import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadFish } from '../services/drawing-api.js';

export function FishPostcard({ result }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { fish, creator } = result;
  async function download() {
    setBusy(true); setError('');
    try { await downloadFish(fish); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-2xl" aria-labelledby="confirmation-title">
    <p className="eyebrow text-teal">UNA NUEVA HISTORIA EN EL OCÉANO</p>
    <h1 id="confirmation-title" className="mt-3 text-3xl font-semibold tracking-tight text-ocean md:text-4xl" tabIndex={-1}>Tu pez ya está guardado.</h1>
    <p className="mt-3 leading-relaxed text-slate-600">Tu creación ya forma parte de la comunidad. Llévate una copia o búscala nadando en el arrecife.</p>
    <article className="postcard mt-8">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold tracking-widest text-teal"><span>FISH TANK</span><span>HECHO POR TI</span></div>
      <div className="postcard-image"><img src={fish.image_url} alt={`Tu dibujo: ${fish.name}`} /></div>
      <div className="border-t border-line pt-5">
        <h2 className="break-words text-3xl font-semibold text-ocean">{fish.name}</h2>
        <p className="mt-2 break-words text-slate-600">Creado por <span className="font-semibold text-teal">@{creator.username}</span></p>
      </div>
    </article>
    {result.moderation?.simulated && <p className="mt-4 text-sm text-slate-500">Prueba con revisión simulada. El PNG y el registro se guardaron en Supabase.</p>}
    {error && <p className="message error mt-4" role="alert">{error}</p>}
    <div className="mt-7 grid gap-3 sm:grid-cols-2">
      <button className="button-primary" type="button" disabled={busy} onClick={download}>{busy ? 'Descargando…' : 'Descargar mi pez'}</button>
      <Link className="button-outline text-center" to="/pecera">Ir a la Pecera Comunitaria</Link>
    </div>
  </section>;
}
