// Parser: mengubah teks file .dfa atau .fa menjadi objek JavaScript.
// Acuan: spesifikasi-fa.md bagian 4 (aturan penulisan) dan bagian 8.1-8.4
// (format .fa dan NFA).
//
// Parser HANYA membaca teks. Pemeriksaan "apakah ini benar-benar DFA/NFA"
// adalah tugas validator.
//
// Dua format file:
//   .dfa  format lama, selalu DFA. Baris `type:` diabaikan (bagian 8.1).
//   .fa   format baru. Baris `type:` (jika ada, wajib baris bermakna pertama)
//         menentukan jenisnya: tanpa `type:` atau `type: NFA` -> NFA,
//         `type: DFA` -> DFA.
//
// Baris bermakna (selain kosong/komentar) ada tiga jenis:
//   1. Header    "nama: isi"             -> Q, Σ, q₀, F   (contoh: states: q0 q1)
//   2. Transisi  "asal simbol -> tujuan" -> δ             (contoh: q0 0 -> q1)
//   3. Jenis     "type: DFA" / "type: NFA"                (hanya bermakna di .fa)
//
// HEADER mengenali baris jenis 1. Seluruh baris harus cocok (^ ... $).
//   grup 1 = nama header (hanya empat nama ini yang sah)
//   grup 2 = sisa baris setelah ':' (boleh kosong, mis. "accept:" -> F = ∅)
// Baris yang tidak cocok dicoba sebagai transisi; jika bukan juga, error.
const HEADER = /^(states|alphabet|start|accept):(.*)$/;
const NAMA_HEADER = ['states', 'alphabet', 'start', 'accept']; // sama dengan isi HEADER
const BARIS_TYPE = /^type:(.*)$/;
const JENIS = ['DFA', 'NFA'];

// String kosong (ε) boleh ditulis dengan empat cara di file .fa (bagian 8.4).
// Semuanya dinormalkan menjadi 'ε' di hasil parse.
const EPSILON = 'ε';
const TULISAN_EPSILON = ['ε', 'eps', 'λ', 'lam'];

// Transisi .fa: "asal simbol -> tujuan". Tujuan diambil sebagai sisa baris
// (grup 3) karena himpunan seperti "{q0, q1}" boleh berisi spasi.
const TRANSISI_FA = /^(\S+)\s+(\S+)\s+->\s+(.+)$/;

// Memecah teks menjadi daftar kata; pemisahnya spasi atau tab (aturan 2).
//   pisah(' q0   q1 ') -> ['q0', 'q1']
//   pisah('')          -> []   (bukan [''] seperti ''.split(/\s+/)),
// supaya "accept:" tanpa isi menjadi himpunan kosong, bukan satu state kosong.
function pisah(teks) {
  const t = teks.trim();
  return t === '' ? [] : t.split(/\s+/);
}

// Aturan 3 dan 4: '#' memulai komentar (seperti Python): dari '#' sampai akhir
// baris dibuang, di awal baris maupun setelah isi. Baris yang tinggal kosong
// (kosong asli atau komentar penuh) dilewati. Akibatnya nama state dan simbol
// tidak pernah mengandung '#'.
// Hasil: daftar { nomor, isi } untuk baris bermakna saja (nomor mulai dari 1).
function barisBermakna(teks) {
  const hasil = [];
  String(teks).split(/\r?\n/).forEach((isi, i) => {
    const posKomentar = isi.indexOf('#');
    const trimmed = (posKomentar === -1 ? isi : isi.slice(0, posKomentar)).trim();
    if (trimmed !== '') hasil.push({ nomor: i + 1, isi: trimmed });
  });
  return hasil;
}

