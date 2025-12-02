/**
 * Touch gesture recognition utilities
 * Handles multi-touch gestures for mobile canvas interaction
 */

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureState {
  mode: 'none' | 'pending' | 'drawing' | 'erasing' | 'panning' | 'zooming';
  touches: TouchPoint[];
  initialDistance: number | null;
  initialMidpoint: { x: number; y: number } | null;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  startTimestamp: number | null;
}

// Timing constants
export const GESTURE_DELAY_MS = 50; // Delay to distinguish single from multi-touch
export const LONG_PRESS_DURATION_MS = 300; // Duration for long press (erase mode)
export const TAP_MAX_DURATION_MS = 200; // Max duration for a tap gesture
export const TAP_MAX_MOVEMENT_PX = 10; // Max movement during tap

/**
 * Calculate distance between two touch points
 */
export function getDistance(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate midpoint between two touch points
 */
export function getMidpoint(p1: TouchPoint, p2: TouchPoint): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Convert TouchList to array of TouchPoints
 * Works with both native TouchList and React.TouchList
 */
export function touchListToPoints(
  touches: React.TouchList | TouchList,
  rect: DOMRect
): TouchPoint[] {
  const points: TouchPoint[] = [];
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    points.push({
      id: touch.identifier,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      timestamp: Date.now(),
    });
  }
  return points;
}

/**
 * Create initial gesture state
 */
export function createInitialGestureState(): GestureState {
  return {
    mode: 'none',
    touches: [],
    initialDistance: null,
    initialMidpoint: null,
    longPressTimer: null,
    startTimestamp: null,
  };
}

/**
 * Calculate zoom scale factor from pinch gesture
 */
export function calculatePinchScale(
  currentDistance: number,
  initialDistance: number
): number {
  if (initialDistance === 0) return 1;
  return currentDistance / initialDistance;
}

/**
 * Calculate pan delta from two-finger gesture
 */
export function calculatePanDelta(
  currentMidpoint: { x: number; y: number },
  initialMidpoint: { x: number; y: number }
): { dx: number; dy: number } {
  return {
    dx: currentMidpoint.x - initialMidpoint.x,
    dy: currentMidpoint.y - initialMidpoint.y,
  };
}

/**
 * Detect if this is a tap gesture (quick touch without movement)
 */
export function isTapGesture(
  startPoint: TouchPoint,
  endPoint: TouchPoint,
  duration: number
): boolean {
  const distance = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) +
    Math.pow(endPoint.y - startPoint.y, 2)
  );
  return duration < TAP_MAX_DURATION_MS && distance < TAP_MAX_MOVEMENT_PX;
}

/**
 * Count number of fingers in a multi-tap gesture
 */
export function countTapFingers(touches: TouchPoint[]): number {
  return touches.length;
}

/**
 * Check if device supports touch
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check if device is mobile (phone/tablet)
 */
export function isMobileDevice(): boolean {
  // Check for touch support AND screen size
  const hasTouch = isTouchDevice();
  const isSmallScreen = window.innerWidth <= 1024;
  const hasMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return hasTouch && (isSmallScreen || hasMobileUA);
}

/**
 * Get vibration support and trigger haptic feedback
 */
export function triggerHapticFeedback(duration: number = 10): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}
