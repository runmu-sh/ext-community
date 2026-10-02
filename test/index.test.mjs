/**
 * `npm test`: the extension in the headless μClient host (@runmu.sh/dev/test), fed GMCP and a recording.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREATED_FROM = '/tank/data/Dev/games/muClient/clients/extensions/dev/test.mjs';
function find() {
  if (process.env.MUCLIENT_DEV_TEST) return process.env.MUCLIENT_DEV_TEST;
  try { return createRequire(join(ROOT, 'package.json')).resolve('@runmu.sh/dev/test'); } catch { /* next */ }
  if (CREATED_FROM && existsSync(CREATED_FROM)) return CREATED_FROM;
  throw new Error('@runmu.sh/dev/test was not found. Run npm install (it is in the @runmu.sh/dev devDependency).');
}
const { createHost } = await import(pathToFileURL(find()).href);

/** A host whose toasts keep every option, whose announcements are recorded, and whose GMCP handler we can call with any meta. */
async function setup(opts = {}) {
  const host = createHost({ root: ROOT, ...opts });
  const toasts = [];
  const spoken = [];
  const handlers = [];
  host.mu.ui.toast = (title, body, o) => { toasts.push({ title, body, ...o }); };
  host.mu.a11y.announce = (text, o) => { spoken.push({ text, ...o }); };
  const on = host.mu.gmcp.on;
  host.mu.gmcp.on = (pkg, fn, o) => { handlers.push({ pkg, fn }); return on(pkg, fn, o); };
  const ext = await host.load('src/index.ts');
  const call = (pkg, data, meta = {}) => { for (const h of handlers) h.fn(data, { id: 'x', sid: 's1', worldId: 'w1', ts: Date.now(), origin: { kind: 'game', self: false }, replay: false, pkg, ...meta }); };
  return { host, ext, toasts, spoken, call };
}

test('kudos: giver → receiver: message, kind kudos, grouped, 7 s, read aloud', async () => {
  const { host, toasts, spoken } = await setup();
  host.gmcp('Client.Community.Kudos', { giver: 'Vessa', receiver: 'Ivo', message: 'for the tour' });
  assert.deepEqual(toasts, [{ title: 'Kudos', body: 'Vessa → Ivo: for the tour', kind: 'kudos', timeoutMs: 7000, group: 'community.kudos' }]);
  assert.deepEqual(spoken, [{ text: 'Kudos: Vessa → Ivo: for the tour' }]);
  assert.deepEqual(host.sent, [], 'sends nothing to the game');
  assert.equal(host.errors.length, 0);
  await host.unload();
  assert.deepEqual(host.live(), [], 'everything registered through mu is disposed');
});

test('kudos: anonymous and missing giver read "Someone"; no message, no colon', async () => {
  const { host, toasts } = await setup();
  host.gmcp('Client.Community.Kudos', { giver: 'Vessa', receiver: 'Ivo', anonymous: true });
  host.gmcp('client.community.kudos', { receiver: 'Ivo' });
  assert.deepEqual(toasts.map((t) => t.body), ['Someone → Ivo', 'Someone → Ivo']);
  await host.unload();
});

test('milestone: its label, kind milestone, never grouped', async () => {
  const { host, toasts } = await setup();
  host.gmcp('Client.Community.Milestone', { label: '1000 scenes logged' });
  assert.deepEqual(toasts, [{ title: 'Milestone', body: '1000 scenes logged', kind: 'milestone', timeoutMs: 7000 }]);
  await host.unload();
});

test('event: kind is the title (community_ prefix dropped), text or message the body', async () => {
  const { host, toasts } = await setup();
  host.gmcp('Client.Community.Event', { kind: 'community_spotlight', text: "Ivo's scene" });
  host.gmcp('Client.Community.Event', { kind: 'Festival', message: 'starts at dusk' });
  host.gmcp('Client.Community.Event', { kind: 'quiet' });
  assert.deepEqual(toasts.map((t) => [t.title, t.body, t.kind, t.group]), [
    ['spotlight', "Ivo's scene", 'info', 'community.event'],
    ['Festival', 'starts at dusk', 'info', 'community.event'],
    ['quiet', undefined, 'info', 'community.event'],
  ]);
  await host.unload();
});

test('payloads with nothing to show raise nothing and log a warning', async () => {
  const { host, toasts } = await setup();
  host.gmcp('Client.Community.Kudos', { giver: 'Vessa' });
  host.gmcp('Client.Community.Milestone', {});
  host.gmcp('Client.Community.Event', { text: 'no kind' });
  host.gmcp('Client.Community.Unknown', { a: 1 });
  assert.deepEqual(toasts, []);
  assert.equal(host.logs.filter((l) => l.level === 'warn').length, 4);
  assert.equal(host.errors.length, 0);
  await host.unload();
});

test('a replayed event (snapshot on reconnect, late activation) raises nothing', async () => {
  const { host, toasts, spoken, call } = await setup();
  call('Client.Community.Kudos', { receiver: 'Ivo' }, { replay: true });
  call('Client.Community.Milestone', { label: 'x' }, { replay: true });
  assert.deepEqual(toasts, []);
  assert.deepEqual(spoken, []);
  call('Client.Community.Milestone', { label: 'x' });
  assert.equal(toasts.length, 1);
  await host.unload();
});

