# Finite Automata Simulator (FAS)

Kerangka webapp Node.js untuk mensimulasikan DFA. Format file mengikuti
[`spesifikasi-fa.md`](spesifikasi-fa.md). Tanpa library eksternal: tidak perlu `npm install`.

## Menjalankan

Butuh Node.js 18 atau lebih baru.

```
npm start          # server web di http://localhost:3000 (ganti port: PORT=8080 npm start)
npm run dev        # sama, tetapi server restart otomatis saat file berubah
npm test           # menjalankan semua tes (node --test)
npm run cli -- contoh/berakhiran-01.dfa 0101
```

CLI (`src/cli.js`) membaca file `.fa` dan `.dfa`; DFA atau NFA ditentukan oleh
ekstensi dan baris `type:`:

```
node src/cli.js <file.fa|file.dfa> [string-input]          # jalankan string (kosong = ε)
node src/cli.js ke-dfa <file.fa> [hasil.fa]                # NFA -> DFA, cetak tabel langkah
node src/cli.js ke-nfa <file.fa|file.dfa> [hasil.fa] [--buang-dead-state]   # DFA -> NFA
```

Tanpa nama file hasil, konversi menulis `<nama>-dfa.fa` atau `<nama>-nfa.fa`
di folder yang sama. File yang sudah ada tidak pernah ditimpa.

## Memakai halaman web

1. Mulai dari "NFA baru" atau "DFA baru", pilih contoh di "Muat contoh", atau
   buka file `.fa`/`.dfa` dari komputer (tombol Buka…, atau seret file ke
   kotak definisi).
2. "Jenis automata" menunjukkan apakah dokumen dibaca sebagai DFA atau NFA.
   Untuk dokumen `.fa` jenisnya bisa diganti di sini; baris `type:` tidak
   ditulis di kotak definisi, tetapi ditambahkan otomatis saat menyimpan.
   Dokumen `.dfa` (file lama) selalu DFA; "Jadikan .fa (type: DFA)" mengubahnya
   menjadi dokumen `.fa`, dan "Jadikan .dfa" sebaliknya (hanya untuk DFA).
3. Kotak "Pemeriksaan" langsung memberi tahu jika automata belum valid,
   misalnya `δ(q1, 1) belum didefinisikan`. Diagram state ikut diperbarui
   saat mengetik.
4. Tulis string input (kosongkan untuk ε), lalu tekan Jalankan (atau Enter).
   Hasil DITERIMA/DITOLAK dan tabel jejak muncul. Untuk DFA, jejaknya diputar
   di diagram: state aktif, panah δ yang dipakai, dan simbol yang dibaca
   disorot. Pakai tombol Awal, Mundur, Putar/Jeda, dan Maju untuk mengikuti
   per langkah. Untuk NFA, tabel jejak berisi himpunan state per langkah.
5. Jika diagram kurang rapi, ganti tata letak atau seret state ke tempat lain.
   Dengan keyboard: Tab ke state, lalu tombol panah (Shift + panah: geser halus).
6. Simpan menyimpan definisi ke komputer sesuai format dokumen (`.fa` atau `.dfa`).

Halaman bisa dipakai di ponsel. Di layar sempit, diagram yang lebar bisa
digulung ke samping.

## Struktur folder

```
fas/
├── contoh/              file .dfa dan .fa contoh (yang diawali tidak-valid- sengaja salah)
├── src/
│   ├── parser.js        teks .dfa/.fa -> objek (Q, Σ, δ, q₀, F)
│   ├── validator.js     cek aturan V1-V6b (DFA) dan V1-V5 (NFA)
│   ├── simulator.js     jalankan string, hasilkan jejak (DFA dan NFA)
│   ├── converter.js     konversi NFA -> DFA (konstruksi subset) dan DFA -> NFA
│   ├── fas.js           gabungan parse -> validasi -> simulasi (dipakai CLI dan web)
│   ├── cli.js           antarmuka baris perintah
│   └── web/server.js    tahap 5: server http bawaan Node + API JSON
├── public/              halaman web (HTML, CSS, JS polos)
│   ├── graf.js          model graf (node, sisi) dan tata letak; tanpa DOM
│   ├── gambar.js        penggambar diagram state (geometri + elemen SVG)
│   ├── animasi.js       animasi jejak di atas diagram (keadaan tiap langkah + sorotan)
│   ├── berkas.js        pembantu simpan/buka file .dfa
│   └── app.js           penghubung halaman dengan API
└── test/                tes per modul
```

