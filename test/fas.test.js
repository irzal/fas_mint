// Tes alur lengkap: parse -> validasi -> simulasi lewat jalankan().
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { jalankan, analisis } = require('../src/fas');

const contoh = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');

test('DFA valid: errors dan warnings kosong, hasil simulasi terisi', () => {
  const { errors, warnings, result } = jalankan(contoh, '1101');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(result.accepted, true);
});

test('hasil menyertakan dfa hasil parse (bahan untuk menggambar graf)', () => {
  const { dfa } = jalankan(contoh, '1101');
  assert.deepEqual(dfa.states, ['q0', 'q1', 'q2']);
  assert.deepEqual(dfa.alphabet, ['0', '1']);
  assert.equal(dfa.start, 'q0');
  assert.deepEqual(dfa.accept, ['q2']);
  assert.equal(dfa.transitions.length, 6);
});

test('DFA tidak valid: errors terisi, tidak disimulasikan', () => {
  const rusak = contoh.replace('q1 1 -> q2\n', '');
  const { errors, warnings, result } = jalankan(rusak, '1101');
  assert.deepEqual(errors, ['δ(q1, 1) belum didefinisikan']);
  assert.deepEqual(warnings, []);
  assert.equal(result, null);
});

test('dfa tetap disertakan saat errors tidak kosong', () => {
  const rusak = contoh.replace('q1 1 -> q2\n', '');
  const { dfa } = jalankan(rusak, '');
  assert.equal(dfa.transitions.length, 5);
});

test('state tak terjangkau: ada peringatan, simulasi tetap jalan', () => {
  const dengan = contoh.replace('states: q0 q1 q2', 'states: q0 q1 q2 q3') + 'q3 0 -> q3\nq3 1 -> q3\n';
  const { errors, warnings, result } = jalankan(dengan, '01');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, ["state 'q3' tidak terjangkau dari state awal 'q0'"]);
  assert.equal(result.accepted, true);
});

test('sintaks salah: parser melempar error dengan nomor baris', () => {
  assert.throws(() => jalankan('states: q0\nxx\n', ''), /baris 2/);
});

test('simbol input di luar Σ melempar error', () => {
  assert.throws(() => jalankan(contoh, '012'), /simbol '2' pada posisi 3 tidak ada di Σ/);
});

test('analisis: DFA valid tanpa simulasi', () => {
  const a = analisis(contoh);
  assert.equal(a.syntaxError, null);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.warnings, []);
  assert.equal(a.dfa.transitions.length, 6);
});

test('analisis: sintaks salah dilaporkan tanpa melempar, dfa null', () => {
  const a = analisis('states: q0\nxx\n');
  assert.match(a.syntaxError, /^baris 2/);
  assert.equal(a.dfa, null);
  assert.deepEqual(a.errors, []);
});

test('analisis: aturan DFA dilanggar -> errors terisi, dfa tetap ada, tanpa peringatan', () => {
  const a = analisis(contoh.replace('q1 1 -> q2\n', ''));
  assert.equal(a.syntaxError, null);
  assert.deepEqual(a.errors, ['δ(q1, 1) belum didefinisikan']);
  assert.deepEqual(a.warnings, []);
  assert.equal(a.dfa.transitions.length, 5);
});

test('analisis: peringatan state tak terjangkau', () => {
  const dengan = contoh.replace('states: q0 q1 q2', 'states: q0 q1 q2 q3') + 'q3 0 -> q3\nq3 1 -> q3\n';
  assert.deepEqual(analisis(dengan).warnings, ["state 'q3' tidak terjangkau dari state awal 'q0'"]);
});

test('analisis: teks kosong -> sintaks salah (header tidak ada)', () => {
  assert.match(analisis('').syntaxError, /tidak ada/);
});
