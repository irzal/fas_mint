// Titik masuk bersama: dipakai oleh CLI dan antarmuka web,
// supaya keduanya menjalankan langkah yang sama persis.

const path = require('node:path');
const { parseDfa, parseFa } = require('./parser');
const { validateDfa, warnDfa, validateNfa, warnNfa } = require('./validator');
const { simulate, simulateNfa } = require('./simulator');

/**
 * Parse, validasi, lalu (jika valid) jalankan simulasi.
 * `warnings` berisi peringatan (mis. state tak terjangkau); tidak menghentikan simulasi.
 * `dfa` adalah hasil parse (tipe Dfa di parser.js), selalu disertakan, juga saat
 * `errors` tidak kosong, supaya antarmuka (mis. penggambar graf) tidak perlu
 * mem-parse ulang teksnya.
 *
 * @param {string} teksDfa isi file .dfa
 * @param {string} input string masukan
 * @returns {{ errors: string[], warnings: string[], dfa: import("./parser").Dfa,
 *   result: import("./simulator").HasilSimulasi|null }}
 * @throws {Error} jika sintaks salah, atau simbol input tidak ada di Σ
 */
function jalankan(teksDfa, input) {
  const dfa = parseDfa(teksDfa);
  const errors = validateDfa(dfa);
  if (errors.length > 0) {
    return { errors, warnings: [], dfa, result: null };
  }
  return { errors: [], warnings: warnDfa(dfa), dfa, result: simulate(dfa, input) };
}

/**
 * Pemeriksaan tanpa simulasi, untuk pratinjau saat DFA diketik: parse, validasi,
 * peringatan. Tidak melempar error; kesalahan sintaks dilaporkan di `syntaxError`
 * (teks pesan parser, memuat nomor baris), dan `dfa` bernilai null jika sintaks salah.
 * Selain itu `dfa` selalu ada, juga saat `errors` tidak kosong.
 *
 * @param {string} teksDfa isi file .dfa
 * @returns {{ syntaxError: string|null, errors: string[], warnings: string[],
 *   dfa: import("./parser").Dfa|null }}
 */
function analisis(teksDfa) {
  let dfa;
  try {
    dfa = parseDfa(teksDfa);
  } catch (err) {
    return { syntaxError: err.message, errors: [], warnings: [], dfa: null };
  }
  const errors = validateDfa(dfa);
  return {
    syntaxError: null,
    errors,
    warnings: errors.length > 0 ? [] : warnDfa(dfa),
    dfa,
  };
}

// ===================== DFA dan NFA (tahap 6) =====================

/**
 * Format file dari namanya: '.fa' -> 'fa', '.dfa' -> 'dfa', selain itu null.
 * Huruf besar/kecil ekstensi tidak dibedakan (mis. CONTOH.FA).
 *
 * @param {string} nama nama atau jalur file
 * @returns {'fa'|'dfa'|null}
 */
function formatDariNama(nama) {
  const ext = path.extname(String(nama)).toLowerCase();
  if (ext === '.fa') return 'fa';
  if (ext === '.dfa') return 'dfa';
  return null;
}

/**
 * Parse lalu validasi, untuk DFA maupun NFA. Jenisnya ditentukan format file
 * dan baris `type:` (spesifikasi bagian 8.1). `warnings` berisi peringatan
 * parser (mis. baris type: diabaikan di .dfa) lalu peringatan validator;
 * peringatan validator hanya diberikan jika tidak ada error.
 *
 * @param {string} teks isi file
 * @param {'fa'|'dfa'} format
 * @returns {{ type: 'DFA'|'NFA', errors: string[], warnings: string[],
 *   automaton: import("./parser").Dfa|import("./parser").Nfa }}
 * @throws {Error} jika sintaks salah
 */
function periksaFa(teks, format) {
  const { type, automaton, warnings: peringatanParser } = parseFa(teks, format);
  const errors = type === 'DFA' ? validateDfa(automaton) : validateNfa(automaton);
  const peringatan = errors.length > 0 ? [] : type === 'DFA' ? warnDfa(automaton) : warnNfa(automaton);
  return { type, errors, warnings: [...peringatanParser, ...peringatan], automaton };
}

/**
 * Seperti periksaFa, lalu (jika valid) jalankan simulasi DFA atau NFA.
 * `result` berbentuk HasilSimulasi (DFA, bagian 7) atau HasilSimulasiNfa
 * (NFA, bagian 8.6), atau null jika ada error.
 *
 * @param {string} teks isi file
 * @param {'fa'|'dfa'} format
 * @param {string} input string masukan
 * @throws {Error} jika sintaks salah, atau simbol input tidak ada di Σ
 */
function jalankanFa(teks, format, input) {
  const hasil = periksaFa(teks, format);
  if (hasil.errors.length > 0) return { ...hasil, result: null };
  const result = hasil.type === 'DFA' ? simulate(hasil.automaton, input) : simulateNfa(hasil.automaton, input);
  return { ...hasil, result };
}

/**
 * Seperti periksaFa, tetapi tidak melempar error: kesalahan sintaks
 * dilaporkan di `syntaxError`, dan `type`/`automaton` bernilai null.
 * Dipakai untuk pemeriksaan langsung saat mengetik di halaman web.
 *
 * @param {string} teks isi file
 * @param {'fa'|'dfa'} format
 * @returns {{ syntaxError: string|null, type: 'DFA'|'NFA'|null, errors: string[],
 *   warnings: string[], automaton: object|null }}
 */
function analisisFa(teks, format) {
  try {
    return { syntaxError: null, ...periksaFa(teks, format) };
  } catch (err) {
    return { syntaxError: err.message, type: null, errors: [], warnings: [], automaton: null };
  }
}

module.exports = { jalankan, analisis, formatDariNama, periksaFa, jalankanFa, analisisFa };
