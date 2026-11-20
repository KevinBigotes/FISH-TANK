import { EventEmitter } from 'node:events';
export function createEcosystem({ repository, weather, maxFish = 200, syncMs = 30_000, weatherPollMs = 600_000 }) {
  const events = new EventEmitter(), fishes = new Map(), changedAt = new Map();
  let revision = 0, loaded = false, source = 'loading', pending, timers = [];
  function trim() {
    const sorted = [...fishes.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    for (const fish of sorted.slice(0, Math.max(0, sorted.length - maxFish))) { fishes.delete(fish.id); changedAt.delete(fish.id); }
  }
  const snapshot = () => ({ fish: [...fishes.values()], weather: weather.snapshot(), loaded, source, limit: maxFish, revision });
  async function refresh() {
    if (pending) return pending;
    const atStart = revision;
    pending = (async () => {
      try {
        const latest = await repository.latest(maxFish);
        // Una lectura iniciada antes de un evento no puede borrar su pez recién llegado.
        const concurrent = [...fishes.values()].filter((fish) => changedAt.get(fish.id) > atStart);
        fishes.clear();
        for (const fish of [...latest, ...concurrent]) fishes.set(fish.id, fish);
        trim();
        for (const id of changedAt.keys()) if (!fishes.has(id)) changedAt.delete(id);
        loaded = true; source = 'ready'; revision++;
      } catch { source = 'unavailable'; }
      events.emit('snapshot', snapshot()); return snapshot();
    })().finally(() => { pending = null; });
    return pending;
  }
  return {
    events, snapshot, refresh,
    async publish(id) {
      if (fishes.has(id)) return true;
      const fish = await repository.byId(id);
      if (!fish) return false;
      if (fishes.has(id)) return true;
      fishes.set(id, fish); changedAt.set(id, ++revision); trim();
      if (fishes.has(id)) events.emit('fish', { fish, revision, limit: maxFish });
      return true;
    },
    async refreshWeather() { const result = await weather.refresh(); events.emit('weather', result); return result; },
    start() {
      if (timers.length) return;
      void refresh(); void this.refreshWeather();
      timers = [setInterval(refresh, syncMs), setInterval(() => this.refreshWeather(), weatherPollMs), setInterval(() => events.emit('weather', weather.snapshot()), 30_000)];
      timers.forEach((timer) => timer.unref());
    },
    stop() { timers.forEach(clearInterval); timers = []; },
  };
}
