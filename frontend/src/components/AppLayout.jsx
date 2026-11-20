import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { authErrorMessage } from '../lib/auth-errors.js';
import { Brand } from './Brand.jsx';

export function AppLayout() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function exit() {
    setBusy(true); setError('');
    try { await signOut(); }
    catch (failure) { setError(authErrorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-mist">
    <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Saltar al contenido</a>
    <header className="app-header">
      <Brand />
      <nav aria-label="Navegación principal" className="flex flex-wrap gap-1">
        <NavLink to="/pecera" className="nav-link">Pecera comunitaria</NavLink>
        <NavLink to="/dibujar" className="nav-link">Dibujar</NavLink>
        <NavLink to="/mi-pecera" className="nav-link">Mi pecera</NavLink>
      </nav>
      <button type="button" className="button-quiet" onClick={exit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button>
    </header>
    {error && <p role="alert" className="message error mx-auto mt-4 max-w-6xl">{error}</p>}
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16"><Outlet /></main>
    <footer className="page-footer"><span>SOAYLEMER</span><span>Imaginación compartida. Posibilidades infinitas.</span></footer>
  </div>;
}
