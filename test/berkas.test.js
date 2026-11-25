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

// ---------- dokumen .fa dan .dfa (sub tahap 6h) ----------

const B = require('../public/berkas');

test('formatDariNama: .fa, .dfa (huruf besar juga), selain itu null', () => {
  assert.equal(B.formatDariNama('a.fa'), 'fa');
  assert.equal(B.formatDariNama('A.FA'), 'fa');
  assert.equal(B.formatDariNama('a.dfa'), 'dfa');
  assert.equal(B.formatDariNama('a.txt'), null);
  assert.equal(B.formatDariNama('fa'), null);
  assert.equal(B.formatDariNama(undefined), null);
});

test('namaBerkas: ekstensi mengikuti format dokumen', () => {
  assert.equal(B.namaBerkas('genap.dfa', 'fa'), 'genap.fa');
  assert.equal(B.namaBerkas('genap.fa', 'dfa'), 'genap.dfa');
  assert.equal(B.namaBerkas('Genap.FA', 'fa'), 'Genap.fa');
  assert.equal(B.namaBerkas('catatan.txt', 'fa'), 'catatan.txt.fa');
  assert.equal(B.namaBerkas('mesin δ', 'dfa'), 'mesin δ.dfa');
});

test('namaBerkas: kosong atau tak berarti memakai automata.<format>; path aman', () => {
  for (const x of ['', '  ', '.fa', '.dfa', '///', undefined]) assert.equal(B.namaBerkas(x, 'fa'), 'automata.fa', JSON.stringify(x));
  assert.equal(B.namaBerkas('', 'dfa'), 'automata.dfa');
  assert.ok(!/[\\/]/.test(B.namaBerkas('../x/y', 'fa')));
});

test('pisahkanBarisType: baris type: yang sah dipindah, jenis dari yang pertama', () => {
  const p = B.pisahkanBarisType('# judul\ntype: DFA  # jenis\nstates: q0\n  type: NFA\n');
  assert.deepEqual(p, { jenis: 'DFA', teks: '# judul\nstates: q0\n', jumlah: 2 });
});

test('pisahkanBarisType: nilai tak dikenal dan huruf kecil dibiarkan; tanpa type: jenis null', () => {
  assert.deepEqual(B.pisahkanBarisType('type: PDA\ntype: nfa\nstates: q0'), {
    jenis: null,
    teks: 'type: PDA\ntype: nfa\nstates: q0',
    jumlah: 0,
  });
  assert.deepEqual(B.pisahkanBarisType(''), { jenis: null, teks: '', jumlah: 0 });
});

test('pisahkanBarisType: CRLF tetap dikenali', () => {
  assert.equal(B.pisahkanBarisType('type: NFA\r\nstates: q0\r\n').jenis, 'NFA');
});

test('teksSimpanFa: type: di baris pertama, lalu isi kotak definisi', () => {
  assert.equal(B.teksSimpanFa('states: q0', 'NFA'), 'type: NFA\nstates: q0\n');
  assert.equal(B.teksSimpanFa('', 'DFA'), 'type: DFA\n');
});

test('simpan .fa lalu buka lagi: jenis dan teks kembali sama', () => {
  const { parseFa } = require('../src/parser');
  const teks = 'states: q0 q1\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> {q0, q1}\n';
  const file = B.teksSimpanFa(teks, 'NFA');
  assert.equal(parseFa(file, 'fa').type, 'NFA');
  assert.deepEqual(B.pisahkanBarisType(file), { jenis: 'NFA', teks, jumlah: 1 });
});

test('TEMPLAT: NFA baru valid sebagai NFA, DFA baru valid sebagai DFA', () => {
  const { periksaFa } = require('../src/fas');
  const nfa = periksaFa(B.TEMPLAT.NFA, 'fa', 'NFA');
  assert.deepEqual(nfa.errors, []);
  assert.deepEqual(nfa.warnings, []);
  const dfa = periksaFa(B.TEMPLAT.DFA, 'fa', 'DFA');
  assert.deepEqual(dfa.errors, []);
  assert.deepEqual(dfa.warnings, []);
  // NFA baru bukan DFA: notasi himpunan ditolak parser
  assert.throws(() => periksaFa(B.TEMPLAT.NFA, 'fa', 'DFA'), /notasi himpunan .* hanya untuk NFA/);
});

test('TEMPLAT: NFA baru memuat ε-transisi, transisi ke lebih dari satu state, dan komentar λ; q0 ∈ F', () => {
  const { parseFa } = require('../src/parser');
  const nfa = parseFa(B.TEMPLAT.NFA, 'fa').automaton;
  assert.ok(nfa.transitions.some((t) => t.symbol === 'ε'));
  assert.ok(nfa.transitions.some((t) => t.to.length > 1));
  assert.deepEqual(nfa.accept, [nfa.start]);
  assert.match(B.TEMPLAT.NFA, /^# .*λ, eps, atau lam$/m);
  const dfa = parseFa(B.TEMPLAT.DFA, 'fa', { type: 'DFA' }).automaton;
  assert.deepEqual(dfa.accept, [dfa.start]);
});
