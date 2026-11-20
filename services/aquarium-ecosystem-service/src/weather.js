export function normalizeWeather(data, config, now = Date.now()) {
  const condition = data?.weather?.[0];
  const required = [data?.main?.temp, data?.wind?.speed, data?.sys?.sunrise, data?.sys?.sunset, data?.dt, condition?.id];
  if (required.some((value) => !Number.isFinite(value)) || !condition?.description || data.sys.sunset <= data.sys.sunrise) throw new Error('Respuesta meteorológica incompleta.');
  return {
    status: 'ready', source: 'OpenWeatherMap', location: config.location, timezone: config.timezone,
    temperatureC: data.main.temp, windMps: Math.max(0, data.wind.speed),
    clouds: Math.max(0, Math.min(100, data.clouds?.all || 0)),
    rainMm: Math.max(0, data.rain?.['1h'] || 0), rainy: condition.id >= 200 && condition.id < 600,
    description: condition.description, sunrise: data.sys.sunrise * 1000, sunset: data.sys.sunset * 1000,
    observedAt: data.dt * 1000, fetchedAt: now,
  };
}
export function createWeatherService(config, { fetchImpl = fetch, now = Date.now } = {}) {
  let current = null, failure = config.apiKey ? 'waiting' : 'missing_key', pending;
  const unavailable = () => ({ status: 'unavailable', source: 'OpenWeatherMap', location: config.location, timezone: config.timezone, reason: failure, isNight: null });
  function snapshot() {
    const time = now();
    if (!current || time - current.fetchedAt > 3_600_000 || time - current.observedAt > 7_200_000) return unavailable();
    return { ...current, status: failure || time - current.fetchedAt > config.pollMs * 1.5 ? 'stale' : 'ready', isNight: time < current.sunrise || time >= current.sunset };
  }
  return {
    snapshot,
    refresh() {
      if (pending) return pending;
      pending = (async () => {
        if (!config.apiKey) return snapshot();
        const url = new URL('https://api.openweathermap.org/data/2.5/weather');
        url.search = new URLSearchParams({ lat: String(config.lat), lon: String(config.lon), appid: config.apiKey, units: 'metric', lang: 'es' });
        try {
          const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
          if (!response.ok) { failure = response.status === 401 ? 'invalid_key' : 'provider_unavailable'; return snapshot(); }
          current = normalizeWeather(await response.json(), config, now()); failure = null;
        } catch { failure = 'provider_unavailable'; }
        return snapshot();
      })().finally(() => { pending = null; });
      return pending;
    },
  };
}
