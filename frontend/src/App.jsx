import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { PersonalAquariumPage } from './pages/PersonalAquariumPage.jsx';
import { DrawingPage } from './pages/DrawingPage.jsx';
const AquariumPage = lazy(() => import('./pages/AquariumPage.jsx').then((module) => ({ default: module.AquariumPage })));

export function App({ initialAuth }) {
  return <AuthProvider initialAuth={initialAuth}><HashRouter><Routes>
    <Route path="/login" element={<AuthPage key="login" />} />
    <Route path="/registro" element={<AuthPage key="register" mode="register" />} />
    <Route path="/pecera" element={<Suspense fallback={<div className="aquarium-loading" role="status">Abriendo el arrecife…</div>}><AquariumPage /></Suspense>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/mi-pecera" element={<PersonalAquariumPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dibujar" element={<DrawingPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/pecera" replace />} />
  </Routes></HashRouter></AuthProvider>;
}
