// Tes simulator. Acuan: spesifikasi bagian 7.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDfa } = require('../src/parser');
const { simulate } = require('../src/simulator');

const teks = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
const dfa = parseDfa(teks); // berakhiran 01: q0 -0-> q1 -1-> q2 (akhir)

test('"1101" diterima oleh DFA berakhiran 01', () => {
  const hasil = simulate(dfa, '1101');
  assert.equal(hasil.accepted, true);
  assert.equal(hasil.finalState, 'q2');
});

test('"0110" ditolak oleh DFA berakhiran 01', () => {
  const hasil = simulate(dfa, '0110');
  assert.equal(hasil.accepted, false);
  assert.equal(hasil.finalState, 'q1');
});

test('string kosong (ε) diterima jika dan hanya jika q₀ ada di F', () => {
  const kosong = simulate(dfa, '');
  assert.deepEqual(kosong, { accepted: false, finalState: 'q0', steps: [] });

  const awalAkhir = { ...dfa, accept: ['q0'] };
  assert.equal(simulate(awalAkhir, '').accepted, true);
});

test('F = ∅: semua string ditolak', () => {
  const tanpaAkhir = { ...dfa, accept: [] };
  for (const s of ['', '0', '01', '1101', '0101']) {
    assert.equal(simulate(tanpaAkhir, s).accepted, false, `"${s}"`);
  }
});

test('simbol di luar Σ menghentikan simulasi dengan error', () => {
  assert.throws(() => simulate(dfa, '01a1'), /simbol 'a' pada posisi 3 tidak ada di Σ/);
  assert.throws(() => simulate(dfa, ' '), /simbol ' ' pada posisi 1 tidak ada di Σ/);
});

test('error simbol di luar Σ membawa posisi simbolnya', () => {
  assert.throws(() => simulate(dfa, '01a1'), (err) => err.position === 3);
  assert.throws(() => simulate(dfa, 'x'), (err) => err.position === 1);
});

test('jejak berisi satu langkah per simbol input', () => {
  const { steps } = simulate(dfa, '101');
  assert.deepEqual(steps, [
    { from: 'q0', symbol: '1', to: 'q0' },
    { from: 'q0', symbol: '0', to: 'q1' },
    { from: 'q1', symbol: '1', to: 'q2' },
  ]);
  assert.equal(simulate(dfa, '0110').steps.length, 4);
});

test('jejak bersambung: tujuan satu langkah adalah asal langkah berikutnya', () => {
  const { steps, finalState } = simulate(dfa, '0100110101');
  assert.equal(steps[0].from, dfa.start);
  for (let i = 1; i < steps.length; i++) assert.equal(steps[i].from, steps[i - 1].to);
  assert.equal(steps.at(-1).to, finalState);
});

test('simbol input dibaca per karakter Unicode (emoji dihitung satu)', () => {
  const emoji = {
    states: ['a', 'b'], alphabet: ['😀'], start: 'a', accept: ['b'],
    transitions: [
      { from: 'a', symbol: '😀', to: 'b', line: 1 },
      { from: 'b', symbol: '😀', to: 'a', line: 2 },
    ],
  };
  const hasil = simulate(emoji, '😀😀😀');
  assert.equal(hasil.steps.length, 3);
  assert.equal(hasil.accepted, true);
});

test('hasil sama dengan pembanding naif untuk semua string biner sampai panjang 8', () => {
  // Pembanding: berakhiran "01" berarti string diterima jika diakhiri "01".
  for (let panjang = 0; panjang <= 8; panjang++) {
    for (let n = 0; n < 2 ** panjang; n++) {
      const s = panjang === 0 ? '' : n.toString(2).padStart(panjang, '0');
      assert.equal(simulate(dfa, s).accepted, s.endsWith('01'), `"${s}"`);
    }
  }
});
