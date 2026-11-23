// Validator: memeriksa apakah objek hasil parser benar-benar DFA atau NFA.
// Acuan: spesifikasi-fa.md bagian 5 (DFA: aturan V1 sampai V6b) dan
// bagian 8.5 (NFA: V1 sampai V5, tanpa V6).

const { EPSILON, TULISAN_EPSILON } = require('./parser');

// Pesan V4. Jika simbolnya salah satu tulisan string kosong (ε, eps, λ, lam)
// pada DFA, tambahkan petunjuk bahwa ε-transisi hanya ada di NFA.
function pesanV4(simbol, untukDfa) {
  const petunjuk = untukDfa && TULISAN_EPSILON.includes(simbol) ? ' (ε-transisi hanya untuk NFA)' : '';
  return `simbol '${simbol}' tidak ada di Σ${petunjuk}`;
}

/**
 * Semua pelanggaran dikumpulkan sekaligus (tidak berhenti di yang pertama),
 * satu pesan per pelanggaran, urutan: V1, V2, V3, lalu V4/V5 per transisi
 * (urutan file), lalu V6a/V6b per pasangan (state, simbol).
 *
 * Transisi yang state atau simbolnya tidak dikenal (V4/V5) tidak ikut dihitung
 * di V6, supaya satu kesalahan tidak dilaporkan dua kali.
 *
 * @param {import("./parser").Dfa} dfa objek hasil parseDfa
 * @returns {string[]} daftar pesan error; kosong berarti DFA valid.
 *   Contoh: ["δ(q1, 1) belum didefinisikan"]
 */
function validateDfa(dfa) {
  const errors = [];
  const Q = new Set(dfa.states);
  const sigma = new Set(dfa.alphabet);

  // V1: state awal harus anggota Q.
  if (!Q.has(dfa.start)) {
    errors.push(`state awal '${dfa.start}' tidak ada di Q`);
  }

  // V2: setiap state akhir harus anggota Q.
  for (const s of dfa.accept) {
    if (!Q.has(s)) errors.push(`state akhir '${s}' tidak ada di Q`);
  }

  // V3: tidak ada duplikat di Q maupun Σ (satu pesan per nama, walau muncul 3x).
  for (const s of duplikat(dfa.states)) {
    errors.push(`state '${s}' ditulis dua kali di Q`);
  }
  for (const a of duplikat(dfa.alphabet)) {
    errors.push(`simbol '${a}' ditulis dua kali di Σ`);
  }

  // V4 dan V5: simbol dan kedua state pada tiap transisi harus dikenal.
  // `jumlah` menghitung transisi sah per pasangan "state\0simbol" untuk V6.
  const jumlah = new Map();
  for (const t of dfa.transitions) {
    let sah = true;
    if (!Q.has(t.from)) {
      errors.push(`state '${t.from}' tidak ada di Q`);
      sah = false;
    }
    if (!sigma.has(t.symbol)) {
      errors.push(pesanV4(t.symbol, true));
      sah = false;
    }
    if (!Q.has(t.to)) {
      errors.push(`state '${t.to}' tidak ada di Q`);
      sah = false;
    }
    if (sah) {
      const kunci = t.from + '\0' + t.symbol;
      jumlah.set(kunci, (jumlah.get(kunci) || 0) + 1);
    }
  }

  // V6: tiap pasangan (state, simbol) punya tepat satu transisi.
  // Dilihat dari Q dan Σ tanpa duplikat, jadi V3 tidak menggandakan pesan V6.
  for (const q of Q) {
    for (const a of sigma) {
      const n = jumlah.get(q + '\0' + a) || 0;
      if (n === 0) {
        errors.push(`δ(${q}, ${a}) belum didefinisikan`);
      } else if (n > 1) {
        errors.push(`δ(${q}, ${a}) didefinisikan dua kali, itu bukan DFA`);
      }
    }
  }

  return errors;
}

/**
 * Memeriksa NFA (spesifikasi bagian 8.5). Sama dengan validateDfa untuk V1
 * sampai V5, tetapi tanpa V6: di NFA satu pasangan (state, simbol) boleh punya
 * banyak tujuan atau tidak punya tujuan sama sekali (δ = ∅).
 *
 * V4 pada NFA: simbol transisi harus anggota Σ, atau ε (parser sudah
 * menormalkan tulisan eps, λ, lam menjadi 'ε').
 *
 * Urutan pesan: V1, V2, V3, lalu V4/V5 per transisi (urutan file). Pada satu
 * baris, asal dan simbol diperiksa dulu, lalu setiap state tujuan.
 *
 * @param {import("./parser").Nfa} nfa objek hasil parseFa dengan type 'NFA'
 * @returns {string[]} daftar pesan error; kosong berarti NFA valid
 */
function validateNfa(nfa) {
  const errors = [];
  const Q = new Set(nfa.states);
  const sigma = new Set(nfa.alphabet);

  // V1: state awal harus anggota Q.
  if (!Q.has(nfa.start)) errors.push(`state awal '${nfa.start}' tidak ada di Q`);

  // V2: setiap state akhir harus anggota Q.
  for (const s of nfa.accept) {
    if (!Q.has(s)) errors.push(`state akhir '${s}' tidak ada di Q`);
  }

  // V3: tidak ada duplikat di Q maupun Σ.
  for (const s of duplikat(nfa.states)) errors.push(`state '${s}' ditulis dua kali di Q`);
  for (const a of duplikat(nfa.alphabet)) errors.push(`simbol '${a}' ditulis dua kali di Σ`);

  // V4 dan V5 untuk setiap baris transisi. Baris "q -> {}" (δ = ∅) tetap
  // diperiksa asal dan simbolnya.
  for (const t of nfa.transitions) {
    if (!Q.has(t.from)) errors.push(`state '${t.from}' tidak ada di Q`);
    if (t.symbol !== EPSILON && !sigma.has(t.symbol)) errors.push(pesanV4(t.symbol, false));
    for (const ke of t.to) {
      if (!Q.has(ke)) errors.push(`state '${ke}' tidak ada di Q`);
    }
  }
  return errors;
}

