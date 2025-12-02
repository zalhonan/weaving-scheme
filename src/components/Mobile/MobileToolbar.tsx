import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useUIStore, useCanvasStore, useTemporalStore } from '../../store';
import { COLOR_PALETTE, ERASER_TOOL, isEraser } from '../../constants/colors';
import styles from './MobileToolbar.module.css';

export const MobileToolbar: React.FC = () => {
  const {
    mobileToolbarCollapsed,
    mobileToolbarPosition,
    toggleMobileToolbar,
    setMobileToolbarPosition,
    toggleSidebar,
    setShowGestureHints,
  } = useUIStore();

  const { currentColor, setCurrentColor } = useCanvasStore();

  const temporalStore = useTemporalStore;

  const canUndo = useSyncExternalStore(
    temporalStore.subscribe,
    () => temporalStore.getState().pastStates.length > 0
  );

  const canRedo = useSyncExternalStore(
    temporalStore.subscribe,
    () => temporalStore.getState().futureStates.length > 0
  );

  const undo = () => temporalStore.getState().undo();
  const redo = () => temporalStore.getState().redo();

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Color picker popup
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleDragStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      dragOffset.current = {
        x: clientX - mobileToolbarPosition.x,
        y: clientY - mobileToolbarPosition.y,
      };
      setIsDragging(true);
    },
    [mobileToolbarPosition]
  );

  const handleDragMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const newX = Math.max(0, Math.min(window.innerWidth - 60, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, clientY - dragOffset.current.y));

      setMobileToolbarPosition(newX, newY);
    },
    [isDragging, setMobileToolbarPosition]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global move/end handlers when dragging
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e);

      const moveHandler = (ev: TouchEvent) => handleDragMove(ev);
      const endHandler = () => {
        handleDragEnd();
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', endHandler);
      };

      document.addEventListener('touchmove', moveHandler, { passive: false });
      document.addEventListener('touchend', endHandler);
    },
    [handleDragStart, handleDragMove, handleDragEnd]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleDragStart(e);

      const moveHandler = (ev: MouseEvent) => handleDragMove(ev);
      const endHandler = () => {
        handleDragEnd();
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', endHandler);
      };

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', endHandler);
    },
    [handleDragStart, handleDragMove, handleDragEnd]
  );

  if (mobileToolbarCollapsed) {
    return (
      <button
        className={styles.collapsedButton}
        style={{
          left: mobileToolbarPosition.x,
          top: mobileToolbarPosition.y,
        }}
        onClick={toggleMobileToolbar}
        aria-label="Развернуть панель"
      >
        <span className={styles.menuIcon}>☰</span>
      </button>
    );
  }

  return (
    <div
      ref={toolbarRef}
      className={styles.toolbar}
      style={{
        left: mobileToolbarPosition.x,
        top: mobileToolbarPosition.y,
      }}
    >
      {/* Drag handle */}
      <div
        className={styles.dragHandle}
        onTouchStart={handleTouchStart}
        onMouseDown={handleMouseDown}
      >
        <span className={styles.dragIcon}>⋮⋮</span>
      </div>

      {/* Collapse button */}
      <button
        className={styles.toolButton}
        onClick={toggleMobileToolbar}
        aria-label="Свернуть панель"
      >
        <span className={styles.icon}>✕</span>
      </button>

      {/* Undo button */}
      <button
        className={`${styles.toolButton} ${!canUndo ? styles.disabled : ''}`}
        onClick={() => canUndo && undo()}
        disabled={!canUndo}
        aria-label="Отменить"
      >
        <span className={styles.icon}>↶</span>
      </button>

      {/* Redo button */}
      <button
        className={`${styles.toolButton} ${!canRedo ? styles.disabled : ''}`}
        onClick={() => canRedo && redo()}
        disabled={!canRedo}
        aria-label="Повторить"
      >
        <span className={styles.icon}>↷</span>
      </button>

      {/* Current color / color picker */}
      <button
        className={`${styles.colorButton} ${isEraser(currentColor) ? styles.eraserButton : ''}`}
        style={isEraser(currentColor) ? { backgroundColor: '#FFFFFF' } : { backgroundColor: currentColor }}
        onClick={() => setShowColorPicker(!showColorPicker)}
        aria-label={isEraser(currentColor) ? 'Ластик' : 'Выбрать цвет'}
      >
        {isEraser(currentColor) && (
          <svg
            className={styles.eraserIconSmall}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L21 10C21.5 10.5 21.5 11.5 21 12L13 20" />
            <path d="M6 11L13 18" />
          </svg>
        )}
      </button>

      {/* Menu button */}
      <button
        className={styles.toolButton}
        onClick={toggleSidebar}
        aria-label="Открыть меню"
      >
        <span className={styles.icon}>☰</span>
      </button>

      {/* Help button */}
      <button
        className={styles.toolButton}
        onClick={() => setShowGestureHints(true)}
        aria-label="Справка по жестам"
      >
        <span className={styles.icon}>?</span>
      </button>

      {/* Color picker popup */}
      {showColorPicker && (
        <div className={styles.colorPicker}>
          {COLOR_PALETTE.map((color) => {
            const isEraserItem = color === ERASER_TOOL;
            return (
              <button
                key={color}
                className={`${styles.colorSwatch} ${
                  currentColor === color ? styles.colorSwatchSelected : ''
                } ${isEraserItem ? styles.eraserSwatchMobile : ''}`}
                style={isEraserItem ? { backgroundColor: '#FFFFFF' } : { backgroundColor: color }}
                onClick={() => {
                  setCurrentColor(color);
                  setShowColorPicker(false);
                }}
                aria-label={isEraserItem ? 'Ластик' : `Цвет ${color}`}
              >
                {isEraserItem && (
                  <svg
                    className={styles.eraserIconSmall}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L21 10C21.5 10.5 21.5 11.5 21 12L13 20" />
                    <path d="M6 11L13 18" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
