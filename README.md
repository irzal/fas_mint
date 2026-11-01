# Finite Automata Simulator (FAS)

Kerangka webapp Node.js untuk mensimulasikan DFA. Format file mengikuti
[`spesifikasi-dfa.md`](spesifikasi-dfa.md). Tanpa library eksternal: tidak perlu `npm install`.

## Menjalankan

Butuh Node.js 18 atau lebih baru.

```
npm start          # server web di http://localhost:3000 (ganti port: PORT=8080 npm start)
npm run dev        # sama, tetapi server restart otomatis saat file berubah
npm test           # menjalankan semua tes (node --test)
npm run cli -- contoh/berakhiran-01.dfa 0101
```

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
└── test/                tes per modul
```

Alur data: `public/app.js` -> `POST /api/simulasi` -> `src/fas.js` ->
parser -> validator -> simulator. CLI memakai `src/fas.js` yang sama.

## Deploy ke hosting (mis. Hostinger Node.js)

Konfigurasi yang dipakai sekarang:

| Pengaturan | Isi |
|---|---|
| File masuk (entry file) | `server.js` |
| Skrip start di `package.json` | `node src/web/server.js` (`npm start`) |
| Build command dan output directory | dikosongkan (tidak ada dependensi dan tidak ada yang dikompilasi) |
| Versi Node.js | 18 atau lebih baru |
| Port | dibaca dari variabel `PORT` yang diberikan hosting (bawaan 3000) |

`src/web/server.js` hanya menyalakan server jika dijalankan langsung (`node ...`).
Jika hosting memuat file masuk lewat `require()`, server bisa tidak menyala dan
halaman tidak terbuka (misalnya 403). Untuk kasus itu tersedia **`server.js`** di akar
proyek, yang selalu menyalakan server. Cara memakainya: ubah file masuk di hosting
menjadi `server.js` dan `start` di `package.json` menjadi `node server.js`, lalu deploy
ulang. Ini hanya cadangan dan belum dipakai; tesnya ada di `test/server-masuk.test.js`.

## API

| Method | Path                   | Keterangan                                   |
|--------|------------------------|----------------------------------------------|
| GET    | `/api/contoh`          | daftar file di `contoh/`                     |
| GET    | `/api/contoh/<nama>`   | isi satu file contoh (teks)                  |
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
| 5c | Gambar graf SVG, menu pilihan tata letak | belum |
| 5d | Animasi jejak di atas graf | belum |
| 5e | Penyelesaian: layar kecil, aksesibilitas, README | belum |
| 5f | Menggeser node (posisi hanya selama halaman terbuka) | belum |
| 5g | Simpan dan Buka file `.dfa` di sisi browser (unduh / pemilih file / seret-lepas) | selesai (dicoba di Chromium) |
| nanti | Konfigurasi gambar graf di file terpisah (lihat spesifikasi bagian 8) | belum |
| nanti | Simpan per pengguna (akun) di server, selain simpan ke komputer sendiri di 5g. Butuh identitas pengguna, penyimpanan di server, dan perlindungan akses | belum |

## Status

- Sudah jalan: `parseDfa`, `validateDfa`, `simulate`, server web, API, dan
  CLI (dengan jejak langkah), semuanya dengan tes.
- Belum: tampilan graf dan animasinya di web.
