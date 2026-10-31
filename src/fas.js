// Titik masuk bersama: dipakai oleh CLI dan antarmuka web,
// supaya keduanya menjalankan langkah yang sama persis.

const { parseDfa } = require('./parser');
const { validateDfa, warnDfa } = require('./validator');
const { simulate } = require('./simulator');

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

module.exports = { jalankan, analisis };
