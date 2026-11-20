import { useEffect, useRef, useState } from 'react';
import { createAquariumRenderer } from '../aquarium/renderer.js';

export function AquariumCanvas({ fish, loaded, weather, paused }) {
  const canvas = useRef(null), renderer = useRef(null);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    renderer.current = createAquariumRenderer(canvas.current, { onImageError: () => setImageError(true) });
    return () => { renderer.current.destroy(); renderer.current = null; };
  }, []);
  useEffect(() => renderer.current.setFish(fish, loaded), [fish, loaded]);
  useEffect(() => renderer.current.setWeather(weather), [weather]);
  useEffect(() => renderer.current.setPaused(paused), [paused]);
  return <><canvas ref={canvas} className="aquarium-canvas" role="img" aria-label={`Arrecife animado con ${fish.length} peces de la comunidad. Los peces nadan libremente.`} />
    {imageError && <p className="aquarium-image-warning" role="status">Algún dibujo no pudo cargar su imagen.</p>}</>;
}
