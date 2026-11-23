#!/usr/bin/env node
// Antarmuka baris perintah.
//
// Pemakaian:
//   node src/cli.js <file.fa|file.dfa> [string-input] [--pohon]
//       jalankan string input (kosong = ε); DFA atau NFA ditentukan oleh
//       ekstensi file dan baris type: (spesifikasi bagian 8.1). --pohon
//       (hanya NFA) mencetak juga pohon komputasi.
//   node src/cli.js ke-dfa <file.fa> [hasil.fa]
//       konversi NFA -> DFA (konstruksi subset, bagian 9.1)
//   node src/cli.js ke-nfa <file.fa|file.dfa> [hasil.fa] [--buang-dead-state]
//       konversi DFA -> NFA (bagian 9.2)
//
// Kode keluar: 0 jika berhasil (simulasi DITERIMA atau DITOLAK, atau
// konversi selesai), 1 jika ada kesalahan.

const fs = require('node:fs');
const path = require('node:path');
const { formatDariNama, periksaFa, jalankanFa, konversiFa } = require('./fas');
// teksPohon dipakai bersama halaman web (fungsi murni, tanpa DOM).
const { teksPohon } = require('../public/animasi');

const PEMAKAIAN = [
  'Pemakaian:',
  '  node src/cli.js <file.fa|file.dfa> [string-input] [--pohon]',
  '  node src/cli.js ke-dfa <file.fa> [hasil.fa]',
  '  node src/cli.js ke-nfa <file.fa|file.dfa> [hasil.fa] [--buang-dead-state]',
];

// ---------- pembantu tampilan ----------

// Himpunan state untuk dibaca manusia: {q0, q1}; himpunan kosong: ∅.
function himpunan(states) {
  return states.length === 0 ? '∅' : `{${states.join(', ')}}`;
}

// Panjang teks menurut karakter Unicode (δ, ε, ∅ dihitung satu).
const panjang = (t) => [...t].length;
const isiKanan = (t, n) => t + ' '.repeat(Math.max(0, n - panjang(t)));

/**
 * Tabel teks rata kolom, untuk dicetak di terminal.
 * @param {string[]} kepala judul kolom
 * @param {string[][]} baris isi tabel
 * @returns {string[]} baris-baris teks (sudah diberi indentasi dua spasi)
 */
function tabelTeks(kepala, baris) {
  const lebar = kepala.map((k, i) => Math.max(panjang(k), ...baris.map((b) => panjang(b[i]))));
  const susun = (b) => '  ' + b.map((x, i) => isiKanan(x, lebar[i])).join(' | ').trimEnd();
  const garis = '  ' + lebar.map((n) => '-'.repeat(n)).join('-+-');
  return [susun(kepala), garis, ...baris.map(susun)];
}

/**
 * Teks jejak DFA: satu baris per langkah, memakai notasi δ seperti di spesifikasi.
 *
 * @param {import("./simulator").HasilSimulasi} hasil
 * @returns {string[]} baris-baris teks
 */
function formatJejak(hasil) {
  if (hasil.steps.length === 0) return ['  (tidak ada langkah: string kosong ε)'];
  const lebar = String(hasil.steps.length).length;
  return hasil.steps.map(
    (s, i) => `  ${String(i + 1).padStart(lebar)}. δ(${s.from}, ${s.symbol}) = ${s.to}`
  );
}

/**
 * Teks jejak NFA (spesifikasi bagian 8.6): langkah ke-0 adalah ε-closure({q₀}),
 * lalu satu baris per simbol. Bagian ε-closure hanya ditulis jika mengubah
 * himpunan (tanpa ε-transisi, hasil δ sudah himpunan akhirnya).
 *
 * @param {import("./simulator").HasilSimulasiNfa} hasil
 * @param {string} q0 state awal
 * @returns {string[]}
 */
function formatJejakNfa(hasil, q0) {
  const lebar = String(hasil.steps.length).length;
  const nomor = (i) => String(i).padStart(lebar);
  const awal = hasil.start.states;
  const baris = [
    awal.length === 1 && awal[0] === q0
      ? `  ${nomor(0)}. awal: ${himpunan(awal)}`
      : `  ${nomor(0)}. awal: ε-closure({${q0}}) = ${himpunan(awal)}`,
  ];
  hasil.steps.forEach((s, i) => {
    let teks = `  ${nomor(i + 1)}. dari ${himpunan(s.from)} baca ${s.symbol}: gabungan δ = ${himpunan(s.moved)}`;
    if (s.to.join('\0') !== s.moved.join('\0')) teks += `, ε-closure = ${himpunan(s.to)}`;
    baris.push(teks);
  });
  if (hasil.steps.length === 0) baris.push('  (tidak ada langkah lagi: string kosong ε)');
  return baris;
}

// ---------- membaca file ----------

