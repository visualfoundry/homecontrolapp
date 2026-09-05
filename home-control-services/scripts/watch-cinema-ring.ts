// =============================================================================
// watch-cinema-ring — catch the Cinema AUTO retrigger ring in the act.
//
//   npm run watch-ring          (or under PM2 as `hca-ringwatch`)
//
// The ring is a trigger cycle across eisy0/2/3 that rewrites `_Room_Cinema_AUTO`
// once or twice a second until the three copies of "Cinema AUTO" happen to agree
// again. It is dormant, not fixed, so the open question is what *starts* it.
//
// That question cannot be answered after the fact. `lastRunTime` keeps only the
// most recent run, so by the time anyone notices the flicker every program in the
// ring reads "just now" and the order that lit it is gone. The only way to see the
// ignition is to already be recording when it happens.
//
// So this keeps a rolling pre-trigger buffer. The baseline loop is deliberately
// cheap — one request every RING_SAMPLE_MS to eisy3, which returns every Cinema
// variable in a single response — and it remembers the last PRE_TRIGGER_MS of
// changes without writing anything. When the variable starts flapping, that buffer
// is flushed to a capture file *first*, so the file opens with the minutes leading
// up to ignition rather than the ignition itself.
//
// Only then does it start the expensive sampling: the ring programs on all three
// units, so the run order is on record while the ring is still spinning.
//
// Load matters here — the units are already suspected of buckling under the 1 Hz
// poll (see project-eisy-poll-timeouts), and a diagnostic that provokes the fault
// it is measuring is worse than none. Baseline is 0.5 req/s against one unit; the
// heavier sampling only runs once something is already wrong.
// =============================================================================

import 'dotenv/config';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EISY_URLS, EISY_USER, EISY_PASS } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'ring-captures');

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

const SAMPLE_MS      = intEnv('RING_SAMPLE_MS', 2_000);
/** How much history to keep before ignition. The answer lives in here. */
const PRE_TRIGGER_MS = intEnv('RING_PRE_TRIGGER_MS', 10 * 60_000);
/** Changes to `_Room_Cinema_AUTO` inside IGNITE_WINDOW_MS that mean "ring is up". */
const IGNITE_COUNT   = intEnv('RING_IGNITE_COUNT', 4);
const IGNITE_WINDOW_MS = intEnv('RING_IGNITE_WINDOW_MS', 30_000);
/** Quiet time after the last flap before a capture is closed. */
const SETTLE_MS      = intEnv('RING_SETTLE_MS', 3 * 60_000);
/** Hard ceiling on one capture. The 2026-09-01 ring ran for hours; without this a
 *  single episode would grow a file unbounded and keep three units under the
 *  extra program-sampling load for as long as it lasted. The ignition is in the
 *  first minute anyway — that is the part worth having. */
const MAX_CAPTURE_MS = intEnv('RING_MAX_CAPTURE_MS', 30 * 60_000);

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------------------------------------------------------------------------
// What we watch
//
// All of these live on eisy3 and arrive in one `/rest/vars/get/2` response, so
// watching the neighbours of the flapping variable is free. That is the point:
// whatever lights the ring almost certainly moves one of them first.
// ---------------------------------------------------------------------------

const EISY_VARS = 3;

const WATCHED_VARS: Record<string, string> = {
  '54':  '_Room_Cinema_AUTO',
  '55':  '_Room_Cinema_DND',
  '56':  '_Room_Cinema_DOOR',
  '20':  '_House_TV_Cinema_On',
  '201': 'Room_Cinema_Lights',
  '202': 'Room_Cinema_Motion_Lights',
  '203': 'Room_Cinema_Motion_Override',
  '204': 'Room_Cinema_Motion_Activated',
  '205': 'Room_Cinema_Motion_Wait_Long',
  '206': 'Room_Cinema_Motion_Wait_Short',
  '207': 'Room_Cinema_DND_Activated',
  '208': 'Room_Cinema_LED',
  '209': 'Cinema_Shades',
  '210': 'Cinema_Screen',
  '211': 'Cinema_Playing_Transition',
};

