// Tes semua file di folder contoh/: yang biasa harus DFA valid tanpa peringatan,
// yang diawali "tidak-valid-" harus ditolak validator dengan pesan yang dijanjikan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { jalankan, analisis } = require('../src/fas');

const FOLDER = path.join(__dirname, '..', 'contoh');
const baca = (nama) => fs.readFileSync(path.join(FOLDER, nama), 'utf8');
const semua = fs.readdirSync(FOLDER).filter((f) => f.endsWith('.dfa'));

for (const nama of semua) {
  if (nama.startsWith('tidak-valid-')) continue;
  test(`contoh ${nama}: DFA valid tanpa peringatan`, () => {
    const a = analisis(baca(nama));
    assert.equal(a.syntaxError, null);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(a.warnings, []);
  });
}

test('contoh tidak-valid-transisi-kurang.dfa melanggar V6a', () => {
  assert.deepEqual(analisis(baca('tidak-valid-transisi-kurang.dfa')).errors, ['δ(q1, 1) belum didefinisikan']);
});

test('contoh tidak-valid-transisi-ganda.dfa melanggar V6b', () => {
  assert.deepEqual(analisis(baca('tidak-valid-transisi-ganda.dfa')).errors, [
    'δ(q0, 0) didefinisikan dua kali, itu bukan DFA',
  ]);
});

// Bahasa yang diterima tiap contoh sesuai komentar di filenya.
function diterima(nama, input) {
  return jalankan(baca(nama), input).result.accepted;
}

test('jumlah-0-genap.dfa', () => {
  assert.equal(diterima('jumlah-0-genap.dfa', ''), true); // nol buah 0 = genap
  assert.equal(diterima('jumlah-0-genap.dfa', '0'), false);
  assert.equal(diterima('jumlah-0-genap.dfa', '1001'), true);
  assert.equal(diterima('jumlah-0-genap.dfa', '000'), false);
});

test('kelipatan-3.dfa cocok dengan n mod 3 untuk n = 0..50', () => {
  for (let n = 0; n <= 50; n++) {
    assert.equal(diterima('kelipatan-3.dfa', n.toString(2)), n % 3 === 0, `n = ${n}`);
  }
});

test('mengandung-ab.dfa', () => {
  assert.equal(diterima('mengandung-ab.dfa', ''), false);
  assert.equal(diterima('mengandung-ab.dfa', 'ba'), false);
  assert.equal(diterima('mengandung-ab.dfa', 'bbab'), true);
  assert.equal(diterima('mengandung-ab.dfa', 'aaba'), true);
});
