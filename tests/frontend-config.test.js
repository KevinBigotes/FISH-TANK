import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicConfig } from '../frontend/src/lib/config.js';
import { authErrorMessage } from '../frontend/src/lib/auth-errors.js';

test('la configuración permite claves públicas y rechaza secretos y HTTP remoto', () => {
  const valid = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example', VITE_AUTH_USER_SERVICE_URL: 'http://localhost:3001/' };
  assert.deepEqual(readPublicConfig(valid).errors, []);
  assert.equal(readPublicConfig(valid).authServiceUrl, 'http://localhost:3001');
  assert.ok(readPublicConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_example' }).errors.length);
  assert.ok(readPublicConfig({ ...valid, VITE_AUTH_USER_SERVICE_URL: 'http://api.example.com' }).errors.length);
  assert.ok(readPublicConfig({}, {}).errors.length);
});

test('Pages puede autenticar con la configuración pública sin backend Node', () => {
  const config = readPublicConfig({});
  assert.deepEqual(config.errors, []);
  assert.equal(config.authServiceUrl, '');
  assert.equal(new URL(config.supabaseUrl).hostname, 'zskigxxernjyvectrjhl.supabase.co');
  assert.ok(config.supabaseKey.startsWith('sb_publishable_'));
  assert.deepEqual(readPublicConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }).errors, []);
});

test('los errores de autenticación dan instrucciones específicas sin filtrar errores internos', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /Confirma tu correo/);
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /no son correctos/);
  assert.match(authErrorMessage({ message: 'Database error saving new user' }), /otro nombre/);
  assert.doesNotMatch(authErrorMessage({ message: 'internal sensitive stack' }), /sensitive/);
});
