import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
}

const CLOSE_ANIMATION_MS = 220;

export const BottomSheet = ({ open, title, onClose, children, closeLabel = 'Close' }: BottomSheetProps) => {
  const headingId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);
  const [dragDistance, setDragDistance] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(false);
      setRendered(true);
      const timeoutId = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(timeoutId);
    }

    setVisible(false);
    const timeoutId = window.setTimeout(() => {
      setRendered(false);
      setDragging(false);
      setDragDistance(0);
      dragDistanceRef.current = 0;
    }, CLOSE_ANIMATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!rendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [rendered]);

  useEffect(() => {
    if (!rendered) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, rendered]);

  const height = sheetRef.current?.offsetHeight ?? 0;
  const dragThreshold = Math.max(96, Math.min(180, Math.round(height * 0.25)));

  if (!rendered) {
    return null;
  }

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const onHandlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startYRef.current = event.clientY;
    dragDistanceRef.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const distance = Math.max(0, event.clientY - startYRef.current);
    dragDistanceRef.current = distance;
    setDragDistance(distance);
  };

  const onHandlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || pointerIdRef.current !== event.pointerId) {
      return;
    }

    pointerIdRef.current = null;
    setDragging(false);

    if (dragDistanceRef.current >= dragThreshold) {
      onClose();
      return;
    }

    dragDistanceRef.current = 0;
    setDragDistance(0);
  };

  const translateY = visible ? dragDistance : window.innerHeight;

  return createPortal(
    <div className={`sheet-overlay ${visible ? 'sheet-overlay--open' : ''}`} onClick={onBackdropClick}>
      <section
        ref={sheetRef}
        className={`sheet ${dragging ? 'sheet--dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{ transform: `translateY(${translateY}px)` }}
      >
        <button
          type="button"
          className="sheet-handle-hitbox"
          aria-label="Drag to close"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
        >
          <span className="sheet-handle" />
        </button>

        <div className="sheet-header">
          <h3 id={headingId}>{title}</h3>
          <button type="button" className="button-secondary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>

        <div className="sheet-content">{children}</div>
      </section>
    </div>,
    document.body
  );
};
