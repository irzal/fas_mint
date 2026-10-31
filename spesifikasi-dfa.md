# Spesifikasi Format File `.dfa`

Versi: 0.1 (draf)

Dokumen ini adalah acuan utama format file definisi DFA untuk
Finite Automata Simulator (FAS). Jika kode dan dokumen ini berbeda,
dokumen inilah yang dianggap benar. Perbarui dokumen ini terlebih dahulu
sebelum mengubah kode.

---

## 1. Ide dasar

DFA didefinisikan secara formal sebagai 5-tuple **(Q, Σ, δ, q₀, F)**.
File `.dfa` dirancang agar tiap barisnya sama dengan satu komponen tuple itu,
sehingga mahasiswa bisa membandingkannya langsung dengan buku teks.

## 2. Contoh lengkap

DFA yang menerima string biner yang **berakhiran `01`**:

```
# DFA: string biner berakhiran 01
states: q0 q1 q2
alphabet: 0 1
start: q0
accept: q2

# transisi: asal simbol -> tujuan
q0 0 -> q1
q0 1 -> q0
q1 0 -> q1
q1 1 -> q2
q2 0 -> q1
q2 1 -> q0
```

## 3. Pemetaan ke notasi buku teks

| Baris di file     | Notasi buku teks      | Arti                          |
|-------------------|-----------------------|-------------------------------|
| `states: ...`     | Q                     | himpunan semua state          |
| `alphabet: ...`   | Σ                     | himpunan simbol masukan       |
| `start: ...`      | q₀                    | state awal                    |
| `accept: ...`     | F                     | himpunan state akhir          |
| `q0 0 -> q1`      | δ(q0, 0) = q1         | satu nilai fungsi transisi    |

## 4. Aturan penulisan (sintaks)

1. Satu baris berisi satu informasi.
2. Elemen dalam satu baris dipisahkan oleh spasi atau tab.
3. Baris kosong diabaikan.
4. Tanda `#` memulai komentar, seperti di Python: mulai dari `#` sampai akhir
   baris diabaikan, baik `#` itu di awal baris maupun setelah isi baris
   (mis. `states: q0 q1  # tiga state`). Akibatnya `#` tidak bisa dipakai
   di dalam nama state maupun simbol.
5. Urutan baris bebas. Boleh menulis `start:` sebelum `states:`.
6. Huruf besar dan kecil dibedakan. `Q0` dan `q0` adalah dua state berbeda.
7. Baris `states:`, `alphabet:`, `start:`, dan `accept:` masing-masing
   wajib ada tepat satu kali.
8. `accept:` boleh kosong (artinya F = ∅). Tulis `accept:` tanpa isi.

### Nama state

- Terdiri dari karakter apa saja selain spasi, misalnya `q0`, `A`, `genap`, `s_1`.
- Tidak boleh mengandung `->`.
- Tidak boleh mengandung `#` (karena `#` memulai komentar, aturan 4).

### Simbol alfabet

- Tepat **satu karakter**, selain spasi.
- Tidak boleh `#` (karena `#` memulai komentar, aturan 4).
- Tidak boleh `ε` (dicadangkan untuk NFA di masa depan).

## 5. Aturan validasi (agar benar-benar DFA)

Parser hanya membaca teks. Validator memeriksa aturan berikut,
dan setiap pelanggaran menghasilkan satu pesan error.

| No | Aturan | Contoh pesan error |
|----|--------|--------------------|
| V1 | `start` harus anggota `states` | `state awal 'q9' tidak ada di Q` |
| V2 | Setiap state di `accept` harus anggota `states` | `state akhir 'q5' tidak ada di Q` |
| V3 | Tidak ada duplikat di `states` maupun `alphabet` | `state 'q1' ditulis dua kali di Q` |
| V4 | Simbol pada transisi harus anggota `alphabet` | `simbol 'a' tidak ada di Σ` |
| V5 | Asal dan tujuan transisi harus anggota `states` | `state 'q7' tidak ada di Q` |
| V6 | Tiap pasangan (state, simbol) punya **tepat satu** transisi | lihat V6a dan V6b |
| V6a | ... tidak boleh kurang | `δ(q1, 1) belum didefinisikan` |
| V6b | ... tidak boleh lebih dari satu | `δ(q0, 0) didefinisikan dua kali, itu bukan DFA` |