/** The variable whose flapping defines the ring being up. */
const RING_VAR = '54';

/** The ring members, from the 2026-09-01 lockstep observation. */
const RING_PROGRAMS: Array<{ eisy: number; id: string; name: string }> = [
  { eisy: 3, id: '0046', name: 'Sync - Cinema AUTO OnOff' },
  { eisy: 0, id: '00E5', name: 'Network Sync - Room AUTO Cinema OnOff' },
  { eisy: 0, id: '0145', name: 'Rooms Auto Cinema Button Set' },
  { eisy: 2, id: '0107', name: 'Room Cinema Auto Set Off' },
  { eisy: 2, id: '0109', name: 'Room Cinema Auto Set On' },
  { eisy: 2, id: '01C9', name: 'Scene Button Cinema Auto Set On' },
  { eisy: 2, id: '01CA', name: 'Scene Button Cinema Auto Set Off' },
];

// ---------------------------------------------------------------------------
// EISY reads
// ---------------------------------------------------------------------------

const authHeader = 'Basic ' + Buffer.from(`${EISY_USER}:${EISY_PASS}`).toString('base64');

async function eisyGet(eisy: number, path: string, timeoutMs = 8_000): Promise<string> {
  const res = await fetch(`${EISY_URLS[eisy]}${path}`, {
    headers: { Authorization: authHeader, Accept: 'text/xml', Connection: 'close' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`eisy${eisy} ${path}: HTTP ${res.status}`);
  return res.text();
}

interface VarSample { val: string; ts: string }

/** One request. `ts` is the EISY's own last-changed stamp, which is what makes a
 *  change detectable without sampling fast enough to catch the value mid-flip. */
async function readVars(): Promise<Record<string, VarSample>> {
  const xml = await eisyGet(EISY_VARS, '/rest/vars/get/2');
  const out: Record<string, VarSample> = {};
  for (const m of xml.matchAll(/<var[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/var>/g)) {
    const id = m[1];
    if (!(id in WATCHED_VARS)) continue;
    out[id] = {
      val: /<val>([^<]*)<\/val>/.exec(m[2])?.[1]?.trim() ?? '',
      ts:  /<ts>([^<]*)<\/ts>/.exec(m[2])?.[1]?.trim() ?? '',
    };
  }
  return out;
}

/** Only called once a capture is open — three requests, one per unit. */
async function readRingPrograms(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const units = [...new Set(RING_PROGRAMS.map(p => p.eisy))];
  await Promise.all(units.map(async eisy => {
    let xml: string;
    try {
      xml = await eisyGet(eisy, '/rest/programs?subfolders=true');
    } catch (err) {
      for (const p of RING_PROGRAMS.filter(p => p.eisy === eisy)) {
        out[`eisy${p.eisy}/${p.id}`] = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
      }
      return;
    }
    for (const m of xml.matchAll(/<program\b[^>]*\bid="([0-9A-F]+)"[^>]*>([\s\S]*?)<\/program>/g)) {
      const pid = m[1];
      if (!RING_PROGRAMS.some(p => p.eisy === eisy && p.id === pid)) continue;
      out[`eisy${eisy}/${pid}`] = /<lastRunTime>([^<]*)<\/lastRunTime>/.exec(m[2])?.[1]?.trim() ?? '';
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

type Record_ =
  | { t: string; kind: 'change'; changed: Record<string, { name: string; from: string; to: string; eisyTs: string }> }
  | { t: string; kind: 'ignition'; flapsInWindow: number; note: string }
  | { t: string; kind: 'programs'; lastRunTimes: Record<string, string> }
  | { t: string; kind: 'settled'; quietMs: number }
  | { t: string; kind: 'error'; message: string };

const stamp = () => new Date().toISOString();

/** Pre-trigger history. Trimmed by age, never written unless the ring lights. */
const buffer: Record_[] = [];

function remember(rec: Record_): void {
  buffer.push(rec);
  const cutoff = Date.now() - PRE_TRIGGER_MS;
  while (buffer.length && Date.parse(buffer[0].t) < cutoff) buffer.shift();
}

let captureFile: string | null = null;
let captureOpenedAt = 0;

function write(rec: Record_): void {
  if (!captureFile) return;
  appendFileSync(captureFile, JSON.stringify(rec) + '\n');
}

function openCapture(flaps: number): void {
  mkdirSync(OUT_DIR, { recursive: true });
  captureFile = join(OUT_DIR, `ring-${stamp().replace(/[:.]/g, '-')}.jsonl`);
  captureOpenedAt = Date.now();
  // The buffer goes down first, so the file reads as cause then effect.
  writeFileSync(
    captureFile,
    buffer.map(r => JSON.stringify(r)).join('\n') + (buffer.length ? '\n' : ''),
  );
  write({
    t: stamp(), kind: 'ignition', flapsInWindow: flaps,
    note: `${RING_VAR} (${WATCHED_VARS[RING_VAR]}) changed ${flaps}x in ${IGNITE_WINDOW_MS / 1000}s. ` +
          `The ${buffer.length} record(s) above this line are the ${PRE_TRIGGER_MS / 60000} minutes before it.`,
  });
  console.log(`[ring] IGNITION — ${flaps} flaps in ${IGNITE_WINDOW_MS / 1000}s. Capturing to ${captureFile}`);
}

function closeCapture(quietMs: number): void {
  write({ t: stamp(), kind: 'settled', quietMs });
  console.log(`[ring] settled after ${Math.round(quietMs / 1000)}s quiet — closed ${captureFile}`);
  captureFile = null;
}

// ---------------------------------------------------------------------------
// Loop
//
// The two EISY reads sit behind swappable references so the self-test below can
// drive the real detection, buffering and capture code with synthetic samples.
// The house is usually quiet for hours at a time, so waiting for a natural
// trigger is not a way to find out whether any of this works.
// ---------------------------------------------------------------------------

let sampleVars: () => Promise<Record<string, VarSample>> = readVars;
let samplePrograms: () => Promise<Record<string, string>> = readRingPrograms;

/** Times we saw RING_VAR's eisy timestamp move. */
const flaps: number[] = [];
let previous: Record<string, VarSample> | null = null;
let lastFlapAt = 0;

async function tick(): Promise<void> {
  let now: Record<string, VarSample>;
  try {
    now = await sampleVars();
  } catch (err) {
    const rec: Record_ = { t: stamp(), kind: 'error', message: err instanceof Error ? err.message : String(err) };
    remember(rec); write(rec);
    return;
  }

  if (previous) {
    const changed: Record<string, { name: string; from: string; to: string; eisyTs: string }> = {};
    for (const [id, cur] of Object.entries(now)) {
      const was = previous[id];
      // A rewrite with the same value still moves the EISY's stamp, and during the
      // ring most writes are exactly that — so comparing values alone would miss it.
      if (was && was.val === cur.val && was.ts === cur.ts) continue;
      if (!was) continue;
      changed[id] = { name: WATCHED_VARS[id], from: was.val, to: cur.val, eisyTs: cur.ts };
    }
    if (Object.keys(changed).length > 0) {
      const rec: Record_ = { t: stamp(), kind: 'change', changed };
      remember(rec); write(rec);
    }

    if (changed[RING_VAR]) {
      const at = Date.now();
      flaps.push(at);
      lastFlapAt = at;
      while (flaps.length && flaps[0] < at - IGNITE_WINDOW_MS) flaps.shift();
      if (!captureFile && flaps.length >= IGNITE_COUNT) openCapture(flaps.length);
    }
  }
  previous = now;

  if (captureFile) {
    // Only while something is actually wrong.
    try {
      write({ t: stamp(), kind: 'programs', lastRunTimes: await samplePrograms() });
    } catch (err) {
      write({ t: stamp(), kind: 'error', message: `programs: ${err instanceof Error ? err.message : String(err)}` });
    }
    const quiet = Date.now() - lastFlapAt;
    const openFor = Date.now() - captureOpenedAt;
    if (quiet >= SETTLE_MS) closeCapture(quiet);
    else if (openFor >= MAX_CAPTURE_MS) {
      console.log(`[ring] capture hit the ${MAX_CAPTURE_MS / 60000} min ceiling while still flapping`);
      closeCapture(quiet);
      flaps.length = 0; // a fresh episode has to re-ignite rather than resume
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `[ring] watching ${WATCHED_VARS[RING_VAR]} on eisy${EISY_VARS} every ${SAMPLE_MS}ms; ` +
    `ignition = ${IGNITE_COUNT} changes in ${IGNITE_WINDOW_MS / 1000}s; ` +
    `keeping ${PRE_TRIGGER_MS / 60000} min of pre-trigger history; captures → ${OUT_DIR}`,
  );
  for (;;) {
    const t0 = Date.now();
    await tick();
    const wait = Math.max(0, SAMPLE_MS - (Date.now() - t0));
    if (wait > 0) await new Promise<void>(r => setTimeout(r, wait));
  }
}

// ---------------------------------------------------------------------------
// Self-test — `npm run watch-ring -- --selftest`
//
// Feeds a scripted sequence through the real tick(): quiet, then one unrelated
// variable moving (the "cause"), then the ring var flapping, then quiet again.
// Asserts that a capture appeared, that the cause is in the file *above* the
// ignition line, and that the capture closed on its own. Touches no hardware.
// ---------------------------------------------------------------------------

async function selfTest(): Promise<void> {
  const state: Record<string, VarSample> = {};
  for (const id of Object.keys(WATCHED_VARS)) state[id] = { val: '0', ts: 'seed' };
  let step = 0;

  sampleVars = () => {
    step += 1;
    // step 3: an unrelated Cinema variable moves — this is the plant we expect
    // to find sitting above the ignition line afterwards.
    if (step === 3) state['55'] = { val: '1', ts: 'cause-' + step };
    // steps 5..5+IGNITE_COUNT: the ring var is rewritten, value flipping. Then it
    // stops — a sampler that flapped for ever could never demonstrate settling.
    if (step >= 5 && step <= 5 + IGNITE_COUNT) {
      state[RING_VAR] = { val: step % 2 ? '1' : '0', ts: 'flap-' + step };
    }
    return Promise.resolve(structuredClone(state));
  };
  samplePrograms = () => Promise.resolve({ 'eisy3/0046': 'synthetic' });

  const before = new Set(lsCaptures());
  for (let i = 0; i < 5 + IGNITE_COUNT + 1; i++) await tick();

  const created = lsCaptures().filter(f => !before.has(f));
  assert(created.length === 1, `expected exactly 1 capture file, got ${created.length}`);
  const lines = readFileSync(join(OUT_DIR, created[0]), 'utf8').trim().split('\n').map(l => JSON.parse(l) as Record_);

  const igniteAt = lines.findIndex(r => r.kind === 'ignition');
  assert(igniteAt >= 0, 'capture has no ignition record');
  const causeAt = lines.findIndex(r => r.kind === 'change' && '55' in (r as { changed: object }).changed);
  assert(causeAt >= 0, 'the pre-trigger cause was not carried into the capture');
  assert(causeAt < igniteAt, `cause must precede ignition (cause@${causeAt}, ignition@${igniteAt})`);
  assert(lines.some(r => r.kind === 'programs'), 'no program snapshot was taken during capture');

  // Quiet again: the capture should close itself once SETTLE_MS has passed.
  lastFlapAt = Date.now() - SETTLE_MS - 1;
  await tick();
  assert(captureFile === null, 'capture did not close after settling');

  console.log(`[ring] self-test OK — ${lines.length} records, cause@${causeAt} before ignition@${igniteAt}, capture closed`);
  rmSync(join(OUT_DIR, created[0]));
}

function lsCaptures(): string[] {
  try { return readdirSync(OUT_DIR); } catch { return []; }
}

function assert(ok: boolean, message: string): void {
  if (!ok) { console.error(`[ring] self-test FAILED: ${message}`); process.exit(1); }
}

const run = process.argv.includes('--selftest') ? selfTest : main;
void run().catch((err: unknown) => {
  console.error('[ring] fatal:', err);
  process.exit(1);
});
