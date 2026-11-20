import { io } from 'socket.io-client';
export function createEcosystemPublisher({ url, token }, connect = io) {
  if (!url || !token) return { publish() {}, close() {} };
  const socket = connect(`${url.replace(/\/+$/, '')}/publishers`, { auth: { token }, forceNew: true, transports: ['websocket'], reconnection: true, reconnectionDelayMax: 5000 });
  const pending = new Set();
  let flushing = false, closed = false;
  async function flush() {
    if (flushing || closed || !socket.connected) return;
    flushing = true;
    try {
      for (const id of pending) {
        if (closed || !socket.connected) break;
        try { const result = await socket.timeout(5000).emitWithAck('fish:published', { id }); if (!result?.ok) break; pending.delete(id); }
        catch { break; }
      }
    } finally { flushing = false; }
  }
  socket.on('connect', flush);
  const timer = setInterval(() => { if (!socket.connected && !socket.active) socket.connect(); void flush(); }, 3000);
  timer.unref();
  return {
    publish(id) {
      if (closed) return;
      pending.add(id);
      // La reconciliación de Supabase recupera envíos antiguos aunque el proceso reinicie.
      if (pending.size > 1000) pending.delete(pending.values().next().value);
      void flush();
    },
    close() { closed = true; clearInterval(timer); socket.close(); pending.clear(); },
  };
}
