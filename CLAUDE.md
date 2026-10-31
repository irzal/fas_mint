# Instruksi Project: Finite Automata Simulator (FAS)

## Tujuan
Membangun Finite Automata Simulator (FAS) berbasis Node.js untuk pembelajaran mahasiswa S1 pada mata kuliah teori bahasa dan automata.

Tahap pengembangan (dikerjakan berurutan):
1. Format file definisi DFA (`.dfa`) (selesai)
2. Parser dan validator (selesai)
3. Simulator (menjalankan string, menampilkan jejak langkah demi langkah) (selesai)
4. Antarmuka CLI (selesai)
5. Antarmuka web (visualisasi diagram state)  <- tahap sekarang (rincian sub tahap di `README.md`)

## Lokasi kode
Seluruh kode project ada di folder ini (folder yang berisi `CLAUDE.md` ini):
- `src/` modul `parser`, `validator`, `simulator`, `cli`, dan `web/server.js`
- `public/` file antarmuka web
- `test/` tes (`node --test`)
- `contoh/` contoh file `.dfa`
- `spesifikasi-dfa.md` acuan utama format `.dfa`

Gagasan jangka panjang yang belum diputuskan (editor diagram grafis, Tutor AI
untuk DFA/NFA/regex) dicatat di `spesifikasi-dfa.md` bagian 8. Jangan
dikerjakan sebelum diputuskan.

## Pengguna sasaran
Mahasiswa S1 yang baru belajar DFA. Mereka harus bisa membaca file `.dfa` dan langsung mencocokkannya dengan definisi 5-tuple (Q, Σ, δ, q₀, F) di buku teks.

## Keputusan yang sudah diambil
- Format file: teks biasa, satu baris satu informasi (bukan JSON). Rincian lengkap ada di [`spesifikasi-dfa.md`](spesifikasi-dfa.md). File itu adalah acuan utama.
- Ekstensi file: `.dfa`
- Pesan error memakai notasi buku teks, misalnya `δ(q1, 1) belum didefinisikan`.
- Teknologi: Node.js, tanpa library eksternal untuk parser, validator, dan simulator. Tes memakai test runner bawaan Node (`node --test`).
- Kode dipisah per modul (`parser`, `validator`, `simulator`, `cli`) agar bisa dipakai ulang oleh antarmuka web nanti.
- Hanya DFA dulu. NFA dan ε-transisi belum dikerjakan, tetapi format dijaga agar bisa diperluas tanpa merusak file lama.

## Cara Claude bekerja di project ini
- Gunakan Bahasa Indonesia. Istilah teknis boleh dalam bahasa Inggris jika memang itu istilah bakunya (misalnya parser, trace).
- Selalu rujuk `spesifikasi-dfa.md` di folder ini. Jika permintaan bertentangan dengan spesifikasi, tunjukkan pertentangannya dan tanyakan dulu, jangan diam-diam menyimpang.
- Jika sebuah keputusan baru diambil, sarankan agar dicatat ke `spesifikasi-dfa.md` (bagian "Riwayat keputusan") supaya percakapan berikutnya konsisten.
- Jaga kode dan penjelasan tetap sederhana. Mahasiswa S1 harus bisa membacanya. Pilih kode yang jelas daripada yang ringkas dan rumit.
- Beri komentar di kode dalam Bahasa Indonesia pada bagian yang berkaitan dengan teori (misalnya fungsi transisi δ).
- Setiap modul baru disertai tes, termasuk kasus tepi (alfabet kosong, state akhir kosong, string input kosong).

## Hal yang sudah diputuskan (dulu terbuka)
Rinciannya di `spesifikasi-dfa.md` bagian 9 (Riwayat keputusan):
- Dead state implisit: tidak ada. Dead state harus ditulis eksplisit.
- Komentar di akhir baris: didukung. `#` memulai komentar sampai akhir baris.
- Format jejak simulasi: `{ accepted, finalState, steps: [{ from, symbol, to }] }`.
