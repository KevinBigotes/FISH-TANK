import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { networkInterfaces } from 'node:os';
import { projectConfig } from '../frontend/src/lib/project-config.js';
import { isPrivateHost } from '../frontend/src/lib/network.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const lanMode = process.argv[2] === 'lan';
const command = lanMode ? 'dev' : process.argv[2] || 'dev';
const allowed = new Set(['dev', 'build', 'test', 'preview', 'install', 'doctor']);
if (!allowed.has(command)) {
  console.error('Usa INICIAR.cmd [dev|lan|build|test|preview|install|doctor].');
  process.exit(1);
}
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Fish Tank necesita Node.js 24 o posterior. Actualiza Node desde https://nodejs.org/');
  process.exit(1);
}

// Buscar el CLI de pnpm junto al Node disponible; no requiere npm ni instalaciones globales.
const nodeRoot = path.resolve(path.dirname(process.execPath), '..');
const candidates = [
  process.env.npm_execpath,
  ...['pnpm.mjs', 'pnpm.cjs'].map((file) => path.join(nodeRoot, 'node_modules', 'pnpm', 'bin', file)),
  ...['pnpm.mjs', 'pnpm.cjs'].map((file) => path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', file)),
].filter((file) => file && /pnpm\.(mjs|cjs|js)$/.test(file));
const pnpmEntry = candidates.find(existsSync);
const pnpmCommand = pnpmEntry ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const baseArgs = pnpmEntry ? [pnpmEntry] : [];
const env = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}` };
function run(args) {
  const result = spawnSync(pnpmCommand, [...baseArgs, ...args], {
    cwd: root, env, stdio: 'inherit', shell: !pnpmEntry && process.platform === 'win32', windowsHide: true,
  });
  if (result.error) {
    console.error('No se pudo iniciar pnpm. Instala pnpm siguiendo https://pnpm.io/installation');
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

if (command === 'doctor') {
  console.log(`Node ${process.versions.node}: disponible.`);
  run(['--version']);
  console.log('Lanzador listo. Ejecuta INICIAR.cmd para iniciar Fish Tank.');
  process.exit(0);
}

async function createIfMissing(relativePath, contents) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  try { await writeFile(target, contents, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
if (command === 'dev') {
  await createIfMissing('services/gallery-collection-service/.env', `PORT=3004\nHOST=127.0.0.1\nSUPABASE_URL=${projectConfig.supabaseUrl}\nSUPABASE_PUBLISHABLE_KEY=${projectConfig.supabaseKey}\nCORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://kevinbigotes.github.io\n`);
  await createIfMissing('frontend/.env', `VITE_AUTH_USER_SERVICE_URL=http://localhost:3001\nVITE_DRAWING_PROCESSING_SERVICE_URL=http://localhost:3002\n`);
  const frontendEnv = path.join(root, 'frontend/.env');
  if (!/^VITE_GALLERY_COLLECTION_SERVICE_URL=/m.test(await readFile(frontendEnv, 'utf8'))) await appendFile(frontendEnv, '\nVITE_GALLERY_COLLECTION_SERVICE_URL=http://localhost:3004\n');
  if (!/^VITE_DRAWING_PROCESSING_SERVICE_URL=/m.test(await readFile(frontendEnv, 'utf8'))) {
    await appendFile(frontendEnv, '\nVITE_DRAWING_PROCESSING_SERVICE_URL=http://localhost:3002\n');
  }
  if (!/^VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL=/m.test(await readFile(frontendEnv, 'utf8'))) {
    await appendFile(frontendEnv, '\nVITE_AQUARIUM_ECOSYSTEM_SERVICE_URL=http://localhost:3003\n');
  }
  await createIfMissing('services/drawing-processing-service/.env', await readFile(path.join(root, 'services/drawing-processing-service/.env.example'), 'utf8'));
  await createIfMissing('services/aquarium-ecosystem-service/.env', await readFile(path.join(root, 'services/aquarium-ecosystem-service/.env.example'), 'utf8'));
  const drawingFile = path.join(root, 'services/drawing-processing-service/.env');
  const aquariumFile = path.join(root, 'services/aquarium-ecosystem-service/.env');
  const drawingEnv = parseEnv(await readFile(drawingFile, 'utf8'));
  const aquariumEnv = parseEnv(await readFile(aquariumFile, 'utf8'));
  if (drawingEnv.ECOSYSTEM_SERVICE_TOKEN && aquariumEnv.ECOSYSTEM_SERVICE_TOKEN && drawingEnv.ECOSYSTEM_SERVICE_TOKEN !== aquariumEnv.ECOSYSTEM_SERVICE_TOKEN) {
    throw new Error('ECOSYSTEM_SERVICE_TOKEN debe coincidir en los servicios de dibujos y pecera.');
  }
  const token = drawingEnv.ECOSYSTEM_SERVICE_TOKEN || aquariumEnv.ECOSYSTEM_SERVICE_TOKEN || randomBytes(32).toString('hex');
  for (const file of [drawingFile, aquariumFile]) {
    let contents = await readFile(file, 'utf8');
    if (!parseEnv(contents).ECOSYSTEM_SERVICE_TOKEN) {
      contents = contents.replace(/^ECOSYSTEM_SERVICE_TOKEN=.*\r?\n?/m, '');
      await writeFile(file, `${contents.trimEnd()}\nECOSYSTEM_SERVICE_TOKEN=${token}\n`);
    }
  }
  if (!drawingEnv.AQUARIUM_ECOSYSTEM_SERVICE_URL) await appendFile(drawingFile, '\nAQUARIUM_ECOSYSTEM_SERVICE_URL=http://127.0.0.1:3003\n');
  await createIfMissing('services/auth-user-service/.env', [
    'PORT=3001', 'HOST=127.0.0.1', `SUPABASE_URL=${projectConfig.supabaseUrl}`,
    `SUPABASE_PUBLISHABLE_KEY=${projectConfig.supabaseKey}`,
    'CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://kevinbigotes.github.io',
    'TRUST_PROXY_HOPS=0', '',
  ].join('\n'));
  if (lanMode) {
    const addresses = [...new Set(Object.values(networkInterfaces()).flat().filter((item) => item && !item.internal && item.family === 'IPv4' && isPrivateHost(item.address)).map((item) => item.address))];
    if (!addresses.length) throw new Error('No se encontró una dirección IPv4 privada. Conecta la PC a tu red local.');
    env.HOST = '0.0.0.0'; env.FISH_TANK_LAN = 'true'; env.VITE_LAN_MODE = 'true';
    env.CORS_ORIGINS = [...new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'https://kevinbigotes.github.io', ...addresses.map((address) => `http://${address}:5173`), ...(env.CORS_ORIGINS || '').split(',').filter(Boolean)])].join(',');
    console.log('PC y teléfono deben estar en la misma red. Abre la pecera con una de estas direcciones para que el QR funcione:');
    for (const address of addresses) console.log(`http://${address}:5173/#/pecera`);
  } else console.log('Pecera: http://localhost:5173/#/pecera · Para probar el QR con teléfono: INICIAR.cmd lan');
}
const currentLock = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const installedLock = await readFile(path.join(root, 'node_modules/.pnpm/lock.yaml'), 'utf8').catch(() => null);
if (command === 'install' || currentLock !== installedLock || !existsSync(path.join(root, 'node_modules/.modules.yaml'))) {
  run(['install', '--frozen-lockfile']);
}
if (command !== 'install') run([command]);
