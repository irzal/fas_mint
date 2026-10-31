// Validator: memeriksa apakah objek hasil parser benar-benar DFA.
// Acuan: spesifikasi-dfa.md bagian 5 (aturan V1 sampai V6b).

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
      errors.push(`simbol '${t.symbol}' tidak ada di Σ`);
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
 * Aman dipanggil pada DFA yang belum valid; transisi ke/dari state tak dikenal
 * hanya ikut ditelusuri apa adanya.
 *
 * @param {import("./parser").Dfa} dfa
 * @returns {string[]}
 */
function findUnreachable(dfa) {
  const tetangga = new Map();
  for (const t of dfa.transitions) {
    if (!tetangga.has(t.from)) tetangga.set(t.from, []);
    tetangga.get(t.from).push(t.to);
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

module.exports = { validateDfa, warnDfa, findUnreachable, removeUnreachable };