Jumlah transisi yang benar adalah |Q| × |Σ|. Pada contoh di atas:
3 state × 2 simbol = 6 transisi.

### Peringatan (bukan error)

Peringatan tidak membuat file ditolak. DFA tetap dijalankan.

| No | Peringatan | Contoh pesan |
|----|------------|--------------|
| W1 | State yang tidak bisa dicapai dari `start` (state tak terjangkau) | `state 'q2' tidak terjangkau dari state awal 'q0'` |

Secara bawaan state tak terjangkau dibiarkan; hanya diberi peringatan W1.
Penghapusannya bersifat manual lewat fungsi `removeUnreachable(dfa)` di
`src/validator.js`: hasilnya DFA baru tanpa state tak terjangkau (beserta
transisinya dan keanggotaannya di `accept`), objek asli tidak diubah.
Penghapusan itu tidak mengubah bahasa yang diterima DFA.

## 6. Contoh yang TIDAK valid

**Transisi kurang** (melanggar V6a):

```
states: q0 q1
alphabet: 0 1
start: q0
accept: q1
q0 0 -> q1
q0 1 -> q0
q1 0 -> q1
# δ(q1, 1) tidak ada
```

**Transisi ganda** (melanggar V6b, ini ciri NFA, bukan DFA):

```
q0 0 -> q0
q0 0 -> q1
```

## 7. Perilaku simulasi

- Mulai dari `start`, baca string input simbol demi simbol, ikuti δ.
- String **diterima** jika state terakhir ada di F, selain itu **ditolak**.
- String kosong (ε) diterima jika dan hanya jika `start` ada di F.
- Simbol input yang tidak ada di Σ membuat simulasi berhenti dengan error
  (bukan sekadar "ditolak"). Pesannya menyebut simbol dan posisinya (mulai dari 1),
  mis. `simbol 'a' pada posisi 3 tidak ada di Σ`.
- Input dibaca per karakter Unicode (sama dengan aturan simbol alfabet).

### Hasil simulasi

```
{
  accepted:   true,                 // true = diterima, false = ditolak
  finalState: 'q2',                 // state terakhir (untuk ε: start)
  steps: [                          // jejak: satu langkah per simbol input
    { from: 'q0', symbol: '0', to: 'q1' },
    { from: 'q1', symbol: '1', to: 'q2' }
  ]
}
```

Jumlah `steps` sama dengan panjang input; untuk string kosong `steps` adalah `[]`.

## 8. Rencana perluasan (belum dikerjakan)

- NFA: satu baris `asal simbol -> tujuan` boleh muncul berkali-kali,
  dan simbol `ε` diizinkan.
- Penanda jenis di baris pertama, misalnya `type: DFA`, supaya parser tahu
  jenis automata yang sedang dibaca. File lama tanpa penanda dianggap DFA.
- Posisi node untuk visualisasi web, misalnya `layout: q0 100 80`.
- Konfigurasi gambar graf transisi (tata letak bawaan, posisi node, tampilan)
  di file terpisah, mirip CSS terhadap HTML, sehingga file `.dfa` tetap hanya
  berisi 5-tuple. Bentuk dan nama file belum diputuskan; dikerjakan setelah
  tahap 5 selesai. Posisi hasil geser node (sub tahap 5f) akan memakai
  lapisan data yang sama sehingga nanti bisa disimpan ke file itu.

### Gagasan jangka panjang (belum diputuskan)

Dua gagasan di bawah ini dicatat agar tidak hilang. Keduanya belum diputuskan
dan belum dijadwalkan.

**A. Editor diagram transisi grafis di web.** Mahasiswa menggambar state dan
transisi langsung di diagram, lalu halaman menghasilkan teks `.dfa` yang setara.
Teks `.dfa` tetap satu-satunya format simpan: diagram hanyalah cara lain untuk
menulis 5-tuple yang sama. Posisi node mengikuti keputusan yang sudah ada,
yaitu disimpan di file konfigurasi gambar yang terpisah, bukan di dalam `.dfa`.