// Aturan simbol alfabet (spesifikasi bagian 4). Simbol BOLEH:
//   - huruf, angka, atau tanda baca apa saja: 0 1 a B + * ( ) : -
//   - huruf non-Latin atau emoji, selama satu karakter Unicode utuh
//   - huruf besar dan kecil dianggap berbeda ('a' dan 'A' dua simbol)
// Simbol TIDAK BOLEH:
//   - lebih dari satu karakter: 'ab', '10' (tulis sebagai dua simbol: 1 0)
//   - kosong (tidak mungkin lewat sini: pisah() tidak menghasilkan kata kosong)
//   - spasi atau tab (otomatis tidak bisa: spasi adalah pemisah kata)
//   - '#', karena '#' memulai komentar sampai akhir baris, jadi tidak mungkin
//     sampai ke sini; tetap dijaga untuk pemanggil langsung
//   - 'ε', karena dicadangkan untuk string kosong (transisi tanpa masukan)
//   - di file .fa juga 'λ', tulisan lain untuk string kosong (bagian 8.4)
// [...simbol] menghitung karakter Unicode (code point), bukan unit UTF-16,
// jadi emoji dihitung satu. Huruf bertanda yang ditulis terpisah (e + aksen
// gabung) dihitung dua dan ditolak.
// Yang diperiksa di sini hanya baris alphabet:. Apakah simbol pada transisi
// ada di alfabet adalah tugas validator (V4).
function periksaSimbol(simbol, nomor, formatFa) {
  if ([...simbol].length !== 1) {
    throw new Error(`baris ${nomor}: simbol '${simbol}' harus tepat satu karakter`);
  }
  const dilarang = formatFa ? ['#', ...SIMBOL_DICADANGKAN_FA] : ['#', 'ε'];
  if (dilarang.includes(simbol)) {
    throw new Error(`baris ${nomor}: simbol '${simbol}' tidak boleh dipakai di alfabet`);
  }
}

// Aturan nama state (bagian 4, "Nama state", dan bagian 8.4 untuk .fa):
//   - semua format: tidak boleh mengandung '->'
//   - .fa: tidak boleh mengandung '{' atau '}' (khusus untuk himpunan), dan
//     koma hanya boleh di dalam kurung siku, mis. '[q0,q1]' (nama hasil
//     konversi NFA -> DFA). Dengan begitu elemen himpunan seperti
//     {[q0,q1], q2} selalu bisa dipisah dengan benar.
function periksaNamaState(nama, nomor, formatFa) {
  if (nama.includes('->')) {
    throw new Error(`baris ${nomor}: nama state '${nama}' tidak boleh mengandung '->'`);
  }
  if (!formatFa) return;
  const alasan = alasanNamaTakSahFa(nama);
  if (alasan) throw new Error(`baris ${nomor}: nama state '${nama}' ${alasan}`);
}

// Aturan nama state khusus .fa (bagian 8.4 butir 4). Mengembalikan alasan
// jika nama tidak sah, atau null jika sah. Dipakai juga oleh konversi
// DFA -> NFA untuk memeriksa nama dari file .dfa lama.
function alasanNamaTakSahFa(nama) {
  if (nama.includes('{') || nama.includes('}')) {
    return "tidak boleh mengandung '{' atau '}' (kurung kurawal khusus untuk himpunan state)";
  }
  if (adaKomaDiLuarKurungSiku(nama)) {
    return 'tidak boleh mengandung koma di luar kurung siku (contoh nama yang boleh: [q0,q1])';
  }
  return null;
}

// Simbol yang dicadangkan untuk string kosong di file .fa (bagian 8.4 butir 2).
const SIMBOL_DICADANGKAN_FA = ['ε', 'λ'];

// Menelusuri karakter satu per satu sambil menghitung kedalaman kurung siku.
//   'q0,q1'   -> true   (koma di kedalaman 0)
//   '[q0,q1]' -> false  (koma di dalam [ ])
function adaKomaDiLuarKurungSiku(teks) {
  let dalam = 0;
  for (const c of teks) {
    if (c === '[') dalam++;
    else if (c === ']') dalam = Math.max(0, dalam - 1);
    else if (c === ',' && dalam === 0) return true;
  }
  return false;
}

// Memecah isi himpunan "{q0, q1}" menjadi ['q0', 'q1'] (bagian 8.4):
//   - elemen dipisah koma; spasi di sekitar koma boleh ada atau tidak
//   - koma di dalam kurung siku adalah bagian nama: "{[q0,q1], q2}" -> ['[q0,q1]', 'q2']
//   - "{}" (atau "{ }") adalah himpunan kosong ∅ -> []
function pecahHimpunan(teks, nomor) {
  if (!teks.endsWith('}')) {
    throw new Error(`baris ${nomor}: himpunan '${teks}' harus ditutup dengan '}'`);
  }
  const isi = teks.slice(1, -1);
  if (isi.trim() === '') return [];

  const elemen = [];
  let sekarang = '';
  let dalam = 0;
  for (const c of isi) {
    if (c === '[') dalam++;
    if (c === ']') dalam = Math.max(0, dalam - 1);
    if (c === ',' && dalam === 0) {
      elemen.push(sekarang.trim());
      sekarang = '';
    } else {
      sekarang += c;
    }
  }
  elemen.push(sekarang.trim());

  for (const e of elemen) {
    if (e === '') {
      throw new Error(`baris ${nomor}: himpunan '${teks}' berisi elemen kosong (periksa komanya)`);
    }
    if (/\s/.test(e)) {
      throw new Error(`baris ${nomor}: elemen '${e}' di himpunan '${teks}' berisi spasi; pisahkan state dengan koma`);
    }
  }
  return elemen;
}