Alur data: `public/app.js` -> `POST /api/simulasi` -> `src/fas.js` ->
parser -> validator -> simulator. CLI memakai `src/fas.js` yang sama.

Diagram state: `POST /api/analisis` (saat mengetik) memberi `dfa` ->
`Graf.buatGraf` -> `Graf.hitungTataLetak` -> `Gambar.susunGambar` ->
`Gambar.buatSvg`. Semuanya berjalan di browser, kecuali parse di server.
Posisi hasil geser pengguna disisipkan lewat `Graf.terapkanGeser` sebelum
`Gambar.susunGambar`.

## Deploy ke hosting (mis. Hostinger Node.js)

Konfigurasi yang dipakai sekarang (sudah berjalan di Hostinger):

| Pengaturan | Isi |
|---|---|
| File masuk (entry file) | `server.js` (di akar proyek) |
| Skrip start di `package.json` | `node server.js` (`npm start`) |
| Build command dan output directory | dikosongkan (tidak ada dependensi dan tidak ada yang dikompilasi) |
| Environment variables | dikosongkan (`PORT` diberikan hosting) |
| Versi Node.js | 18 atau lebih baru |
| Port | dibaca dari variabel `PORT` yang diberikan hosting (bawaan 3000) |

`server.js` adalah file masuk yang **wajib** dipakai di Hostinger. Hostinger memuat file
masuk lewat `require()` dan tidak mendukung penjaga `if (require.main === module)` yang
dipakai `src/web/server.js` (server hanya menyala jika dijalankan langsung). Dengan file
masuk `src/web/server.js`, log Hostinger menulis "App did not call listen() within 3
seconds" dan halaman tidak terbuka (403). `server.js` memanggil `listen()` tanpa syarat,
jadi aman dimuat dengan cara apa pun. Jangan mengganti file masuk menjadi
`src/web/server.js`. Tesnya ada di `test/server-masuk.test.js`.

## API

| Method | Path                   | Keterangan                                   |
|--------|------------------------|----------------------------------------------|
| GET    | `/api/contoh`          | daftar file `.dfa` dan `.fa` di `contoh/`    |
| GET    | `/api/contoh/<nama>`   | isi satu file contoh (teks)                  |
| GET    | `/healthz`             | menjawab `ok` jika proses hidup (untuk diagnosis hosting) |
| POST   | `/api/simulasi`        | body `{ "dfa": "...", "input": "0101", "format": "fa", "type": "NFA" }` |
| POST   | `/api/analisis`        | body `{ "dfa": "...", "format": "fa", "type": "NFA" }`; periksa tanpa simulasi |

- `dfa`: isi file, boleh teks `.dfa` maupun `.fa`. Nama field ini dipertahankan
  supaya klien lama tetap jalan.
- `format` (opsional): `"fa"` atau `"dfa"`, yaitu format file yang isinya
  dikirim. Menentukan cara membaca (spesifikasi bagian 8.1): `.fa` tanpa
  `type:` adalah NFA, `.dfa` selalu DFA. Bawaan `"dfa"`. Nilai lain dijawab `400`.
- `type` (opsional, hanya dengan `"format": "fa"`): `"DFA"` atau `"NFA"`, jenis
  yang dipilih di luar teks (pilihan jenis di halaman web). Teks lalu tidak
  boleh berisi baris `type:` yang sah. Nomor baris di pesan error tetap sesuai
  teks yang dikirim.

`/api/simulasi` menjawab `200` dengan
`{ type, errors, warnings, automaton, dfa, result }`:

- `type`: `"DFA"` atau `"NFA"`.
- `errors`: pelanggaran aturan (DFA: V1-V6b, NFA: V1-V5); jika tidak kosong,
  `result` adalah `null`.
- `warnings`: peringatan yang tidak menghentikan simulasi (mis. state tak
  terjangkau, baris `type:` yang diabaikan di `.dfa`, tujuan ganda di NFA).