test('only the effect owner reads it aloud (the host gates the toast itself)', async () => {
  const { host, spoken } = await setup();
  host.mu.effects.owner = () => false;
  host.gmcp('Client.Community.Milestone', { label: 'x' });
  assert.deepEqual(spoken, []);
  await host.unload();
});

test('each kind mutes on its own; Read them aloud off keeps the toast; toast time follows the setting', async () => {
  const { host, toasts, spoken } = await setup({ settings: { kudos: false, toastSeconds: 12, announce: false } });
  host.gmcp('Client.Community.Kudos', { receiver: 'Ivo' });
  host.gmcp('Client.Community.Milestone', { label: 'm' });
  host.mu.settings.set('milestones', false);
  host.mu.settings.set('events', false);
  host.gmcp('Client.Community.Milestone', { label: 'm2' });
  host.gmcp('Client.Community.Event', { kind: 'e' });
  assert.deepEqual(toasts.map((t) => [t.title, t.timeoutMs]), [['Milestone', 12000]]);
  assert.deepEqual(spoken, []);
  host.mu.settings.set('toastSeconds', 600);
  host.mu.settings.set('kudos', true);
  host.gmcp('Client.Community.Kudos', { receiver: 'Ivo' });
  assert.equal(toasts.at(-1).timeoutMs, 60000, 'clamped to 60 s');
  await host.unload();
});

test('settings page: five rows, defaults on, 7 s', async () => {
  const { host } = await setup();
  const items = host.settingsSchema.items.map((i) => [i.key, i.default]);
  assert.deepEqual(items, [['kudos', true], ['milestones', true], ['events', true], ['toastSeconds', 7], ['announce', true]]);
  await host.unload();
});

test('the exported API raises the same toasts, and its mappers are pure', async () => {
  const { host, ext, toasts } = await setup();
  assert.equal(ext.api.kudos({ giver: 'A', receiver: 'B' }), true);
  assert.equal(ext.api.milestone({ label: '' }), false);
  assert.equal(ext.api.event({ kind: 'community_raid', text: 'go' }), true);
  assert.deepEqual(toasts.map((t) => [t.title, t.body]), [['Kudos', 'A → B'], ['raid', 'go']]);
  assert.deepEqual(ext.api.toMilestone({ label: 'L' }), { moment: 'milestone', kind: 'milestone', title: 'Milestone', body: 'L' });
  assert.equal(ext.api.toKudos('nope'), null);
  host.mu.settings.set('kudos', false);
  assert.equal(ext.api.kudos({ receiver: 'B' }), false, 'muted kinds are muted for the API too');
  await host.unload();
});

test('follows a recorded session (test/fixtures/session.murec)', async () => {
  const { host, toasts } = await setup();
  assert.equal(await host.play('test/fixtures/session.murec'), 4);
  assert.deepEqual(toasts.map((t) => t.title), ['Kudos', 'Milestone', 'spotlight']);
  await host.unload();
});

// ─── the payload contracts (the host validates inbound messages with them before the handler runs) ───────────
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
/** The subset μClient's validator implements (type, required, properties), enough for these schemas. */
function check(schema, data, path = '$') {
  if (schema.type) { const want = [schema.type].flat(); const got = typeOf(data); if (!want.some((t) => t === got || (t === 'number' && got === 'integer'))) return `${path}: expected ${want.join(' or ')}, got ${got}`; }
  if (typeOf(data) === 'object') {
    for (const r of schema.required ?? []) if (!(r in data)) return `${path}.${r}: required`;
    for (const [k, v] of Object.entries(data)) { const ps = schema.properties?.[k]; if (ps) { const e = check(ps, v, `${path}.${k}`); if (e) return e; } }
  }
  return null;
}
test('manifest declares Client.Community 1 with an inbound contract for each message', () => {
  const [g] = pkg.muclient.contributes.gmcp;
  assert.equal(g.package, 'Client.Community 1');
  assert.deepEqual(Object.keys(g.messages).sort(), ['Client.Community.Event', 'Client.Community.Kudos', 'Client.Community.Milestone']);
  for (const m of Object.values(g.messages)) { assert.equal(m.dir, 'in'); assert.ok(existsSync(join(ROOT, m.schema)), m.schema); }
  assert.ok(pkg.files.includes('schema'), 'the schemas ship with the package');
});
test('contracts accept the documented payloads and reject malformed ones', () => {
  const s = (n) => JSON.parse(readFileSync(join(ROOT, 'schema', `${n}.json`), 'utf8'));
  const kudos = s('kudos'), milestone = s('milestone'), event = s('event');
  assert.equal(check(kudos, { giver: 'a', receiver: 'b', message: 'm', anonymous: true }), null);
  assert.equal(check(kudos, { receiver: 'b' }), null);
  assert.equal(check(kudos, { giver: 'a' }), '$.receiver: required');
  assert.equal(check(kudos, { receiver: 'b', anonymous: 'yes' }), '$.anonymous: expected boolean, got string');
  assert.equal(check(kudos, 'b'), '$: expected object, got string');
  assert.equal(check(milestone, { label: 'x' }), null);
  assert.equal(check(milestone, { label: 3 }), '$.label: expected string, got integer');
  assert.equal(check(event, { kind: 'k', text: 't' }), null);
  assert.equal(check(event, { text: 't' }), '$.kind: required');
});
