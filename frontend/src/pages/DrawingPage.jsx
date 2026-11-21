import { useCallback, useEffect, useRef, useState } from 'react';
import { BRUSHES, COLORS } from '../drawing/canvas-model.js';
import { DrawingCanvas } from '../components/DrawingCanvas.jsx';
import { FishPostcard } from '../components/FishPostcard.jsx';
import { drawingCapabilities, publishFish } from '../services/drawing-api.js';
import { submissionUuid } from '../lib/network.js';

export function DrawingPage() {
  const canvas = useRef(null);
  const submissionId = useRef(null);
  const [color, setColor] = useState(COLORS[0][0]);
  const [brushWidth, setBrushWidth] = useState(14);
  const [tool, setTool] = useState('brush');
  const [drawing, setDrawing] = useState({ hasInk: false, canUndo: false });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCapabilities(null);
    drawingCapabilities(controller.signal).then((data) => { if (!controller.signal.aborted) setCapabilities(data); }).catch(() => {});
    return () => controller.abort();
  }, [attempt]);

  const changed = useCallback((state) => {
    setDrawing(state); setError(''); submissionId.current = null;
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy || !capabilities?.ready) return;
    setBusy(true); setError('');
    try {
      const png = await canvas.current.exportPng();
      if (!submissionId.current) submissionId.current = submissionUuid();
      const saved = await publishFish({ name, png, submissionId: submissionId.current });
      setResult(saved);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  if (result) return <FishPostcard result={result} />;
  return <div className="drawing-page">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow text-teal">EL OCÉANO EMPIEZA EN TUS MANOS</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ocean md:text-4xl">Dale vida a tu pez.</h1>
        <p className="mt-2 text-slate-600">Dibuja con el dedo o el ratón. La cabeza mira hacia la derecha.</p>
      </div>
      <span className="rounded-full border border-line bg-white px-4 py-2 text-sm text-teal">Cada trazo cuenta</span>
    </div>

    <form onSubmit={submit} className="drawing-layout">
      <section className="canvas-panel" aria-label="Taller de dibujo">
        <div className="canvas-topbar">
          <span className="text-sm font-medium text-ocean">Tu lienzo</span>
          <div className="flex gap-1">
            <button type="button" className="tool-button" disabled={busy || !drawing.canUndo} onClick={() => canvas.current.undo()}>Deshacer</button>
            <button type="button" className="tool-button" disabled={busy || !drawing.hasInk} onClick={() => canvas.current.clear()}>Limpiar</button>
          </div>
        </div>
        <DrawingCanvas ref={canvas} color={color} brushWidth={brushWidth} tool={tool} disabled={busy} onChange={changed} />
        <p className="px-4 py-3 text-sm leading-relaxed text-slate-500">La silueta es solo una guía: tu PNG tendrá fondo transparente y conservará únicamente tus trazos.</p>
      </section>

      <aside className="drawing-controls" aria-label="Herramientas y publicación">
        <fieldset disabled={busy} className="space-y-6">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ocean">Tu paleta</legend>
            <div className="drawing-palette">{COLORS.map(([value, label]) => <button key={value} type="button" className={`palette-button ${color === value && tool === 'brush' ? 'chosen' : ''}`}
              aria-label={label} aria-pressed={color === value && tool === 'brush'} onClick={() => { setColor(value); setTool('brush'); }}>
              <span style={{ backgroundColor: value }} />
            </button>)}</div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ocean">Grosor del trazo</legend>
            <div className="grid grid-cols-3 gap-2">{BRUSHES.map((brush) => <button key={brush.width} type="button" className={`brush-button ${brushWidth === brush.width ? 'chosen' : ''}`}
              aria-pressed={brushWidth === brush.width} onClick={() => setBrushWidth(brush.width)}>
              <span aria-hidden="true" className="mx-auto mb-2 block rounded-full bg-current" style={{ width: Math.max(3, brush.width / 2), height: Math.max(3, brush.width / 2) }} />{brush.name}
            </button>)}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Herramienta activa">
            <button className={`tool-choice ${tool === 'brush' ? 'chosen' : ''}`} type="button" aria-pressed={tool === 'brush'} onClick={() => setTool('brush')}>Pincel</button>
            <button className={`tool-choice ${tool === 'eraser' ? 'chosen' : ''}`} type="button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>Borrador</button>
          </div>
          <div className="border-t border-line pt-5">
            <label htmlFor="fish-name">¿Cómo se llama tu pez?</label>
            <input id="fish-name" name="fishName" value={name} required maxLength={80} placeholder="Por ejemplo, Burbuja" autoComplete="off"
              onChange={(event) => { setName(event.target.value); submissionId.current = null; }} />
          </div>
        </fieldset>

        {!capabilities && <p role="status" className="mt-5 text-sm text-slate-500">Conectando con la exposición… El primer inicio puede tardar un minuto. Puedes seguir dibujando.</p>}
        {capabilities && !capabilities.ready && <div className="message warning mt-5" role="status">
          <p>{capabilities.reason} Puedes seguir dibujando.</p>
          <button type="button" className="text-link mt-2" onClick={() => setAttempt((value) => value + 1)}>Reintentar conexión</button>
        </div>}
        {capabilities?.moderationSimulated && <p className="mt-5 text-sm leading-relaxed text-slate-500">Modo de prueba: la revisión de contenido está simulada.</p>}
        {capabilities?.ready && !capabilities.moderationSimulated && <p className="mt-5 text-sm leading-relaxed text-slate-500">Moderación de imágenes activa: revisaremos tu dibujo antes de publicarlo.</p>}
        {error && <p role="alert" className="message error mt-5">{error}</p>}
        {busy && <p role="status" className="mt-5 text-sm text-teal">Preparando, revisando y guardando tu pez. Conserva esta página abierta.</p>}
        <button type="submit" className="button-primary mt-5 w-full" disabled={busy || !drawing.hasInk || !name.trim() || !capabilities?.ready}>
          {busy ? 'Guardando tu pez…' : 'Soltar a la Pecera Comunitaria'}
        </button>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">Tu dibujo se guardará con tu nombre de creador.</p>
      </aside>
    </form>
  </div>;
}