- `automaton`: hasil parse (`states`, `alphabet`, `start`, `accept`,
  `transitions`), selalu ada, bahan untuk menggambar graf. Pada NFA, `to` di
  setiap transisi berupa daftar state. `dfa` berisi hal yang sama (untuk
  klien lama).
- `result`: DFA `{ accepted, finalState, steps }` (spesifikasi bagian 7);
  NFA `{ accepted, start, steps, finalStates }` (spesifikasi bagian 8.6).

Sintaks yang salah atau simbol input di luar Σ dijawab `400` dengan
`{ error: "..." }`. Untuk simbol di luar Σ ada field tambahan `position`
(posisi simbol itu, mulai dari 1).

`/api/analisis` dipakai halaman untuk pemeriksaan langsung saat mengetik. Ia
selalu menjawab `200` dengan `{ syntaxError, type, errors, warnings, automaton, dfa }`:
sintaks yang salah dilaporkan di `syntaxError` (teks pesan, memuat nomor baris)
dan `type`, `automaton`, `dfa` menjadi `null`. Body yang bukan JSON atau tanpa
field `dfa` dijawab `400`.

## Rencana tahap 5 (web)

| Sub tahap | Isi | Status |
|---|---|---|
| 5a | Tampilan hasil, jejak, peringatan, pemeriksaan langsung saat mengetik | selesai (dicoba di Chromium) |
| 5b | Model graf (node, sisi digabung) dan tata letak berlapis/melingkar, `public/graf.js` | selesai |
| 5c | Gambar graf SVG, menu pilihan tata letak, `public/gambar.js` | selesai (dicoba di Chromium) |
| 5d | Animasi jejak di atas graf (Awal/Mundur/Putar/Maju, pita input, sorot baris tabel), `public/animasi.js` | selesai (dicoba di Chromium) |
| 5e | Penyelesaian: layar kecil (tanpa gulung samping halaman, huruf isian 16px, tombol 44px, diagram minimal 75% lalu digulung), aksesibilitas (SVG `role="group"`, ikon tidak dibacakan, teks langkah tidak diumumkan selama diputar, kontras), README | selesai (dicoba di Chromium, lebar 320, 375, dan 1000 px) |
| 5f | Menggeser node dengan mouse/sentuh atau tombol panah, tombol "Kembalikan posisi"; posisi per tata letak, hanya selama halaman terbuka (`Graf.terapkanGeser`) | selesai (dicoba di Chromium) |
| 5g | Simpan dan Buka file `.dfa` di sisi browser (unduh / pemilih file / seret-lepas) | selesai (dicoba di Chromium) |
| nanti | Konfigurasi gambar graf di file terpisah (lihat spesifikasi bagian 11) | belum |
| nanti | Simpan per pengguna (akun) di server, selain simpan ke komputer sendiri di 5g. Butuh identitas pengguna, penyimpanan di server, dan perlindungan akses | belum |

## Rencana tahap 6 (NFA dan konversi)

Acuan: [`spesifikasi-fa.md`](spesifikasi-fa.md) bagian 8 sampai 10. Urutan
dikerjakan dari atas; setiap sub tahap disertai tes, termasuk kasus tepi.
Logika (6a sampai 6e) tetap tanpa library eksternal dan dipakai bersama oleh
CLI dan web.