**B. Tutor AI untuk mahasiswa (DFA, NFA, regex).** Perannya pemberi saran
jika automata buatan mahasiswa tidak sesuai soal, baik secara struktur
(pelanggaran V1-V6b, state tak terjangkau, dan sejenisnya) maupun secara
semantik (bahasa yang diterima berbeda dari soal, ditunjukkan lewat string
tandingan). Kemampuan yang diharapkan:
- memeriksa apakah DFA atau NFA buatan mahasiswa menerima bahasa yang diminta soal;
- memeriksa langkah minimalisasi DFA;
- memeriksa konversi NFA ke DFA (konstruksi subset);
- memeriksa konversi regex ke NFA dan sebaliknya;
- membimbing latihan pumping lemma.

Catatan: kemampuan ini memerlukan modul baru di luar lingkup tahap 1-5, antara
lain NFA dan regex, uji ekuivalensi bahasa dua automata, minimalisasi, dan
konversi. Untuk pumping lemma, Tutor AI lebih cocok sebagai pembimbing langkah
(memilih string, membagi xyz, memeriksa tiap kasus) daripada pembuktian
otomatis, karena pembuktian umumnya tidak bisa diotomatiskan.

## 9. Riwayat keputusan

Catat keputusan baru di sini, terbaru di atas.

| Tanggal | Keputusan | Alasan |
|---------|-----------|--------|
| 2026-10-08 | Tata letak graf berupa fungsi yang bisa diganti (berlapis, melingkar), dipilih lewat menu di halaman; bawaan berlapis | Tata letak terpisah dari model graf, mudah ditambah tanpa mengubah penggambar |
| 2026-10-08 | Menggeser node di graf: posisi hanya berlaku selama halaman terbuka (sub tahap 5f) | Paling sederhana; teks `.dfa` tetap sumber utama |
| 2026-10-08 | Konfigurasi gambar graf kelak di file terpisah, bukan di dalam `.dfa` | Menjaga `.dfa` murni 5-tuple (lihat bagian 8) |
| 2026-10-08 | Format jejak simulasi: `{ accepted, finalState, steps: [{from, symbol, to}] }`, satu langkah per simbol input | Sederhana, cukup untuk tabel jejak dan menyorot state di diagram |
| 2026-10-08 | Simbol input di luar Σ: simulasi melempar error berisi simbol dan posisinya | Sesuai bagian 7: bukan sekadar "ditolak" |
| 2026-10-08 | `#` memulai komentar sampai akhir baris, di mana pun posisinya (seperti Python); `#` tidak boleh ada di nama state maupun simbol | Lebih aman dan familiar; menggantikan keputusan "nama state tidak boleh diawali `#`" di bawah dan jawaban lama "belum ada komentar di akhir baris" |
| 2026-10-08 | Nama state tidak boleh diawali `#` | Komentar akhir baris pada baris header tidak lagi lolos diam-diam sebagai state |
| 2026-10-08 | State tak terjangkau: dibiarkan + peringatan W1; penghapusan hanya lewat `removeUnreachable` yang dipanggil manual | Bukan pelanggaran definisi DFA, tapi sering tanda salah ketik; penghapusan otomatis bisa menyembunyikannya |
| 2026-10-08 | Dead state (black hole) harus ditulis eksplisit; tidak ada dead state implisit | DFA wajib punya fungsi transisi total; V6a tetap error agar mahasiswa belajar alasannya |
| 2026-10-08 | V3 melaporkan duplikat satu kali per nama; V6 dihitung dari Q dan Σ tanpa duplikat | Satu kesalahan tidak menghasilkan pesan ganda |
| 2026-10-08 | Transisi dengan state/simbol tak dikenal (V4/V5) tidak ikut dihitung di V6 | Kesalahan yang sama tidak dilaporkan dua kali |
| 2026-10-08 | `start:` harus berisi tepat satu state; selain itu error parser | Tuple punya tepat satu q₀; kesalahan ditangkap sedini mungkin |
| 2026-10-08 | Format teks baris per baris, bukan JSON | Mudah dicocokkan dengan 5-tuple di buku teks |
| 2026-10-08 | Pesan error memakai notasi δ | Mahasiswa belajar kenapa suatu definisi bukan DFA |
| 2026-10-08 | Ekstensi file `.dfa` | Jelas dan mudah dikenali |

## 10. Pertanyaan terbuka

- [x] Perlu opsi dead state implisit? Tidak (lihat riwayat keputusan)
- [x] Perlu komentar di akhir baris? Ya, `#` memulai komentar sampai akhir baris (lihat riwayat keputusan)
- [x] Format keluaran jejak simulasi? Lihat "Hasil simulasi" di bagian 7
