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

Isi **file masuk (entry file)** aplikasi dengan `server.js` di akar proyek, bukan
`src/web/server.js`. Alasannya: `src/web/server.js` hanya menyalakan server jika
dijalankan langsung, sedangkan sebagian hosting memuat file masuk lewat `require()`.
`server.js` di akar selalu menyalakannya, dan port dibaca dari variabel `PORT`
(bawaan 3000). Tidak ada dependensi, jadi tidak ada langkah build khusus.

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
