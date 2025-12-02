/**
 * Convert hex color to pale version for cell highlighting.
 * Increases lightness while preserving hue.
 */
export function toPaleColor(hex: string, opacity: number = 0.25): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