/**
 * Tujuan yang ditulis lebih dari sekali untuk pasangan (state, simbol) yang
 * sama, baik di baris berbeda (`q0 0 -> q1` dan `q0 0 -> {q1, q2}`) maupun
 * di satu himpunan (`{q1, q1}`). Tujuan itu tetap dihitung sekali (δ adalah
 * himpunan), tetapi diberi peringatan karena kemungkinan salah ketik.
 * Hasil: satu pesan per (state, simbol, tujuan), urutan kemunculan kedua di file.
 */
function tujuanGanda(nfa) {
  const sudah = new Set();
  const dilaporkan = new Set();
  const pesan = [];
  for (const t of nfa.transitions) {
    for (const ke of t.to) {
      const kunci = [t.from, t.symbol, ke].join('\0');
      if (sudah.has(kunci) && !dilaporkan.has(kunci)) {
        dilaporkan.add(kunci);
        pesan.push(`δ(${t.from}, ${t.symbol}): tujuan '${ke}' ditulis lebih dari sekali (baris ${t.line}), dihitung satu kali`);
      }
      sudah.add(kunci);
    }
  }
  return pesan;
}

// Elemen yang muncul lebih dari sekali, masing-masing dilaporkan satu kali.
function duplikat(daftar) {
  const lihat = new Set();
  const ganda = new Set();
  for (const x of daftar) {
    if (lihat.has(x)) ganda.add(x);
    lihat.add(x);
  }
  return ganda;
}

/**
 * State yang tidak bisa dicapai dari `start` dengan mengikuti transisi
 * (penelusuran graf). Urutan hasil mengikuti urutan `states`, tanpa duplikat.
 * Berlaku untuk DFA (`to` satu nama state) dan NFA (`to` daftar state). Pada
 * NFA, ε-transisi juga dihitung sebagai jalan (bagian 8.5): state yang hanya
 * bisa dicapai lewat ε tetap terjangkau.
 * Aman dipanggil pada automata yang belum valid; transisi ke/dari state tak
 * dikenal hanya ikut ditelusuri apa adanya.
 *
 * @param {import("./parser").Dfa|import("./parser").Nfa} dfa
 * @returns {string[]}
 */
function findUnreachable(dfa) {
  const tetangga = new Map();
  for (const t of dfa.transitions) {
    if (!tetangga.has(t.from)) tetangga.set(t.from, []);
    const tujuan = Array.isArray(t.to) ? t.to : [t.to];
    tetangga.get(t.from).push(...tujuan);
  }
  const terjangkau = new Set([dfa.start]);
  const antrean = [dfa.start];
  while (antrean.length > 0) {
    for (const ke of tetangga.get(antrean.shift()) || []) {
      if (!terjangkau.has(ke)) {
        terjangkau.add(ke);
        antrean.push(ke);
      }
    }
  }
  return [...new Set(dfa.states)].filter((s) => !terjangkau.has(s));
}

/**
 * Peringatan (bukan error): file tetap boleh dijalankan. Lihat W1 di spesifikasi.
 *
 * @param {import("./parser").Dfa} dfa
 * @returns {string[]} daftar pesan peringatan; kosong berarti tidak ada
 */
function warnDfa(dfa) {
  return findUnreachable(dfa).map(
    (s) => `state '${s}' tidak terjangkau dari state awal '${dfa.start}'`
  );
}

/**
 * Peringatan untuk NFA (bagian 8.5): W1 (state tak terjangkau, ε ikut
 * dihitung) lalu tujuan yang ditulis lebih dari sekali.
 *
 * @param {import("./parser").Nfa} nfa
 * @returns {string[]}
 */
function warnNfa(nfa) {
  return [...warnDfa(nfa), ...tujuanGanda(nfa)];
}

/**
 * Menghapus state tak terjangkau. TIDAK dipanggil otomatis; pemanggil yang
 * memutuskan. Mengembalikan DFA baru (objek asli tidak diubah): state tak
 * terjangkau dibuang dari states dan accept, beserta transisi yang berasal
 * darinya. Alfabet dan start tidak berubah, dan bahasa yang diterima sama.
 *
 * @param {import("./parser").Dfa} dfa
 * @returns {import("./parser").Dfa}
 */
function removeUnreachable(dfa) {
  const buang = new Set(findUnreachable(dfa));
  return {
    states: dfa.states.filter((s) => !buang.has(s)),
    alphabet: [...dfa.alphabet],
    start: dfa.start,
    accept: dfa.accept.filter((s) => !buang.has(s)),
    transitions: dfa.transitions.filter((t) => !buang.has(t.from)).map((t) => ({ ...t })),
  };
}

module.exports = { validateDfa, warnDfa, validateNfa, warnNfa, findUnreachable, removeUnreachable };
