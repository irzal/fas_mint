// Tes validator NFA (sub tahap 6b). Acuan: spesifikasi-fa.md bagian 8.5.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFa, parseDfa } = require('../src/parser');
const { validateDfa, validateNfa, warnNfa } = require('../src/validator');

const kepala = 'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\n';
const nfa = (isi, awal = kepala) => {
  const h = parseFa(awal + isi, 'fa');
  assert.equal(h.type, 'NFA');
  return h.automaton;
};

// ---------- NFA valid ----------

test('contoh NFA spesifikasi 8.2 valid, tanpa peringatan', () => {
  const a = nfa('q0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n');
  assert.deepEqual(validateNfa(a), []);
  assert.deepEqual(warnNfa(a), []);
});

test('V6 tidak berlaku: transisi kurang dan banyak tujuan tetap valid', () => {
  // δ(q1, 0), δ(q2, 0), δ(q2, 1) tidak ditulis (= ∅); δ(q0, 0) punya dua tujuan
  const a = nfa('q0 0 -> q1\nq0 0 -> q2\nq0 1 -> q0\nq1 1 -> q2\n');
  assert.deepEqual(validateNfa(a), []);
});

test('ε-transisi (semua tulisan) valid tanpa ε di Σ', () => {
  const a = nfa('q0 ε -> q1\nq0 eps -> q2\nq1 λ -> q2\nq2 lam -> {}\n');
  assert.deepEqual(validateNfa(a), []);
});

test('baris -> {} valid jika asal dan simbolnya dikenal', () => {
  assert.deepEqual(validateNfa(nfa('q0 0 -> {}\n')), []);
});

// ---------- V1 sampai V5 ----------

test('V1 dan V2: state awal dan state akhir harus anggota Q', () => {
  const a = nfa('', 'states: q0\nalphabet: 0\nstart: q9\naccept: q0 q5\n');
  assert.deepEqual(validateNfa(a), ["state awal 'q9' tidak ada di Q", "state akhir 'q5' tidak ada di Q"]);
});

test('V3: duplikat di Q dan Σ, satu pesan per nama', () => {
  const a = nfa('', 'states: q0 q1 q0 q0\nalphabet: 0 1 0\nstart: q0\naccept:\n');
  assert.deepEqual(validateNfa(a), ["state 'q0' ditulis dua kali di Q", "simbol '0' ditulis dua kali di Σ"]);
});

test('V4: simbol transisi harus anggota Σ atau ε', () => {
  assert.deepEqual(validateNfa(nfa('q0 a -> q1\n')), ["simbol 'a' tidak ada di Σ"]);
});

test('V5: asal dan setiap tujuan di himpunan harus anggota Q', () => {
  const a = nfa('q7 0 -> q1\nq0 1 -> {q1, q8, q9}\nq6 0 -> {}\n');
  assert.deepEqual(validateNfa(a), [
    "state 'q7' tidak ada di Q",
    "state 'q8' tidak ada di Q",
    "state 'q9' tidak ada di Q",
    "state 'q6' tidak ada di Q",
  ]);
});

test('urutan pesan: V1, V2, V3, lalu V4/V5 per baris (asal, simbol, tujuan)', () => {
  const a = nfa('qx a -> {qy, q0}\n', 'states: q0 q0\nalphabet: 0\nstart: qs\naccept: qf\n');
  assert.deepEqual(validateNfa(a), [
    "state awal 'qs' tidak ada di Q",
    "state akhir 'qf' tidak ada di Q",
    "state 'q0' ditulis dua kali di Q",
    "state 'qx' tidak ada di Q",
    "simbol 'a' tidak ada di Σ",
    "state 'qy' tidak ada di Q",
  ]);
});

// ---------- W1 dengan ε ----------

test('W1: state tak terjangkau diberi peringatan', () => {
  const a = nfa('q0 0 -> q1\n');
  assert.deepEqual(warnNfa(a), ["state 'q2' tidak terjangkau dari state awal 'q0'"]);
});

test('W1: state yang hanya dicapai lewat ε dianggap terjangkau', () => {
  // q1 hanya lewat ε, q2 lewat q1 dengan simbol 0
  assert.deepEqual(warnNfa(nfa('q0 ε -> q1\nq1 0 -> q2\n')), []);
  // rantai ε: q0 -ε-> q1 -ε-> q2
  assert.deepEqual(warnNfa(nfa('q0 eps -> q1\nq1 lam -> q2\n')), []);
});

