// Pembantu murni untuk Simpan/Buka file .dfa dan .fa di browser (tanpa DOM),
// supaya bisa dites di Node. Dipakai app.js lewat <script> (objek global `Berkas`).
// Aturan dokumen di halaman web: spesifikasi-fa.md bagian 10.

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

  // ---------- dokumen .fa dan .dfa (tahap 6, spesifikasi bagian 10) ----------

  /**
   * Format file dari namanya: '.fa' -> 'fa', '.dfa' -> 'dfa', selain itu null.
   * @param {string} nama
   * @returns {'fa'|'dfa'|null}
   */
  function formatDariNama(nama) {
    const n = String(nama ?? '').toLowerCase();
    if (n.endsWith('.dfa')) return 'dfa';
    if (n.endsWith('.fa')) return 'fa';
    return null;
  }

  /**
   * Nama file yang aman diunduh, dengan ekstensi sesuai format dokumen.
   * Ekstensi .fa/.dfa yang sudah ada diganti; ekstensi lain dipertahankan
   * sebagai bagian nama (catatan.txt -> catatan.txt.fa).
   *   namaBerkas('genap.dfa', 'fa') -> 'genap.fa'
   *   namaBerkas('', 'fa')          -> 'automata.fa'
   *
   * @param {string} nama masukan pengguna
   * @param {'fa'|'dfa'} format
   * @returns {string}
   */
  function namaBerkas(nama, format) {
    const ext = '.' + format;
    let n = String(nama ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .trim()
      .replace(/\.(d?fa)$/i, '') // ekstensi lama dibuang dulu ('.fa' -> '')
      .replace(/^\.+/, '') // lalu titik di depan (file tersembunyi / "..")
      .slice(0, 100);
    if (n === '' || /^_+$/.test(n)) n = 'automata';
    return n + ext;
  }

  // Baris type: yang sah (DFA atau NFA), boleh diikuti komentar. Hanya baris
  // seperti ini yang dipindah ke pilihan jenis; nilai lain dibiarkan di teks
  // supaya pemeriksaan melaporkannya.
  const BARIS_TYPE_SAH = /^[ \t]*type:[ \t]*(DFA|NFA)[ \t]*(#.*)?$/;

  /**
   * Memisahkan baris `type: DFA` / `type: NFA` dari teks dokumen .fa: di
   * halaman web jenis automata dipilih lewat pilihan jenis, bukan ditulis di
   * kotak definisi (spesifikasi bagian 10). Semua baris seperti itu dibuang
   * dari teks; jenis diambil dari yang pertama.
   *
   * @param {string} teks
   * @returns {{ jenis: 'DFA'|'NFA'|null, teks: string, jumlah: number }}
   *   jenis null jika tidak ada baris type: yang sah; jumlah = baris yang dibuang
   */
  function pisahkanBarisType(teks) {
    let jenis = null;
    let jumlah = 0;
    const sisa = String(teks)
      .split('\n')
      .filter((baris) => {
        const cocok = BARIS_TYPE_SAH.exec(baris.replace(/\r$/, ''));
        if (!cocok) return true;
        if (jenis === null) jenis = cocok[1];
        jumlah++;
        return false;
      });
    return { jenis, teks: sisa.join('\n'), jumlah };
  }

  /**
   * Isi file .fa yang disimpan: baris `type:` sesuai pilihan jenis di baris
   * pertama, lalu isi kotak definisi (spesifikasi bagian 10).
   *
   * @param {string} teks isi kotak definisi (tanpa baris type:)
   * @param {'DFA'|'NFA'} jenis
   * @returns {string}
   */
  function teksSimpanFa(teks, jenis) {
    return `type: ${jenis}\n` + siapkanTeksSimpan(teks);
  }

  /**
   * Isi kotak definisi untuk dokumen baru. NFA baru adalah dokumen saat halaman
   * pertama kali dibuka (spesifikasi bagian 10): satu state tanpa transisi,
   * langsung valid sebagai NFA. DFA baru memerlukan transisi untuk setiap
   * simbol (V6), jadi q0 diberi loop untuk 0 dan 1.
   */
  const TEMPLAT = {
    // NFA: contoh transisi ke lebih dari satu state, δ(q0, 0) = {q0, q1},
    // dan ε-transisi (string kosong), δ(q0, ε) = {q1}. q0 juga state akhir.
    NFA:
      'states: q0 q1\nalphabet: 0 1\nstart: q0\naccept: q0\n\nq0 0 -> {q0, q1}\n' +
      '# ε boleh ditulis λ, eps, lam\nq0 ε -> q1\n',
    // DFA: δ harus total, jadi q0 diberi loop untuk 0 dan 1; q0 juga state akhir.
    DFA: 'states: q0\nalphabet: 0 1\nstart: q0\naccept: q0\n\nq0 0 -> q0\nq0 1 -> q0\n',
  };

  const api = {
    MAKS_BERKAS,
    NAMA_BAWAAN,
    namaBerkasDfa,
    siapkanTeksSimpan,
    periksaBerkas,
    formatDariNama,
    namaBerkas,
    pisahkanBarisType,
    teksSimpanFa,
    TEMPLAT,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Berkas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
