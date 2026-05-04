import { describe, it, expect, beforeEach, vi } from 'vitest';

// Recording jsPDF stub. The `calls` array is hoisted via vi.hoisted so the
// vi.mock factory and the test bodies share the same reference.
const { calls } = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
}));

vi.mock('jspdf', () => {
  class StubPDF {
    constructor(opts: unknown) {
      calls.push({ method: '__ctor', args: [opts] });
    }
    addPage(...args: unknown[]) { calls.push({ method: 'addPage', args }); }
    setFillColor(...args: unknown[]) { calls.push({ method: 'setFillColor', args }); }
    setDrawColor(...args: unknown[]) { calls.push({ method: 'setDrawColor', args }); }
    setLineWidth(...args: unknown[]) { calls.push({ method: 'setLineWidth', args }); }
    setLineCap(...args: unknown[]) { calls.push({ method: 'setLineCap', args }); }
    setFontSize(...args: unknown[]) { calls.push({ method: 'setFontSize', args }); }
    setTextColor(...args: unknown[]) { calls.push({ method: 'setTextColor', args }); }
    rect(...args: unknown[]) { calls.push({ method: 'rect', args }); }
    line(...args: unknown[]) { calls.push({ method: 'line', args }); }
    text(...args: unknown[]) { calls.push({ method: 'text', args }); }
    save(...args: unknown[]) { calls.push({ method: 'save', args }); }
  }
  return { jsPDF: StubPDF };
});

import {
  generatePDF,
  fitOnePage,
  getUsableArea,
} from '../../src/utils/printPDF';
import type { Line } from '../../src/types';
import { getLineKey } from '../../src/types';

const seedLines = (
  entries: Array<Omit<Line, 'color'> & { color?: string }>
): Map<string, Line> => {
  const m = new Map<string, Line>();
  for (const e of entries) {
    const line: Line = { ...e, color: e.color ?? '#000000' };
    m.set(getLineKey(e.x, e.y, e.orientation), line);
  }
  return m;
};

const countCalls = (method: string) =>
  calls.filter((c) => c.method === method).length;

const findArgs = (method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.args);

beforeEach(() => {
  calls.length = 0;
});

describe('printPDF — fitOnePage math (pure function)', () => {
  it('100×100 portrait → 100 (X-binding, square)', () => {
    expect(fitOnePage(100, 100, 'portrait')).toBe(100);
  });

  it('100×200 portrait → 141 (Y-binding)', () => {
    // ceil(200 × 182 / 259) = ceil(140.54) = 141
    expect(fitOnePage(100, 200, 'portrait')).toBe(141);
  });

  it('1000×1000 portrait → 1000 (X-binding)', () => {
    expect(fitOnePage(1000, 1000, 'portrait')).toBe(1000);
  });

  it('500×1000 portrait → 704 (Y-binding)', () => {
    // ceil(1000 × 182 / 259) = ceil(702.7) = 703
    // max(500, 703) = 703
    expect(fitOnePage(500, 1000, 'portrait')).toBe(703);
  });

  it('1000×500 landscape → 1000 (X-binding, better than portrait)', () => {
    // ceil(500 × 269 / 172) = ceil(782.0) = 782
    // max(1000, 782) = 1000
    expect(fitOnePage(1000, 500, 'landscape')).toBe(1000);
  });

  it('500×1000 landscape → 1564 (Y-binding, worse than portrait)', () => {
    // ceil(1000 × 269 / 172) = ceil(1563.95) = 1564
    expect(fitOnePage(500, 1000, 'landscape')).toBe(1564);
  });

  it('result satisfies the fit invariant: cellsPerPageY ≥ height', () => {
    const cases: Array<[number, number, 'portrait' | 'landscape']> = [
      [100, 100, 'portrait'],
      [100, 200, 'portrait'],
      [1000, 1000, 'portrait'],
      [500, 1000, 'portrait'],
      [1000, 500, 'landscape'],
      [500, 1000, 'landscape'],
      [1, 259, 'portrait'],
      [37, 113, 'landscape'],
    ];
    for (const [w, h, orient] of cases) {
      const cppx = fitOnePage(w, h, orient);
      const { USABLE_WIDTH, USABLE_HEIGHT } = getUsableArea(orient);
      const cellSizeMM = USABLE_WIDTH / cppx;
      const cppy = Math.floor(USABLE_HEIGHT / cellSizeMM);
      expect(cppx).toBeGreaterThanOrEqual(w);
      expect(cppy).toBeGreaterThanOrEqual(h);
    }
  });
});