// Membaca baris header (jenis 1) ke objek `header`. Mengembalikan true jika
// baris itu memang header.
function bacaHeader(b, header, formatFa) {
  const cocok = HEADER.exec(b.isi);
  if (!cocok) return false;
  const [, nama, sisa] = cocok; // elemen 0 (teks utuh) dilewati
  // Aturan 7: tiap header wajib tepat satu kali.
  if (header[nama]) {
    throw new Error(
      `baris ${b.nomor}: '${nama}:' ditulis dua kali (pertama di baris ${header[nama].baris})`
    );
  }
  const nilai = pisah(sisa);
  if (nama === 'alphabet') {
    for (const s of nilai) periksaSimbol(s, b.nomor, formatFa);
  } else {
    // states:, start:, dan accept: berisi nama state.
    for (const n of nilai) periksaNamaState(n, b.nomor, formatFa);
  }
  // Keputusan tambahan (lihat bagian 12 spesifikasi, Riwayat keputusan): q₀ harus tepat satu.
  if (nama === 'start' && nilai.length !== 1) {
    throw new Error(`baris ${b.nomor}: 'start:' harus berisi tepat satu state`);
  }
  header[nama] = { nilai, baris: b.nomor };
  return true;
}

// Pesan untuk baris yang bukan header, bukan transisi. Jika bentuknya "kata:"
// di awal baris, kemungkinan besar maksudnya header yang salah tulis
// (mis. 'States:'), jadi pesan menyebut nama header yang sah.
function errorBarisTakDikenal(b, formatFa) {
  const mirip = /^([^\s:]+):/.exec(b.isi);
  if (mirip) {
    const kata = mirip[1];
    const sah = formatFa ? [...NAMA_HEADER, 'type'] : NAMA_HEADER;
    const saran = sah.find((h) => h === kata.toLowerCase());
    return new Error(
      `baris ${b.nomor}: header '${kata}:' tidak dikenali ` +
        (saran
          ? `(huruf besar dan kecil dibedakan, maksud Anda '${saran}:'?)`
          : `(yang sah: ${NAMA_HEADER.map((h) => h + ':').join(', ')})`)
    );
  }
  return new Error(
    `baris ${b.nomor}: tidak dikenali '${b.isi}' (format transisi: asal simbol -> tujuan)`
  );
}

/**
 * Satu baris transisi DFA, yaitu satu nilai fungsi transisi δ(from, symbol) = to.
 * Contoh: baris `q0 0 -> q1` menjadi { from: 'q0', symbol: '0', to: 'q1', line: 8 }.
 *
 * Yang dijamin parser:
 *   - from, symbol, to: string tak kosong, tanpa spasi/tab.
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
 * Objek hasil parse DFA, sama dengan 5-tuple (Q, Σ, δ, q₀, F).
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
 *     bukan '#' atau 'ε' (di .fa juga bukan 'λ'). Boleh kosong.
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
 * Satu baris transisi NFA: δ(from, symbol) memuat semua state di `to`.
 * Contoh: baris `q0 0 -> {q0, q1}` menjadi
 *   { from: 'q0', symbol: '0', to: ['q0', 'q1'], line: 8 }
 * dan `q0 1 -> {}` menjadi { from: 'q0', symbol: '1', to: [], line: 9 }.
 *
 * Satu entri = satu baris di file (bukan satu pasangan state-simbol), supaya
 * validator tetap bisa memeriksa asal/simbol baris `-> {}` (V4, V5) dan
 * melihat tujuan yang ditulis dua kali.
 *   - symbol: tulisan string kosong (ε, eps, λ, lam) sudah dinormalkan menjadi 'ε'.
 *   - to: daftar nama state sesuai urutan tulisan; boleh kosong (δ = ∅).
 *
 * @typedef {object} TransisiNfa
 * @property {string} from
 * @property {string} symbol
 * @property {string[]} to
 * @property {number} line
 */

