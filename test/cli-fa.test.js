// Tes CLI untuk .fa, NFA, dan perintah konversi (sub tahap 6f).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main, tabelTeks } = require('../src/cli');

function jalankanCli(argv) {
  const out = [];
  const err = [];
  const kode = main(argv, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { kode, out, err };
}

// Folder sementara berisi file-file uji; dihapus sesudah dipakai.
function denganFolder(file, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fas-cli-fa-'));
  for (const [nama, isi] of Object.entries(file)) fs.writeFileSync(path.join(dir, nama), isi);
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const NFA_01 = 'type: NFA\nstates: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n';
const NFA_EPS = 'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 ε -> q1\nq1 0 -> q2\nq2 eps -> q0\n';
const DFA_MATI =
  'states: q0 q1 mati\nalphabet: 0 1\nstart: q0\naccept: q1\n' +
  'q0 0 -> q1\nq0 1 -> mati\nq1 0 -> q1\nq1 1 -> mati\nmati 0 -> mati\nmati 1 -> mati\n';

// ---------- simulasi ----------

test('NFA tanpa ε: himpunan per langkah, DITERIMA', () => {
  denganFolder({ 'a.fa': NFA_01 }, (dir) => {
    const { kode, out, err } = jalankanCli([path.join(dir, 'a.fa'), '001']);
    assert.equal(kode, 0);
    assert.deepEqual(err, []);
    assert.deepEqual(out, [
      'Jenis: NFA',
      'Input: 001',
      'Jejak:',
      '  0. awal: {q0}',
      '  1. dari {q0} baca 0: gabungan δ = {q0, q1}',
      '  2. dari {q0, q1} baca 0: gabungan δ = {q0, q1}',
      '  3. dari {q0, q1} baca 1: gabungan δ = {q0, q2}',
      'Hasil: DITERIMA (himpunan terakhir {q0, q2} memuat state akhir q2)',
    ]);
  });
});

test('NFA dengan ε: ε-closure ditulis jika mengubah himpunan; ∅ untuk himpunan kosong', () => {
  denganFolder({ 'e.fa': NFA_EPS }, (dir) => {
    const { kode, out } = jalankanCli([path.join(dir, 'e.fa'), '01']);
    assert.equal(kode, 0);
    assert.deepEqual(out.slice(3), [
      '  0. awal: ε-closure({q0}) = {q0, q1}',
      '  1. dari {q0, q1} baca 0: gabungan δ = {q2}, ε-closure = {q0, q1, q2}',
      '  2. dari {q0, q1, q2} baca 1: gabungan δ = ∅',
      'Hasil: DITOLAK (himpunan terakhir ∅ tidak memuat state akhir)',
    ]);
  });
});

test('NFA, input kosong ε', () => {
  denganFolder({ 'e.fa': NFA_EPS }, (dir) => {
    const { out } = jalankanCli([path.join(dir, 'e.fa')]);
    assert.deepEqual(out, [
      'Jenis: NFA',
      'Input: (kosong, ε)',
      'Jejak:',
      '  0. awal: ε-closure({q0}) = {q0, q1}',
      '  (tidak ada langkah lagi: string kosong ε)',
      'Hasil: DITOLAK (himpunan terakhir {q0, q1} tidak memuat state akhir)',
    ]);
  });
});

test('.fa ber-type: DFA memakai keluaran DFA seperti file .dfa', () => {
  const isi = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  denganFolder({ 'd.fa': 'type: DFA\n' + isi }, (dir) => {
    const lama = jalankanCli([path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), '1101']);
    const baru = jalankanCli([path.join(dir, 'd.fa'), '1101']);
    assert.deepEqual(baru, lama);
  });
});

test('NFA tidak valid: pesan menyebut NFA, kode keluar 1', () => {
  denganFolder({ 'x.fa': 'states: q0\nalphabet: 0\nstart: q9\naccept:\nq0 a -> q0\n' }, (dir) => {
    const { kode, out } = jalankanCli([path.join(dir, 'x.fa'), '0']);
    assert.equal(kode, 1);
    assert.deepEqual(out, ['File bukan NFA yang valid:', "  - state awal 'q9' tidak ada di Q", "  - simbol 'a' tidak ada di Σ"]);
  });
});

test('NFA: simbol di luar Σ ditandai dengan ^', () => {
  denganFolder({ 'a.fa': NFA_01 }, (dir) => {
    const { kode, err } = jalankanCli([path.join(dir, 'a.fa'), '01x']);
    assert.equal(kode, 1);
    assert.deepEqual(err, ["simbol 'x' pada posisi 3 tidak ada di Σ", '  01x', '    ^']);
  });
});

test('.dfa berisi type: NFA: peringatan, tetap dijalankan sebagai DFA', () => {
  const isi = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  denganFolder({ 'lama.dfa': 'type: NFA\n' + isi }, (dir) => {
    const { kode, out, err } = jalankanCli([path.join(dir, 'lama.dfa'), '01']);
    assert.equal(kode, 0);
    assert.match(err[0], /^peringatan: baris 1: baris 'type: NFA' diabaikan/);
    assert.equal(out.at(-1), 'Hasil: DITERIMA (berhenti di q2)');
  });
});

test('ekstensi selain .fa dan .dfa ditolak', () => {
  denganFolder({ 'a.txt': NFA_01 }, (dir) => {
    const { kode, err } = jalankanCli([path.join(dir, 'a.txt'), '0']);
    assert.equal(kode, 1);
    assert.match(err[0], /harus berekstensi \.fa atau \.dfa/);
  });
});

test('kesalahan sintaks .fa dilaporkan dengan nomor baris', () => {
  denganFolder({ 'a.fa': 'states: q0\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> q0 q1\n' }, (dir) => {
    const { kode, err } = jalankanCli([path.join(dir, 'a.fa')]);
    assert.equal(kode, 1);
    assert.match(err[0], /^baris 5: tujuan 'q0 q1' berisi spasi/);
  });
});

// ---------- ke-dfa ----------

test('ke-dfa: mencetak tabel langkah dan tabel ringkasan, menulis file hasil bawaan', () => {
  denganFolder({ 'a.fa': NFA_01 }, (dir) => {
    const { kode, out, err } = jalankanCli(['ke-dfa', path.join(dir, 'a.fa')]);
    assert.equal(kode, 0);
    assert.deepEqual(err, []);
    assert.deepEqual(out.slice(0, 11), [
      'Konversi NFA -> DFA (konstruksi subset)',
      '',
      'Langkah 0: state awal DFA = ε-closure({q0}) = {q0} -> [q0]',
      '  No | Himpunan | Simbol | Gabungan δ | Hasil   | Keterangan',
      '  ---+----------+--------+------------+---------+-----------',
      '  1  | [q0]     | 0      | {q0, q1}   | [q0,q1] | baru',
      '  2  | [q0]     | 1      | {q0}       | [q0]    | sudah ada',
      '  3  | [q0,q1]  | 0      | {q0, q1}   | [q0,q1] | sudah ada',
      '  4  | [q0,q1]  | 1      | {q0, q2}   | [q0,q2] | baru',
      '  5  | [q0,q2]  | 0      | {q0, q1}   | [q0,q1] | sudah ada',
      '  6  | [q0,q2]  | 1      | {q0}       | [q0]    | sudah ada',
    ]);
    assert.deepEqual(out.slice(12, 18), [
      'Tabel transisi DFA (→ state awal, * state akhir):',
      '  State DFA  | 0       | 1',
      '  -----------+---------+--------',
      '  →  [q0]    | [q0,q1] | [q0]',
      '     [q0,q1] | [q0,q1] | [q0,q2]',
      '   * [q0,q2] | [q0,q1] | [q0]',
    ]);
    const hasil = path.join(dir, 'a-dfa.fa');
    assert.equal(out.at(-1), `Hasil disimpan ke ${hasil}`);
    assert.match(fs.readFileSync(hasil, 'utf8'), /^type: DFA\n/);
    // file hasil bisa langsung dijalankan
    assert.equal(jalankanCli([hasil, '001']).out.at(-1), 'Hasil: DITERIMA (berhenti di [q0,q2])');
  });
});

test('ke-dfa dengan ε: kolom ε-closure ikut dicetak', () => {
  denganFolder({ 'e.fa': NFA_EPS }, (dir) => {
    const { out } = jalankanCli(['ke-dfa', path.join(dir, 'e.fa'), path.join(dir, 'hasil.fa')]);
    assert.match(out[3], /\| ε-closure +\|/);
    assert.ok(fs.existsSync(path.join(dir, 'hasil.fa')));
  });
});

test('ke-dfa tidak menimpa file yang sudah ada (ditolak sebelum tabel dicetak)', () => {
  denganFolder({ 'a.fa': NFA_01, 'a-dfa.fa': 'isi lama' }, (dir) => {
    const { kode, out, err } = jalankanCli(['ke-dfa', path.join(dir, 'a.fa')]);
    assert.equal(kode, 1);
    assert.deepEqual(out, []);
    assert.match(err[0], /sudah ada; pilih nama lain \(file tidak ditimpa\)/);
    assert.equal(fs.readFileSync(path.join(dir, 'a-dfa.fa'), 'utf8'), 'isi lama');
  });
});

test('ke-dfa menolak file DFA dan NFA yang tidak valid', () => {
  denganFolder({ 'd.fa': 'type: DFA\n' + 'states: q0\nalphabet:\nstart: q0\naccept:\n', 'x.fa': 'states: q0\nalphabet: 0\nstart: q9\naccept:\n' }, (dir) => {
    const dfa = jalankanCli(['ke-dfa', path.join(dir, 'd.fa')]);
    assert.equal(dfa.kode, 1);
    assert.match(dfa.err[0], /sudah DFA; konversi NFA -> DFA hanya untuk NFA/);
    const salah = jalankanCli(['ke-dfa', path.join(dir, 'x.fa')]);
    assert.equal(salah.kode, 1);
    assert.deepEqual(salah.out, ['File bukan NFA yang valid:', "  - state awal 'q9' tidak ada di Q"]);
    assert.ok(!fs.existsSync(path.join(dir, 'x-dfa.fa')));
  });
});

// ---------- ke-nfa ----------

test('ke-nfa: tabel pemetaan dan file hasil', () => {
  denganFolder({ 'm.dfa': DFA_MATI }, (dir) => {
    const { kode, out } = jalankanCli(['ke-nfa', path.join(dir, 'm.dfa')]);
    assert.equal(kode, 0);
    assert.deepEqual(out.slice(0, 5), [
      'Konversi DFA -> NFA: δ_N(q, a) = {δ_D(q, a)}',
      '',
      '  DFA               | NFA',
      '  ------------------+--------------------',
      '  δ(q0, 0) = q1     | δ(q0, 0) = {q1}',
    ]);
    assert.match(fs.readFileSync(path.join(dir, 'm-nfa.fa'), 'utf8'), /^type: NFA\n[\s\S]*q0 1 -> \{mati\}/);
  });
});

test('ke-nfa --buang-dead-state: baris dihapus ditandai, alasan dicetak', () => {
  denganFolder({ 'm.dfa': DFA_MATI }, (dir) => {
    const { kode, out } = jalankanCli(['ke-nfa', path.join(dir, 'm.dfa'), '--buang-dead-state']);
    assert.equal(kode, 0);
    assert.ok(out.includes('  δ(q0, 1) = mati   | (dihapus: dead state)'));
    assert.ok(out.includes('Dead state dibuang: mati (dari state ini tidak ada jalan ke state akhir)'));
    const teks = fs.readFileSync(path.join(dir, 'm-nfa.fa'), 'utf8');
    assert.match(teks, /^states: q0 q1$/m);
  });
});

test('ke-nfa menolak NFA dan nama state .dfa yang tidak sah di .fa', () => {
  denganFolder({ 'a.fa': NFA_01, 'k.dfa': 'states: a,b\nalphabet: 0\nstart: a,b\naccept:\na,b 0 -> a,b\n' }, (dir) => {
    assert.match(jalankanCli(['ke-nfa', path.join(dir, 'a.fa')]).err[0], /sudah NFA; konversi DFA -> NFA hanya untuk DFA/);
    const r = jalankanCli(['ke-nfa', path.join(dir, 'k.dfa')]);
    assert.equal(r.kode, 1);
    assert.match(r.err[0], /konversi gagal: nama state 'a,b'/);
    assert.ok(!fs.existsSync(path.join(dir, 'k-nfa.fa')));
  });
});

// ---------- argumen ----------

test('argumen perintah konversi yang salah menampilkan cara pakai', () => {
  for (const argv of [['ke-dfa'], ['ke-dfa', 'a.fa', 'b.fa', 'c.fa'], ['ke-dfa', 'a.fa', '--buang-dead-state'], ['ke-nfa', 'a.dfa', '--opsi-asing']]) {
    const { kode, out } = jalankanCli(argv);
    assert.equal(kode, 1, argv.join(' '));
    assert.equal(out[0], 'Pemakaian:', argv.join(' '));
  }
});

test('tabelTeks: kolom rata menurut karakter Unicode', () => {
  assert.deepEqual(tabelTeks(['A', 'δ'], [['∅', 'xyz']]), ['  A | δ', '  --+----', '  ∅ | xyz']);
});

test('ke-dfa dengan ε: langkah 0 menyebut nama state awal NFA', () => {
  denganFolder({ 'e.fa': NFA_EPS }, (dir) => {
    const { out } = jalankanCli(['ke-dfa', path.join(dir, 'e.fa'), path.join(dir, 'h.fa')]);
    assert.equal(out[2], 'Langkah 0: state awal DFA = ε-closure({q0}) = {q0, q1} -> [q0,q1]');
  });
});

test('ke-dfa/ke-nfa: jenis tidak sesuai arah disebut bersama nama file', () => {
  denganFolder({ 'a.fa': NFA_01 }, (dir) => {
    const f = path.join(dir, 'a.fa');
    assert.equal(jalankanCli(['ke-nfa', f]).err[0], `file '${f}': automata ini sudah NFA; konversi DFA -> NFA hanya untuk DFA`);
  });
});
