// Tes animasi jejak (public/animasi.js), bagian yang murni logika.
// sorotDiagram butuh browser, jadi dicoba langsung di halaman.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDfa } = require('../src/parser');
const { simulate } = require('../src/simulator');
const { keadaanJejak } = require('../public/animasi');

const dfa = parseDfa(fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8'));
// q0 -0-> q1 -1-> q2 : diterima (q2 ∈ F)
const diterima = simulate(dfa, '01');
// q0 -0-> q1 -0-> q1 : ditolak (q1 ∉ F)
const ditolak = simulate(dfa, '00');

test('posisi 0: di state awal, belum ada panah yang dipakai', () => {
  const k = keadaanJejak('q0', diterima, 0);
  assert.equal(k.posisi, 0);
  assert.equal(k.total, 2);
  assert.equal(k.state, 'q0');
  assert.equal(k.sisi, null);
  assert.equal(k.selesai, false);
  assert.equal(k.diterima, null);
  assert.equal(k.teks, 'Mulai di state awal q0. Belum ada simbol yang dibaca.');
});

test('posisi tengah: state tujuan langkah itu, panah yang dipakai, teks notasi δ', () => {
  const k = keadaanJejak('q0', diterima, 1);
  assert.equal(k.state, 'q1');
  assert.deepEqual(k.sisi, { from: 'q0', to: 'q1' });
  assert.equal(k.selesai, false);
  assert.equal(k.diterima, null);
  assert.equal(k.teks, 'Langkah 1 dari 2: δ(q0, 0) = q1.');
});

test('posisi akhir, diterima: state terakhir ∈ F', () => {
  const k = keadaanJejak('q0', diterima, 2);
  assert.equal(k.state, 'q2');
  assert.deepEqual(k.sisi, { from: 'q1', to: 'q2' });
  assert.equal(k.selesai, true);
  assert.equal(k.diterima, true);
  assert.equal(k.teks, 'Langkah 2 dari 2: δ(q1, 1) = q2. Input habis di q2, dan q2 ∈ F: DITERIMA.');
});

test('posisi akhir, ditolak: state terakhir ∉ F; loop q1 -> q1 sebagai panah', () => {
  const k = keadaanJejak('q0', ditolak, 2);
  assert.equal(k.state, 'q1');
  assert.deepEqual(k.sisi, { from: 'q1', to: 'q1' });
  assert.equal(k.diterima, false);
  assert.match(k.teks, /q1 ∉ F: DITOLAK\.$/);
});

test('state di akhir animasi sama dengan finalState hasil simulasi', () => {
  for (const input of ['', '0', '1', '0101', '1110', '01010']) {
    const h = simulate(dfa, input);
    const k = keadaanJejak(dfa.start, h, h.steps.length);
    assert.equal(k.state, h.finalState, input);
    assert.equal(k.diterima, h.accepted, input);
  }
});

test('posisi di luar batas dipotong ke 0 atau n', () => {
  assert.equal(keadaanJejak('q0', diterima, -3).posisi, 0);
  assert.equal(keadaanJejak('q0', diterima, 99).posisi, 2);
  assert.equal(keadaanJejak('q0', diterima, 99).state, 'q2');
});

// ---------- kasus tepi ----------

test('input kosong ε, q₀ ∉ F: posisi 0 sekaligus akhir, ditolak', () => {
  const k = keadaanJejak('q0', simulate(dfa, ''), 0);
  assert.equal(k.total, 0);
  assert.equal(k.state, 'q0');
  assert.equal(k.sisi, null);
  assert.equal(k.selesai, true);
  assert.equal(k.diterima, false);
  assert.equal(k.teks, 'Input kosong (ε): tidak ada langkah, tetap di state awal q0. Input habis di q0, dan q0 ∉ F: DITOLAK.');
});

test('input kosong ε, q₀ ∈ F: diterima', () => {
  const genap = parseDfa(fs.readFileSync(path.join(__dirname, '..', 'contoh', 'jumlah-0-genap.dfa'), 'utf8'));
  const k = keadaanJejak(genap.start, simulate(genap, ''), 0);
  assert.equal(k.diterima, true);
  assert.match(k.teks, /genap ∈ F: DITERIMA\.$/);
});

test('F kosong: setiap input berakhir DITOLAK', () => {
  const tanpaF = { ...dfa, accept: [] };
  const h = simulate(tanpaF, '01');
  const k = keadaanJejak('q0', h, 2);
  assert.equal(k.diterima, false);
  assert.match(k.teks, /DITOLAK\.$/);
});