test('W1: tujuan di dalam himpunan ikut dihitung; {} tidak menjangkau apa pun', () => {
  assert.deepEqual(warnNfa(nfa('q0 1 -> {q1, q2}\n')), []);
  assert.deepEqual(warnNfa(nfa('q0 1 -> {}\n')), [
    "state 'q1' tidak terjangkau dari state awal 'q0'",
    "state 'q2' tidak terjangkau dari state awal 'q0'",
  ]);
});

// ---------- tujuan ganda ----------

test('tujuan ganda di dua baris diberi peringatan, tetapi tetap valid', () => {
  const a = nfa('q0 0 -> q1\nq0 0 -> {q1, q2}\nq0 1 -> q0\n');
  assert.deepEqual(validateNfa(a), []);
  assert.deepEqual(warnNfa(a), ["δ(q0, 0): tujuan 'q1' ditulis lebih dari sekali (baris 6), dihitung satu kali"]);
});

test('tujuan ganda di dalam satu himpunan, dan untuk ε', () => {
  const a = nfa('q0 0 -> {q1, q2, q1}\nq0 ε -> q2\nq0 eps -> q2\n');
  assert.deepEqual(warnNfa(a), [
    "δ(q0, 0): tujuan 'q1' ditulis lebih dari sekali (baris 5), dihitung satu kali",
    "δ(q0, ε): tujuan 'q2' ditulis lebih dari sekali (baris 7), dihitung satu kali",
  ]);
});

test('tujuan ganda tiga kali tetap satu peringatan; simbol berbeda bukan ganda', () => {
  const a = nfa('q0 0 -> q1\nq0 0 -> q1\nq0 0 -> q1\nq0 1 -> q1\nq1 0 -> q1\n');
  const ganda = warnNfa(a).filter((w) => w.includes('lebih dari sekali'));
  assert.deepEqual(ganda, ["δ(q0, 0): tujuan 'q1' ditulis lebih dari sekali (baris 6), dihitung satu kali"]);
});

// ---------- DFA: petunjuk ε hanya untuk NFA ----------

test('DFA di .fa: tulisan string kosong ditolak dengan petunjuk', () => {
  const h = parseFa('type: DFA\nstates: q0\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> q0\nq0 eps -> q0\n', 'fa');
  assert.deepEqual(validateDfa(h.automaton), ["simbol 'eps' tidak ada di Σ (ε-transisi hanya untuk NFA)"]);
});

test('DFA di .dfa: ε juga diberi petunjuk; λ yang memang ada di Σ tetap sah', () => {
  const a = parseDfa('states: q0\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> q0\nq0 ε -> q0\n');
  assert.deepEqual(validateDfa(a), ["simbol 'ε' tidak ada di Σ (ε-transisi hanya untuk NFA)"]);
  const b = parseDfa('states: q0\nalphabet: λ\nstart: q0\naccept:\nq0 λ -> q0\n');
  assert.deepEqual(validateDfa(b), []);
});

test('NFA: simbol bukan tulisan ε tidak diberi petunjuk', () => {
  assert.deepEqual(validateNfa(nfa('q0 x -> q1\n')), ["simbol 'x' tidak ada di Σ"]);
});

// ---------- kasus tepi ----------

test('dokumen awal halaman web (satu state, tanpa transisi) valid tanpa peringatan', () => {
  const a = nfa('', 'states: q0\nalphabet: 0 1\nstart: q0\naccept:\n');
  assert.deepEqual(validateNfa(a), []);
  assert.deepEqual(warnNfa(a), []);
});

test('alfabet kosong dan F kosong: hanya ε-transisi yang sah', () => {
  const a = nfa('q0 ε -> q1\nq0 0 -> q1\n', 'states: q0 q1\nalphabet:\nstart: q0\naccept:\n');
  assert.deepEqual(validateNfa(a), ["simbol '0' tidak ada di Σ"]);
});

test('Q kosong: state awal dilaporkan V1', () => {
  const a = nfa('', 'states:\nalphabet: 0\nstart: q0\naccept:\n');
  assert.deepEqual(validateNfa(a), ["state awal 'q0' tidak ada di Q"]);
  assert.deepEqual(warnNfa(a), []);
});

test('validateNfa tidak mengubah objek NFA', () => {
  const a = nfa('q0 0 -> {q0, q1}\nq0 0 -> q1\n');
  const salinan = JSON.parse(JSON.stringify(a));
  validateNfa(a);
  warnNfa(a);
  assert.deepEqual(a, salinan);
});