| Sub tahap | Isi | Status |
|---|---|---|
| 6a | Parser `.fa`: baris `type:` (baris bermakna pertama, nilai DFA/NFA), string kosong `ε`/`eps`/`λ`/`lam`, notasi himpunan `{q0, q1}` dan `{}`, aturan nama state `.fa` (tanpa `{ }`, koma hanya di dalam kurung siku); `.dfa` tetap seperti sekarang, baris `type:` diabaikan (selain `type: DFA` diberi peringatan). Fungsi `parseFa(teks, format)` di `src/parser.js`; `parseDfa` tetap untuk `.dfa` | selesai (tes `test/parser-fa.test.js`) |
| 6b | Validator NFA: V1-V5 (V4 menerima tulisan string kosong), `type:` tak dikenal = error, tujuan ganda digabung + peringatan, W1 dengan ε-transisi; `.fa` ber-`type: DFA` memakai V1-V6b dan menolak `{...}` dan ε. Fungsi `validateNfa` dan `warnNfa` di `src/validator.js`; pesan V4 DFA memberi petunjuk "ε-transisi hanya untuk NFA" | selesai (tes `test/validator-nfa.test.js`) |
| 6c | Simulator NFA: ε-closure, himpunan state per langkah, jejak `{ accepted, start, steps: [{ from, symbol, moved, edges, to, epsilonEdges }], finalStates }`. Fungsi `simulateNfa`, `epsilonClosure`, `move` di `src/simulator.js` | selesai (tes `test/simulator-nfa.test.js`) |
| 6d | Konversi NFA -> DFA (konstruksi subset, hanya himpunan terjangkau): nama `[q0,q1]` dan `[]`, deteksi tabrakan nama, tabel langkah demi langkah dan tabel transisi subset. Fungsi `nfaToDfa` di `src/converter.js`, hasil berupa teks `.fa` (`type: DFA`), objek DFA, dan kedua tabel | selesai (tes `test/converter-nfa-dfa.test.js`) |
| 6e | Konversi DFA -> NFA: tujuan ditulis `{p}`, pilihan buang dead state (state awal tidak pernah dibuang), tabel pemetaan. Fungsi `dfaToNfa` dan `findDeadStates` di `src/converter.js`; nama/simbol `.dfa` yang tidak sah di `.fa` menghentikan konversi dengan pesan | selesai (tes `test/converter-dfa-nfa.test.js`) |
| 6f | CLI: membaca `.fa` dan `.dfa`, jejak NFA, perintah konversi kedua arah (mencetak tabel dan menulis file hasil `.fa`). Perintah `ke-dfa` dan `ke-nfa`; fungsi bersama `periksaFa`/`jalankanFa` di `src/fas.js` | selesai (tes `test/cli-fa.test.js`) |
| 6g | Contoh `.fa` (NFA, NFA dengan ε, DFA ber-`type: DFA`, contoh tidak valid) dan server/API untuk `.fa` (daftar contoh, analisis, simulasi). Field `format` di API; halaman web sementara hanya menampilkan contoh `.dfa` sampai 6h-6i | selesai (tes `test/server-fa.test.js`, `test/contoh-fa.test.js`; halaman lama dicoba di Chromium) |
| 6h | Web, dokumen: widget jenis automata (terkunci untuk `.dfa`), baris `type:` disembunyikan dari kotak definisi, menu "DFA baru"/"NFA baru", dokumen awal NFA satu state, Simpan sesuai format dokumen, menu "Jadikan .fa (type: DFA)"/"Jadikan .dfa". Field `type` di API; diagram dan tabel jejak dasar untuk NFA (tanpa animasi) | selesai (dicoba di Chromium, termasuk lebar 320 px) |
| 6i | Web, NFA: diagram dengan ε-transisi, tabel jejak NFA (kolom hasil δ dan ε-closure terpisah), animasi yang menyorot beberapa state dan panah sekaligus | belum |
| 6j | Web, konversi: menu konversi kedua arah, tabel langkah/pemetaan, tampilan hasil konversi (masih perlu diputuskan, spesifikasi bagian 13) | belum |
| 6k | Penyelesaian: layar kecil dan aksesibilitas untuk bagian baru, README, contoh lama tetap jalan | belum |

## Status

- Sudah jalan: `parseDfa`, `validateDfa`, `simulate`, server web, API, dan
  CLI (dengan jejak langkah), semuanya dengan tes.
- Sudah jalan di web: diagram state (SVG) yang diperbarui saat mengetik,
  dengan pilihan tata letak berlapis atau melingkar.
- Sudah jalan di web: animasi jejak setelah Jalankan. State aktif, panah yang
  dipakai, simbol yang dibaca, dan baris tabel jejak disorot bersamaan.
- Sudah jalan di web: menggeser state di diagram (seret, atau Tab lalu tombol
  panah). Posisi tetap saat teks diubah, selama nama statenya masih ada.
- Tahap 5 selesai. Yang masih "nanti" ada di tabel tahap 5.
- Tahap 6 (NFA dan konversi): sudah diputuskan di spesifikasi, belum
  dikerjakan. Rencananya di tabel di atas.
