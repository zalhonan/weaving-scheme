import { jsPDF } from 'jspdf';
import { Line, CellHighlight } from '../types';
import { CANVAS_CONSTANTS } from '../constants';

export type PrintOrientation = 'portrait' | 'landscape';

interface PrintOptions {
  width: number;
  height: number;
  lines: Map<string, Line>;
  highlights: CellHighlight[];
  getCellHighlightColor: (cellX: number, cellY: number) => string | null;
  cellsPerPageX?: number;
  orientation?: PrintOrientation;
}

// Page-layout constants. Same on both orientations — only PAGE_WIDTH /
// PAGE_HEIGHT swap.
const MARGIN = 10;
const NUMBER_AREA_MM = 8;
const PAGE_NUMBER_FOOTER_MM = 10;

const DEFAULT_CELLS_PER_PAGE_X = 25;
const DEFAULT_ORIENTATION: PrintOrientation = 'portrait';

// Adaptive-rendering thresholds (millimetres). Each layer disappears or
// degrades when cellSizeMM drops below its threshold. NUMBERS pinned at
// 1.8 mm so that the entire pre-change valid range (cellsPerPage 1..100
// in portrait → cellSizeMM ≥ 1.82) renders byte-identical to before.
const NUMBERS_MIN_CELL_MM = 1.8;
const MINOR_GRID_MIN_CELL_MM = 0.5;
const MAJOR_GRID_MIN_CELL_MM = 0.3;
const USER_LINE_WIDTH_BASE_MM = 0.4;

interface RenderProfileMM {
  showNumbers: boolean;
  showMinorGrid: boolean;
  showMajorGrid: boolean;
  userLineWidth: number;
}

function profileForMM(cellSizeMM: number): RenderProfileMM {
  return {
    showNumbers: cellSizeMM >= NUMBERS_MIN_CELL_MM,
    showMinorGrid: cellSizeMM >= MINOR_GRID_MIN_CELL_MM,
    showMajorGrid: cellSizeMM >= MAJOR_GRID_MIN_CELL_MM,
    // Stroke width never exceeds the prior 0.4 mm default, but shrinks
    // proportionally when cells are sub-millimetre to prevent smearing
    // across multiple adjacent lines.
    userLineWidth: Math.min(USER_LINE_WIDTH_BASE_MM, cellSizeMM * 0.9),
  };
}

interface UsableArea {
  PAGE_WIDTH: number;
  PAGE_HEIGHT: number;
  USABLE_WIDTH: number;
  USABLE_HEIGHT: number;
}

/**
 * Resolve A4 page dimensions and usable drawing area for the given
 * orientation. Exported so the fit-to-page UI can compute cellsPerPage
 * with the same constants the renderer uses.
 */
export function getUsableArea(orientation: PrintOrientation): UsableArea {
  const isLandscape = orientation === 'landscape';
  const PAGE_WIDTH = isLandscape ? 297 : 210;
  const PAGE_HEIGHT = isLandscape ? 210 : 297;
  return {
    PAGE_WIDTH,
    PAGE_HEIGHT,
    USABLE_WIDTH: PAGE_WIDTH - 2 * MARGIN - NUMBER_AREA_MM,
    USABLE_HEIGHT:
      PAGE_HEIGHT - 2 * MARGIN - NUMBER_AREA_MM - PAGE_NUMBER_FOOTER_MM,
  };
}

/**
 * Compute the smallest cellsPerPageX that fits the entire canvas on a
 * single A4 page in the given orientation.
 *
 *   cellsPerPageX = max(width, ceil(height × USABLE_WIDTH / USABLE_HEIGHT))
 *
 * The ceil() guarantees floor(USABLE_HEIGHT / cellSizeMM) ≥ height.
 */
export function fitOnePage(
  width: number,
  height: number,
  orientation: PrintOrientation
): number {
  const { USABLE_WIDTH, USABLE_HEIGHT } = getUsableArea(orientation);
  return Math.max(
    width,
    Math.ceil((height * USABLE_WIDTH) / USABLE_HEIGHT)
  );
}

/**
 * Generate PDF from the scheme.
 */
