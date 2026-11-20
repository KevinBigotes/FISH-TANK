import { advanceSwimmer, clamp, createSwimmer, environmentFor, seededRandom } from './model.js';

const mix = (a, b, f) => a + (b - a) * f;
const rgb = (a, b, f) => `rgb(${a.map((v, i) => Math.round(mix(v, b[i], f))).join(',')})`;

export function createAquariumRenderer(canvas, { onImageError = () => {} } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const swimmers = new Map();
  const random = seededRandom('fish-tank-reef');
  const particles = Array.from({ length: 120 }, () => ({ x: random(), y: random(), radius: 0.8 + random() * 3, speed: 8 + random() * 20, phase: random() * 6 }));
  const plants = Array.from({ length: 32 }, (_, i) => ({ x: i / 31, height: 50 + random() * 130, phase: random() * 6, shade: random() }));
  let width = 1, height = 1, dpr = 1, reef, time = 0, last = 0, frame, stopped = false, paused = false, dirty = true, initialized = false;
  let target = environmentFor(null), lighting = { ...target }, bursts = [];

  function buildReef() {
    reef = document.createElement('canvas'); reef.width = Math.ceil(width * dpr); reef.height = Math.ceil(height * dpr);
    const c = reef.getContext('2d'); c.scale(dpr, dpr);
    const r = seededRandom('coral-garden');
    for (let layer = 0; layer < 3; layer++) {
      const base = height - 35 + layer * 14;
      c.fillStyle = ['#124d57', '#0c3946', '#072d39'][layer];
      c.beginPath(); c.moveTo(0, height);
      for (let x = -40; x <= width + 60; x += 55) c.lineTo(x, base - r() * (70 - layer * 17));
      c.lineTo(width, height); c.closePath(); c.fill();
    }
    function branch(x, y, length, angle, thickness, depth) {
      const nx = x + Math.sin(angle) * length, ny = y - Math.cos(angle) * length;
      c.lineWidth = thickness; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(angle) * length * 0.3, y - length * 0.7, nx, ny); c.stroke();
      if (depth > 0) {
        branch(nx, ny, length * 0.65, angle - 0.4 - r() * 0.2, thickness * 0.7, depth - 1);
        branch(nx, ny, length * 0.68, angle + 0.4 + r() * 0.2, thickness * 0.7, depth - 1);
      }
    }
    c.lineCap = 'round';
    for (const [x, color, size] of [[0.08, '#c17c83', 40], [0.18, '#40838b', 30], [0.84, '#547494', 48], [0.94, '#b47982', 32]]) {
      c.strokeStyle = color; branch(width * x, height - 10, size * Math.min(1.25, height / 700), 0, 9, 4);
    }
    // Esponjas y pequeñas colonias del fondo, sin peces de demostración.
    for (let i = 0; i < 28; i++) {
      const x = r() * width, y = height - r() * 22;
      c.fillStyle = i % 2 ? '#326c72' : '#765f78';
      c.beginPath(); c.ellipse(x, y, 8 + r() * 13, 13 + r() * 21, r() - 0.5, 0, Math.PI * 2); c.fill();
    }
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (width * height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); buildReef(); dirty = true;
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  function background() {
    const n = lighting.night, cloudy = lighting.clouds;
    const gradient = ctx.createLinearGradient(0, 0, width * 0.28, height);
    gradient.addColorStop(0, rgb([37 - cloudy * 12, 145 - cloudy * 30, 153 - cloudy * 15], [7, 26, 51], n));
    gradient.addColorStop(0.43, rgb([8, 78, 100], [5, 22, 43], n));
    gradient.addColorStop(1, '#041c2d'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const x = width * (0.08 + i * 0.18) + Math.sin(time * 0.08 + i) * 28;
      const glow = ctx.createLinearGradient(x, 0, x + width * 0.2, height * 0.85);
      glow.addColorStop(0, `rgba(167,255,225,${(0.10 - cloudy * 0.04) * (1 - n * 0.8)})`);
      glow.addColorStop(1, 'rgba(116,240,220,0)'); ctx.fillStyle = glow;
      ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + width * 0.055, -10); ctx.lineTo(x + width * 0.36, height); ctx.lineTo(x + width * 0.12, height); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = `rgba(175,255,233,${0.05 * (1 - n * 0.7)})`; ctx.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 12) {
        const y = height * (0.05 + row * 0.035) + Math.sin(x * 0.007 + time * 0.22 + row) * 8;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  function vegetation() {
    for (const plant of plants) {
      const baseX = plant.x * width, top = height - plant.height * Math.min(1.2, height / 700);
      const sway = Math.sin(time * (0.6 + lighting.current * 0.7) + plant.phase) * (12 + lighting.current * 22);
      ctx.fillStyle = plant.shade > 0.5 ? '#1d666b' : '#205359';
      for (let blade = -1; blade <= 1; blade++) {
        const x = baseX + blade * 12, tip = x + sway + blade * 15;
        ctx.beginPath(); ctx.moveTo(x - 4, height); ctx.bezierCurveTo(x - 8, height - 40, tip - 18, top + 40, tip, top + Math.abs(blade) * 30);
        ctx.bezierCurveTo(tip - 4, top + 65, x + 6, height - 32, x + 4, height); ctx.fill();
      }
    }
    ctx.globalAlpha = 1 - lighting.night * 0.35; ctx.drawImage(reef, 0, 0, width, height); ctx.globalAlpha = 1;
  }
  function bubble(x, y, radius, alpha, glow = false) {
    ctx.strokeStyle = `rgba(157,237,235,${alpha})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    if (glow) { ctx.fillStyle = `rgba(115,255,228,${alpha * 0.5})`; ctx.shadowColor = '#62fbd2'; ctx.shadowBlur = 9; ctx.fill(); ctx.shadowBlur = 0; }
  }
  function spawnBurst(swimmer) {
    for (let i = 0; i < 26; i++) bursts.push({ x: swimmer.x * width + (random() - 0.5) * 85, y: swimmer.y * height + random() * 60, born: time, radius: 2 + random() * 5, speed: 24 + random() * 65, phase: random() * 6 });
    bursts = bursts.slice(-520);
  }
  function drawFish(swimmer, dt) {
    if (!swimmer.image?.complete || !swimmer.image.naturalWidth) return;
    const image = swimmer.image;
    const length = Math.min(180, width * 0.26) * (0.46 + swimmer.depth * 0.64);
    const scale = length / Math.max(image.naturalWidth, image.naturalHeight * 1.2);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    advanceSwimmer(swimmer, dt, width, w, lighting.current);
    const entering = swimmer.entering && !paused ? clamp(swimmer.age / 2.4, 0, 1) : 1;
    const wave = Math.sin(time * (1.2 + swimmer.speed * 0.006) + swimmer.phase);
    const x = swimmer.x * width, y = swimmer.y * height + wave * (5 + swimmer.depth * 8) + (1 - entering) * 32;
    const opacity = (0.58 + swimmer.depth * 0.42) * Math.min(1, entering * 2);
    ctx.save(); ctx.globalAlpha = opacity; ctx.translate(x, y); ctx.rotate(wave * 0.025);
    const flutter = Math.sin(time * 3.2 + swimmer.phase) * 0.025;
    ctx.scale(swimmer.face * (1 + flutter), 1 - flutter);
    if (lighting.night > 0.3) { ctx.shadowColor = '#75f7db'; ctx.shadowBlur = lighting.night * 9; }
    ctx.drawImage(image, -w / 2, -h / 2, w, h); ctx.restore();
    ctx.save(); ctx.globalAlpha = opacity * 0.8;
    ctx.font = '12px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    let label = swimmer.fish.name;
    if (label.length > 24) label = label.slice(0, 23) + '…';
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,21,36,.42)'; ctx.beginPath(); ctx.roundRect(x - textWidth / 2 - 8, y + h / 2 + 8, textWidth + 16, 23, 11); ctx.fill();
    ctx.fillStyle = '#e6f4ee'; ctx.fillText(label, x, y + h / 2 + 24); ctx.restore();
  }
  function render(dt) {
    time += dt;
    for (const key of ['night', 'current', 'clouds']) lighting[key] = mix(lighting[key], target[key], paused ? 1 : Math.min(1, dt * 0.6));
    background();
    [...swimmers.values()].sort((a, b) => a.depth - b.depth).forEach((fish) => drawFish(fish, dt));
    vegetation();
    const count = 35 + Math.floor(lighting.current * 80);
    for (const particle of particles.slice(0, count)) {
      const y = height - ((particle.y * height + time * particle.speed * (1 + lighting.current)) % (height + 25));
      const x = (particle.x * width + Math.sin(time * 0.3 + particle.phase) * 12 + time * lighting.current * 10) % width;
      bubble(x, y, particle.radius, 0.12 + lighting.night * 0.15, lighting.night > 0.5 && particle.radius < 1.8);
    }
    bursts = bursts.filter((b) => time - b.born < 4);
    for (const b of bursts) { const age = time - b.born; bubble(b.x + Math.sin(age * 2 + b.phase) * 12, b.y - age * b.speed, b.radius, (1 - age / 4) * 0.65); }
  }
  function tick(timestamp) {
    if (stopped) return;
    if (!last || timestamp - last >= 1000 / 45) {
      const dt = !last || paused ? 0 : Math.min((timestamp - last) / 1000, 0.05);
      last = timestamp;
      if (!paused || dirty) { render(dt); dirty = false; }
    }
    frame = requestAnimationFrame(tick);
  }
  function visibility() { cancelAnimationFrame(frame); last = 0; if (!document.hidden) frame = requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', visibility); frame = requestAnimationFrame(tick);
  return {
    setFish(fish, loaded) {
      const ids = new Set(fish.map((entry) => entry.id));
      for (const id of swimmers.keys()) if (!ids.has(id)) swimmers.delete(id);
      for (const entry of fish) {
        let swimmer = swimmers.get(entry.id);
        if (swimmer && swimmer.fish.image_url === entry.image_url) { swimmer.fish = entry; continue; }
        swimmer = { ...createSwimmer(entry), entering: initialized, image: new Image() };
        swimmers.set(entry.id, swimmer); swimmer.image.crossOrigin = 'anonymous'; swimmer.image.decoding = 'async';
        swimmer.image.onload = () => { if (stopped || swimmers.get(entry.id) !== swimmer) return; swimmer.age = 0; if (swimmer.entering) spawnBurst(swimmer); dirty = true; };
        swimmer.image.onerror = () => { if (!stopped) onImageError(); };
        try { const url = new URL(entry.image_url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); swimmer.image.src = url.href; }
        catch { onImageError(); }
      }
      if (loaded) initialized = true;
      dirty = true;
    },
    setWeather(weather) { target = environmentFor(weather); dirty = true; },
    setPaused(value) { paused = value; last = 0; dirty = true; },
    destroy() { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); for (const fish of swimmers.values()) { fish.image.onload = null; fish.image.onerror = null; } swimmers.clear(); bursts = []; },
  };
}
