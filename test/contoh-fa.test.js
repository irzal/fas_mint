// Tes contoh .fa di folder contoh/ (sub tahap 6g): yang biasa harus valid tanpa
// peringatan dan menerima bahasa sesuai komentarnya; yang diawali "tidak-valid-"
// harus ditolak dengan pesan yang dijanjikan di komentarnya.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { periksaFa, analisisFa, jalankanFa } = require('../src/fas');
const { nfaToDfa } = require('../src/converter');

const FOLDER = path.join(__dirname, '..', 'contoh');
const baca = (nama) => fs.readFileSync(path.join(FOLDER, nama), 'utf8');
const semua = fs.readdirSync(FOLDER).filter((f) => f.endsWith('.fa'));

function semuaString(alfabet, panjangMaks) {
  const hasil = [''];
  let lapis = [''];
  for (let n = 1; n <= panjangMaks; n++) {
    lapis = lapis.flatMap((s) => alfabet.map((a) => s + a));
    hasil.push(...lapis);
  }
  return hasil;
}

const diterima = (nama, input) => jalankanFa(baca(nama), 'fa', input).result.accepted;

test('ada contoh .fa', () => {
  assert.ok(semua.length >= 4);
});

for (const nama of semua) {
  if (nama.startsWith('tidak-valid-')) continue;
  test(`contoh ${nama}: valid tanpa peringatan, jenis sesuai awalan nama`, () => {
    const h = periksaFa(baca(nama), 'fa');
    assert.deepEqual(h.errors, []);
    assert.deepEqual(h.warnings, []);
    assert.equal(h.type, nama.startsWith('nfa-') ? 'NFA' : 'DFA');
  });
}

test('nfa-berakhiran-01.fa: string biner berakhiran 01', () => {
  for (const s of semuaString(['0', '1'], 7)) assert.equal(diterima('nfa-berakhiran-01.fa', s), s.endsWith('01'), s);
});

test('nfa-epsilon-a-lalu-b.fa: a*b*', () => {
  for (const s of semuaString(['a', 'b'], 7)) assert.equal(diterima('nfa-epsilon-a-lalu-b.fa', s), /^a*b*$/.test(s), s);
});

test('nfa-ketiga-dari-akhir-1.fa: simbol ketiga dari belakang 1; DFA hasil konversi 8 state', () => {
  for (const s of semuaString(['0', '1'], 7)) {
    assert.equal(diterima('nfa-ketiga-dari-akhir-1.fa', s), s.length >= 3 && s[s.length - 3] === '1', s);
  }
  const nfa = periksaFa(baca('nfa-ketiga-dari-akhir-1.fa'), 'fa').automaton;
  assert.equal(nfaToDfa(nfa).dfa.states.length, 8);
});

test('dfa-mengandung-11.fa: memuat substring 11', () => {
  for (const s of semuaString(['0', '1'], 7)) assert.equal(diterima('dfa-mengandung-11.fa', s), s.includes('11'), s);
});

test('tidak-valid-nfa-state-tak-dikenal.fa melanggar V1, V4, V5', () => {
  assert.deepEqual(periksaFa(baca('tidak-valid-nfa-state-tak-dikenal.fa'), 'fa').errors, [
    "state awal 'mulai' tidak ada di Q",
    "simbol 'c' tidak ada di Σ",
    "state 'q9' tidak ada di Q",
  ]);
});

test('tidak-valid-dfa-notasi-himpunan.fa: kesalahan sintaks di baris 13', () => {
  assert.equal(
    analisisFa(baca('tidak-valid-dfa-notasi-himpunan.fa'), 'fa').syntaxError,
    "baris 13: notasi himpunan '{q0, q1}' hanya untuk NFA; DFA punya tepat satu tujuan (V6)"
  );
});
