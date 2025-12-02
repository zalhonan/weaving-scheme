export interface CanvasSize {
  width: number;
  height: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CanvasStatistics {
  size: CanvasSize;
  boundingBox: BoundingBox | null;
  horizontalLineCount: number;
  verticalLineCount: number;
  totalLineCount: number;
}

export interface ResizeDeltas {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