describe('printPDF — getUsableArea', () => {
  it('portrait: 210×297, usable 182×259', () => {
    const a = getUsableArea('portrait');
    expect(a.PAGE_WIDTH).toBe(210);
    expect(a.PAGE_HEIGHT).toBe(297);
    expect(a.USABLE_WIDTH).toBe(182);
    expect(a.USABLE_HEIGHT).toBe(259);
  });

  it('landscape: 297×210, usable 269×172', () => {
    const a = getUsableArea('landscape');
    expect(a.PAGE_WIDTH).toBe(297);
    expect(a.PAGE_HEIGHT).toBe(210);
    expect(a.USABLE_WIDTH).toBe(269);
    expect(a.USABLE_HEIGHT).toBe(172);
  });
});

describe('printPDF — pre-change valid range regression (cellsPerPage 1..100, portrait)', () => {
  // Fixed seed used across these tests.
  const fixedScheme = () => ({
    width: 20,
    height: 20,
    lines: seedLines([
      { x: 1, y: 2, orientation: 'horizontal' },
      { x: 3, y: 4, orientation: 'vertical' },
      { x: 5, y: 5, orientation: 'horizontal' },
    ]),
    highlights: [],
    getCellHighlightColor: (cx: number, cy: number) =>
      cx === 5 && cy === 5 ? '#FFE0E0' : null,
  });

  it.each([1, 25, 50, 100])(
    'cellsPerPage=%d portrait fires expected layers (numbers, minor grid, major grid, user lines)',
    (cellsPerPage) => {
      generatePDF({ ...fixedScheme(), cellsPerPageX: cellsPerPage });

      // numbers (text) are visible — threshold is 1.8 mm and cellSizeMM ≥ 1.82
      // for cellsPerPage ≤ 100 in portrait. Pre-change behavior preserved.
      expect(countCalls('text')).toBeGreaterThan(0);

      // minor + major grid both fire (cellSizeMM well above their thresholds)
      expect(countCalls('line')).toBeGreaterThan(0);

      // user-line stroke width is the legacy default 0.4 (no clamp at these sizes)
      const lineWidthCalls = findArgs('setLineWidth');
      const userLineWidthCall = lineWidthCalls.find(
        (a) => Math.abs((a[0] as number) - 0.4) < 1e-9
      );
      expect(userLineWidthCall).toBeDefined();
    }
  );

  it('default orientation matches explicit portrait (call sequence equal)', () => {
    generatePDF({ ...fixedScheme(), cellsPerPageX: 25 });
    const a = [...calls];
    calls.length = 0;
    generatePDF({ ...fixedScheme(), cellsPerPageX: 25, orientation: 'portrait' });
    const b = [...calls];

    // Drop save() filenames (timestamped) — compare everything else.
    const stripSave = (xs: typeof calls) =>
      xs.filter((c) => c.method !== 'save').map((c) => ({
        method: c.method,
        args: JSON.stringify(c.args),
      }));
    expect(stripSave(a)).toEqual(stripSave(b));
  });

  it('cellsPerPage=100 portrait still draws numbers (regression: threshold 1.8 not 2.0)', () => {
    // cellSizeMM = 182/100 = 1.82 — must be on the "show" side of 1.8.
    generatePDF({ ...fixedScheme(), cellsPerPageX: 100 });
    expect(countCalls('text')).toBeGreaterThan(0);
  });
});

