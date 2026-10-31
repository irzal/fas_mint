// Tes parser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDfa } = require('../src/parser');

const dasar = 'states: q0 q1\nalphabet: 0 1\nstart: q0\naccept: q1\n';

test('membaca contoh lengkap berakhiran-01.dfa menjadi 5-tuple', () => {
  const teks = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  assert.deepEqual(parseDfa(teks), {
    states: ['q0', 'q1', 'q2'],
    alphabet: ['0', '1'],
    start: 'q0',
    accept: ['q2'],
    transitions: [
      { from: 'q0', symbol: '0', to: 'q1', line: 8 },
      { from: 'q0', symbol: '1', to: 'q0', line: 9 },
      { from: 'q1', symbol: '0', to: 'q1', line: 10 },
      { from: 'q1', symbol: '1', to: 'q2', line: 11 },
      { from: 'q2', symbol: '0', to: 'q1', line: 12 },
      { from: 'q2', symbol: '1', to: 'q0', line: 13 },
    ],
  });
});

test('mengabaikan baris kosong dan komentar #', () => {
  const dfa = parseDfa('# judul\n\n' + dasar + '   # komentar menjorok\n\nq0 0 -> q1\n');
  assert.equal(dfa.transitions.length, 1);
  assert.equal(dfa.transitions[0].line, 9);
});

test('urutan baris bebas (start: sebelum states:)', () => {
  const dfa = parseDfa('start: q0\nq0 0 -> q1\naccept: q1\nalphabet: 0\nstates: q0 q1\n');
  assert.equal(dfa.start, 'q0');
  assert.deepEqual(dfa.states, ['q0', 'q1']);
  assert.equal(dfa.transitions.length, 1);
});

test('accept: tanpa isi menghasilkan F = ∅', () => {
  assert.deepEqual(parseDfa('states: q0\nalphabet: 0\nstart: q0\naccept:\n').accept, []);
});

test('alphabet: tanpa isi menghasilkan Σ = ∅', () => {
  assert.deepEqual(parseDfa('states: q0\nalphabet:\nstart: q0\naccept:\n').alphabet, []);
});

test('membedakan huruf besar dan kecil (Q0 ≠ q0)', () => {
  const dfa = parseDfa('states: q0 Q0\nalphabet: a A\nstart: Q0\naccept:\n');
  assert.deepEqual(dfa.states, ['q0', 'Q0']);
  assert.deepEqual(dfa.alphabet, ['a', 'A']);
  assert.equal(dfa.start, 'Q0');
});

test('spasi dan tab ganda sebagai pemisah, CRLF diterima', () => {
  const dfa = parseDfa('states:\tq0   q1\r\nalphabet: 0\r\nstart: q0\r\naccept: q1\r\nq0\t0  ->\tq1\r\n');
  assert.deepEqual(dfa.states, ['q0', 'q1']);
  assert.deepEqual(dfa.transitions[0], { from: 'q0', symbol: '0', to: 'q1', line: 5 });
});

test('transisi ganda tetap tampil sebagai dua entri', () => {
  const dfa = parseDfa(dasar + 'q0 0 -> q0\nq0 0 -> q1\n');
  assert.equal(dfa.transitions.length, 2);
});

test('error jika states:/alphabet:/start:/accept: tidak ada atau ditulis dua kali', () => {
  for (const nama of ['states', 'alphabet', 'start', 'accept']) {
    const tanpa = dasar.split('\n').filter((b) => !b.startsWith(nama + ':')).join('\n');
    assert.throws(() => parseDfa(tanpa), new RegExp(`'${nama}:' tidak ada`));
    assert.throws(() => parseDfa(dasar + `${nama}: q0\n`), /ditulis dua kali \(pertama di baris \d+\)/);
  }
});

test('error jika simbol lebih dari satu karakter, atau berupa ε', () => {
  assert.throws(() => parseDfa('states: q0\nalphabet: ab\nstart: q0\naccept:\n'), /baris 2.*tepat satu karakter/);
  assert.throws(() => parseDfa('states: q0\nalphabet: ε\nstart: q0\naccept:\n'), /baris 2.*'ε'/);
});

test('error jika start: tidak berisi tepat satu state', () => {
  assert.throws(() => parseDfa('states: q0\nalphabet: 0\nstart:\naccept:\n'), /baris 3.*tepat satu/);
  assert.throws(() => parseDfa('states: q0 q1\nalphabet: 0\nstart: q0 q1\naccept:\n'), /baris 3.*tepat satu/);
});

test('error jika nama state mengandung ->', () => {
  assert.throws(() => parseDfa('states: a->b\nalphabet: 0\nstart: a->b\naccept:\n'), /baris 1.*'->'/);
});

test('error pada baris yang tidak dikenali, dengan nomor baris', () => {
  assert.throws(() => parseDfa(dasar + 'q0 0 q1\n'), /baris 5.*tidak dikenali/);
  assert.throws(
    () => parseDfa(dasar + 'warna: merah\n'),
    /baris 5: header 'warna:' tidak dikenali \(yang sah: states:, alphabet:, start:, accept:\)/
  );
});

test('# memulai komentar sampai akhir baris, di header maupun transisi', () => {
  const dfa = parseDfa(
    'states: q0 q1  # dua state\n' +
      'alphabet: 0 # biner\n' +
      'start: q0#awal\n' +
      'accept: q1 #\n' +
      'q0 0 -> q1 # maju\n' +
      'q1 0 -> q1#tetap\n'
  );
  assert.deepEqual(dfa, {
    states: ['q0', 'q1'],
    alphabet: ['0'],
    start: 'q0',
    accept: ['q1'],
    transitions: [
      { from: 'q0', symbol: '0', to: 'q1', line: 5 },
      { from: 'q1', symbol: '0', to: 'q1', line: 6 },
    ],
  });
});

test('# tanpa spasi sebelumnya tetap memulai komentar (nama tidak pernah berisi #)', () => {
  assert.deepEqual(parseDfa('states: a#b c\nalphabet:\nstart: a\naccept:\n').states, ['a']);
});

test('baris yang hanya berisi komentar menjorok atau # saja diabaikan', () => {
  const dfa = parseDfa('   \t# menjorok\n#\n' + dasar);
  assert.deepEqual(dfa.states, ['q0', 'q1']);
});

test('komentar tidak menyembunyikan error di bagian sebelum #', () => {
  assert.throws(() => parseDfa(dasar + 'q0 0 q1 # lupa panah\n'), /baris 5.*tidak dikenali 'q0 0 q1'/);
});

test('header salah huruf besar/kecil: pesan menyarankan nama yang benar', () => {
  assert.throws(
    () => parseDfa('States: q0\nalphabet: 0\nstart: q0\naccept:\n'),
    /baris 1: header 'States:' tidak dikenali \(huruf besar dan kecil dibedakan, maksud Anda 'states:'\?\)/
  );
});

test('state ber-titik-dua di baris transisi tidak dikira header', () => {
  const dfa = parseDfa('states: a:b\nalphabet: 0\nstart: a:b\naccept:\na:b 0 -> a:b\n');
  assert.deepEqual(dfa.transitions[0], { from: 'a:b', symbol: '0', to: 'a:b', line: 5 });
});
