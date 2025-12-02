export type HighlightType = 'row' | 'col';

/**
 * Highlight for entire row or column of cells.
 * Applied via click on row/column number.
 *
 * Order matters: highlights are stored in application order.
 * On intersection of highlighted row and column, the LAST applied wins.
 */
export interface CellHighlight {
  type: HighlightType;
  index: number;
  color: string;
  timestamp: number;
}
