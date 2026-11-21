import { useEffect, useRef, useState } from 'react';
import { createAquariumRenderer } from '../aquarium/renderer.js';

export function AquariumCanvas({ fish, loaded, weather, paused, selectedId, onSelect }) {
  const canvas = useRef(null), renderer = useRef(null);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    renderer.current = createAquariumRenderer(canvas.current, { onImageError: () => setImageError(true) });
    return () => { renderer.current.destroy(); renderer.current = null; };
  }, []);
  useEffect(() => renderer.current.setFish(fish, loaded), [fish, loaded]);
  useEffect(() => renderer.current.setWeather(weather), [weather]);
  useEffect(() => renderer.current.setPaused(paused), [paused]);
  useEffect(() => renderer.current.select(selectedId), [selectedId]);
  function select(event) { if (!onSelect) return; const rect = canvas.current.getBoundingClientRect(); const selected = renderer.current.hit({ x: event.clientX - rect.left, y: event.clientY - rect.top }); if (selected) onSelect(selected); }
  return <><canvas ref={canvas} className={`aquarium-canvas ${onSelect ? 'interactive-aquarium' : ''}`} onClick={select} role="img" aria-label={`Arrecife animado con ${fish.length} peces. Toca un pez para conocer a su creador.`} />
    {onSelect && <select className="fish-accessible-select" aria-label="Seleccionar un pez" value="" onChange={(e) => { const selected = fish.find((f) => f.id === e.target.value); if (selected) onSelect(selected); }}><option value="">Explorar peces</option>{fish.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}
    {imageError && <p className="aquarium-image-warning" role="status">Algún dibujo no pudo cargar su imagen.</p>}</>;
}
