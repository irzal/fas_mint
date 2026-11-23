// Konversi antar automata. Acuan: spesifikasi-fa.md bagian 9.
//   nfaToDfa: NFA -> DFA dengan konstruksi subset (bagian 9.1)
//   dfaToNfa: DFA -> NFA, δ_N(q, a) = {δ_D(q, a)} (bagian 9.2)
//
// Konversi memakai epsilonClosure dan move yang sama dengan simulator NFA,
// jadi langkah konversi dan langkah simulasi selalu cocok.

const { parseFa, EPSILON, SIMBOL_DICADANGKAN_FA, alasanNamaTakSahFa } = require('./parser');
const { epsilonClosure, move } = require('./simulator');

// Nama state DFA hasil konstruksi subset (bagian 9.1): nama-nama state NFA
// dipisah koma tanpa spasi, di dalam kurung siku. Himpunan kosong -> '[]'.
// `himpunan` sudah urut menurut baris states: NFA (dijamin epsilonClosure).
//   ['q0', 'q2'] -> '[q0,q2]'
function namaHimpunan(himpunan) {
  return '[' + himpunan.join(',') + ']';
}

// Kunci untuk membandingkan dua himpunan (urutan sudah baku), tidak bisa
// tertukar walau nama state berisi koma atau kurung.
function kunciHimpunan(himpunan) {
  return JSON.stringify(himpunan);
}

/**
 * Satu baris tabel langkah konstruksi subset: memproses state DFA `fromName`
 * (himpunan `from`) dengan simbol `symbol`.
 *
 * @typedef {object} LangkahSubset
 * @property {string[]} from          himpunan asal
 * @property {string} fromName        nama state DFA asal, mis. '[q0,q1]'
 * @property {string} symbol
 * @property {string[]} moved         gabungan δ(q, symbol) untuk q di `from`
 * @property {object[]} edges         panah δ NFA yang dipakai
 * @property {string[]} to            ε-closure(moved): himpunan hasil
 * @property {object[]} epsilonEdges  panah ε yang dipakai untuk closure itu
 * @property {string} toName          nama state DFA hasil
 * @property {boolean} isNew          true jika himpunan hasil baru ditemukan
 */

/**
 * Hasil konversi NFA -> DFA.
 *
 * @typedef {object} HasilNfaToDfa
 * @property {string} text  isi file .fa (dengan `type: DFA`) untuk DFA hasil
 * @property {import("./parser").Dfa} dfa  objek DFA (hasil parse `text`)
 * @property {boolean} usesEpsilon  NFA punya ε-transisi (tabel perlu kolom ε-closure)
 * @property {{ states: string[], epsilonEdges: object[], name: string }} start
 *   langkah ke-0: ε-closure({q₀}) sebagai state awal DFA
 * @property {LangkahSubset[]} steps  tabel langkah demi langkah
 * @property {{ name: string, states: string[], isStart: boolean, isAccept: boolean,
 *   transitions: { symbol: string, toName: string }[] }[]} table
 *   tabel transisi subset (ringkasan), satu baris per state DFA
 */

/**
 * Konstruksi subset (bagian 9.1):
 *   1. State awal DFA = ε-closure({q₀}).
 *   2. Ambil state DFA (himpunan S) yang belum diproses. Untuk setiap simbol a
 *      di Σ: T = ε-closure(move(S, a)). Jika T belum pernah ditemukan, T
 *      menjadi state DFA baru. δ_DFA(S, a) = T.
 *   3. Ulangi sampai semua state DFA sudah diproses.
 * Hanya himpunan yang terjangkau dari state awal yang dibuat (bukan 2ⁿ).
 * State DFA adalah state akhir jika himpunannya memuat paling sedikit satu
 * anggota F. Himpunan kosong menjadi state '[]' (dead state).
 *
 * @param {import("./parser").Nfa} nfa NFA yang sudah lolos validator
 * @returns {HasilNfaToDfa}
 * @throws {Error} jika dua himpunan berbeda menghasilkan nama state yang sama
 */