// Membaca file .fa/.dfa lalu memeriksanya. Mengembalikan null (setelah menulis
// pesan) jika gagal.
function bacaDanPeriksa(file, out, err) {
  const format = formatDariNama(file);
  if (!format) {
    err(`file '${file}' harus berekstensi .fa atau .dfa`);
    return null;
  }
  let teks;
  try {
    teks = fs.readFileSync(file, 'utf8');
  } catch (e) {
    err(`tidak bisa membaca file '${file}': ${e.code || e.message}`);
    return null;
  }
  try {
    return { format, teks, hasil: periksaFa(teks, format) };
  } catch (e) {
    err(e.message); // kesalahan sintaks
    return null;
  }
}

function tulisError(hasil, out) {
  out(`File bukan ${hasil.type} yang valid:`);
  for (const e of hasil.errors) out('  - ' + e);
}

// Menulis file hasil konversi tanpa menimpa file yang sudah ada.
function simpanHasil(file, teks, out, err) {
  try {
    fs.writeFileSync(file, teks, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') err(`file '${file}' sudah ada; pilih nama lain (file tidak ditimpa)`);
    else err(`tidak bisa menulis file '${file}': ${e.code || e.message}`);
    return false;
  }
  out(`Hasil disimpan ke ${file}`);
  return true;
}

// File hasil tidak boleh menimpa file yang sudah ada. Diperiksa di awal,
// supaya penolakan muncul sebelum tabel konversi dicetak. (simpanHasil tetap
// memakai flag 'wx' untuk berjaga-jaga.)
function hasilSudahAda(file, err) {
  if (!fs.existsSync(file)) return false;
  err(`file '${file}' sudah ada; pilih nama lain (file tidak ditimpa)`);
  return true;
}

// Nama file hasil bawaan: contoh/abc.fa -> contoh/abc-dfa.fa
function namaHasilBawaan(file, akhiran) {
  const { dir, name } = path.parse(file);
  return path.join(dir, `${name}-${akhiran}.fa`);
}

// ---------- perintah ----------

function perintahSimulasi(file, input, cetakPohon, out, err) {
  const baca = bacaDanPeriksa(file, out, err);
  if (!baca) return 1;
  const { hasil } = baca;
  if (hasil.errors.length > 0) {
    tulisError(hasil, out);
    return 1;
  }
  for (const w of hasil.warnings) err('peringatan: ' + w);

  let r;
  let pohon;
  try {
    ({ result: r, tree: pohon } = jalankanFa(baca.teks, baca.format, input));
  } catch (e) {
    err(e.message);
    if (e.position) {
      // Tandai simbol yang salah: input diulang, tanda ^ tepat di bawahnya.
      err('  ' + input);
      err('  ' + ' '.repeat(e.position - 1) + '^');
    }
    return 1;
  }

  if (hasil.type === 'DFA') {
    out(`Input: ${input === '' ? '(kosong, ε)' : input}`);
    out('Jejak:');
    for (const baris of formatJejak(r)) out(baris);
    out(`Hasil: ${r.accepted ? 'DITERIMA' : 'DITOLAK'} (berhenti di ${r.finalState})`);
    return 0;
  }

  out('Jenis: NFA');
  out(`Input: ${input === '' ? '(kosong, ε)' : input}`);
  out('Jejak:');
  for (const baris of formatJejakNfa(r, hasil.automaton.start)) out(baris);
  const F = new Set(hasil.automaton.accept);
  const akhir = r.finalStates.filter((q) => F.has(q));
  out(
    r.accepted
      ? `Hasil: DITERIMA (himpunan terakhir ${himpunan(r.finalStates)} memuat state akhir ${akhir.join(', ')})`
      : `Hasil: DITOLAK (himpunan terakhir ${himpunan(r.finalStates)} tidak memuat state akhir)`
  );
  if (cetakPohon) {
    out('Pohon komputasi:');
    if (pohon.terlaluBesar) out(`  (terlalu besar: lebih dari ${pohon.maksSimpul} simpul; coba input yang lebih pendek)`);
    else for (const b of teksPohon(pohon, input)) out('  ' + b);
  }
  return 0;
}

// Membaca file lalu menjalankan konversiFa (pemeriksaan dan konversi yang sama
// dengan halaman web). Mengembalikan hasil konversi, atau null (setelah menulis
// pesan) jika file tidak bisa dibaca, sintaks salah, jenis tidak sesuai arah,
// automata belum valid, atau konversi gagal.
function konversiDariFile(file, arah, opsi, out, err) {
  const format = formatDariNama(file);
  if (!format) {
    err(`file '${file}' harus berekstensi .fa atau .dfa`);
    return null;
  }
  let teks;
  try {
    teks = fs.readFileSync(file, 'utf8');
  } catch (e) {
    err(`tidak bisa membaca file '${file}': ${e.code || e.message}`);
    return null;
  }
  let k;
  try {
    k = konversiFa(teks, format, undefined, arah, opsi);
  } catch (e) {
    // Jenis yang tidak sesuai arah disebut bersama nama filenya.
    err(e.message.startsWith('automata ini sudah') ? `file '${file}': ${e.message}` : e.message);
    return null;
  }
  if (k.errors.length > 0) {
    tulisError(k, out);
    return null;
  }
  return k;
}

function perintahKeDfa(file, fileHasil, out, err) {
  const tujuan = fileHasil || namaHasilBawaan(file, 'dfa');
  if (hasilSudahAda(tujuan, err)) return 1;
  const konversi = konversiDariFile(file, 'ke-dfa', {}, out, err);
  if (!konversi) return 1;
  const k = konversi.hasil;

  out('Konversi NFA -> DFA (konstruksi subset)');
  out('');
  out(`Langkah 0: state awal DFA = ε-closure({${konversi.automaton.start}}) = ${himpunan(k.start.states)} -> ${k.start.name}`);
  const kepala = k.usesEpsilon
    ? ['No', 'Himpunan', 'Simbol', 'Gabungan δ', 'ε-closure', 'Hasil', 'Keterangan']
    : ['No', 'Himpunan', 'Simbol', 'Gabungan δ', 'Hasil', 'Keterangan'];
  const baris = k.steps.map((s, i) => {
    const kolom = [String(i + 1), s.fromName, s.symbol, himpunan(s.moved)];
    if (k.usesEpsilon) kolom.push(himpunan(s.to));
    kolom.push(s.toName, s.isNew ? 'baru' : 'sudah ada');
    return kolom;
  });
  if (baris.length > 0) for (const b of tabelTeks(kepala, baris)) out(b);
  out('');
  out('Tabel transisi DFA (→ state awal, * state akhir):');
  const alfabet = k.dfa.alphabet;
  const ringkas = k.table.map((r) => [
    (r.isStart ? '→' : ' ') + (r.isAccept ? '*' : ' ') + ' ' + r.name,
    ...r.transitions.map((t) => t.toName),
  ]);
  for (const b of tabelTeks(['State DFA', ...alfabet], ringkas)) out(b);
  out('');
  return simpanHasil(tujuan, k.text, out, err) ? 0 : 1;
}

function perintahKeNfa(file, fileHasil, buangDead, out, err) {
  const tujuan = fileHasil || namaHasilBawaan(file, 'nfa');
  if (hasilSudahAda(tujuan, err)) return 1;
  const konversi = konversiDariFile(file, 'ke-nfa', { buangDeadState: buangDead }, out, err);
  if (!konversi) return 1;
  const k = konversi.hasil;

  out('Konversi DFA -> NFA: δ_N(q, a) = {δ_D(q, a)}');
  out('');
  const baris = k.mapping.map((m) => [
    `δ(${m.from}, ${m.symbol}) = ${m.dfaTo}`,
    m.removed ? '(dihapus: dead state)' : `δ(${m.from}, ${m.symbol}) = {${m.nfaTo.join(', ')}}`,
  ]);
  if (baris.length > 0) for (const b of tabelTeks(['DFA', 'NFA'], baris)) out(b);
  for (const r of k.removedStates) out(`Dead state dibuang: ${r.state} (${r.reason})`);
  out('');
  return simpanHasil(tujuan, k.text, out, err) ? 0 : 1;
}

/**
 * @param {string[]} argv argumen setelah nama skrip
 * @param {{ out?: (teks: string) => void, err?: (teks: string) => void }} [io]
 *   tempat menulis; bawaannya console.log / console.error (diganti saat tes)
 * @returns {number} kode keluar
 */
function main(argv, io = {}) {
  const out = io.out || console.log;
  const err = io.err || console.error;
  const [pertama, ...sisa] = argv;

  if (pertama === 'ke-dfa' || pertama === 'ke-nfa') {
    const buangDead = sisa.includes('--buang-dead-state');
    const bebas = sisa.filter((a) => a !== '--buang-dead-state');
    const opsiSalah = bebas.find((a) => a.startsWith('--'));
    if (bebas.length < 1 || bebas.length > 2 || opsiSalah || (buangDead && pertama === 'ke-dfa')) {
      for (const b of PEMAKAIAN) out(b);
      return 1;
    }
    const [file, fileHasil] = bebas;
    return pertama === 'ke-dfa'
      ? perintahKeDfa(file, fileHasil, out, err)
      : perintahKeNfa(file, fileHasil, buangDead, out, err);
  }

  const cetakPohon = sisa.includes('--pohon');
  const bebas = sisa.filter((a) => a !== '--pohon');
  if (!pertama || pertama.startsWith('--') || bebas.length > 1 || bebas.some((a) => a.startsWith('--'))) {
    for (const b of PEMAKAIAN) out(b);
    return 1;
  }
  const [input = ''] = bebas;
  return perintahSimulasi(pertama, input, cetakPohon, out, err);
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, formatJejak, formatJejakNfa, tabelTeks };
