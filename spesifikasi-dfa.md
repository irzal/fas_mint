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

- NFA (tahap 6, sudah diputuskan, belum dikerjakan):
  - Satu pasangan (state, simbol) boleh punya banyak transisi atau tidak sama
    sekali, dan simbol `ε` diizinkan.
  - Format file baru adalah `.fa` (finite automaton), untuk NFA maupun DFA.
    Jenisnya ditentukan oleh baris `type:` di dalam file:

    | Isi file `.fa`        | Dibaca sebagai | Aturan validasi                    |
    |-----------------------|----------------|------------------------------------|
    | tanpa baris `type:`   | NFA            | aturan NFA (V6 tidak berlaku)      |
    | `type: NFA`           | NFA            | aturan NFA                         |
    | `type: DFA`           | DFA            | V1-V6b, sama dengan `.dfa`         |

    Bawaan NFA karena DFA adalah kasus khusus NFA, dan kasus khususlah yang
    diberi tanda.
  - `.dfa` hanya untuk kompatibilitas file lama dan tidak memerlukan baris
    `type:`. Isinya selalu dibaca sebagai DFA dengan aturan V1-V6b seperti
    sekarang. Jika ada baris `type:` di file `.dfa`, baris itu diabaikan:
    `type: DFA` diabaikan tanpa pesan; nilai lain (misalnya `type: NFA`)
    diabaikan dengan peringatan, misalnya `baris 'type: NFA' diabaikan: file
    .dfa selalu dibaca sebagai DFA; simpan sebagai .fa jika maksudnya NFA`.
    File baru memakai `.fa`.
  - Perbedaan utama: DFA (file `.dfa`, atau `.fa` dengan `type: DFA`) lebih
    ketat, karena tiap pasangan (state, simbol) wajib punya tepat satu
    tujuan (V6). NFA lebih longgar: boleh banyak tujuan, boleh tidak ada,
    dan boleh ε. NFA -> DFA harus lewat konversi (konstruksi subset).
  - Konversi NFA -> DFA (konstruksi subset) wajib ada bersama NFA, tidak
    boleh menyusul. Hasilnya file `.fa` berisi `type: DFA`.
  - Isi file `.dfa` sama artinya dengan file `.fa` berisi isi yang sama
    ditambah baris `type: DFA`: baris itu membuat file `.fa` dibaca persis
    seperti file `.dfa`. Ini cara membaca, bukan konversi.
  - Konversi `.dfa` -> `.fa` adalah konversi DFA -> NFA, yaitu sama dengan
    mengubah file `.fa` ber-`type: DFA` menjadi file `.fa` ber-`type: NFA`.
    Konversi ini memakai algoritma tersendiri, lihat rincian (j).
  - Baris `type:` (jawaban rincian (i)): jika ada, wajib menjadi baris
    bermakna pertama, karena baris itu menentukan apakah file dibaca dengan
    aturan DFA atau NFA. Komentar dan baris kosong boleh ada di atasnya.
    Baris `type:` di posisi lain adalah error. Ini pengecualian dari bagian 4
    aturan 5 (urutan baris bebas), yang hanya berlaku untuk `type:`.
  - String kosong (jawaban rincian (b)): di file `.fa` boleh ditulis dengan
    empat cara yang artinya sama: `ε` atau `eps` (epsilon), dan `λ` atau
    `lam` (lambda), karena sebagian buku teks memakai λ. Akibatnya `ε` dan
    `λ` tidak boleh menjadi simbol alfabet di file `.fa`. `eps` dan `lam`
    tidak bisa bertabrakan dengan simbol alfabet, karena simbol alfabet
    hanya satu karakter. Aturan `.dfa` tidak berubah.
  - NFA tanpa `type:` yang kebetulan memenuhi syarat DFA tidak diberi info
    tambahan apa pun (jawaban rincian (h)); tetap dibaca sebagai NFA.
  - Nama state DFA hasil konversi (jawaban rincian (d)) memakai **kurung
    siku**: `[` + nama-nama state NFA dipisah koma tanpa spasi + `]`,
    misalnya `[q0,q2]`. Himpunan kosong (dead state) bernama `[]`. Urutan
    nama di dalamnya mengikuti urutan di baris `states:` NFA (bukan urutan
    abjad, yang menaruh `q10` sebelum `q2`). Kurung siku dipakai, bukan
    kurung kurawal, supaya jelas bedanya: `{q0, q1}` adalah himpunan state,
    `[q0,q1]` adalah satu state hasil penggabungan. Konversi tetap wajib
    mendeteksi tabrakan nama (dua himpunan berbeda menghasilkan nama yang
    sama) dan melaporkannya sebagai error. Bukan `Ø`/`ø` untuk himpunan
    kosong (huruf Latin yang mirip ∅).
  - Banyak tujuan dalam satu baris (jawaban rincian (f)) ditulis dengan
    notasi himpunan seperti buku teks:

    ```
    q0 0 -> q1              # satu tujuan, seperti sekarang
    q0 0 -> {q0, q1}        # δ(q0, 0) = {q0, q1}
    q0 ε -> {q1, q2}        # ε-transisi ke dua state
    q0 1 -> {}              # δ(q0, 1) = ∅ ditulis eksplisit (boleh)
    ```

    - Di dalam `{ }` elemen dipisah koma; spasi setelah koma boleh ada atau
      tidak (`{q0,q1}` sama dengan `{q0, q1}`).
    - Di file `.fa`, nama state tidak boleh mengandung `{` atau `}` (khusus
      untuk himpunan), dan koma di dalam nama state hanya boleh di dalam
      kurung siku. Jadi `{[q0,q1], q2}` adalah dua elemen: `[q0,q1]` dan
      `q2`.
    - Bentuk satu baris dan beberapa baris boleh dicampur. Tujuan yang
      tertulis dua kali untuk pasangan (state, simbol) yang sama digabung
      dan diberi peringatan.
    - Tujuan dipisah spasi tanpa kurung (`q0 0 -> q0 q1`) tidak dipakai,
      supaya hanya ada satu cara menulis banyak tujuan.
    - Pada DFA (`.dfa`, atau `.fa` ber-`type: DFA`) notasi `{...}` ditolak;
      tepat satu tujuan per pasangan (V6). Format `.dfa` tidak berubah.
  - Jejak simulasi NFA (jawaban rincian (c)): **himpunan state per
    langkah**, satu langkah per simbol input seperti jejak DFA. Setiap
    langkah mencatat hasil δ dan ε-closure secara terpisah, serta panah yang
    dipakai (untuk menyorot beberapa panah sekaligus di diagram):

    ```
    {
      accepted: true,            // true jika himpunan terakhir ∩ F ≠ ∅
      start: {                   // langkah ke-0: ε-closure({q₀})
        states: ['q0', 'q1'],
        epsilonEdges: [{ from: 'q0', to: 'q1' }]
      },
      steps: [                   // satu langkah = satu simbol input
        {
          from: ['q0', 'q1'],    // himpunan sebelum membaca simbol
          symbol: '0',
          moved: ['q0', 'q2'],   // gabungan δ(q, 0) untuk setiap q di `from`
          edges: [{ from: 'q0', symbol: '0', to: 'q0' }, { from: 'q1', symbol: '0', to: 'q2' }],
          to: ['q0', 'q1', 'q2'],// ε-closure(moved): himpunan sesudah langkah ini
          epsilonEdges: [{ from: 'q0', to: 'q1' }]
        }
      ],
      finalStates: ['q0', 'q1', 'q2']  // himpunan terakhir
    }
    ```

    - Urutan state di setiap himpunan mengikuti baris `states:` (sama
      dengan aturan nama `[q0,q1]` di rincian (d)).
    - Tanpa ε-transisi, `moved` sama dengan `to` dan `epsilonEdges` kosong.
    - Jika himpunan menjadi kosong (semua cabang mati), simulasi tetap
      membaca sisa input dengan himpunan kosong, lalu ditolak.
    - Simbol input di luar Σ tetap error, sama dengan DFA (bagian 7).
    - Pohon komputasi (setiap kemungkinan jalan ditelusuri terpisah) bukan
      bentuk utama jejak, karena jumlah cabangnya bisa eksponensial. Bisa
      menjadi fitur tambahan kelak, misalnya hanya untuk input pendek.
    - Di halaman web, tabel jejak NFA memisahkan kolom hasil δ dan kolom
      ε-closure.
  - Halaman web (jawaban rincian (g)). Aturan CLI tidak berubah: file `.fa`
    dibaca menurut baris `type:` di dalamnya, file `.dfa` selalu DFA.
    - Ada **widget jenis automata** (DFA / NFA) di dekat kotak definisi yang
      selalu menunjukkan mode dokumen yang sedang dibuka.
    - **Dokumen `.dfa`** (dibuka dari file `.dfa`, termasuk contoh `.dfa`):
      penanganannya tidak berubah dari sekarang. Teks ditampilkan apa
      adanya dan selalu dibaca sebagai DFA. Widget menunjukkan DFA dan
      terkunci (tidak bisa diganti). File `.dfa` hanya bisa dibuka, tidak
      bisa dibuat baru.
    - **Dokumen `.fa`**: mode DFA atau NFA dipilih lewat widget. Baris
      `type:` tidak ditampilkan di kotak definisi; saat membuka file `.fa`,
      baris itu dibaca ke widget lalu disembunyikan dari teks (tanpa baris
      `type:` widget menunjukkan NFA). Baris `type:` yang diketik atau
      ditempel ke kotak definisi otomatis dipindah ke widget lalu dihapus
      dari teks.
    - **Membuat baru**: menu "DFA baru" dan "NFA baru". Keduanya membuat
      dokumen `.fa` dengan mode sesuai menu.
    - **Menyimpan**: Simpan selalu memakai format dokumen saat ini (`.fa`
      atau `.dfa`), tanpa pilihan format. Untuk dokumen `.fa`, aplikasi
      selalu menulis `type: DFA` atau `type: NFA` di baris pertama sesuai
      widget, jadi file `.fa` yang disimpan aplikasi ini selalu punya baris
      `type:`. Dokumen `.dfa` disimpan apa adanya, tanpa baris `type:`.
    - **Menu ganti format** adalah satu-satunya cara mengganti format
      dokumen. Ini bukan konversi, karena isi `.dfa` dibaca sama dengan
      `.fa` + `type: DFA`:
      - "Jadikan .fa (type: DFA)" untuk dokumen `.dfa`; sesudahnya dokumen
        menjadi `.fa` mode DFA dan widget bisa diganti.
      - "Jadikan .dfa" untuk dokumen `.fa` mode DFA; sesudahnya dokumen
        menjadi `.dfa` dan widget terkunci. Tidak tersedia untuk mode NFA.
    - **NFA menjadi `.dfa`** hanya lewat menu konversi NFA -> DFA: yang
      disimpan adalah DFA hasil konstruksi subset, bukan teks NFA-nya.
      Rinciannya (misalnya apakah hasil konversi juga ditampilkan di kotak
      definisi) dibahas bersama konversi.
    - Catatan: teks yang disalin dari kotak definisi tidak membawa baris
      `type:`. Jika ditempel ke file `.fa` di luar aplikasi, file itu dibaca
      sebagai NFA.
    - Detail tahap 6: dokumen apa yang terbuka saat halaman pertama kali
      dibuka.
  - Langkah konversi NFA -> DFA ditampilkan (jawaban rincian (e)):
    - **Tabel langkah demi langkah**: satu baris per pasangan (himpunan,
      simbol), berisi himpunan asal, simbol, gabungan δ, ε-closure (jika
      NFA punya ε-transisi), himpunan hasil, dan keterangan "baru" atau
      "sudah ada". Langkah ke-0 adalah ε-closure({q₀}) sebagai state awal
      DFA.
    - **Tabel transisi subset** (bentuk buku teks) ditampilkan di bawahnya
      sebagai ringkasan: baris = state DFA, kolom = simbol, dengan tanda
      state awal (→) dan state akhir (*). State DFA adalah state akhir jika
      himpunannya mengandung paling sedikit satu anggota F.
    - Hanya himpunan yang **terjangkau** dari state awal DFA yang dibuat,
      seperti saat mengerjakan di kertas (bukan seluruh 2ⁿ himpunan bagian).
      `[]` hanya muncul jika ada langkah yang hasilnya himpunan kosong.
    - CLI juga mencetak kedua tabel itu, selain menulis file hasil.
  - Pertanyaan yang dibahas **setelah format NFA selesai didefinisikan**:
    (j) algoritma konversi DFA -> NFA (`.dfa` atau `.fa` ber-`type: DFA`
    menjadi `.fa` ber-`type: NFA`). Rinciannya bergantung pada definisi NFA
    yang dipakai, misalnya jika δ NFA ditulis sebagai himpunan
    (δ(q, a) = {p}), transisi DFA perlu ditulis ulang.
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
| 2026-11-23 | Konversi NFA -> DFA (rincian (e)): tampilkan tabel langkah demi langkah (himpunan, simbol, gabungan δ, ε-closure, hasil, baru/sudah ada) dan tabel transisi subset sebagai ringkasan; hanya himpunan yang terjangkau; CLI juga mencetak kedua tabel | Mahasiswa bisa mengikuti cara mendapatkan hasil dan mencocokkannya dengan buku dan kerja di kertas; 2ⁿ himpunan terlalu banyak |
| 2026-11-23 | Halaman web (rincian (g)): widget jenis automata DFA/NFA. Dokumen `.dfa` tidak berubah penanganannya, widget DFA terkunci, `.dfa` hanya bisa dibuka. Dokumen `.fa`: mode dipilih lewat widget, baris `type:` disembunyikan dari kotak definisi (yang diketik dipindah ke widget) dan selalu ditulis saat menyimpan. Menu "DFA baru"/"NFA baru" membuat `.fa`. Simpan selalu memakai format dokumen saat ini; format hanya diganti lewat menu "Jadikan .fa (type: DFA)" / "Jadikan .dfa" (hanya mode DFA). NFA menjadi `.dfa` hanya lewat konversi NFA -> DFA. CLI tidak berubah | Mode selalu terlihat dan mudah diganti; file `.fa` yang disimpan selalu menjelaskan dirinya sendiri; `.dfa` tetap format lama |
| 2026-11-23 | Jejak simulasi NFA: himpunan state per langkah (`start`, `steps: [{ from, symbol, moved, edges, to, epsilonEdges }]`, `finalStates`, `accepted`); hasil δ dan ε-closure dipisah; panah yang dipakai ikut dicatat; pohon komputasi bukan bentuk utama | Satu langkah per simbol seperti jejak DFA, jadi tabel dan animasi bisa dipakai lagi; himpunannya sama dengan state hasil konstruksi subset; ε-closure terpisah karena sering membingungkan |
| 2026-11-23 | Banyak tujuan di `.fa` ditulis dengan notasi himpunan `q0 0 -> {q0, q1}` (boleh `{}` untuk ∅); nama state di `.fa` tidak boleh mengandung `{ }`, koma hanya di dalam kurung siku; tujuan ganda digabung dengan peringatan; tujuan dipisah spasi tidak dipakai; `{...}` ditolak pada DFA | Sama dengan notasi buku teks δ(q, a) = {…}; kurung kurawal untuk himpunan dan kurung siku untuk nama gabungan membuat penulisan tidak ambigu |
| 2026-11-23 | Nama state hasil konversi NFA -> DFA memakai kurung siku: `[q0,q2]` (koma tanpa spasi), himpunan kosong `[]`, mengganti nama `{}` di baris bawah; urutan mengikuti baris `states:` NFA; tabrakan nama dilaporkan sebagai error | Kurung kurawal dipakai untuk himpunan state, jadi nama gabungan dibedakan dengan kurung siku; urutan abjad salah untuk `q10` vs `q2` |
| 2026-11-23 | Himpunan kosong (dead state) di DFA hasil konversi NFA -> DFA bernama `{}` | Notasi himpunan, sejalan dengan nama seperti `{q0,q1}`; mudah diketik |
| 2026-11-23 | Format `.fa`, rincian (b), (h), (i) bagian 8: `type:` wajib menjadi baris bermakna pertama (komentar dan baris kosong boleh di atasnya); string kosong boleh ditulis `ε`, `eps`, `λ`, atau `lam`, sehingga `ε` dan `λ` dicadangkan (bukan simbol alfabet) di `.fa`; NFA tanpa `type:` yang memenuhi syarat DFA tidak diberi info tambahan | `type:` menentukan cara membaca seluruh file; sebagian buku teks memakai λ untuk string kosong; `eps`/`lam` mudah diketik |
| 2026-11-23 | Konversi `.dfa` -> `.fa` adalah konversi DFA -> NFA (sama dengan `.fa` ber-`type: DFA` menjadi `.fa` ber-`type: NFA`) dengan algoritma tersendiri; algoritmanya dibahas setelah format NFA selesai didefinisikan (rincian (j) bagian 8). Mencabut "mengubah `.dfa` ke `.fa` berarti menambahkan `type: DFA`" di baris-baris bawah. Tetap berlaku: isi `.dfa` dibaca sama dengan `.fa` + `type: DFA` (cara membaca, bukan konversi) | Konversi menghasilkan NFA, dan bentuknya bergantung pada definisi NFA |
| 2026-11-23 | File `.dfa` tidak memerlukan baris `type:`. Jika ada, baris itu diabaikan: `type: DFA` tanpa pesan, nilai lain (mis. `type: NFA`) dengan peringatan. Mengganti "`.dfa` berisi `type: NFA` adalah error" di baris bawah | `.dfa` tetap format lama; file tetap bisa dibuka, dan mahasiswa diberi tahu jika maksudnya NFA |
| 2026-11-23 | Jenis automata ditentukan baris `type:` (rincian (a) bagian 8). File `.fa` tanpa `type:` dibaca sebagai NFA; `type: DFA` membuatnya DFA dengan aturan V1-V6b. `.dfa` hanya untuk kompatibilitas file lama dan selalu DFA; `.dfa` berisi `type: NFA` adalah error. Hasil konversi NFA -> DFA menjadi `.fa` berisi `type: DFA` (mengganti keputusan "hasilnya `.dfa`" di baris bawah). Mengubah `.dfa` ke `.fa` berarti menambahkan `type: DFA` | DFA kasus khusus NFA, jadi kasus khusus yang diberi tanda; isi file menjelaskan dirinya sendiri (juga untuk teks yang ditempel di web); file `.dfa` lama tetap diperiksa dengan aturan DFA |
| 2026-11-23 | NFA (tahap 6): ekstensi `.fa`; DFA boleh juga ditulis di `.fa` karena DFA kasus khusus NFA; `.dfa` tetap khusus DFA. Konversi NFA -> DFA wajib ada bersama NFA dan hasilnya disimpan sebagai `.dfa`. Ada fitur mengubah `.dfa` menjadi `.fa`. Rincian yang belum diputuskan dicatat di bagian 8 | NFA generalisasi DFA, jadi satu format `.fa` cukup untuk keduanya; ekstensi `.dfa` menjamin isinya DFA |
| 2026-11-23 | Menggeser state (sub tahap 5f): posisi hasil geser disimpan sebagai lapisan data tersendiri (nama state -> posisi), terpisah per tata letak, dan menimpa posisi bawaan lewat `terapkanGeser`. Posisi tetap berlaku saat teks `.dfa` diubah selama nama statenya masih ada di Q; tombol "Kembalikan posisi" menghapusnya untuk tata letak yang sedang dipakai. Selain diseret (mouse/sentuh), state bisa dipilih dengan Tab dan digeser dengan tombol panah (10 piksel, Shift: 1 piksel) | Lapisan data yang sama kelak bisa disimpan ke file konfigurasi gambar (bagian 8); menyunting teks tidak menghapus hasil geser; tetap bisa dipakai tanpa mouse |
| 2026-11-23 | Animasi jejak (sub tahap 5d): jejak dilihat sebagai posisi 0..n (0 = di q₀, belum membaca simbol; k = sesudah langkah ke-k). Yang disorot bersamaan: state aktif, panah yang baru dipakai, simbol yang baru dibaca, dan baris tabel jejak. Teks memakai notasi `δ(p, a) = q`; di akhir ditulis `q ∈ F: DITERIMA` atau `q ∉ F: DITOLAK`. Diputar otomatis satu langkah per detik setelah Jalankan, kecuali jika pengguna meminta gerak dikurangi (prefers-reduced-motion); tombol Awal, Mundur, Putar/Jeda, Maju. Animasi berhenti jika definisi atau input berubah | Mahasiswa bisa mencocokkan tiap langkah δ dengan diagram dan tabel; hasil akhir tidak hanya ditandai warna |
| 2026-11-23 | Notasi diagram state (sub tahap 5c): q₀ ditunjuk panah dari kiri; state akhir = lingkaran ganda; δ(p, a) = p = loop; simbol dengan asal dan tujuan sama digabung dalam satu panah berlabel `a, b`; p -> q dan q -> p melengkung ke sisi berlawanan; panah yang akan menembus state lain dibuat melengkung; state tak terjangkau digambar putus-putus | Sama dengan notasi buku teks; tanda tak terjangkau sejalan dengan peringatan W1 |
| 2026-11-23 | Saat sintaks `.dfa` salah, diagram terakhir tetap tampil tetapi dipudarkan dan diberi catatan; saat DFA belum valid, diagram tetap digambar dengan peringatan "bisa belum lengkap" | Diagram tidak hilang-muncul selama mengetik, tetapi tidak dikira gambar terbaru |
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
