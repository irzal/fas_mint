// Tes server untuk .fa dan NFA (sub tahap 6g).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buatServer } = require('../src/web/server');

let server;
let alamat;

before(async () => {
  server = buatServer();
  await new Promise((resolve) => server.listen(0, resolve));
  alamat = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const post = async (jalur, body) => {
  const res = await fetch(alamat + jalur, { method: 'POST', body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
};
const contoh = async (nama) => (await fetch(alamat + '/api/contoh/' + nama)).text();

// ---------- daftar dan isi contoh ----------

test('daftar contoh memuat .dfa dan .fa', async () => {
  const { contoh: daftar } = await (await fetch(alamat + '/api/contoh')).json();
  assert.ok(daftar.includes('berakhiran-01.dfa'));
  assert.ok(daftar.includes('nfa-berakhiran-01.fa'));
  assert.ok(daftar.every((n) => n.endsWith('.dfa') || n.endsWith('.fa')));
});

test('isi contoh .fa bisa diambil', async () => {
  const res = await fetch(alamat + '/api/contoh/nfa-berakhiran-01.fa');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^type: NFA/);
});

test('folder contoh: .fa ikut didaftar dan diurutkan; ekstensi lain tidak', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fas-fa-'));
  try {
    for (const n of ['c.fa', 'a.dfa', 'b.txt', 'd.fax']) fs.writeFileSync(path.join(dir, n), 'x');
    const s = buatServer({ folderContoh: dir });
    await new Promise((r) => s.listen(0, r));
    try {
      const dasar = `http://localhost:${s.address().port}`;
      assert.deepEqual((await (await fetch(dasar + '/api/contoh')).json()).contoh, ['a.dfa', 'c.fa']);
      assert.equal((await fetch(dasar + '/api/contoh/c.fa')).status, 200);
      assert.equal((await fetch(dasar + '/api/contoh/d.fax')).status, 404);
    } finally {
      s.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- format ----------

test('tanpa field format: dibaca sebagai .dfa (perilaku lama), jawaban memuat type', async () => {
  const { status, data } = await post('/api/simulasi', { dfa: await contoh('berakhiran-01.dfa'), input: '01' });
  assert.equal(status, 200);
  assert.equal(data.type, 'DFA');
  assert.deepEqual(data.automaton, data.dfa);
  assert.equal(data.result.finalState, 'q2');
});

test('format tidak sah dijawab 400', async () => {
  for (const format of ['nfa', 5, null]) {
    const { status, data } = await post('/api/analisis', { dfa: 'x', format });
    assert.equal(status, 400, String(format));
    assert.match(data.error, /"format" harus "fa" atau "dfa"/);
  }
});

// ---------- simulasi ----------

test('simulasi NFA: jejak himpunan per langkah', async () => {
  const { status, data } = await post('/api/simulasi', { dfa: await contoh('nfa-berakhiran-01.fa'), input: '001', format: 'fa' });
  assert.equal(status, 200);
  assert.equal(data.type, 'NFA');
  assert.deepEqual(data.errors, []);
  assert.equal(data.result.accepted, true);
  assert.deepEqual(data.result.finalStates, ['q0', 'q2']);
  assert.deepEqual(data.result.steps.map((s) => s.to), [['q0', 'q1'], ['q0', 'q1'], ['q0', 'q2']]);
  assert.deepEqual(data.automaton.transitions[0].to, ['q0', 'q1']);
});

test('simulasi NFA dengan ε', async () => {
  const { data } = await post('/api/simulasi', { dfa: await contoh('nfa-epsilon-a-lalu-b.fa'), input: 'aab', format: 'fa' });
  assert.equal(data.result.accepted, true);
  assert.deepEqual(data.result.start.states, ['baca_a', 'baca_b']);
});

test('simulasi .fa ber-type: DFA memakai jejak DFA', async () => {
  const { data } = await post('/api/simulasi', { dfa: await contoh('dfa-mengandung-11.fa'), input: '0110', format: 'fa' });
  assert.equal(data.type, 'DFA');
  assert.equal(data.result.finalState, 'ketemu');
});

test('simulasi NFA tidak valid: 200 dengan errors, result null', async () => {
  const { status, data } = await post('/api/simulasi', { dfa: await contoh('tidak-valid-nfa-state-tak-dikenal.fa'), input: 'a', format: 'fa' });
  assert.equal(status, 200);
  assert.equal(data.result, null);
  assert.equal(data.errors.length, 3);
});

test('simulasi NFA: simbol di luar Σ dijawab 400 dengan posisi', async () => {
  const { status, data } = await post('/api/simulasi', { dfa: await contoh('nfa-berakhiran-01.fa'), input: '0x', format: 'fa' });
  assert.equal(status, 400);
  assert.equal(data.position, 2);
});

test('simulasi: kesalahan sintaks .fa dijawab 400', async () => {
  const { status, data } = await post('/api/simulasi', { dfa: await contoh('tidak-valid-dfa-notasi-himpunan.fa'), input: '', format: 'fa' });
  assert.equal(status, 400);
  assert.match(data.error, /baris 13: notasi himpunan/);
});

// ---------- analisis ----------

test('analisis NFA: type dan automaton, tanpa result', async () => {
  const { status, data } = await post('/api/analisis', { dfa: await contoh('nfa-ketiga-dari-akhir-1.fa'), format: 'fa' });
  assert.equal(status, 200);
  assert.equal(data.syntaxError, null);
  assert.equal(data.type, 'NFA');
  assert.deepEqual(data.errors, []);
  assert.deepEqual(data.automaton.states, ['q0', 'q1', 'q2', 'q3']);
  assert.equal('result' in data, false);
});

test('analisis: teks tanpa type: dengan format fa dibaca sebagai NFA; dengan format dfa sebagai DFA', async () => {
  const teks = 'states: q0\nalphabet: 0 1\nstart: q0\naccept:\n';
  const fa = (await post('/api/analisis', { dfa: teks, format: 'fa' })).data;
  assert.equal(fa.type, 'NFA');
  assert.deepEqual(fa.errors, []);
  const dfa = (await post('/api/analisis', { dfa: teks, format: 'dfa' })).data;
  assert.equal(dfa.type, 'DFA');
  assert.deepEqual(dfa.errors, ['δ(q0, 0) belum didefinisikan', 'δ(q0, 1) belum didefinisikan']);
});

test('analisis: sintaks salah tetap 200, type dan automaton null', async () => {
  const { status, data } = await post('/api/analisis', { dfa: 'type: PDA\n', format: 'fa' });
  assert.equal(status, 200);
  assert.match(data.syntaxError, /type 'PDA' tidak dikenal/);
  assert.equal(data.type, null);
  assert.equal(data.automaton, null);
  assert.equal(data.dfa, null);
});

test('analisis .dfa berisi type: NFA: peringatan parser ikut dikirim', async () => {
  const teks = 'type: NFA\n' + (await contoh('berakhiran-01.dfa'));
  const { data } = await post('/api/analisis', { dfa: teks, format: 'dfa' });
  assert.equal(data.type, 'DFA');
  assert.match(data.warnings[0], /baris 'type: NFA' diabaikan/);
});

// ---------- field type (sub tahap 6h) ----------

test('field type: jenis dari pilihan jenis, teks tanpa baris type:', async () => {
  const teks = 'states: q0\nalphabet: 0 1\nstart: q0\naccept:\n';
  assert.equal((await post('/api/analisis', { dfa: teks, format: 'fa', type: 'DFA' })).data.type, 'DFA');
  const nfa = await post('/api/simulasi', { dfa: teks, format: 'fa', type: 'NFA', input: '01' });
  assert.equal(nfa.data.type, 'NFA');
  assert.deepEqual(nfa.data.result.finalStates, []);
});

test('field type tidak sah atau tanpa format fa dijawab 400', async () => {
  for (const body of [{ dfa: 'x', format: 'fa', type: 'PDA' }, { dfa: 'x', format: 'dfa', type: 'DFA' }, { dfa: 'x', type: 'NFA' }]) {
    const { status, data } = await post('/api/analisis', body);
    assert.equal(status, 400, JSON.stringify(body));
    assert.match(data.error, /"type" harus "DFA" atau "NFA"/);
  }
});
