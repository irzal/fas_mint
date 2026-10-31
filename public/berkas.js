// Pembantu murni untuk Simpan/Buka file .dfa di browser (tanpa DOM), supaya bisa
// dites di Node. Dipakai app.js lewat <script> (objek global `Berkas`).

(function (root) {
  // Batas ukuran file yang dibuka. Sengaja jauh di bawah batas body server
  // (100000 byte): teks dikirim sebagai JSON, dan karakter seperti baris baru dan
  // tanda kutip memanjang saat di-escape. 50 KB cukup untuk DFA ribuan baris.
  const MAKS_BERKAS = 50_000;
  const NAMA_BAWAAN = 'dfa.dfa';

  /**
   * Nama file yang aman diunduh: tanpa pemisah path dan karakter yang dilarang di
   * Windows, berakhiran .dfa, bawaan 'dfa.dfa' jika kosong.
   *
   * @param {string} nama masukan pengguna
   * @returns {string}
   */
  function namaBerkasDfa(nama) {
    let n = String(nama ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .trim()
      .replace(/^\.+/, '') // tanpa titik di depan (file tersembunyi / "..")
      .slice(0, 100);
    if (n === '' || /^\.dfa$/i.test(n) || /^_+(\.dfa)?$/i.test(n)) return NAMA_BAWAAN;
    if (!/\.dfa$/i.test(n)) n += '.dfa';
    return n;
  }

  /**
   * Isi file yang disimpan: berakhir tepat dengan satu baris baru (kebiasaan file
   * teks); teks kosong tetap kosong.
   *
   * @param {string} teks isi kotak definisi
   * @returns {string}
   */
  function siapkanTeksSimpan(teks) {
    const t = String(teks).replace(/\r\n?/g, '\n');
    return t === '' || t.endsWith('\n') ? t : t + '\n';
  }

  /**
   * Memeriksa file yang akan dibuka.
   *
   * @param {{ teks: string, ukuran: number }} berkas isi (sudah di-decode UTF-8) dan ukuran byte asli
   * @returns {string|null} pesan alasan penolakan, atau null jika layak dibuka
   */
  function periksaBerkas({ teks, ukuran }) {
    if (ukuran > MAKS_BERKAS) {
      return `file terlalu besar (${ukuran} byte, maksimum ${MAKS_BERKAS} byte)`;
    }
    if (teks.includes('\u0000')) return 'bukan file teks (berisi data biner)';
    if (teks.includes('�')) return 'bukan teks UTF-8 yang sah';
    return null;
  }

  const api = { MAKS_BERKAS, NAMA_BAWAAN, namaBerkasDfa, siapkanTeksSimpan, periksaBerkas };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Berkas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
