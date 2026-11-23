// Animasi jejak simulasi di atas diagram state (sub tahap 5d).
//
// Jejak dilihat sebagai deretan posisi 0, 1, ..., n (n = panjang input):
//   - posisi 0: berada di state awal q₀, belum ada simbol yang dibaca
//   - posisi k: simbol ke-k baru saja dibaca, yaitu langkah δ(p, a) = q,
//     dan sekarang berada di q
// Posisi n adalah akhir input: diterima jika state terakhir anggota F.
//
// Dua bagian:
//   1. keadaanJejak(...)  -> apa yang disorot di posisi k. Murni, dites di Node.
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

  /**
   * Pasang sorotan di diagram: state saat ini, panah yang baru dipakai, dan
   * (di akhir) tanda diterima/ditolak. Sorotan lama dihapus dulu.
   * Elemen dicari lewat atribut data-* yang dipasang Gambar.buatSvg.
   * @param {SVGSVGElement|null} svg
   * @param {ReturnType<typeof keadaanJejak>|null} keadaan null = hapus sorotan saja
   */
  function sorotDiagram(svg, keadaan) {
    if (!svg) return;
    for (const g of svg.querySelectorAll('.state')) {
      g.classList.remove('aktif', 'diterima', 'ditolak');
      if (keadaan && g.dataset.state === keadaan.state) {
        g.classList.add('aktif');
        if (keadaan.selesai) g.classList.add(keadaan.diterima ? 'diterima' : 'ditolak');
      }
    }
    for (const g of svg.querySelectorAll('.transisi')) {
      const dipakai = Boolean(keadaan && keadaan.sisi &&
        g.dataset.from === keadaan.sisi.from && g.dataset.to === keadaan.sisi.to);
      g.classList.toggle('dipakai', dipakai);
      const panah = g.querySelector('.panah');
      panah.setAttribute('marker-end', dipakai ? 'url(#kepala-panah-sorot)' : 'url(#kepala-panah)');
      // Panah yang dipakai dipindah ke atas panah lain (tetap di bawah lingkaran
      // state) supaya tidak tertutup panah yang bersilangan.
      if (dipakai) svg.insertBefore(g, svg.querySelector('.state'));
    }
  }

  const api = { keadaanJejak, sorotDiagram };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Animasi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
