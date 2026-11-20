export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function seededRandom(text) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => { seed += 0x6d2b79f5; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createSwimmer(fish) {
  const random = seededRandom(fish.id);
  const depth = random();
  const direction = random() > 0.5 ? 1 : -1;
  return { fish, depth, direction, face: direction, x: 0.12 + random() * 0.76, y: 0.24 + random() * 0.48,
    speed: 16 + depth * 28 + random() * 12, phase: random() * Math.PI * 2, turn: null, age: 0 };
}
export function advanceSwimmer(fish, dt, viewportWidth, spriteWidth, current = 0) {
  dt = clamp(dt, 0, 0.05);
  const margin = Math.min(0.4, (spriteWidth / 2 + 18) / viewportWidth);
  if (fish.turn) {
    fish.turn.time += dt;
    const progress = clamp(fish.turn.time / 0.85, 0, 1);
    fish.face = fish.turn.from * Math.cos(progress * Math.PI);
    if (progress === 1) { fish.direction = -fish.turn.from; fish.face = fish.direction; fish.turn = null; }
  }
  fish.x = clamp(fish.x + fish.face * fish.speed * (1 + current * 0.4) * dt / viewportWidth, margin, 1 - margin);
  if (!fish.turn && ((fish.x >= 1 - margin && fish.direction > 0) || (fish.x <= margin && fish.direction < 0))) {
    fish.turn = { from: fish.direction, time: 0 };
  }
  fish.age += dt;
  return fish;
}
export function environmentFor(weather) {
  const available = weather && weather.status !== 'unavailable';
  return { night: available && weather.isNight ? 1 : 0,
    current: available ? clamp((weather.windMps || 0) / 15 + (weather.rainy ? 0.35 : 0), 0, 1) : 0,
    clouds: available ? clamp((weather.clouds || 0) / 100, 0, 1) : 0 };
}
export const drawingJoinUrl = (location) => location.origin + location.pathname + '#/dibujar';
export function mergeFish(previous, incoming, limit = 200) {
  const unique = new Map(previous.map((fish) => [fish.id, fish]));
  for (const fish of incoming) unique.set(fish.id, fish);
  return [...unique.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-limit);
}
