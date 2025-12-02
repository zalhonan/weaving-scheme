import { useState, useEffect } from 'react';
import { useCanvasStore } from '../../store';
import styles from './Sidebar.module.css';

export const CanvasSizeControl: React.FC = () => {
  const { width, height, resizeCanvas, setCanvasSize } = useCanvasStore();

  // Exact size inputs - sync with current canvas size
  const [exactWidth, setExactWidth] = useState(width);
  const [exactHeight, setExactHeight] = useState(height);

  // Update exact inputs when canvas size changes externally
  useEffect(() => {
    setExactWidth(width);
    setExactHeight(height);
  }, [width, height]);

  const [inputValues, setInputValues] = useState({
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    all: 10,
  });

  const handleInputChange = (
    side: 'top' | 'bottom' | 'left' | 'right' | 'all',
    value: string
  ) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setInputValues((prev) => ({ ...prev, [side]: num }));
    }
  };

  const handleResize = (
    side: 'top' | 'bottom' | 'left' | 'right' | 'all',
    delta: number
  ) => {
    resizeCanvas(side, delta);
  };

  const handleSetExactSize = () => {
    const newW = Math.max(1, Math.min(200, exactWidth));
    const newH = Math.max(1, Math.min(200, exactHeight));
    setCanvasSize(newW, newH);
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Размер канвы</h3>

      {/* Exact size setting */}
      <div className={styles.exactSizeControl}>
        <div className={styles.exactSizeInputs}>
          <div className={styles.exactSizeField}>
            <label className={styles.exactSizeLabel}>Ширина</label>
            <input
              type="number"
              className={styles.exactSizeInput}
              value={exactWidth}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setExactWidth(val);
              }}
              min={1}
              max={200}
            />
          </div>
          <span className={styles.exactSizeSeparator}>×</span>
          <div className={styles.exactSizeField}>
            <label className={styles.exactSizeLabel}>Высота</label>
            <input
              type="number"
              className={styles.exactSizeInput}
              value={exactHeight}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setExactHeight(val);
              }}
              min={1}
              max={200}
            />
          </div>
        </div>
        <button
          className={styles.exactSizeButton}
          onClick={handleSetExactSize}
          disabled={exactWidth === width && exactHeight === height}
        >
          Установить
        </button>
      </div>

      {/* Relative controls */}
      <div className={styles.relativeSizeLabel}>Добавить/убрать клетки:</div>
      <div className={styles.sizeControlCross}>
        {/* Top */}
        <div className={styles.sizeControlRow}>
          <div className={styles.sizeControlCell} />
          <div className={styles.sizeControlCell}>
            <div className={styles.sizeControlGroup}>
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('top', -inputValues.top)}
                title="Уменьшить сверху"
              >
                −
              </button>
              <input
                type="number"
                className={styles.sizeInput}
                value={inputValues.top}
                onChange={(e) => handleInputChange('top', e.target.value)}
                min={1}
                max={100}
              />
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('top', inputValues.top)}
                title="Увеличить сверху"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.sizeControlCell} />
        </div>

        {/* Middle row: Left - Center - Right */}
        <div className={styles.sizeControlRow}>
          <div className={styles.sizeControlCell}>
            <div className={styles.sizeControlGroup}>
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('left', -inputValues.left)}
                title="Уменьшить слева"
              >
                −
              </button>
              <input
                type="number"
                className={styles.sizeInput}
                value={inputValues.left}
                onChange={(e) => handleInputChange('left', e.target.value)}
                min={1}
                max={100}
              />
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('left', inputValues.left)}
                title="Увеличить слева"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.sizeControlCell}>
            <div className={styles.sizeControlGroupCenter}>
              <button
                className={styles.sizeButtonCenter}
                onClick={() => handleResize('all', -inputValues.all)}
                title="Уменьшить со всех сторон"
              >
                −
              </button>
              <input
                type="number"
                className={styles.sizeInputCenter}
                value={inputValues.all}
                onChange={(e) => handleInputChange('all', e.target.value)}
                min={1}
                max={100}
              />
              <button
                className={styles.sizeButtonCenter}
                onClick={() => handleResize('all', inputValues.all)}
                title="Увеличить со всех сторон"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.sizeControlCell}>
            <div className={styles.sizeControlGroup}>
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('right', -inputValues.right)}
                title="Уменьшить справа"
              >
                −
              </button>
              <input
                type="number"
                className={styles.sizeInput}
                value={inputValues.right}
                onChange={(e) => handleInputChange('right', e.target.value)}
                min={1}
                max={100}
              />
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('right', inputValues.right)}
                title="Увеличить справа"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className={styles.sizeControlRow}>
          <div className={styles.sizeControlCell} />
          <div className={styles.sizeControlCell}>
            <div className={styles.sizeControlGroup}>
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('bottom', -inputValues.bottom)}
                title="Уменьшить снизу"
              >
                −
              </button>
              <input
                type="number"
                className={styles.sizeInput}
                value={inputValues.bottom}
                onChange={(e) => handleInputChange('bottom', e.target.value)}
                min={1}
                max={100}
              />
              <button
                className={styles.sizeButton}
                onClick={() => handleResize('bottom', inputValues.bottom)}
                title="Увеличить снизу"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.sizeControlCell} />
        </div>
      </div>
    </div>
  );
};