describe('printPDF — adaptive thresholds (new behavior)', () => {
  const fixedScheme = () => ({
    width: 100,
    height: 100,
    lines: seedLines([{ x: 1, y: 1, orientation: 'horizontal' }]),
    highlights: [],
    getCellHighlightColor: () => null,
  });

  it('cellsPerPage=120 portrait hides numbers (cellSizeMM ≈ 1.52 < 1.8)', () => {
    // Note: only the page-number footer "Page N / M" text. Numbers in the
    // grid (column/row labels) should be skipped.
    generatePDF({ ...fixedScheme(), cellsPerPageX: 120 });
    // The page footer fires text() once per page. Without adaptive,
    // cellsPerPage=120, width=100 → 1 page would include 100 column labels
    // + 100 row labels + 1 footer = 201 text calls. With adaptive: 1 footer.
    expect(countCalls('text')).toBe(1);
  });

  it('cellsPerPage=400 portrait hides minor grid (cellSizeMM = 0.455 < 0.5)', () => {
    generatePDF({ ...fixedScheme(), cellsPerPageX: 400 });
    // Without minor grid: only major grid + user lines fire pdf.line.
    // Need to compare against a render at cellsPerPage where minor grid IS on.
    const linesAt400 = countCalls('line');
    calls.length = 0;
    generatePDF({ ...fixedScheme(), cellsPerPageX: 25 });
    const linesAt25 = countCalls('line');
    expect(linesAt400).toBeLessThan(linesAt25);
  });

  it('cellsPerPage=700 portrait hides major grid too (cellSizeMM ≈ 0.26 < 0.3)', () => {
    generatePDF({ ...fixedScheme(), cellsPerPageX: 700 });
    // At width=height=100, cellsPerPageY = floor(USABLE_H / cellSizeMM) is
    // huge — 1 page. With both grids hidden, the only pdf.line calls come
    // from user lines (1 line in our scheme).
    expect(countCalls('line')).toBe(1);
  });

  it('cellsPerPage=1000 portrait clamps user-line width', () => {
    generatePDF({ ...fixedScheme(), cellsPerPageX: 1000 });
    // cellSizeMM = 0.182 → userLineWidth = min(0.4, 0.182 × 0.9) = 0.164
    const setLineWidthArgs = findArgs('setLineWidth');
    const clamped = setLineWidthArgs.find(
      (a) => Math.abs((a[0] as number) - 0.182 * 0.9) < 1e-9
    );
    expect(clamped).toBeDefined();
  });

  it('cellsPerPage=1000 portrait does NOT clamp grid widths (those are 0.1 / 0.2)', () => {
    generatePDF({ ...fixedScheme(), cellsPerPageX: 1000 });
    // Grids are hidden at this cell size, so no setLineWidth(0.1) or 0.2 calls.
    const setLineWidthArgs = findArgs('setLineWidth');
    expect(setLineWidthArgs.find((a) => a[0] === 0.1)).toBeUndefined();
    expect(setLineWidthArgs.find((a) => a[0] === 0.2)).toBeUndefined();
  });
});

describe('printPDF — landscape orientation', () => {
  const fixedScheme = () => ({
    width: 20,
    height: 20,
    lines: new Map<string, Line>(),
    highlights: [],
    getCellHighlightColor: () => null,
  });

  it('passes orientation: landscape to jsPDF constructor', () => {
    generatePDF({ ...fixedScheme(), orientation: 'landscape' });
    const ctor = calls.find((c) => c.method === '__ctor');
    expect(ctor).toBeDefined();
    expect((ctor!.args[0] as { orientation: string }).orientation).toBe('landscape');
  });

  it('page-number footer lands at PAGE_HEIGHT - MARGIN/2 = 205 in landscape', () => {
    generatePDF({ ...fixedScheme(), orientation: 'landscape' });
    // pdf.text(pageInfo, PAGE_WIDTH/2, PAGE_HEIGHT - MARGIN/2, ...)
    // landscape: PAGE_WIDTH=297, PAGE_HEIGHT=210 → footer at (148.5, 205).
    const textArgs = findArgs('text');
    const footer = textArgs.find((a) => a[2] === 205);
    expect(footer).toBeDefined();
    expect(footer![1]).toBe(148.5); // PAGE_WIDTH / 2
  });
});

describe('printPDF — lifted-cap acceptance', () => {
  it('cellsPerPage=1000 on 1000×1000 canvas produces exactly 1 page, no throw', () => {
    expect(() => {
      generatePDF({
        width: 1000,
        height: 1000,
        lines: seedLines([
          { x: 100, y: 200, orientation: 'horizontal' },
          { x: 500, y: 500, orientation: 'vertical' },
        ]),
        highlights: [],
        getCellHighlightColor: () => null,
        cellsPerPageX: 1000,
      });
    }).not.toThrow();
    // Single page → addPage never called.
    expect(countCalls('addPage')).toBe(0);
    expect(countCalls('save')).toBe(1);
  });
});
