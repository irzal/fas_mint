// Simulator: menjalankan string input pada DFA atau NFA yang sudah valid.
// Acuan: spesifikasi-fa.md bagian 7 (DFA) dan bagian 8.6 (NFA).

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

// ===================== NFA (spesifikasi bagian 8.6) =====================
//
// NFA bisa berada di beberapa state sekaligus, jadi simulasi menyimpan
// HIMPUNAN state aktif. Setiap himpunan di sini berupa array yang diurutkan
// menurut baris `states:` (bukan urutan penemuan), supaya hasilnya mudah
// dibaca dan sama dengan nama state hasil konversi, mis. [q0,q1] (bagian 9.1).

const { EPSILON } = require('./parser');

// Tabel δ NFA: state -> (simbol -> Set tujuan). Beberapa baris untuk pasangan
// yang sama digabung (δ adalah himpunan, tujuan ganda dihitung sekali).
function tabelDeltaNfa(nfa) {
  const delta = new Map();
  for (const t of nfa.transitions) {
    if (!delta.has(t.from)) delta.set(t.from, new Map());
    const perSimbol = delta.get(t.from);
    if (!perSimbol.has(t.symbol)) perSimbol.set(t.symbol, new Set());
    for (const ke of t.to) perSimbol.get(t.symbol).add(ke);
  }
  return delta;
}

// δ(q, a) sebagai himpunan; kosong (∅) jika tidak ditulis.
function tujuanDelta(delta, q, a) {
  return delta.get(q)?.get(a) ?? new Set();
}

// Mengurutkan himpunan state menurut baris `states:`. State yang tidak ada di
// Q (NFA belum valid) diletakkan di belakang, menurut urutan tulisan.
function urutkan(nfa, himpunan) {
  const posisi = new Map(nfa.states.map((s, i) => [s, i]));
  return [...himpunan].sort((a, b) => (posisi.get(a) ?? Infinity) - (posisi.get(b) ?? Infinity));
}

/**
 * ε-closure(S): semua state di S, ditambah semua state yang bisa dicapai dari
 * S dengan mengikuti ε-transisi saja (tanpa membaca simbol), berulang-ulang.
 *
 * Juga mengembalikan panah ε yang dipakai: setiap ε-transisi (p, q) dengan p
 * di dalam closure. Itulah panah yang ditelusuri untuk mendapatkan closure,
 * dan yang disorot di diagram.
 *
 * @param {import("./parser").Nfa} nfa
 * @param {Iterable<string>} himpunan S
 * @returns {{ states: string[], epsilonEdges: { from: string, to: string }[] }}
 */
function epsilonClosure(nfa, himpunan) {
  const delta = tabelDeltaNfa(nfa);
  const hasil = new Set(himpunan);
  const antrean = [...hasil];
  while (antrean.length > 0) {
    const p = antrean.shift();
    for (const q of tujuanDelta(delta, p, EPSILON)) {
      if (!hasil.has(q)) {
        hasil.add(q);
        antrean.push(q);
      }
    }
  }
  const states = urutkan(nfa, hasil);
  const epsilonEdges = [];
  for (const p of states) {
    for (const q of urutkan(nfa, tujuanDelta(delta, p, EPSILON))) {
      epsilonEdges.push({ from: p, to: q });
    }
  }
  return { states, epsilonEdges };
}

/**
 * move(S, a): gabungan δ(q, a) untuk setiap q di S, TANPA ε-closure.
 * Juga mengembalikan panah yang dipakai: { from: q, symbol: a, to: p } untuk
 * setiap p di δ(q, a).
 *
 * @param {import("./parser").Nfa} nfa
 * @param {Iterable<string>} himpunan S
 * @param {string} simbol a (bukan ε)
 * @returns {{ states: string[], edges: { from: string, symbol: string, to: string }[] }}
 */
function move(nfa, himpunan, simbol) {
  const delta = tabelDeltaNfa(nfa);
  const hasil = new Set();
  const edges = [];
  for (const q of urutkan(nfa, new Set(himpunan))) {
    for (const p of urutkan(nfa, tujuanDelta(delta, q, simbol))) {
      hasil.add(p);
      edges.push({ from: q, symbol: simbol, to: p });
    }
  }
  return { states: urutkan(nfa, hasil), edges };
}

/**
 * Hasil simulasi NFA (spesifikasi bagian 8.6):
 *
 * {
 *   accepted: true,             // true jika himpunan terakhir ∩ F ≠ ∅
 *   start: {                    // langkah ke-0: ε-closure({q₀})
 *     states: ['q0', 'q1'],
 *     epsilonEdges: [{ from: 'q0', to: 'q1' }]
 *   },
 *   steps: [                    // satu langkah = satu simbol input
 *     { from: [...],            // himpunan sebelum membaca simbol
 *       symbol: '0',
 *       moved: [...],           // move(from, 0): gabungan δ(q, 0)
 *       edges: [...],           // panah δ yang dipakai
 *       to: [...],              // ε-closure(moved): himpunan sesudah langkah
 *       epsilonEdges: [...] }   // panah ε yang dipakai untuk closure itu
 *   ],
 *   finalStates: [...]          // himpunan terakhir
 * }
 *
 * @typedef {object} HasilSimulasiNfa
 */

/**
 * Menjalankan string input pada NFA: mulai dari ε-closure({q₀}); untuk setiap
 * simbol, ambil move lalu ε-closure-nya. Diterima jika himpunan terakhir
 * memuat paling sedikit satu state akhir. Jika himpunan menjadi kosong (semua
 * cabang mati), sisa input tetap dibaca dengan himpunan kosong, lalu ditolak.
 *
 * @param {import("./parser").Nfa} nfa objek NFA yang sudah lolos validator
 * @param {string} input string masukan, boleh kosong (ε)
 * @returns {HasilSimulasiNfa}
 * @throws {Error} jika ada simbol input yang tidak ada di Σ (sama dengan DFA);
 *   error itu punya properti `position` (posisi simbol, mulai dari 1)
 */
function simulateNfa(nfa, input) {
  const sigma = new Set(nfa.alphabet);
  const start = epsilonClosure(nfa, [nfa.start]);
  const steps = [];
  let sekarang = start.states;

  // [...input] memecah per karakter Unicode, sama dengan DFA.
  [...input].forEach((symbol, i) => {
    if (!sigma.has(symbol)) {
      const err = new Error(`simbol '${symbol}' pada posisi ${i + 1} tidak ada di Σ`);
      err.position = i + 1;
      throw err;
    }
    const pindah = move(nfa, sekarang, symbol);
    const closure = epsilonClosure(nfa, pindah.states);
    steps.push({
      from: sekarang,
      symbol,
      moved: pindah.states,
      edges: pindah.edges,
      to: closure.states,
      epsilonEdges: closure.epsilonEdges,
    });
    sekarang = closure.states;
  });

  const F = new Set(nfa.accept);
  return {
    accepted: sekarang.some((q) => F.has(q)),
    start,
    steps,
    finalStates: sekarang,
  };
}

module.exports = { simulate, simulateNfa, epsilonClosure, move };
