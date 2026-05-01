import type { Line, SelectionMask } from '../../../types';
import { hasCell } from './maskUtils';

/**
 * Returns lines belonging to the selection under the inclusive-boundary rule:
 * - Horizontal line at (x, y) is included iff cell (x, y-1) ∈ mask
 *   OR cell (x, y) ∈ mask.
 * - Vertical line at (x, y) is included iff cell (x-1, y) ∈ mask
 *   OR cell (x, y) ∈ mask.
 *
 * Pure: does not mutate inputs.
 */
export const getLinesInMask = (
  mask: SelectionMask,
  allLines: Map<string, Line>,
): Line[] => {
  if (mask.size === 0) return [];
  const result: Line[] = [];
  for (const line of allLines.values()) {
    if (line.orientation === 'horizontal') {
      if (hasCell(mask, line.x, line.y - 1) || hasCell(mask, line.x, line.y)) {
        result.push(line);
      }
    } else if (
      hasCell(mask, line.x - 1, line.y) ||
      hasCell(mask, line.x, line.y)
    ) {
      result.push(line);
    }
  }
  return result;
};
