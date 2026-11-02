// Live smoke with isolated fictitious records; never calls TikTok or touches client profiles.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
if (!process.argv.includes('--live')) throw Error('Use --live with the deployment environment to run the isolated storage smoke.');
const require = createRequire(import.meta.url), ts = require('typescript');
const admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const storage = admin.storage.from('tiktok-profile-links'), written = new Set();
const encryption = {}, exports = {};
const compile = file => ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compile('lib/crypto/encryption.server.ts'), { exports: encryption, Buffer, require(path) {
  if (path === 'node:crypto') return require(path);
  if (path.includes('env.server')) return { serverEnv: { encryptionKey: process.env.ENCRYPTION_KEY, isProduction: true } };
  throw Error('Unexpected crypto import');
} });
vm.runInNewContext(compile('lib/integrations/tiktok/profile-links.server.ts'), { exports, Date, Promise, require(path) {
  if (path === 'server-only') return {};
  if (path === 'node:crypto') return require(path);
  if (path.includes('encryption')) return encryption;
  if (path.includes('supabase/admin')) return { createAdminClient: () => ({ storage: { from: () => ({
    upload: async (...args) => { written.add(args[0]); return storage.upload(...args); },
    download: (...args) => storage.download(...args), list: (...args) => storage.list(...args),
  }) } }) };
  throw Error('Unexpected profile import');
} });
const run = randomUUID(), clienteId = 'isolated-storage-smoke-' + run;
try {
  const input = { clienteId, userId: 'storage-smoke', bcId: 'smoke-' + run, assetId: 'smoke-' + run, name: 'Perfil ficticio de prueba' };
  const saved = await exports.saveTikTokProfile(input);
  assert.equal((await exports.saveTikTokProfile(input)).id, saved.id);
  assert.equal((await exports.listSavedTikTokProfiles(clienteId))[0].id, saved.id);
  await assert.rejects(exports.saveTikTokProfile({ ...input, clienteId: clienteId + '-foreign' }), /otro cliente/);
  await assert.rejects(exports.getSavedTikTokProfile(clienteId + '-foreign', saved.id));
  await exports.markTikTokProfileDisconnected(clienteId,saved.id);
  assert.equal((await exports.listSavedTikTokProfiles(clienteId)).length,0);
  assert.ok((await exports.getSavedTikTokProfile(clienteId,saved.id)).disconnectedAt);
  const restored = await exports.saveTikTokProfile(input);
  assert.equal(restored.id,saved.id);assert.equal(restored.disconnectedAt,undefined);
  assert.notEqual(restored.revision,saved.revision);
  for (const path of written) {
    const content = await storage.download(path);
    assert.equal(content.error, null); const raw = await content.data.text();
    assert.ok(raw.startsWith('v1:')); assert.ok(!raw.includes(clienteId));
  }
  console.log('Live storage smoke passed: encrypted persistence, repeat-save stability, foreign-client rejection and scoped read. No TikTok calls.');
} finally {
  const result = await storage.remove([...written]);
  if (result.error) throw Error('Could not remove isolated smoke objects.');
  console.log('Isolated fictitious smoke records removed.');
}
