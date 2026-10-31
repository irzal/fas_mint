// Simulator: menjalankan string input pada DFA yang sudah valid.
// Acuan: spesifikasi-dfa.md bagian 7 (perilaku simulasi).

/**
 * Hasil simulasi (lihat "Hasil simulasi" di spesifikasi bagian 7):
 *
 * {
 *   accepted: true,                 // true = diterima, false = ditolak
 *   finalState: 'q2',
 *   steps: [                        // jejak: satu langkah = satu nilai δ
 *     { from: 'q0', symbol: '0', to: 'q1' },
 *     { from: 'q1', symbol: '1', to: 'q2' }
 *   ]
 * }
 *
 * @typedef {object} Langkah
 * @property {string} from
 * @property {string} symbol
 * @property {string} to
 *
 * @typedef {object} HasilSimulasi
 * @property {boolean} accepted
 * @property {string} finalState
 * @property {Langkah[]} steps
 */

/**
 * Mulai dari q₀, baca input simbol demi simbol, ikuti δ. Diterima jika state
 * terakhir ada di F. String kosong (ε) diterima jika dan hanya jika q₀ ada di F.
 *
 * @param {import("./parser").Dfa} dfa objek DFA yang sudah lolos validator
 * @param {string} input string masukan, boleh kosong (ε)
 * @returns {HasilSimulasi} hasil simulasi seperti di atas
 * @throws {Error} jika ada simbol input yang tidak ada di Σ (bukan sekadar
 *   "ditolak"); error itu punya properti `position` (posisi simbol, mulai dari 1)
 *   untuk antarmuka yang ingin menandai simbolnya. Juga jika δ(state, simbol)
 *   tidak ada (DFA belum divalidasi)
 */
function simulate(dfa, input) {
  // Tabel δ: state -> (simbol -> tujuan). Map bertingkat, bukan kunci gabungan,
  // supaya nama state/simbol apa pun tidak bisa bertabrakan.
  const delta = new Map();
  for (const t of dfa.transitions) {
    if (!delta.has(t.from)) delta.set(t.from, new Map());
    delta.get(t.from).set(t.symbol, t.to);
  }
  const sigma = new Set(dfa.alphabet);

  const steps = [];
  let state = dfa.start;
  // [...input] memecah per karakter Unicode, sama dengan aturan simbol alfabet.
  [...input].forEach((symbol, i) => {
    if (!sigma.has(symbol)) {
      const err = new Error(`simbol '${symbol}' pada posisi ${i + 1} tidak ada di Σ`);
      err.position = i + 1;
      throw err;
    }
    const to = delta.get(state)?.get(symbol);
    if (to === undefined) {
      throw new Error(`δ(${state}, ${symbol}) belum didefinisikan`);
    }
    steps.push({ from: state, symbol, to });
    state = to;
  });

  return { accepted: dfa.accept.includes(state), finalState: state, steps };
}

module.exports = { simulate };