export function generatePDF(options: PrintOptions): void {
  const {
    width,
    height,
    lines,
    getCellHighlightColor,
    cellsPerPageX = DEFAULT_CELLS_PER_PAGE_X,
    orientation = DEFAULT_ORIENTATION,
  } = options;

  const { PAGE_WIDTH, PAGE_HEIGHT, USABLE_WIDTH, USABLE_HEIGHT } =
    getUsableArea(orientation);

  // Calculate cell size based on desired cells per page horizontally
  const cellSizeMM = USABLE_WIDTH / cellsPerPageX;
  const cellsPerPageY = Math.floor(USABLE_HEIGHT / cellSizeMM);

  // Calculate number of pages needed
  const pagesX = Math.ceil(width / cellsPerPageX);
  const pagesY = Math.ceil(height / cellsPerPageY);
  const totalPages = pagesX * pagesY;

  const profile = profileForMM(cellSizeMM);

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  let pageNum = 0;

  for (let pageY = 0; pageY < pagesY; pageY++) {
    for (let pageX = 0; pageX < pagesX; pageX++) {
      if (pageNum > 0) {
        pdf.addPage();
      }
      pageNum++;

      const startCellX = pageX * cellsPerPageX;
      const startCellY = pageY * cellsPerPageY;
      const endCellX = Math.min(startCellX + cellsPerPageX, width);
      const endCellY = Math.min(startCellY + cellsPerPageY, height);
      const cellsX = endCellX - startCellX;
      const cellsY = endCellY - startCellY;

      const gridStartX = MARGIN + NUMBER_AREA_MM;
      const gridStartY = MARGIN + NUMBER_AREA_MM;

      // Draw cell highlights (layer 1)
      for (let cellX = startCellX; cellX < endCellX; cellX++) {
        for (let cellY = startCellY; cellY < endCellY; cellY++) {
          const color = getCellHighlightColor(cellX, cellY);
          if (color) {
            const rgb = parseColor(color);
            if (rgb) {
              pdf.setFillColor(rgb.r, rgb.g, rgb.b);
              pdf.rect(
                gridStartX + (cellX - startCellX) * cellSizeMM,
                gridStartY + (cellY - startCellY) * cellSizeMM,
                cellSizeMM,
                cellSizeMM,
                'F'
              );
            }
          }
        }
      }

      // Draw grid lines (layer 2) — gated on adaptive profile.
      if (profile.showMinorGrid) {
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.1);

        // Vertical grid lines
        for (let i = 0; i <= cellsX; i++) {
          const x = gridStartX + i * cellSizeMM;
          pdf.line(x, gridStartY, x, gridStartY + cellsY * cellSizeMM);
        }

        // Horizontal grid lines
        for (let i = 0; i <= cellsY; i++) {
          const y = gridStartY + i * cellSizeMM;
          pdf.line(gridStartX, y, gridStartX + cellsX * cellSizeMM, y);
        }
      }

      // Draw major grid lines (every 10 cells) — gated on adaptive profile.
      if (profile.showMajorGrid) {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.2);

        const interval = CANVAS_CONSTANTS.MAJOR_GRID_INTERVAL;

        // Vertical major lines
        for (let i = startCellX; i <= endCellX; i++) {
          if (i % interval === 0) {
            const x = gridStartX + (i - startCellX) * cellSizeMM;
            pdf.line(x, gridStartY, x, gridStartY + cellsY * cellSizeMM);
          }
        }

        // Horizontal major lines
        for (let i = startCellY; i <= endCellY; i++) {
          if (i % interval === 0) {
            const y = gridStartY + (i - startCellY) * cellSizeMM;
            pdf.line(gridStartX, y, gridStartX + cellsX * cellSizeMM, y);
          }
        }
      }

      // Draw numbers (layer 3) — hidden when font would overlap.
      if (profile.showNumbers) {
        pdf.setFontSize(6);
        pdf.setTextColor(100, 100, 100);

        // Column numbers (top)
        for (let i = startCellX; i < endCellX; i++) {
          const x = gridStartX + (i - startCellX) * cellSizeMM + cellSizeMM / 2;
          const y = MARGIN + NUMBER_AREA_MM / 2 + 1;
          pdf.text(String(i), x, y, { align: 'center' });
        }

        // Row numbers (left)
        for (let i = startCellY; i < endCellY; i++) {
          const x = MARGIN + NUMBER_AREA_MM / 2;
          const y = gridStartY + (i - startCellY) * cellSizeMM + cellSizeMM / 2 + 1;
          pdf.text(String(i), x, y, { align: 'center' });
        }
      }

      // Draw user lines (layer 4). Stroke width clamps to cell size at
      // sub-millimetre cells to prevent smearing across neighbours.
      pdf.setLineWidth(profile.userLineWidth);
      pdf.setLineCap('round');

      lines.forEach((line) => {
        // Check if line is in this page's area
        if (line.orientation === 'horizontal') {
          // Horizontal line at row boundary y, spanning cell x
          if (
            line.x >= startCellX &&
            line.x < endCellX &&
            line.y >= startCellY &&
            line.y <= endCellY
          ) {
            const rgb = parseColor(line.color);
            if (rgb) {
              pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
            } else {
              pdf.setDrawColor(0, 0, 0);
            }
            const x1 = gridStartX + (line.x - startCellX) * cellSizeMM;
            const x2 = gridStartX + (line.x - startCellX + 1) * cellSizeMM;
            const y = gridStartY + (line.y - startCellY) * cellSizeMM;
            pdf.line(x1, y, x2, y);
          }
        } else {
          // Vertical line at column boundary x, spanning cell y
          if (
            line.x >= startCellX &&
            line.x <= endCellX &&
            line.y >= startCellY &&
            line.y < endCellY
          ) {
            const rgb = parseColor(line.color);
            if (rgb) {
              pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
            } else {
              pdf.setDrawColor(0, 0, 0);
            }
            const x = gridStartX + (line.x - startCellX) * cellSizeMM;
            const y1 = gridStartY + (line.y - startCellY) * cellSizeMM;
            const y2 = gridStartY + (line.y - startCellY + 1) * cellSizeMM;
            pdf.line(x, y1, x, y2);
          }
        }
      });

      // Draw page number and position
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const pageInfo = totalPages > 1
        ? `Page ${pageNum} / ${totalPages}  [column ${pageX + 1}, row ${pageY + 1}]`
        : 'Page 1';
      pdf.text(pageInfo, PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN / 2, { align: 'center' });
    }
  }

  // Save the PDF
  pdf.save(`weaving-scheme-${Date.now()}.pdf`);
}

/**
 * Parse color string to RGB values.
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
  }

  // Handle rgb() colors
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}
