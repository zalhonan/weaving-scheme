/**
 * 12-color palette based on Google Material Design.
 * Arranged in 2 rows of 6 colors.
 * White is second (default for cell highlighting).
 */
export const COLOR_PALETTE = [
  // Row 1
  '#000000', // Black (default for lines)
  '#FFFFFF', // White (default for cells)
  '#D32F2F', // Red
  '#1976D2', // Blue
  '#388E3C', // Green
  '#F57C00', // Orange
  // Row 2
  '#7B1FA2', // Purple
  '#0097A7', // Teal
  '#5D4037', // Brown
  '#E91E63', // Pink
  '#607D8B', // Blue Grey
  '#FFC107', // Amber
] as const;

export const DEFAULT_COLOR = COLOR_PALETTE[0];

/**
 * Convert a hex color to a pale (light) version for cell highlighting.
 * Returns a color with 20% opacity effect.
 */
export function getPaleColor(hexColor: string): string {
  // Parse hex color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Mix with white (20% color, 80% white)
  const factor = 0.2;
  const paleR = Math.round(r * factor + 255 * (1 - factor));
  const paleG = Math.round(g * factor + 255 * (1 - factor));
  const paleB = Math.round(b * factor + 255 * (1 - factor));

  return `rgb(${paleR}, ${paleG}, ${paleB})`;
}
