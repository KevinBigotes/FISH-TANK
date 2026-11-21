import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { authUserApi } from '../services/auth-user-api.js';
import { galleryApi } from '../services/gallery-api.js';

export function FishDetails({ fish, onClose, onCollectionChange = () => {} }) {
  const dialog = useRef(null), alive = useRef(true);
  const { session } = useAuth(); const location = useLocation();
  const [creator, setCreator] = useState(null), [gallery, setGallery] = useState([]), [more, setMore] = useState(false);
  const [saved, setSaved] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const own = session?.user.id === fish.creator_id;
  useEffect(() => { alive.current = true; dialog.current.showModal(); return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setSaved(null);
    const jobs = [authUserApi.getCreator(fish.creator_id, controller.signal).then(setCreator), galleryApi.creator(fish.creator_id, 0, controller.signal).then((data) => { setGallery(data.data); setMore(data.hasMore); })];
    if (session && !own) jobs.push(galleryApi.status(fish.id, controller.signal).then((data) => setSaved(data.saved)));
    Promise.allSettled(jobs).then((results) => { if (!controller.signal.aborted) { const failure = results.find((r) => r.status === 'rejected'); if (failure) setError(failure.reason.message); } });
    return () => controller.abort();
  }, [fish.id, fish.creator_id, session?.user.id, attempt]);
  async function save() { setBusy(true); setError(''); try { await galleryApi.save(fish.id); if (alive.current) { setSaved(true); onCollectionChange(); } } catch (e) { if (alive.current) setError(e.message); } finally { if (alive.current) setBusy(false); } }
  async function loadMore() { setBusy(true); try { const data = await galleryApi.creator(fish.creator_id, gallery.length); if (alive.current) { setGallery((old) => [...new Map([...old, ...data.data].map((f) => [f.id, f])).values()]); setMore(data.hasMore); } } catch (e) { if (alive.current) setError(e.message); } finally { if (alive.current) setBusy(false); } }
  return <dialog ref={dialog} className="fish-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="fish-title" onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
    <article><button className="qr-close" type="button" onClick={onClose} aria-label="Cerrar ficha del pez">×</button>
      <img className="fish-portrait" src={fish.image_url} alt={fish.name} /><h2 id="fish-title">{fish.name}</h2>
      <p className="fish-date">Liberado el {new Date(fish.created_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
      {creator ? <section className="creator-identity"><span className="creator-avatar" style={{ background: creator.avatar_color }}>{creator.username.slice(0, 1).toUpperCase()}</span><div><h3>@{creator.username}</h3><p>{creator.bio || 'Este creador aún no ha escrito su biografía.'}</p></div></section> : <p role="status">Cargando perfil del creador…</p>}
      {own ? <p className="message success">Este pez es tuyo y ya vive en tu pecera.</p> : session ? <button className="button-primary w-full" disabled={busy || saved === null || saved} onClick={save}>{saved ? 'Guardado en tu pecera' : busy ? 'Guardando…' : 'Guardar en mi pecera personal'}</button> : <Link className="text-link" to="/login" state={{ from: location.pathname }}>Inicia sesión para guardar este pez</Link>}
      {error && <div className="message error mt-4" role="alert">{error} <button className="text-link" onClick={() => setAttempt((x) => x + 1)}>Reintentar</button></div>}
      <h3 className="gallery-title">Peces creados por {creator?.username || 'este creador'}</h3>
      <div className="creator-fish-grid">{gallery.map((entry) => <figure key={entry.id}><img src={entry.image_url} alt={entry.name} loading="lazy" /><figcaption>{entry.name}</figcaption></figure>)}</div>
      {more && <button className="button-outline mt-4" disabled={busy} onClick={loadMore}>Ver más peces</button>}
    </article>
  </dialog>;
}