function nfaToDfa(nfa) {
  const F = new Set(nfa.accept);
  const usesEpsilon = nfa.transitions.some((t) => t.symbol === EPSILON && t.to.length > 0);

  // Himpunan yang sudah ditemukan, urut penemuan: { states, name }.
  const ditemukan = [];
  const indeks = new Map(); // kunci himpunan -> posisi di `ditemukan`
  const pemilikNama = new Map(); // nama -> kunci himpunan (untuk deteksi tabrakan)

  // Mendaftarkan himpunan; mengembalikan true jika baru.
  function daftarkan(himpunan) {
    const kunci = kunciHimpunan(himpunan);
    if (indeks.has(kunci)) return false;
    const name = namaHimpunan(himpunan);
    if (pemilikNama.has(name)) {
      const lain = JSON.parse(pemilikNama.get(name));
      throw new Error(
        `konversi gagal: himpunan {${lain.join(', ')}} dan {${himpunan.join(', ')}} sama-sama bernama '${name}'; ganti nama state NFA`
      );
    }
    pemilikNama.set(name, kunci);
    indeks.set(kunci, ditemukan.length);
    ditemukan.push({ states: himpunan, name });
    return true;
  }

  // Langkah 1: state awal.
  const awal = epsilonClosure(nfa, [nfa.start]);
  daftarkan(awal.states);
  const start = { states: awal.states, epsilonEdges: awal.epsilonEdges, name: namaHimpunan(awal.states) };

  // Langkah 2 dan 3: proses himpunan satu per satu menurut urutan penemuan.
  // `ditemukan` bertambah selama perulangan; perulangan berhenti saat semua
  // himpunan yang ditemukan sudah diproses.
  const steps = [];
  const delta = new Map(); // nama asal -> [{ symbol, toName }]
  for (let i = 0; i < ditemukan.length; i++) {
    const S = ditemukan[i];
    delta.set(S.name, []);
    for (const a of nfa.alphabet) {
      const pindah = move(nfa, S.states, a);
      const closure = epsilonClosure(nfa, pindah.states);
      const isNew = daftarkan(closure.states);
      const toName = namaHimpunan(closure.states);
      steps.push({
        from: S.states,
        fromName: S.name,
        symbol: a,
        moved: pindah.states,
        edges: pindah.edges,
        to: closure.states,
        epsilonEdges: closure.epsilonEdges,
        toName,
        isNew,
      });
      delta.get(S.name).push({ symbol: a, toName });
    }
  }

  const table = ditemukan.map((S) => ({
    name: S.name,
    states: S.states,
    isStart: S.name === start.name,
    isAccept: S.states.some((q) => F.has(q)),
    transitions: delta.get(S.name),
  }));

  const text = tulisTeksDfa(table, nfa.alphabet);
  const dfa = parseFa(text, 'fa').automaton;
  return { text, dfa, usesEpsilon, start, steps, table };
}

// Menulis DFA hasil konversi sebagai teks .fa ber-`type: DFA` (bagian 9.1).
// Urutan state dan transisi mengikuti urutan penemuan di konstruksi subset.
function tulisTeksDfa(table, alfabet) {
  const awal = table.find((r) => r.isStart);
  const baris = [
    'type: DFA',
    '# hasil konversi NFA -> DFA (konstruksi subset)',
    `states: ${table.map((r) => r.name).join(' ')}`,
    `alphabet: ${alfabet.join(' ')}`.trimEnd(),
    `start: ${awal.name}`,
    `accept: ${table.filter((r) => r.isAccept).map((r) => r.name).join(' ')}`.trimEnd(),
  ];
  const transisi = table.flatMap((r) => r.transitions.map((t) => `${r.name} ${t.symbol} -> ${t.toName}`));
  if (transisi.length > 0) baris.push('', ...transisi);
  return baris.join('\n') + '\n';
}

// ===================== DFA -> NFA (bagian 9.2) =====================

const ALASAN_DEAD_STATE = 'dari state ini tidak ada jalan ke state akhir';

/**
 * Dead state: state yang tidak punya jalan ke state akhir mana pun.
 * Dicari dari belakang: mulai dari F, ikuti transisi secara terbalik; state
 * yang tidak tercapai dengan cara itu adalah dead state. Urutan hasil
 * mengikuti baris `states:`.
 *
 * @param {import("./parser").Dfa} dfa
 * @returns {string[]}
 */
function findDeadStates(dfa) {
  const asalDari = new Map(); // tujuan -> daftar asal (transisi terbalik)
  for (const t of dfa.transitions) {
    if (!asalDari.has(t.to)) asalDari.set(t.to, []);
    asalDari.get(t.to).push(t.from);
  }
  const bisaKeF = new Set(dfa.accept);
  const antrean = [...bisaKeF];
  while (antrean.length > 0) {
    for (const p of asalDari.get(antrean.shift()) || []) {
      if (!bisaKeF.has(p)) {
        bisaKeF.add(p);
        antrean.push(p);
      }
    }
  }
  return [...new Set(dfa.states)].filter((q) => !bisaKeF.has(q));
}

