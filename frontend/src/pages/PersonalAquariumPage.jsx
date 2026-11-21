import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AquariumCanvas } from '../components/AquariumCanvas.jsx';
import { FishDetails } from '../components/FishDetails.jsx';
import { ProfileCard } from '../components/ProfileCard.jsx';
import { galleryApi } from '../services/gallery-api.js';

export function PersonalAquariumPage() {
  const { session } = useAuth();
  const [fish, setFish] = useState([]), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState(null), [removing, setRemoving] = useState(null);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    galleryApi.personal(controller.signal).then((data) => { if (!controller.signal.aborted) { setFish(data); setLoaded(true); } }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [session.user.id, revision]);
  useEffect(() => { const refresh = () => setRevision((n) => n + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  async function remove(entry) { setRemoving(entry.id); setError(''); try { await galleryApi.remove(entry.id); setFish((items) => items.filter((f) => f.id !== entry.id)); if (selected?.id === entry.id) setSelected(null); } catch (e) { setError(e.message); } finally { setRemoving(null); } }
  return <section className="aquarium-screen personal-aquarium" aria-label="Mi pecera personal">
    <AquariumCanvas fish={fish} loaded={loaded} weather={null} paused={paused || Boolean(selected)} selectedId={selected?.id} onSelect={setSelected} />
    <header className="personal-header"><div><p className="eyebrow">TU RINCÓN DEL OCÉANO</p><h1>Mi pecera personal</h1><p>{fish.length} peces · creados por ti y adoptados</p></div><nav><button className="button-outline" onClick={() => setPaused(!paused)}>{paused ? 'Reanudar' : 'Pausar'}</button><Link to="/pecera">Pecera comunitaria</Link><Link to="/dibujar">Dibujar</Link></nav></header>
    {!loaded && !error && <p className="aquarium-empty" role="status">Cargando tu pecera…</p>}
    {loaded && !fish.length && <div className="aquarium-empty"><p>Un espacio para tus favoritos.</p><span>Crea tu primer pez o guarda uno de la comunidad.</span></div>}
    {error && <div className="personal-error" role="alert">{error} <button onClick={() => setRevision((n) => n + 1)}>Reintentar</button></div>}
    <details className="collection-drawer"><summary>Gestionar mi pecera · {fish.length} peces</summary><div className="collection-content">
      <div className="collection-grid">{fish.map((entry) => <article key={entry.id}><button className="collection-preview" onClick={() => setSelected(entry)}><img src={entry.image_url} alt={entry.name} /><strong>{entry.name}</strong></button><span>{entry.kind === 'created' ? 'Creado por ti' : 'Adoptado'}</span>{entry.kind === 'adopted' && <button className="text-link" disabled={removing !== null} onClick={() => remove(entry)}>{removing === entry.id ? 'Quitando…' : 'Quitar de mi pecera'}</button>}</article>)}</div>
      <ProfileCard />
    </div></details>
    {selected && <FishDetails key={selected.id} fish={selected} onClose={() => setSelected(null)} onCollectionChange={() => setRevision((n) => n + 1)} />}
  </section>;
}
