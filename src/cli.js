#!/usr/bin/env node
// Antarmuka baris perintah.
// Pemakaian: node src/cli.js <file.dfa> <string-input>
// String input boleh dikosongkan (artinya ε). Kode keluar: 0 jika simulasi
// selesai (DITERIMA atau DITOLAK), 1 jika ada kesalahan.

const fs = require('node:fs');
const { jalankan } = require('./fas');

/**
 * Teks jejak: satu baris per langkah, memakai notasi δ seperti di spesifikasi.
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
 * @param {string[]} argv argumen setelah nama skrip: [file, input]
 * @param {{ out?: (teks: string) => void, err?: (teks: string) => void }} [io]
 *   tempat menulis; bawaannya console.log / console.error (diganti saat tes)
 * @returns {number} kode keluar
 */
function main(argv, io = {}) {
  const out = io.out || console.log;
  const err = io.err || console.error;
  const [file, input = ''] = argv;
  if (!file) {
    out('Pemakaian: node src/cli.js <file.dfa> <string-input>');
    return 1;
  }

  let teks;
  try {
    teks = fs.readFileSync(file, 'utf8');
  } catch (e) {
    err(`tidak bisa membaca file '${file}': ${e.code || e.message}`);
    return 1;
  }

  try {
    const { errors, warnings, result } = jalankan(teks, input);
    if (errors.length > 0) {
      out('File bukan DFA yang valid:');
      for (const e of errors) out('  - ' + e);
      return 1;
    }
    for (const w of warnings) err('peringatan: ' + w);

    out(`Input: ${input === '' ? '(kosong, ε)' : input}`);
    out('Jejak:');
    for (const baris of formatJejak(result)) out(baris);
    out(`Hasil: ${result.accepted ? 'DITERIMA' : 'DITOLAK'} (berhenti di ${result.finalState})`);
    return 0;
  } catch (e) {
    err(e.message);
    if (e.position) {
      // Tandai simbol yang salah: input diulang, tanda ^ tepat di bawahnya.
      err('  ' + input);
      err('  ' + ' '.repeat(e.position - 1) + '^');
    }
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, formatJejak };
