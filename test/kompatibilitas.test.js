// Tes kompatibilitas (sub tahap 6k): file .dfa lama harus berperilaku sama
// persis lewat jalur lama (jalankan, analisis) dan jalur tahap 6 (jalankanFa,
// analisisFa dengan format 'dfa'), yang sekarang dipakai CLI dan web.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { jalankan, analisis, jalankanFa, analisisFa } = require('../src/fas');

const FOLDER = path.join(__dirname, '..', 'contoh');
const contohDfa = fs.readdirSync(FOLDER).filter((f) => f.endsWith('.dfa'));
const baca = (nama) => fs.readFileSync(path.join(FOLDER, nama), 'utf8');

function semuaString(alfabet, panjangMaks) {
  const hasil = [''];
  let lapis = [''];
  for (let n = 1; n <= panjangMaks; n++) {
    lapis = lapis.flatMap((s) => alfabet.map((a) => s + a));
    hasil.push(...lapis);
  }
  return hasil;
}

test('masih ada contoh .dfa lama', () => {
  assert.ok(contohDfa.length >= 6);
});

for (const nama of contohDfa) {
  test(`${nama}: analisis lama sama dengan analisisFa(.., 'dfa')`, () => {
    const teks = baca(nama);
    const lama = analisis(teks);
    const baru = analisisFa(teks, 'dfa');
    assert.equal(baru.type, 'DFA');
    assert.equal(baru.syntaxError, lama.syntaxError);
    assert.deepEqual(baru.errors, lama.errors);
    assert.deepEqual(baru.warnings, lama.warnings);
    assert.deepEqual(baru.automaton, lama.dfa);
  });

  test(`${nama}: jalankan lama sama dengan jalankanFa(.., 'dfa', ..) untuk semua string pendek`, () => {
    const teks = baca(nama);
    const alfabet = analisis(teks).dfa.alphabet;
    for (const input of semuaString(alfabet, 5)) {
      const lama = jalankan(teks, input);
      const baru = jalankanFa(teks, 'dfa', input);
      assert.deepEqual(baru.result, lama.result, `'${input}'`);
      assert.deepEqual(baru.errors, lama.errors, `'${input}'`);
    }
  });
}
