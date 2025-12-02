import { jsPDF } from 'jspdf';
import { Line, CellHighlight } from '../types';
import { CANVAS_CONSTANTS } from '../constants';

interface PrintOptions {
  width: number;
  height: number;
  lines: Map<string, Line>;
  highlights: CellHighlight[];
  getCellHighlightColor: (cellX: number, cellY: number) => string | null;
  cellsPerPageX?: number;
}

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;
const NUMBER_AREA_MM = 8;

// Usable area per page
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN - NUMBER_AREA_MM;
const USABLE_HEIGHT = PAGE_HEIGHT - 2 * MARGIN - NUMBER_AREA_MM - 10; // 10mm for page number

const DEFAULT_CELLS_PER_PAGE_X = 25;

/**
 * Generate PDF from the scheme.
 */
export function generatePDF(options: PrintOptions): void {
  const { width, height, lines, getCellHighlightColor, cellsPerPageX = DEFAULT_CELLS_PER_PAGE_X } = options;

  // Calculate cell size based on desired cells per page horizontally
  const cellSizeMM = USABLE_WIDTH / cellsPerPageX;
  const cellsPerPageY = Math.floor(USABLE_HEIGHT / cellSizeMM);

  // Calculate number of pages needed
  const pagesX = Math.ceil(width / cellsPerPageX);
  const pagesY = Math.ceil(height / cellsPerPageY);
  const totalPages = pagesX * pagesY;

  const pdf = new jsPDF({
    orientation: 'portrait',
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

      // Draw grid lines (layer 2)
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

      // Draw major grid lines (every 10 cells)
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

      // Draw numbers (layer 3)
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

      // Draw user lines (layer 4)
      pdf.setLineWidth(0.4);
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
