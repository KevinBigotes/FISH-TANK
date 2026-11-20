import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, canvasPoint, containsInk, paintStroke, replayDrawing } from '../drawing/canvas-model.js';

export const DrawingCanvas = forwardRef(function DrawingCanvas({ color, brushWidth, tool, disabled, onChange }, ref) {
  const canvasRef = useRef(null);
  const commands = useRef([]);
  const active = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  function reportChange() {
    const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
    const ink = containsInk(context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    setHasInk(ink);
    onChange({ hasInk: ink, canUndo: commands.current.length > 0 });
  }

  function finishStroke(event) {
    if (!active.current || active.current.pointerId !== event.pointerId) return;
    commands.current.push(active.current.stroke);
    active.current = null;
    if (canvasRef.current.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
    reportChange();
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (disabled || active.current || !commands.current.length) return;
      commands.current.pop();
      replayDrawing(canvasRef.current.getContext('2d'), commands.current);
      reportChange();
    },
    clear() {
      if (disabled || active.current || !hasInk) return;
      commands.current.push({ type: 'clear' });
      canvasRef.current.getContext('2d').clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      reportChange();
    },
    async exportPng() {
      if (active.current) throw new Error('Termina el trazo antes de enviar.');
      const canvas = canvasRef.current;
      if (!containsInk(canvas.getContext('2d').getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT))) {
        throw new Error('Dibuja algo antes de soltar tu pez.');
      }
      // Solo se exporta el canvas transparente. La guía vive en otro elemento.
      return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob)
        : reject(new Error('No pudimos preparar el PNG. Intenta de nuevo.')), 'image/png'));
    },
  }));

  useEffect(() => {
    function beforeUnload(event) { if (hasInk) event.preventDefault(); }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasInk]);

  function pointerDown(event) {
    if (disabled || active.current || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    const stroke = { type: 'stroke', tool, color, width: tool === 'eraser' ? Math.max(brushWidth, 28) : brushWidth,
      points: [canvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect())] };
    active.current = { pointerId: event.pointerId, stroke };
    paintStroke(canvas.getContext('2d', { willReadFrequently: true }), stroke);
  }

  function pointerMove(event) {
    const current = active.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    for (const pointEvent of coalesced?.length ? coalesced : [event]) {
      const point = canvasPoint(pointEvent.clientX, pointEvent.clientY, rect);
      const previous = current.stroke.points.at(-1);
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.5) continue;
      current.stroke.points.push(point);
      paintStroke(canvas.getContext('2d'), { ...current.stroke, points: [previous, point] });
    }
  }

  return <div className={`drawing-surface ${disabled ? 'opacity-70' : ''}`}>
    <svg className="fish-guide" viewBox="0 0 1024 768" aria-hidden="true">
      <path d="M260 383 140 266v237l120-120c102-146 321-160 480 0-159 160-378 145-480 0Z" />
      <path d="m390 280 60-84 88 57M410 499l59 73 62-61M620 304c-32 44-32 115 0 158" />
      <circle cx="661" cy="359" r="12" />
    </svg>
    <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className={`drawing-canvas ${tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
      aria-label="Lienzo para dibujar un pez mirando a la derecha. Usa el dedo, lápiz táctil o ratón."
      aria-disabled={disabled} onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={finishStroke} onPointerCancel={finishStroke} onLostPointerCapture={finishStroke}>
      Tu navegador necesita soporte de HTML5 Canvas para dibujar.
    </canvas>
    {!hasInk && <span className="canvas-hint" aria-hidden="true">Imagina un pez. Dale tu color.</span>}
  </div>;
});