/**
 * Hasil konversi DFA -> NFA.
 *
 * @typedef {object} HasilDfaToNfa
 * @property {string} text  isi file .fa (dengan `type: NFA`)
 * @property {import("./parser").Nfa} nfa  objek NFA (hasil parse `text`)
 * @property {{ from: string, symbol: string, dfaTo: string, nfaTo: string[]|null,
 *   removed: boolean }[]} mapping
 *   tabel pemetaan, satu baris per transisi DFA: δ(from, symbol) = dfaTo
 *   menjadi δ(from, symbol) = {nfaTo}; `removed` true (dan nfaTo null) jika
 *   baris itu dihapus karena dead state dibuang
 * @property {{ state: string, reason: string }[]} removedStates
 *   dead state yang dibuang beserta alasannya (kosong jika tidak dibuang)
 */

/**
 * Setiap DFA adalah NFA: δ_N(q, a) = {δ_D(q, a)}. Q, Σ, q₀, F tidak berubah.
 * Setiap transisi ditulis dengan kurung kurawal (`q0 0 -> {q1}`), supaya
 * terlihat bahwa hasil δ berubah dari satu state menjadi himpunan state.
 *
 * Pilihan `removeDeadStates`: dead state (tidak punya jalan ke state akhir)
 * dibuang beserta semua panah dari dan ke state itu. Bahasa yang diterima
 * tidak berubah, karena di NFA transisi yang tidak ditulis berarti δ = ∅.
 * State awal tidak pernah dibuang, juga jika bahasanya ∅. State tak terjangkau
 * yang masih punya jalan ke state akhir tidak dibuang (keputusan W1).
 *
 * @param {import("./parser").Dfa} dfa DFA yang sudah lolos validator
 * @param {{ removeDeadStates?: boolean }} [opsi]
 * @returns {HasilDfaToNfa}
 * @throws {Error} jika nama state atau simbol DFA (dari file .dfa lama) tidak
 *   sah di file .fa
 */
function dfaToNfa(dfa, opsi = {}) {
  // File .dfa lama boleh memakai nama/simbol yang tidak sah di .fa.
  for (const q of dfa.states) {
    const alasan = alasanNamaTakSahFa(q);
    if (alasan) {
      throw new Error(`konversi gagal: nama state '${q}' ${alasan} di file .fa; ganti namanya dulu`);
    }
  }
  for (const a of dfa.alphabet) {
    if (SIMBOL_DICADANGKAN_FA.includes(a)) {
      throw new Error(
        `konversi gagal: simbol '${a}' dicadangkan untuk string kosong di file .fa; ganti simbolnya dulu`
      );
    }
  }

  const dibuang = new Set(
    opsi.removeDeadStates ? findDeadStates(dfa).filter((q) => q !== dfa.start) : []
  );
  const mapping = dfa.transitions.map((t) => {
    const removed = dibuang.has(t.from) || dibuang.has(t.to);
    return { from: t.from, symbol: t.symbol, dfaTo: t.to, nfaTo: removed ? null : [t.to], removed };
  });
  const removedStates = [...dibuang].map((state) => ({ state, reason: ALASAN_DEAD_STATE }));

  const tetap = (q) => !dibuang.has(q);
  const baris = [
    'type: NFA',
    '# hasil konversi DFA -> NFA',
    `states: ${dfa.states.filter(tetap).join(' ')}`,
    `alphabet: ${dfa.alphabet.join(' ')}`.trimEnd(),
    `start: ${dfa.start}`,
    `accept: ${dfa.accept.filter(tetap).join(' ')}`.trimEnd(),
  ];
  if (removedStates.length > 0) {
    baris.push(`# dead state dibuang: ${removedStates.map((r) => r.state).join(' ')} (${ALASAN_DEAD_STATE})`);
  }
  const transisi = mapping.filter((m) => !m.removed).map((m) => `${m.from} ${m.symbol} -> {${m.nfaTo.join(', ')}}`);
  if (transisi.length > 0) baris.push('', ...transisi);
  const text = baris.join('\n') + '\n';

  const nfa = parseFa(text, 'fa').automaton;
  return { text, nfa, mapping, removedStates };
}

module.exports = { nfaToDfa, namaHimpunan, dfaToNfa, findDeadStates };
