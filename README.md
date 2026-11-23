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

## Memakai halaman web

1. Pilih contoh di "Muat contoh", tulis DFA sendiri di kotak definisi, atau
   buka file `.dfa` dari komputer (tombol Buka…, atau seret file ke kotak).
2. Kotak "Pemeriksaan DFA" langsung memberi tahu jika DFA belum valid,
   misalnya `δ(q1, 1) belum didefinisikan`. Diagram state ikut diperbarui
   saat mengetik.
3. Tulis string input (kosongkan untuk ε), lalu tekan Jalankan (atau Enter).
   Hasil DITERIMA/DITOLAK dan tabel jejak muncul, lalu jejaknya diputar di
   diagram: state aktif, panah δ yang dipakai, dan simbol yang dibaca disorot.
   Pakai tombol Awal, Mundur, Putar/Jeda, dan Maju untuk mengikuti per langkah.
4. Jika diagram kurang rapi, ganti tata letak atau seret state ke tempat lain.
   Dengan keyboard: Tab ke state, lalu tombol panah (Shift + panah: geser halus).
5. Simpan menyimpan definisi ke komputer sebagai file `.dfa`.

Halaman bisa dipakai di ponsel. Di layar sempit, diagram yang lebar bisa
digulung ke samping.

## Struktur folder

```
fas/
├── contoh/              file .dfa contoh (yang diawali tidak-valid- sengaja salah)
├── src/
│   ├── parser.js        teks .dfa -> objek (Q, Σ, δ, q₀, F)
│   ├── validator.js     cek aturan V1-V6b
│   ├── simulator.js     jalankan string, hasilkan jejak
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
| GET    | `/api/contoh`          | daftar file di `contoh/`                     |
| GET    | `/api/contoh/<nama>`   | isi satu file contoh (teks)                  |
| GET    | `/healthz`             | menjawab `ok` jika proses hidup (untuk diagnosis hosting) |
| POST   | `/api/simulasi`        | body `{ "dfa": "...", "input": "0101" }`     |
| POST   | `/api/analisis`        | body `{ "dfa": "..." }`; periksa tanpa simulasi |

`/api/simulasi` menjawab `200` dengan
`{ errors, warnings, dfa, result }`:

- `errors`: pelanggaran aturan DFA (V1-V6b); jika tidak kosong, `result` adalah `null`.
- `warnings`: peringatan yang tidak menghentikan simulasi (mis. state tak terjangkau).
- `dfa`: hasil parse (`states`, `alphabet`, `start`, `accept`, `transitions`),
  selalu ada, bahan untuk menggambar graf.
- `result`: `{ accepted, finalState, steps }`.

Sintaks `.dfa` yang salah atau simbol input di luar Σ dijawab `400` dengan
`{ error: "..." }`. Untuk simbol di luar Σ ada field tambahan `position`
(posisi simbol itu, mulai dari 1).

`/api/analisis` dipakai halaman untuk pemeriksaan langsung saat mengetik. Ia
selalu menjawab `200` dengan `{ syntaxError, errors, warnings, dfa }`: sintaks
yang salah dilaporkan di `syntaxError` (teks pesan, memuat nomor baris) dan
`dfa` menjadi `null`. Body yang bukan JSON atau tanpa field `dfa` dijawab `400`.

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

## Status

- Sudah jalan: `parseDfa`, `validateDfa`, `simulate`, server web, API, dan
  CLI (dengan jejak langkah), semuanya dengan tes.
- Sudah jalan di web: diagram state (SVG) yang diperbarui saat mengetik,
  dengan pilihan tata letak berlapis atau melingkar.
- Sudah jalan di web: animasi jejak setelah Jalankan. State aktif, panah yang
  dipakai, simbol yang dibaca, dan baris tabel jejak disorot bersamaan.
- Sudah jalan di web: menggeser state di diagram (seret, atau Tab lalu tombol
  panah). Posisi tetap saat teks diubah, selama nama statenya masih ada.
- Tahap 5 selesai. Yang masih "nanti" ada di tabel di atas.
