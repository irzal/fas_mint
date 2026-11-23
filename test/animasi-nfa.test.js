// Tes keadaan jejak NFA untuk animasi (sub tahap 6i). sorotDiagram butuh
// browser, jadi dicoba langsung di halaman.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFa } = require('../src/parser');
const { simulateNfa } = require('../src/simulator');
const { keadaanJejakNfa } = require('../public/animasi');

const nfaDari = (teks) => parseFa(teks, 'fa').automaton;

// berakhiran 01, tanpa ε
const b01 = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n');
// dengan ε: q0 -ε-> q1, q1 -0-> q2, q2 -ε-> q0; F = {q2}
const eps = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 ε -> q1\nq1 0 -> q2\nq2 eps -> q0\n');

test('posisi 0 tanpa ε: himpunan awal {q0}, tanpa panah', () => {
  const k = keadaanJejakNfa(b01, simulateNfa(b01, '01'), 0);
  assert.deepEqual(k.states, ['q0']);
  assert.deepEqual(k.daftarSisi, []);
  assert.equal(k.selesai, false);
  assert.equal(k.diterima, null);
  assert.equal(k.teks, 'Mulai: himpunan awal {q0}. Belum ada simbol yang dibaca.');
});

test('posisi 0 dengan ε: ε-closure({q0}) dan panah ε-nya disorot', () => {
  const k = keadaanJejakNfa(eps, simulateNfa(eps, '0'), 0);
  assert.deepEqual(k.states, ['q0', 'q1']);
  assert.deepEqual(k.daftarSisi, [{ from: 'q0', to: 'q1' }]);
  assert.equal(k.teks, 'Mulai: himpunan awal ε-closure({q0}) = {q0, q1}. Belum ada simbol yang dibaca.');
});

test('langkah tengah tanpa ε: semua panah δ yang dipakai, teks gabungan δ', () => {
  const k = keadaanJejakNfa(b01, simulateNfa(b01, '001'), 1);
  assert.deepEqual(k.states, ['q0', 'q1']);
  assert.deepEqual(k.daftarSisi, [{ from: 'q0', to: 'q0' }, { from: 'q0', to: 'q1' }]);
  assert.equal(k.teks, 'Langkah 1 dari 3: dari {q0} baca 0: gabungan δ = {q0, q1}.');
});

test('langkah dengan ε: panah δ lalu panah ε, teks menyebut ε-closure', () => {
  const k = keadaanJejakNfa(eps, simulateNfa(eps, '01'), 1);
  assert.deepEqual(k.states, ['q0', 'q1', 'q2']);
  assert.deepEqual(k.daftarSisi, [
    { from: 'q1', to: 'q2' },
    { from: 'q0', to: 'q1' },
    { from: 'q2', to: 'q0' },
  ]);
  assert.equal(k.teks, 'Langkah 1 dari 2: dari {q0, q1} baca 0: gabungan δ = {q2}, ε-closure = {q0, q1, q2}.');
});

test('akhir, diterima: state akhir di himpunan disebut dan dicatat', () => {
  const k = keadaanJejakNfa(b01, simulateNfa(b01, '001'), 3);
  assert.equal(k.selesai, true);
  assert.equal(k.diterima, true);
  assert.deepEqual(k.states, ['q0', 'q2']);
  assert.deepEqual(k.stateAkhir, ['q2']);
  assert.equal(k.teks, 'Langkah 3 dari 3: dari {q0, q1} baca 1: gabungan δ = {q0, q2}. Input habis; {q0, q2} memuat state akhir q2: DITERIMA.');
});

test('akhir, himpunan kosong: ∅ dan DITOLAK', () => {
  const k = keadaanJejakNfa(eps, simulateNfa(eps, '01'), 2);
  assert.deepEqual(k.states, []);
  assert.deepEqual(k.daftarSisi, []);
  assert.equal(k.diterima, false);
  assert.deepEqual(k.stateAkhir, []);
  assert.match(k.teks, /gabungan δ = ∅\. Input habis; ∅ tidak memuat state akhir: DITOLAK\.$/);
});

test('input kosong ε: posisi 0 sekaligus akhir', () => {
  const k = keadaanJejakNfa(eps, simulateNfa(eps, ''), 0);
  assert.equal(k.total, 0);
  assert.equal(k.selesai, true);
  assert.equal(k.diterima, false);
  assert.equal(k.teks, 'Input kosong (ε): tidak ada langkah, himpunan awal ε-closure({q0}) = {q0, q1}. Input habis; {q0, q1} tidak memuat state akhir: DITOLAK.');
});

test('posisi di luar batas dipotong ke 0 atau n', () => {
  const h = simulateNfa(b01, '01');
  assert.equal(keadaanJejakNfa(b01, h, -5).posisi, 0);
  assert.equal(keadaanJejakNfa(b01, h, 99).posisi, 2);
});

test('himpunan di akhir animasi sama dengan finalStates hasil simulasi', () => {
  for (const input of ['', '0', '01', '0101', '1110', '00100']) {
    const h = simulateNfa(b01, input);
    const k = keadaanJejakNfa(b01, h, h.steps.length);
    assert.deepEqual(k.states, h.finalStates, input);
    assert.equal(k.diterima, h.accepted, input);
  }
});

test('F kosong (dokumen NFA baru): selalu DITOLAK', () => {
  const a = nfaDari('states: q0\nalphabet: 0 1\nstart: q0\naccept:\n');
  const k = keadaanJejakNfa(a, simulateNfa(a, '0'), 1);
  assert.equal(k.diterima, false);
  assert.deepEqual(k.states, []);
});
