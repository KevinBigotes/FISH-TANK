import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { PhasePage } from './pages/PhasePage.jsx';

export function App({ initialAuth }) {
  return <AuthProvider initialAuth={initialAuth}><HashRouter><Routes>
    <Route path="/login" element={<AuthPage key="login" />} />
    <Route path="/registro" element={<AuthPage key="register" mode="register" />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/pecera" element={<PhasePage type="aquarium" />} />
        <Route path="/dibujar" element={<PhasePage type="drawing" />} />
        <Route path="/mi-pecera" element={<PhasePage type="collection" />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/pecera" replace />} />
  </Routes></HashRouter></AuthProvider>;
}
