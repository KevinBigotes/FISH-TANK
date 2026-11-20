import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { config } from '../lib/config.js';
import { mergeFish } from './model.js';

const initial = { fish: [], weather: null, loaded: false, source: 'loading', connection: 'connecting', limit: 200 };
export function useEcosystem(serviceUrl = config.aquariumServiceUrl) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    setState(initial);
    if (!serviceUrl) { setState({ ...initial, connection: 'unconfigured' }); return; }
    const socket = io(serviceUrl, { autoConnect: false, reconnection: true, reconnectionDelayMax: 5000 });
    const snapshot = (data) => setState((previous) => ({ ...previous, ...data, fish: mergeFish([], data.fish, data.limit), connection: 'live' }));
    const added = ({ fish, limit }) => setState((previous) => ({ ...previous, fish: mergeFish(previous.fish, [fish], limit), limit }));
    socket.on('aquarium:snapshot', snapshot).on('fish:added', added);
    socket.on('weather:updated', (weather) => setState((previous) => ({ ...previous, weather })));
    socket.on('disconnect', () => setState((previous) => ({ ...previous, connection: 'reconnecting' })));
    socket.on('connect_error', () => setState((previous) => ({ ...previous, connection: 'reconnecting' })));
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [serviceUrl]);
  return state;
}
