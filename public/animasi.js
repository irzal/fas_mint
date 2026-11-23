// Animasi jejak simulasi di atas diagram state (sub tahap 5d untuk DFA,
// sub tahap 6i untuk NFA).
//
// Jejak dilihat sebagai deretan posisi 0, 1, ..., n (n = panjang input):
//   - posisi 0: berada di state awal q₀, belum ada simbol yang dibaca
//   - posisi k: simbol ke-k baru saja dibaca, yaitu langkah δ(p, a) = q,
//     dan sekarang berada di q
// Posisi n adalah akhir input: diterima jika state terakhir anggota F.
//
// Pada NFA, setiap posisi berupa HIMPUNAN state (spesifikasi bagian 8.6):
//   - posisi 0: ε-closure({q₀})
//   - posisi k: sesudah membaca simbol ke-k (gabungan δ, lalu ε-closure)
// Diterima jika himpunan terakhir memuat paling sedikit satu state akhir.
//
// Bagian-bagian:
//   1. keadaanJejak(...), keadaanJejakNfa(...) -> apa yang disorot di posisi k.
//      Murni, dites di Node.
//   2. sorotDiagram(...)  -> memasang sorotan itu di <svg> (butuh browser).

(function (root) {
  /**
   * @param {string} start state awal q₀
   * @param {{ accepted: boolean, finalState: string,
   *   steps: { from: string, symbol: string, to: string }[] }} hasil hasil simulasi
   * @param {number} k posisi, 0 sampai hasil.steps.length (di luar itu dipotong)
   * @returns {{
   *   posisi: number, total: number,
   *   state: string,                                // state saat ini
   *   sisi: { from: string, to: string } | null,    // panah yang baru dipakai
   *   selesai: boolean,                             // input sudah habis dibaca
   *   diterima: boolean | null,                     // hanya terisi jika selesai
   *   teks: string                                  // penjelasan untuk mahasiswa
   * }}
   */
  function keadaanJejak(start, hasil, k) {
    const total = hasil.steps.length;
    const posisi = Math.max(0, Math.min(total, k));
    const langkah = posisi === 0 ? null : hasil.steps[posisi - 1];
    const state = langkah ? langkah.to : start;
    const selesai = posisi === total;

    let teks;
    if (total === 0) {
      teks = `Input kosong (ε): tidak ada langkah, tetap di state awal ${start}.`;
    } else if (langkah === null) {
      teks = `Mulai di state awal ${start}. Belum ada simbol yang dibaca.`;
    } else {
      // Notasi buku teks: δ(asal, simbol) = tujuan
      teks = `Langkah ${posisi} dari ${total}: δ(${langkah.from}, ${langkah.symbol}) = ${langkah.to}.`;
    }
    if (selesai) {
      teks += hasil.accepted
        ? ` Input habis di ${state}, dan ${state} ∈ F: DITERIMA.`
        : ` Input habis di ${state}, dan ${state} ∉ F: DITOLAK.`;
    }

    return {
      posisi,
      total,
      state,
      sisi: langkah ? { from: langkah.from, to: langkah.to } : null,
      selesai,
      diterima: selesai ? hasil.accepted : null,
      teks,
    };
  }

  // Himpunan state untuk teks: {q0, q1}; himpunan kosong: ∅.
  function himpunan(states) {
    return states.length === 0 ? '∅' : `{${states.join(', ')}}`;
  }
  const sama = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /**
   * Keadaan jejak NFA di posisi k (spesifikasi bagian 8.6).
   *
   * @param {{ start: string, accept: string[] }} nfa
   * @param {{ accepted: boolean, start: { states: string[], epsilonEdges: object[] },
   *   steps: { from: string[], symbol: string, moved: string[], edges: object[],
   *   to: string[], epsilonEdges: object[] }[], finalStates: string[] }} hasil hasil simulateNfa
   * @param {number} k posisi, 0 sampai hasil.steps.length (di luar itu dipotong)
   * @returns {{
   *   posisi: number, total: number,
   *   states: string[],                          // himpunan state saat ini
   *   daftarSisi: { from: string, to: string }[], // panah δ dan ε yang dipakai
   *   selesai: boolean,
   *   diterima: boolean | null,                  // hanya terisi jika selesai
   *   stateAkhir: string[],                      // state akhir di himpunan (jika selesai)
   *   teks: string
   * }}
   */
  function keadaanJejakNfa(nfa, hasil, k) {
    const total = hasil.steps.length;
    const posisi = Math.max(0, Math.min(total, k));
    const langkah = posisi === 0 ? null : hasil.steps[posisi - 1];
    const states = langkah ? langkah.to : hasil.start.states;
    const selesai = posisi === total;

    const daftarSisi = langkah
      ? [...langkah.edges, ...langkah.epsilonEdges].map((e) => ({ from: e.from, to: e.to }))
      : hasil.start.epsilonEdges.map((e) => ({ from: e.from, to: e.to }));

    let teks;
    const awal = hasil.start.states;
    const teksAwal = sama(awal, [nfa.start])
      ? `himpunan awal ${himpunan(awal)}`
      : `himpunan awal ε-closure({${nfa.start}}) = ${himpunan(awal)}`;
    if (total === 0) {
      teks = `Input kosong (ε): tidak ada langkah, ${teksAwal}.`;
    } else if (langkah === null) {
      teks = `Mulai: ${teksAwal}. Belum ada simbol yang dibaca.`;
    } else {
      teks =
        `Langkah ${posisi} dari ${total}: dari ${himpunan(langkah.from)} baca ${langkah.symbol}: ` +
        `gabungan δ = ${himpunan(langkah.moved)}`;
      if (!sama(langkah.moved, langkah.to)) teks += `, ε-closure = ${himpunan(langkah.to)}`;
      teks += '.';
    }

    const F = new Set(nfa.accept);
    const stateAkhir = selesai ? states.filter((q) => F.has(q)) : [];
    if (selesai) {
      teks += hasil.accepted
        ? ` Input habis; ${himpunan(states)} memuat state akhir ${stateAkhir.join(', ')}: DITERIMA.`
        : ` Input habis; ${himpunan(states)} tidak memuat state akhir: DITOLAK.`;
    }

    return {
      posisi,
      total,
      states,
      daftarSisi,
      selesai,
      diterima: selesai ? hasil.accepted : null,
      stateAkhir,
      teks,
    };
  }

  /**
   * Pasang sorotan di diagram: state saat ini, panah yang baru dipakai, dan
   * (di akhir) tanda diterima/ditolak. Sorotan lama dihapus dulu.
   * Berlaku untuk keadaan DFA (satu `state`, satu `sisi`) maupun NFA
   * (himpunan `states`, `daftarSisi`). Di akhir NFA yang diterima, hanya state
   * akhir di himpunan yang ditandai diterima; jika ditolak, semua ditandai ditolak.
   * Elemen dicari lewat atribut data-* yang dipasang Gambar.buatSvg.
   * @param {SVGSVGElement|null} svg
   * @param {object|null} keadaan hasil keadaanJejak/keadaanJejakNfa; null = hapus sorotan saja
   */
  function sorotDiagram(svg, keadaan) {
    if (!svg) return;
    const aktif = new Set(keadaan ? keadaan.states ?? [keadaan.state] : []);
    const akhirDiterima = new Set(keadaan?.stateAkhir ?? (keadaan ? [keadaan.state] : []));
    const daftarSisi = keadaan ? keadaan.daftarSisi ?? (keadaan.sisi ? [keadaan.sisi] : []) : [];
    for (const g of svg.querySelectorAll('.state')) {
      g.classList.remove('aktif', 'diterima', 'ditolak');
      if (!aktif.has(g.dataset.state)) continue;
      g.classList.add('aktif');
      if (keadaan.selesai) {
        if (!keadaan.diterima) g.classList.add('ditolak');
        else if (akhirDiterima.has(g.dataset.state)) g.classList.add('diterima');
      }
    }
    for (const g of svg.querySelectorAll('.transisi')) {
      const dipakai = daftarSisi.some((s) => g.dataset.from === s.from && g.dataset.to === s.to);
      g.classList.toggle('dipakai', dipakai);
      const panah = g.querySelector('.panah');
      panah.setAttribute('marker-end', dipakai ? 'url(#kepala-panah-sorot)' : 'url(#kepala-panah)');
      // Panah yang dipakai dipindah ke atas panah lain (tetap di bawah lingkaran
      // state) supaya tidak tertutup panah yang bersilangan.
      if (dipakai) svg.insertBefore(g, svg.querySelector('.state'));
    }
  }

  const api = { keadaanJejak, keadaanJejakNfa, sorotDiagram };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Animasi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