/**
 * Objek hasil parse NFA. Sama dengan Dfa, kecuali transisinya TransisiNfa.
 * δ: Q × (Σ ∪ {ε}) → 𝒫(Q). Transisi yang tidak ditulis berarti δ = ∅.
 *
 * @typedef {object} Nfa
 * @property {string[]} states
 * @property {string[]} alphabet
 * @property {string} start
 * @property {string[]} accept
 * @property {TransisiNfa[]} transitions
 */

/**
 * Hasil parseFa.
 * @typedef {object} HasilParse
 * @property {'DFA'|'NFA'} type   jenis automata menurut aturan bagian 8.1
 * @property {Dfa|Nfa} automaton  Dfa jika type 'DFA', Nfa jika 'NFA'
 * @property {string[]} warnings  peringatan dari parser (mis. baris type: diabaikan di .dfa)
 */

/**
 * Membaca teks file .fa atau .dfa. Hanya memeriksa sintaks; apakah hasilnya
 * benar-benar DFA/NFA diperiksa validator.
 *
 * Pilihan `opsi.type` ('DFA' atau 'NFA', hanya untuk format 'fa'): jenis
 * automata sudah ditentukan di luar teks, mis. lewat pilihan jenis di halaman
 * web yang menyembunyikan baris `type:` (bagian 10). Teks lalu tidak boleh
 * berisi baris `type:` yang sah; nilai yang tidak dikenal tetap dilaporkan
 * seperti biasa. Nomor baris di pesan error tetap sesuai teks yang diberikan.
 *
 * @param {string} teks isi file
 * @param {'fa'|'dfa'} [format] format file, dari ekstensinya; bawaan 'fa'
 * @param {{ type?: 'DFA'|'NFA' }} [opsi]
 * @returns {HasilParse}
 * @throws {Error} jika sintaks salah; pesan memuat nomor baris
 */
function parseFa(teks, format = 'fa', opsi = {}) {
  if (format !== 'fa' && format !== 'dfa') {
    throw new Error(`format '${format}' tidak dikenal (pilih 'fa' atau 'dfa')`);
  }
  if (opsi.type !== undefined && !(format === 'fa' && JENIS.includes(opsi.type))) {
    throw new Error(`jenis '${opsi.type}' dari luar teks hanya boleh DFA atau NFA, dan hanya untuk format 'fa'`);
  }
  const formatFa = format === 'fa';
  const semua = barisBermakna(teks);
  const warnings = [];

  // Langkah 1: tentukan jenis automata (bagian 8.1).
  let type;
  let baris = semua;
  if (formatFa && opsi.type) {
    // Jenis dari luar teks: baris type: yang sah tidak boleh ada di teks.
    type = opsi.type;
    for (const b of semua) {
      const cocok = BARIS_TYPE.exec(b.isi);
      if (!cocok) continue;
      bacaNilaiType(cocok[1], b.nomor); // nilai tak dikenal -> error biasa
      throw new Error(
        `baris ${b.nomor}: baris 'type:' tidak dipakai di sini, karena jenis automata sudah dipilih (${opsi.type})`
      );
    }
  } else if (formatFa) {
    type = 'NFA'; // tanpa baris type: -> NFA
    const pertama = semua[0];
    const cocok = pertama && BARIS_TYPE.exec(pertama.isi);
    if (cocok) {
      type = bacaNilaiType(cocok[1], pertama.nomor);
      baris = semua.slice(1);
    }
    // Baris type: hanya boleh di baris bermakna pertama.
    const lain = baris.find((b) => BARIS_TYPE.test(b.isi));
    if (lain) {
      throw new Error(
        `baris ${lain.nomor}: 'type:' harus menjadi baris pertama (selain komentar dan baris kosong)`
      );
    }
  } else {
    // .dfa selalu DFA. Baris type: diabaikan; selain "type: DFA" diberi peringatan.
    type = 'DFA';
    baris = semua.filter((b) => {
      const cocok = BARIS_TYPE.exec(b.isi);
      if (!cocok) return true;
      const nilai = cocok[1].trim();
      if (nilai !== 'DFA') {
        warnings.push(
          `baris ${b.nomor}: baris 'type: ${nilai}' diabaikan: file .dfa selalu dibaca sebagai DFA; simpan sebagai .fa jika maksudnya NFA`
        );
      }
      return false;
    });
  }

  // Langkah 2: baca header dan transisi.
  const header = {};
  const transitions = [];
  for (const b of baris) {
    if (bacaHeader(b, header, formatFa)) continue;
    const t = formatFa ? bacaTransisiFa(b, type) : bacaTransisiDfa(b);
    if (!t) throw errorBarisTakDikenal(b, formatFa);
    transitions.push(t);
  }

  // Urutan baris bebas, jadi kelengkapan header baru bisa dicek setelah semua dibaca.
  for (const nama of NAMA_HEADER) {
    if (!header[nama]) throw new Error(`baris '${nama}:' tidak ada`);
  }

  return {
    type,
    automaton: {
      states: header.states.nilai,
      alphabet: header.alphabet.nilai,
      start: header.start.nilai[0],
      accept: header.accept.nilai,
      transitions,
    },
    warnings,
  };
}

