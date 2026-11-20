import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { authUserApi } from '../services/auth-user-api.js';

export function ProfileCard() {
  const { session, profile, setProfile, profileLoading, profileError, reloadProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function save(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await authUserApi.updateProfile(session.access_token, {
        username: data.get('username'), bio: data.get('bio'), avatar_color: data.get('avatar_color'),
      });
      setProfile(updated); setEditing(false); setNotice('Perfil guardado.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="profile-title">
    <p className="eyebrow text-teal">TU ESPACIO</p>
    <h2 id="profile-title" className="mt-2 text-2xl font-semibold text-ocean">Tu identidad de creador</h2>
    {profileLoading && <p className="mt-5 text-slate-600" role="status">Cargando tu perfil…</p>}
    {profileError && <div className="mt-5"><p role="alert" className="message error">{profileError}</p><button type="button" className="text-link mt-3" onClick={reloadProfile}>Reintentar</button></div>}
    {notice && <p role="status" className="message success mt-4">{notice}</p>}
    {error && <p role="alert" className="message error mt-4">{error}</p>}
    {profile && (editing ? <form onSubmit={save} className="mt-5 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <div><label htmlFor="profile-name">Nombre de creador</label><input id="profile-name" name="username" defaultValue={profile.username} required minLength={3} maxLength={40} pattern="[a-z0-9_]{3,40}" /></div>
        <div><label htmlFor="profile-bio">Acerca de ti</label><textarea id="profile-bio" name="bio" defaultValue={profile.bio} rows={3} maxLength={280} /></div>
        <div><label htmlFor="profile-color">Tu color</label><input id="profile-color" name="avatar_color" type="color" defaultValue={profile.avatar_color} className="h-12 w-20 cursor-pointer p-1" /></div>
        <p className="field-hint">Tu nombre, color y biografía son públicos. Tu correo es privado.</p>
        <div className="flex flex-wrap gap-3"><button type="submit" className="button-primary">{busy ? 'Guardando…' : 'Guardar perfil'}</button><button type="button" className="button-quiet" onClick={() => setEditing(false)}>Cancelar</button></div>
      </fieldset>
    </form> : <div className="mt-6">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-4 border-white text-xl font-semibold text-ocean shadow-sm" style={{ backgroundColor: profile.avatar_color }}>{profile.username.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0"><p className="break-words font-semibold text-ocean">@{profile.username}</p><p className="break-all text-sm text-slate-600">{session.user.email}</p></div>
      </div>
      <p className="mt-5 break-words leading-relaxed text-slate-600">{profile.bio || 'Cada creador tiene una historia. Añade unas palabras sobre ti.'}</p>
      <button type="button" className="text-link mt-5" onClick={() => { setEditing(true); setNotice(''); setError(''); }}>Editar mi perfil</button>
    </div>)}
  </section>;
}
