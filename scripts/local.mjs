import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { projectConfig } from '../frontend/src/lib/project-config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2] || 'dev';
const allowed = new Set(['dev', 'build', 'test', 'preview', 'install', 'doctor']);
if (!allowed.has(command)) {
  console.error('Usa INICIAR.cmd [dev|build|test|preview|install|doctor].');
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
  await createIfMissing('frontend/.env', `VITE_AUTH_USER_SERVICE_URL=http://localhost:3001\n`);
  await createIfMissing('services/auth-user-service/.env', [
    'PORT=3001', 'HOST=127.0.0.1', `SUPABASE_URL=${projectConfig.supabaseUrl}`,
    `SUPABASE_PUBLISHABLE_KEY=${projectConfig.supabaseKey}`,
    'CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://kevinbigotes.github.io',
    'TRUST_PROXY_HOPS=0', '',
  ].join('\n'));
}
if (command === 'install' || !existsSync(path.join(root, 'node_modules/.modules.yaml'))) {
  run(['install', '--frozen-lockfile']);
}
if (command !== 'install') run([command]);
