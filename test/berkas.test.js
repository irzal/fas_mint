// Tes pembantu Simpan/Buka file (public/berkas.js).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAKS_BERKAS, NAMA_BAWAAN, namaBerkasDfa, siapkanTeksSimpan, periksaBerkas } = require('../public/berkas');

test('nama file: akhiran .dfa ditambahkan jika belum ada, tidak digandakan', () => {
  assert.equal(namaBerkasDfa('genap'), 'genap.dfa');
  assert.equal(namaBerkasDfa('genap.dfa'), 'genap.dfa');
  assert.equal(namaBerkasDfa('Genap.DFA'), 'Genap.DFA');
  assert.equal(namaBerkasDfa('catatan.txt'), 'catatan.txt.dfa');
});

test('nama file: kosong atau tak berarti memakai nama bawaan', () => {
  for (const x of ['', '   ', '.dfa', '...', '///', '???', undefined, null]) {
    assert.equal(namaBerkasDfa(x), NAMA_BAWAAN, JSON.stringify(x));
  }
});

test('nama file: pemisah path dan karakter terlarang diganti, tidak bisa keluar folder', () => {
  assert.equal(namaBerkasDfa('../../etc/passwd'), '_.._etc_passwd.dfa');
  assert.equal(namaBerkasDfa('a\\b:c*d?.dfa'), 'a_b_c_d_.dfa');
  assert.equal(namaBerkasDfa('x\ny\u0000z'), 'x_y_z.dfa');
  assert.ok(!/[\\/]/.test(namaBerkasDfa('a/b\\c')));
});

test('nama file: titik di depan dibuang, panjang dibatasi', () => {
  assert.equal(namaBerkasDfa('.rahasia'), 'rahasia.dfa');
  assert.ok(namaBerkasDfa('x'.repeat(500)).length <= 104);
  assert.match(namaBerkasDfa('x'.repeat(500)), /\.dfa$/);
});

test('nama file: huruf non-Latin tetap utuh', () => {
  assert.equal(namaBerkasDfa('mesin δ'), 'mesin δ.dfa');
});

test('teks simpan: berakhir satu baris baru, CRLF diseragamkan, kosong tetap kosong', () => {
  assert.equal(siapkanTeksSimpan('a'), 'a\n');
  assert.equal(siapkanTeksSimpan('a\n'), 'a\n');
  assert.equal(siapkanTeksSimpan('a\r\nb\rc'), 'a\nb\nc\n');
  assert.equal(siapkanTeksSimpan(''), '');
});

test('periksa berkas: teks biasa (termasuk δ Σ ε) dan file kosong diterima', () => {
  assert.equal(periksaBerkas({ teks: 'states: q0\n# δ Σ ε\n', ukuran: 20 }), null);
  assert.equal(periksaBerkas({ teks: '', ukuran: 0 }), null);
});

test('periksa berkas: terlalu besar ditolak, tepat di batas diterima', () => {
  assert.match(periksaBerkas({ teks: 'x', ukuran: MAKS_BERKAS + 1 }), /terlalu besar/);
  assert.equal(periksaBerkas({ teks: 'x', ukuran: MAKS_BERKAS }), null);
});

test('periksa berkas: data biner dan UTF-8 rusak ditolak', () => {
  assert.match(periksaBerkas({ teks: 'ab\u0000cd', ukuran: 5 }), /biner/);
  assert.match(periksaBerkas({ teks: 'ab�cd', ukuran: 5 }), /UTF-8/);
});

test('hasil simpan lalu parse kembali sama (alur bolak-balik)', () => {
  const { parseDfa } = require('../src/parser');
  const asli = 'states: q0 q1\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> q1\nq1 0 -> q1';
  assert.deepEqual(parseDfa(siapkanTeksSimpan(asli)), parseDfa(asli));
});
