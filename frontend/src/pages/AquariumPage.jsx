import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand.jsx';
import { AquariumCanvas } from '../components/AquariumCanvas.jsx';
import { JoinAquarium } from '../components/JoinAquarium.jsx';
import { useEcosystem } from '../aquarium/useEcosystem.js';
import { FishDetails } from '../components/FishDetails.jsx';

export function AquariumPage({ serviceUrl }) {
  const ecosystem = useEcosystem(serviceUrl);
  const [selected, setSelected] = useState(null);
  const screen = useRef(null);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [full, setFull] = useState(false), [fullscreenError, setFullscreenError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const changed = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', changed);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => { document.removeEventListener('fullscreenchange', changed); clearInterval(timer); };
  }, []);
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await screen.current.requestFullscreen(); }
    catch { setFullscreenError('Tu navegador no permite pantalla completa. Puedes ampliar su ventana.'); }
  }
  const weather = ecosystem.weather;
  const available = weather && weather.status !== 'unavailable';
  const localTime = new Intl.DateTimeFormat('es-MX', { timeZone: weather?.timezone || 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const connected = ecosystem.connection === 'live' && ecosystem.source === 'ready';
  const status = ecosystem.connection === 'unconfigured' ? 'Pecera pendiente de conexión' : ecosystem.connection === 'reconnecting' ? 'Reconectando con la comunidad…'
    : ecosystem.source === 'unavailable' ? 'Sincronización en pausa' : connected ? 'En vivo' : 'Conectando con la comunidad…';
  return <section ref={screen} className="aquarium-screen" aria-label="Pecera Comunitaria">
    <AquariumCanvas fish={ecosystem.fish} loaded={ecosystem.loaded} weather={weather} paused={paused || Boolean(selected)} selectedId={selected?.id} onSelect={setSelected} />
    <header className="aquarium-header"><Brand light /><div className="aquarium-heading"><h1>Pecera Comunitaria</h1><p>UN ARRECIFE HECHO ENTRE TODOS</p></div>
      <nav className="aquarium-actions" aria-label="Controles de la exposición">
        <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar animación' : 'Pausar animación'} title={paused ? 'Reanudar animación' : 'Pausar animación'}>{paused ? '▷' : 'Ⅱ'}</button>
        {document.fullscreenEnabled && <button type="button" onClick={fullscreen} aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa">⛶</button>}
        <Link to="/dibujar" className="aquarium-draw-link">Dibujar un pez</Link>
        <Link to="/mi-pecera" className="aquarium-draw-link">Mi pecera</Link>
      </nav>
    </header>
    <div className="aquarium-connection" role="status"><span className={connected ? 'live-dot' : 'offline-dot'} />{status}{ecosystem.loaded && <span className="fish-counter">{ecosystem.fish.length} {ecosystem.fish.length === 1 ? 'pez' : 'peces'}{ecosystem.fish.length >= ecosystem.limit ? ' recientes' : ''}</span>}</div>
    {ecosystem.loaded && ecosystem.source === 'ready' && ecosystem.fish.length === 0 && <div className="aquarium-empty"><p>Todo océano empieza<br />con un pequeño pez.</p><span>Escanea el código y comparte el primero.</span></div>}
    {ecosystem.connection === 'unconfigured' && <div className="aquarium-empty"><p>El arrecife está listo.</p><span>Conecta el servicio de la pecera para recibir las creaciones.</span></div>}
    {fullscreenError && <p className="aquarium-notice" role="status">{fullscreenError}</p>}
    <aside className="reef-weather" aria-label="Clima del arrecife">
      <div className="weather-symbol" aria-hidden="true">{available ? weather.isNight ? '☾' : weather.rainy ? '☂' : '☀' : '≈'}</div>
      <div><p className="reef-location">{weather?.location || 'Cozumel, México'} <span>· {localTime}</span></p>
        <p className="reef-conditions">{available ? `${Math.round(weather.temperatureC)}°C · ${weather.description}` : 'Clima no disponible'}</p>
        <p className="reef-weather-detail">{available ? `${weather.isNight ? 'Arrecife bioluminiscente' : 'Luz submarina'} · viento ${Math.round(weather.windMps * 3.6)} km/h${weather.status === 'stale' ? ' · última lectura' : ''}` : 'El arrecife continúa en modo ambiente'}</p>
        <a href="https://openweathermap.org/" target="_blank" rel="noreferrer" className="weather-credit">OpenWeatherMap</a>
      </div>
    </aside>
    <JoinAquarium />
    {selected && <FishDetails key={selected.id} fish={selected} onClose={() => setSelected(null)} />}
  </section>;
}
