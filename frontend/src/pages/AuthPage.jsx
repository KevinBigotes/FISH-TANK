import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { Brand } from '../components/Brand.jsx';
import { config } from '../lib/config.js';
import { authErrorMessage } from '../lib/auth-errors.js';
import { emailRedirectUrl, supabase } from '../lib/supabase.js';

const avatarColors = [
  ['#36b6aa', 'Turquesa'], ['#ee9472', 'Coral'], ['#7c83cb', 'Lavanda'], ['#d3ac44', 'Dorado'],
];
const destinations = ['/pecera', '/dibujar', '/mi-pecera'];

export function AuthPage({ mode = 'login' }) {
  const registering = mode === 'register';
  const { session, callbackError } = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [color, setColor] = useState(avatarColors[0][0]);
  const destination = destinations.includes(location.state?.from) ? location.state.from : '/pecera';
  if (session) return <Navigate to={destination} replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy || !supabase) return;
    setError(''); setNotice('');
    const values = new FormData(event.currentTarget);
    const password = values.get('password');
    if (registering && password !== values.get('confirmPassword')) {
      setError('Las contraseñas no coinciden.'); return;
    }
    setBusy(true);
    try {
      const email = values.get('email').trim();
      const result = registering
        ? await supabase.auth.signUp({ email, password, options: {
          data: { username: values.get('username').trim().toLowerCase(), avatar_color: color },
          emailRedirectTo: emailRedirectUrl(),
        } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (registering && !result.data.session) {
        setNotice('Revisa tu correo para confirmar la cuenta. Abre el enlace en este navegador y después inicia sesión. Si ya tenías una cuenta, puedes iniciar sesión directamente.');
      }
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { setBusy(false); }
  }

  return <div className="auth-shell">
    <aside className="auth-story">
      <Brand light />
      <div className="story-copy">
        <p className="eyebrow text-seafoam">UNA EXPOSICIÓN HECHA ENTRE TODOS</p>
        <h1>Las grandes ideas<br />empiezan con<br /><span>un pequeño trazo.</span></h1>
        <p className="max-w-sm text-lg leading-relaxed text-white/75">Un lugar para imaginar, dejar tu huella y descubrir lo que podemos crear juntos.</p>
      </div>
      <div className="story-signature"><span className="signature-line" /><span>Tu imaginación tiene un lugar aquí.</span></div>
      <div className="contour contour-one" aria-hidden="true" /><div className="contour contour-two" aria-hidden="true" />
    </aside>
    <main className="auth-main">
      <div className="auth-topline"><span>EXPLORA. IMAGINA. CONECTA.</span><span className="edition-label">EDICIÓN EXPOSICIÓN</span></div>
      <section className="auth-form-wrap" aria-labelledby="auth-title">
        <div className="mb-8 flex gap-6 border-b border-line">
          <Link to="/login" state={location.state} className={`auth-tab ${!registering ? 'selected' : ''}`} aria-current={!registering ? 'page' : undefined}>Iniciar sesión</Link>
          <Link to="/registro" state={location.state} className={`auth-tab ${registering ? 'selected' : ''}`} aria-current={registering ? 'page' : undefined}>Crear cuenta</Link>
        </div>
        <p className="eyebrow text-teal">{registering ? 'TU HISTORIA EMPIEZA AQUÍ' : 'QUÉ BUENO TENERTE AQUÍ'}</p>
        <h2 id="auth-title" className="mt-3 text-4xl font-semibold tracking-tight text-ocean">{registering ? 'Haz espacio a tu imaginación.' : 'Vuelve a tu océano.'}</h2>
        <p className="mt-3 mb-7 leading-relaxed text-slate-600">{registering ? 'Crea tu identidad y sé parte de nuestra comunidad.' : 'Entra con tu cuenta para seguir siendo parte de la comunidad.'}</p>

        {config.errors.length > 0 && <div className="message warning mb-5" role="status">
          <strong>Falta conectar la exposición.</strong>
          <p className="mt-1">Completa frontend/.env y reinicia Vite.</p>
          <ul className="mt-2 list-disc pl-5">{config.errors.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
        {callbackError && !registering && <p className="message warning mb-5" role="alert">{callbackError}</p>}
        {error && <p className="message error mb-5" role="alert">{error}</p>}
        {notice && <p className="message success mb-5" role="status">{notice}</p>}

        <form onSubmit={submit} className="space-y-5" aria-label={registering ? 'Crear cuenta' : 'Iniciar sesión'}>
          <fieldset disabled={busy || !supabase} className="space-y-5 disabled:opacity-60">
            {registering && <div>
              <label htmlFor="username">Nombre de creador</label>
              <input id="username" name="username" autoComplete="username" required minLength={3} maxLength={40} pattern="[a-z0-9_]{3,40}" placeholder="tu_nombre" aria-describedby="username-help" />
              <p id="username-help" className="field-hint">De 3 a 40 letras minúsculas, números o guiones bajos. Será público.</p>
            </div>}
            <div>
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.com" />
            </div>
            <div>
              <label htmlFor="password">Contraseña</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} maxLength={128} className="pr-24" placeholder={registering ? 'Al menos 8 caracteres' : 'Tu contraseña'} />
                <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
            {registering && <>
              <div>
                <label htmlFor="confirmPassword">Repite tu contraseña</label>
                <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Una vez más" />
              </div>
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-ocean">Elige tu color</legend>
                <div className="flex gap-3">{avatarColors.map(([value, name]) => <label key={value} className="color-choice" title={name}>
                  <input type="radio" name="avatar_color" value={value} checked={color === value} onChange={() => setColor(value)} className="peer sr-only" />
                  <span className="color-swatch peer-checked:ring-2 peer-checked:ring-ocean peer-checked:ring-offset-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4" style={{ backgroundColor: value }} />
                  <span className="sr-only">{name}</span>
                </label>)}</div>
              </fieldset>
            </>}
            <button className="button-primary w-full" type="submit">{busy ? 'Un momento…' : registering ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}</button>
          </fieldset>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{registering ? '¿Ya formas parte?' : '¿Es tu primera visita?'}{' '}<Link className="text-link" to={registering ? '/login' : '/registro'} state={location.state}>{registering ? 'Inicia sesión' : 'Crea una cuenta'}</Link></p>
      </section>
      <p className="auth-bottomline">Un océano de ideas, una comunidad de creadores.</p>
    </main>
  </div>;
}
