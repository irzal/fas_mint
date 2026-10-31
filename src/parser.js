// Parser: mengubah teks file .dfa menjadi objek JavaScript.
// Acuan: spesifikasi-dfa.md bagian 4 (aturan penulisan).
//
// Parser HANYA membaca teks. Pemeriksaan "apakah ini benar-benar DFA"
// adalah tugas validator.

// File .dfa hanya punya dua jenis baris bermakna (selain kosong/komentar):
//   1. Header    "nama: isi"            -> Q, Σ, q₀, F   (contoh: states: q0 q1)
//   2. Transisi  "asal simbol -> tujuan" -> δ             (contoh: q0 0 -> q1)
//
// HEADER mengenali baris jenis 1. Seluruh baris harus cocok (^ ... $).
//   grup 1 = nama header (hanya empat nama ini yang sah)
//   grup 2 = sisa baris setelah ':' (boleh kosong, mis. "accept:" -> F = ∅)
// Baris yang tidak cocok dicoba sebagai transisi; jika bukan juga, error.
const HEADER = /^(states|alphabet|start|accept):(.*)$/;
const NAMA_HEADER = ['states', 'alphabet', 'start', 'accept']; // sama dengan isi HEADER

// Memecah teks menjadi daftar kata; pemisahnya spasi atau tab (aturan 2).
//   pisah(' q0   q1 ') -> ['q0', 'q1']
//   pisah('')          -> []   (bukan [''] seperti ''.split(/\s+/)),
// supaya "accept:" tanpa isi menjadi himpunan kosong, bukan satu state kosong.
function pisah(teks) {
  const t = teks.trim();
  return t === '' ? [] : t.split(/\s+/);
}

// Aturan simbol alfabet (spesifikasi bagian 4). Simbol BOLEH:
//   - huruf, angka, atau tanda baca apa saja: 0 1 a B + * ( ) : -
//   - huruf non-Latin atau emoji, selama satu karakter Unicode utuh
//   - huruf besar dan kecil dianggap berbeda ('a' dan 'A' dua simbol)
// Simbol TIDAK BOLEH:
//   - lebih dari satu karakter: 'ab', '10' (tulis sebagai dua simbol: 1 0)
//   - kosong (tidak mungkin lewat sini: pisah() tidak menghasilkan kata kosong)
//   - spasi atau tab (otomatis tidak bisa: spasi adalah pemisah kata)
//   - '#', karena '#' memulai komentar sampai akhir baris (lihat parseDfa),
//     jadi tidak mungkin sampai ke sini; tetap dijaga untuk pemanggil langsung
//   - 'ε', karena dicadangkan untuk NFA (transisi tanpa masukan)
// [...simbol] menghitung karakter Unicode (code point), bukan unit UTF-16,
// jadi emoji dihitung satu. Huruf bertanda yang ditulis terpisah (e + aksen
// gabung) dihitung dua dan ditolak.
// Yang diperiksa di sini hanya baris alphabet:. Apakah simbol pada transisi
// ada di alfabet adalah tugas validator (V4).
function periksaSimbol(simbol, nomor) {
  if ([...simbol].length !== 1) {
    throw new Error(`baris ${nomor}: simbol '${simbol}' harus tepat satu karakter`);
  }
  if (simbol === '#' || simbol === 'ε') {
    throw new Error(`baris ${nomor}: simbol '${simbol}' tidak boleh dipakai di alfabet`);
  }
}

/**
 * Satu baris transisi di file, yaitu satu nilai fungsi transisi δ(from, symbol) = to.
 * Contoh: baris `q0 0 -> q1` menjadi { from: 'q0', symbol: '0', to: 'q1', line: 8 }.
 *
 * Yang dijamin parser:
 *   - from, symbol, to: string tak kosong, tanpa spasi/tab (hasil pisah()).
 *   - line: bilangan bulat >= 1, nomor baris di file (baris pertama = 1).
 * Yang TIDAK dijamin (tugas validator):
 *   - from dan to belum tentu ada di states (V5).
 *   - symbol belum tentu ada di alphabet, dan boleh lebih dari satu
 *     karakter karena aturan satu karakter hanya diperiksa di alphabet: (V4).
 *
 * @typedef {object} Transisi
 * @property {string} from   state asal
 * @property {string} symbol simbol masukan
 * @property {string} to     state tujuan
 * @property {number} line   nomor baris di file (mulai dari 1)
 */

