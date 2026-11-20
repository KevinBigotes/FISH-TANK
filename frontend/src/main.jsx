import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { bootstrapAuth } from './lib/supabase.js';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<div className="grid min-h-screen place-items-center bg-mist text-ocean" role="status">Preparando tu espacio…</div>);
const initialAuth = await bootstrapAuth();
root.render(<StrictMode><App initialAuth={initialAuth} /></StrictMode>);