// Isi baris "type: ..." di file .fa: tepat satu kata, DFA atau NFA.
// Huruf besar dan kecil dibedakan (aturan 6), tetapi pesannya memberi saran.
function bacaNilaiType(sisa, nomor) {
  const nilai = pisah(sisa);
  if (nilai.length === 1 && JENIS.includes(nilai[0])) return nilai[0];
  const tulisan = nilai.join(' ');
  const saran = nilai.length === 1 ? JENIS.find((j) => j === nilai[0].toUpperCase()) : undefined;
  throw new Error(
    `baris ${nomor}: type '${tulisan}' tidak dikenal; pilih DFA atau NFA` +
      (saran ? ` (huruf besar dan kecil dibedakan, maksud Anda '${saran}'?)` : '')
  );
}

// Transisi di file .dfa: tepat 4 kata: asal, simbol, '->', tujuan.
// Anggota Q/Σ TIDAK diperiksa di sini (itu V4/V5 di validator), dan transisi
// ganda tetap dimasukkan apa adanya (V6b). Format .dfa tidak berubah sejak
// tahap 1-5, jadi tujuan seperti '{q1}' dibaca sebagai nama state biasa.
// Mengembalikan null jika baris bukan transisi.
function bacaTransisiDfa(b) {
  const token = pisah(b.isi);
  if (token.length === 4 && token[2] === '->') {
    return { from: token[0], symbol: token[1], to: token[3], line: b.nomor };
  }
  return null;
}

// Transisi di file .fa. Mengembalikan null jika baris bukan transisi.
//   DFA: tujuan tepat satu nama state; notasi himpunan ditolak (bagian 8.4 butir 5).
//   NFA: tujuan satu nama state atau himpunan "{...}"; tulisan string kosong
//        (ε, eps, λ, lam) pada simbol dinormalkan menjadi 'ε'.
function bacaTransisiFa(b, type) {
  const cocok = TRANSISI_FA.exec(b.isi);
  if (!cocok) return null;
  const [, from, simbol, tujuan] = cocok;
  periksaNamaState(from, b.nomor, true);

  if (type === 'DFA') {
    if (tujuan.startsWith('{')) {
      throw new Error(
        `baris ${b.nomor}: notasi himpunan '${tujuan}' hanya untuk NFA; DFA punya tepat satu tujuan (V6)`
      );
    }
    if (/\s/.test(tujuan)) return null; // mis. "q0 0 -> q1 q2": bukan transisi
    periksaNamaState(tujuan, b.nomor, true);
    return { from, symbol: simbol, to: tujuan, line: b.nomor };
  }

  // NFA
  let to;
  if (tujuan.startsWith('{')) {
    to = pecahHimpunan(tujuan, b.nomor);
  } else if (/\s/.test(tujuan)) {
    throw new Error(
      `baris ${b.nomor}: tujuan '${tujuan}' berisi spasi; tulis banyak tujuan sebagai himpunan, mis. {${pisah(tujuan).join(', ')}}`
    );
  } else {
    to = [tujuan];
  }
  for (const nama of to) periksaNamaState(nama, b.nomor, true);
  const symbol = TULISAN_EPSILON.includes(simbol) ? EPSILON : simbol;
  return { from, symbol, to, line: b.nomor };
}

/**
 * Membaca teks file .dfa menjadi objek Dfa (bentuk lama, dipakai CLI dan web
 * sejak tahap 1). Sama dengan parseFa(teks, 'dfa').automaton; peringatan
 * parser (baris type: yang diabaikan) tidak ikut dikembalikan.
 *
 * @param {string} teks isi file .dfa
 * @returns {Dfa} objek DFA seperti didefinisikan di atas
 * @throws {Error} jika sintaks salah; pesan memuat nomor baris
 */
function parseDfa(teks) {
  return parseFa(teks, 'dfa').automaton;
}

module.exports = { parseFa, parseDfa, EPSILON, TULISAN_EPSILON, SIMBOL_DICADANGKAN_FA, alasanNamaTakSahFa };
