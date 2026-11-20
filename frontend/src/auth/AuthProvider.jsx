import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { authUserApi } from '../services/auth-user-api.js';

const AuthContext = createContext(null);

export function AuthProvider({ initialAuth, children }) {
  const [session, setSession] = useState(initialAuth.session);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    // Callback síncrono: no invocar métodos de Auth dentro de su lock interno.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setProfileError('');
    setProfileLoading(Boolean(session));
    if (session) {
      authUserApi.getProfile(session.access_token, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setProfile(data); })
        .catch((error) => { if (!controller.signal.aborted) setProfileError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
    }
    return () => controller.abort();
  }, [session?.access_token, revision]);

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }

  return <AuthContext.Provider value={{
    session, profile, setProfile, profileError, profileLoading, signOut,
    reloadProfile: () => setRevision((value) => value + 1),
    callbackError: initialAuth.callbackError,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
