// Tes CLI. main() menerima penulis keluaran, jadi bisa dites tanpa menjalankan proses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('../src/cli');

const CONTOH = path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa');

// Menjalankan main() dan mengumpulkan keluaran stdout/stderr per baris.
function jalankanCli(argv) {
  const out = [];
  const err = [];
  const kode = main(argv, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { kode, out, err };
}

// File .dfa sementara di folder temp sistem, dihapus sesudah dipakai.
function denganFile(isi, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fas-cli-'));
  const file = path.join(dir, 'uji.dfa');
  fs.writeFileSync(file, isi);
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('DITERIMA: jejak per langkah dengan notasi δ, kode keluar 0', () => {
  const { kode, out, err } = jalankanCli([CONTOH, '1101']);
  assert.equal(kode, 0);
  assert.deepEqual(err, []);
  assert.deepEqual(out, [
    'Input: 1101',
    'Jejak:',
    '  1. δ(q0, 1) = q0',
    '  2. δ(q0, 1) = q0',
    '  3. δ(q0, 0) = q1',
    '  4. δ(q1, 1) = q2',
    'Hasil: DITERIMA (berhenti di q2)',
  ]);
});

test('DITOLAK tetap kode keluar 0 (simulasi selesai)', () => {
  const { kode, out } = jalankanCli([CONTOH, '0110']);
  assert.equal(kode, 0);
  assert.equal(out.at(-1), 'Hasil: DITOLAK (berhenti di q1)');
});

test('input dikosongkan: dianggap ε, tanpa langkah', () => {
  const { kode, out } = jalankanCli([CONTOH]);
  assert.equal(kode, 0);
  assert.deepEqual(out, [
    'Input: (kosong, ε)',
    'Jejak:',
    '  (tidak ada langkah: string kosong ε)',
    'Hasil: DITOLAK (berhenti di q0)',
  ]);
});

test('nomor langkah rata kanan jika langkah lebih dari 9', () => {
  const { out } = jalankanCli([CONTOH, '0101010101']);
  assert.ok(out.includes('   1. δ(q0, 0) = q1'));
  assert.ok(out.includes('  10. δ(q1, 1) = q2'));
});

test('simbol di luar Σ: pesan dan tanda ^ di bawah simbolnya, kode keluar 1', () => {
  const { kode, out, err } = jalankanCli([CONTOH, '01x1']);
  assert.equal(kode, 1);
  assert.deepEqual(out, []);
  assert.deepEqual(err, ["simbol 'x' pada posisi 3 tidak ada di Σ", '  01x1', '    ^']);
});

test('tanpa argumen file: tampilkan cara pakai, kode keluar 1', () => {
  const { kode, out } = jalankanCli([]);
  assert.equal(kode, 1);
  assert.match(out[0], /Pemakaian: node src\/cli\.js/);
});

test('file tidak ada: pesan jelas, bukan stack trace', () => {
  const { kode, err } = jalankanCli(['/tidak/ada/file.dfa']);
  assert.equal(kode, 1);
  assert.match(err[0], /tidak bisa membaca file '\/tidak\/ada\/file\.dfa': ENOENT/);
});

test('DFA tidak valid: daftar error di stdout, kode keluar 1', () => {
  const rusak = fs.readFileSync(CONTOH, 'utf8').replace('q1 1 -> q2\n', '');
  denganFile(rusak, (file) => {
    const { kode, out } = jalankanCli([file, '01']);
    assert.equal(kode, 1);
    assert.deepEqual(out, ['File bukan DFA yang valid:', '  - δ(q1, 1) belum didefinisikan']);
  });
});

test('sintaks salah: pesan parser dengan nomor baris, kode keluar 1', () => {
  denganFile('states: q0\nxx\n', (file) => {
    const { kode, err } = jalankanCli([file, '']);
    assert.equal(kode, 1);
    assert.match(err[0], /^baris 2/);
  });
});

test('state tak terjangkau: peringatan ke stderr, simulasi tetap jalan', () => {
  const dengan = fs.readFileSync(CONTOH, 'utf8').replace('states: q0 q1 q2', 'states: q0 q1 q2 q3') + 'q3 0 -> q3\nq3 1 -> q3\n';
  denganFile(dengan, (file) => {
    const { kode, out, err } = jalankanCli([file, '01']);
    assert.equal(kode, 0);
    assert.deepEqual(err, ["peringatan: state 'q3' tidak terjangkau dari state awal 'q0'"]);
    assert.equal(out.at(-1), 'Hasil: DITERIMA (berhenti di q2)');
  });
});