/**
 * Objek hasil parse, sama dengan 5-tuple (Q, Σ, δ, q₀, F).
 *
 * Contoh (berakhiran-01.dfa, transisi dipotong):
 *   {
 *     states:      ['q0', 'q1', 'q2'],     // Q
 *     alphabet:    ['0', '1'],             // Σ
 *     start:       'q0',                   // q₀
 *     accept:      ['q2'],                 // F
 *     transitions: [                       // δ
 *       { from: 'q0', symbol: '0', to: 'q1', line: 8 },
 *       ...
 *     ]
 *   }
 *
 * Semua field selalu ada (tidak pernah undefined). Susunan elemen array
 * sama dengan urutan tulisan di file.
 *
 * Yang dijamin parser:
 *   - states: array string tanpa spasi dan tanpa '->'. Boleh kosong.
 *   - alphabet: array string, masing-masing tepat satu karakter Unicode dan
 *     bukan '#' atau 'ε'. Boleh kosong.
 *   - start: satu string (kata tunggal di baris start:).
 *   - accept: array string tanpa spasi dan tanpa '->'. Boleh kosong (F = ∅).
 *   - transitions: array Transisi, satu per baris transisi. Boleh kosong.
 * Yang TIDAK dijamin (tugas validator, aturan V1-V6b):
 *   - start dan isi accept belum tentu anggota states (V1, V2).
 *   - states dan alphabet bisa berisi duplikat (V3).
 *   - jumlah transisi belum tentu |Q| x |Σ|; transisi bisa kurang atau ganda
 *     (V6a, V6b). `transitions` sengaja berupa daftar, bukan tabel, supaya
 *     transisi ganda tetap terlihat.
 *
 * @typedef {object} Dfa
 * @property {string[]} states        Q, himpunan state
 * @property {string[]} alphabet      Σ, himpunan simbol masukan
 * @property {string} start           q₀, state awal
 * @property {string[]} accept        F, himpunan state akhir
 * @property {Transisi[]} transitions δ, daftar transisi
 */

/**
 * Membaca teks file .dfa menjadi objek Dfa. Hanya memeriksa sintaks;
 * apakah hasilnya benar-benar DFA diperiksa validator.
 *
 * @param {string} teks isi file .dfa
 * @returns {Dfa} objek DFA seperti didefinisikan di atas
 * @throws {Error} jika sintaks salah; pesan memuat nomor baris
 */
function parseDfa(teks) {
  // Hasil bacaan header, disimpan per nama: { nilai: string[], baris: number }.
  // `baris` dicatat agar error "ditulis dua kali" bisa menunjuk kemunculan pertama.
  const header = {};
  const transitions = [];

  const baris = String(teks).split(/\r?\n/);
  baris.forEach((isi, i) => {
    const nomor = i + 1;
    // Aturan 3 dan 4: '#' memulai komentar (seperti Python): dari '#' sampai
    // akhir baris dibuang, di awal baris maupun setelah isi. Baris yang tinggal
    // kosong (kosong asli atau komentar penuh) diabaikan. Akibatnya nama state
    // dan simbol tidak pernah mengandung '#'.
    const posKomentar = isi.indexOf('#');
    const trimmed = (posKomentar === -1 ? isi : isi.slice(0, posKomentar)).trim();
    if (trimmed === '') return;

    // Jenis 1: header.
    const cocok = HEADER.exec(trimmed);
    if (cocok) {
      const [, nama, sisa] = cocok; // elemen 0 (teks utuh) dilewati
      // Aturan 7: tiap header wajib tepat satu kali.
      if (header[nama]) {
        throw new Error(
          `baris ${nomor}: '${nama}:' ditulis dua kali (pertama di baris ${header[nama].baris})`
        );
      }
      const nilai = pisah(sisa);
      // Nama state tidak boleh mengandung '->' (bagian 4, "Nama state").
      // Diperiksa untuk semua header karena start:/accept: juga berisi nama state.
      for (const n of nilai) {
        if (n.includes('->')) {
          throw new Error(`baris ${nomor}: nama state '${n}' tidak boleh mengandung '->'`);
        }
      }
      if (nama === 'alphabet') {
        for (const s of nilai) periksaSimbol(s, nomor);
      }
      // Keputusan tambahan (lihat bagian 9 spesifikasi): q₀ harus tepat satu.
      if (nama === 'start' && nilai.length !== 1) {
        throw new Error(`baris ${nomor}: 'start:' harus berisi tepat satu state`);
      }
      header[nama] = { nilai, baris: nomor };
      return;
    }

    // Jenis 2: transisi, tepat 4 kata: asal, simbol, '->', tujuan.
    // Anggota Q/Σ TIDAK diperiksa di sini (itu V4/V5 di validator), dan transisi
    // ganda tetap dimasukkan apa adanya (V6b).
    const token = pisah(trimmed);
    if (token.length === 4 && token[2] === '->') {
      transitions.push({ from: token[0], symbol: token[1], to: token[3], line: nomor });
      return;
    }

    // Bukan kosong, komentar, header, maupun transisi. Jika bentuknya "kata:"
    // di awal baris, kemungkinan besar maksudnya header yang salah tulis
    // (mis. 'States:'), jadi beri pesan yang menyebut nama header yang sah.
    const mirip = /^([^\s:]+):/.exec(trimmed);
    if (mirip) {
      const kata = mirip[1];
      const saran = NAMA_HEADER.find((h) => h === kata.toLowerCase());
      throw new Error(
        `baris ${nomor}: header '${kata}:' tidak dikenali ` +
          (saran ? `(huruf besar dan kecil dibedakan, maksud Anda '${saran}:'?)` : `(yang sah: ${NAMA_HEADER.map((h) => h + ':').join(', ')})`)
      );
    }
    throw new Error(
      `baris ${nomor}: tidak dikenali '${trimmed}' (format transisi: asal simbol -> tujuan)`
    );
  });

  // Urutan baris bebas, jadi kelengkapan header baru bisa dicek setelah semua dibaca.
  for (const nama of NAMA_HEADER) {
    if (!header[nama]) throw new Error(`baris '${nama}:' tidak ada`);
  }

  return {
    states: header.states.nilai,
    alphabet: header.alphabet.nilai,
    start: header.start.nilai[0],
    accept: header.accept.nilai,
    transitions,
  };
}

module.exports = { parseDfa };
