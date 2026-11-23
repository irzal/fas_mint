# Spesifikasi Format File `.dfa` dan `.fa`

Versi: 0.2 (draf)

Dokumen ini adalah acuan utama format file definisi automata untuk
Finite Automata Simulator (FAS). Jika kode dan dokumen ini berbeda,
dokumen inilah yang dianggap benar. Perbarui dokumen ini terlebih dahulu
sebelum mengubah kode.

- Bagian 1-7: DFA dan format `.dfa`. Diimplementasikan di tahap 1-5.
- Bagian 8-10: format `.fa`, NFA, konversi, dan halaman web untuk keduanya.
  Diimplementasikan di tahap 6.
- Bagian 11-13: rencana lain, riwayat keputusan, pertanyaan terbuka.

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
- Tidak boleh `ε` (dicadangkan untuk NFA). Di file `.fa`, `λ` juga
  dicadangkan (bagian 8.4).

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

Jika simbol yang tidak ada di Σ adalah salah satu tulisan string kosong
(`ε`, `eps`, `λ`, `lam`), pesan V4 diberi petunjuk:
`simbol 'ε' tidak ada di Σ (ε-transisi hanya untuk NFA)`.

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

## 8. Format `.fa` dan NFA (tahap 6)

Bagian 8 sampai 10 berlaku untuk format `.fa` dan NFA (tahap 6). Format
`.dfa` di bagian 1 sampai 7 tetap berlaku tanpa perubahan.

### 8.1 Jenis file dan baris `type:`

NFA didefinisikan sebagai 5-tuple **(Q, Σ, δ, q₀, F)** dengan
δ: Q × (Σ ∪ {ε}) → 𝒫(Q): hasil δ adalah **himpunan** state (boleh kosong),
dan ada ε-transisi. DFA adalah kasus khusus NFA.

Format file baru adalah `.fa` (finite automaton), untuk NFA maupun DFA.
Jenisnya ditentukan oleh baris `type:` di dalam file:

| Isi file `.fa`        | Dibaca sebagai | Aturan validasi                       |
|-----------------------|----------------|---------------------------------------|
| tanpa baris `type:`   | NFA            | aturan NFA (bagian 8.5)               |
| `type: NFA`           | NFA            | aturan NFA (bagian 8.5)               |
| `type: DFA`           | DFA            | V1-V6b (bagian 5), sama dengan `.dfa` |

- Bawaan NFA, karena DFA adalah kasus khusus NFA, dan kasus khususlah yang
  diberi tanda.
- Jika ada, baris `type:` wajib menjadi **baris bermakna pertama**, karena
  baris itu menentukan apakah file dibaca dengan aturan DFA atau NFA.
  Komentar dan baris kosong boleh ada di atasnya. Baris `type:` di posisi
  lain adalah error. Ini satu-satunya pengecualian dari bagian 4 aturan 5
  (urutan baris bebas).
- **File `.dfa`** hanya untuk kompatibilitas file lama dan tidak memerlukan
  baris `type:`. Isinya selalu dibaca sebagai DFA dengan aturan bagian 1
  sampai 7. Jika ada baris `type:` di file `.dfa`, baris itu diabaikan:
  `type: DFA` tanpa pesan; nilai lain (misalnya `type: NFA`) dengan
  peringatan, misalnya `baris 'type: NFA' diabaikan: file .dfa selalu dibaca
  sebagai DFA; simpan sebagai .fa jika maksudnya NFA`. File baru memakai
  `.fa`.
- Isi file `.dfa` sama artinya dengan file `.fa` berisi isi yang sama
  ditambah baris `type: DFA`: baris itu membuat file `.fa` dibaca persis
  seperti file `.dfa`. Ini cara membaca, bukan konversi (konversi ada di
  bagian 9).
- Perbedaan utama: DFA (file `.dfa`, atau `.fa` dengan `type: DFA`) lebih
  ketat, karena tiap pasangan (state, simbol) wajib punya tepat satu tujuan
  (V6). NFA lebih longgar: boleh banyak tujuan, boleh tidak ada, dan boleh ε.

### 8.2 Contoh lengkap

NFA yang menerima string biner yang **berakhiran `01`** (bandingkan dengan
DFA di bagian 2):

```
type: NFA
# NFA: string biner berakhiran 01
states: q0 q1 q2
alphabet: 0 1
start: q0
accept: q2

q0 0 -> {q0, q1}    # menebak: mungkin 0 ini awal dari 01 terakhir
q0 1 -> q0
q1 1 -> q2
# δ(q1, 0), δ(q2, 0), dan δ(q2, 1) tidak ditulis: hasilnya ∅
```

Contoh ε-transisi: `q0 ε -> q1` berarti dari q0 mesin boleh pindah ke q1
tanpa membaca simbol.

### 8.3 Pemetaan ke notasi buku teks

| Baris di file        | Notasi buku teks      | Arti                                   |
|----------------------|-----------------------|----------------------------------------|
| `q0 0 -> {q0, q1}`   | δ(q0, 0) = {q0, q1}   | hasil δ adalah himpunan state          |
| `q0 0 -> q1`         | δ(q0, 0) = {q1}       | himpunan satu anggota, tanpa kurung    |
| `q0 1 -> {}`         | δ(q0, 1) = ∅          | boleh ditulis eksplisit                |
| (tidak ditulis)      | δ(q, a) = ∅           | transisi yang tidak ditulis berarti ∅  |
| `q0 ε -> q1`         | δ(q0, ε) = {q1}       | ε-transisi                             |

### 8.4 Aturan penulisan tambahan untuk `.fa`

Aturan bagian 4 tetap berlaku, ditambah:

1. **String kosong** boleh ditulis dengan empat cara yang artinya sama:
   `ε` atau `eps` (epsilon), dan `λ` atau `lam` (lambda), karena sebagian
   buku teks memakai λ. `eps` dan `lam` tidak bisa bertabrakan dengan simbol
   alfabet, karena simbol alfabet hanya satu karakter.
2. **Simbol alfabet** di `.fa` tidak boleh `ε` maupun `λ` (keduanya
   dicadangkan untuk string kosong).
3. **Banyak tujuan** ditulis dengan notasi himpunan seperti buku teks:
   `q0 0 -> {q0, q1}`.
   - Di dalam `{ }` elemen dipisah koma; spasi setelah koma boleh ada atau
     tidak (`{q0,q1}` sama dengan `{q0, q1}`).
   - Himpunan satu anggota sah: `q0 0 -> {q1}` sama artinya dengan
     `q0 0 -> q1`. Himpunan kosong `{}` juga sah.
   - Bentuk satu baris dan beberapa baris boleh dicampur
     (`q0 0 -> q0` lalu `q0 0 -> q1` sama dengan `q0 0 -> {q0, q1}`).
   - Tujuan dipisah spasi tanpa kurung (`q0 0 -> q0 q1`) tidak dipakai,
     supaya hanya ada satu cara menulis banyak tujuan.
4. **Nama state** di `.fa` tidak boleh mengandung `{` atau `}` (khusus untuk
   himpunan), dan koma di dalam nama state hanya boleh di dalam kurung siku.
   Jadi `{[q0,q1], q2}` adalah dua elemen: `[q0,q1]` dan `q2`. Kurung siku
   dipakai untuk nama state hasil konversi (bagian 9.1).
5. **DFA** (`.dfa`, atau `.fa` ber-`type: DFA`): notasi `{...}` dan ε
   ditolak, tepat satu tujuan per pasangan (V6). Format `.dfa` tidak
   berubah.

### 8.5 Aturan validasi NFA

- Sudah diputuskan:
  - V6 (tepat satu transisi per pasangan) **tidak berlaku** untuk NFA.
  - Tujuan yang tertulis dua kali untuk pasangan (state, simbol) yang sama
    (di dua baris, atau di satu himpunan seperti `{q1, q1}`) digabung dan
    diberi **peringatan** (kemungkinan salah ketik), satu per tujuan:
    `δ(q0, 0): tujuan 'q1' ditulis lebih dari sekali (baris 6), dihitung satu kali`.
  - NFA tanpa `type:` yang kebetulan memenuhi syarat DFA tidak diberi info
    tambahan apa pun; tetap dibaca sebagai NFA.
  - V1 sampai V5 tetap berlaku. Pada V4, simbol transisi harus anggota Σ
    atau salah satu tulisan string kosong (`ε`, `eps`, `λ`, `lam`).
  - Nilai `type:` selain `DFA` dan `NFA` di file `.fa` adalah error,
    misalnya `type 'NDA' tidak dikenal; pilih DFA atau NFA`, karena jenis
    file tidak bisa ditentukan. (Di file `.dfa` baris `type:` hanya diabaikan
    dengan peringatan, bagian 8.1.)
  - W1 (state tak terjangkau) tetap berlaku, dengan ε-transisi ikut
    dihitung sebagai jalan: state yang hanya bisa dicapai lewat ε dianggap
    terjangkau.

### 8.6 Simulasi NFA

- Mulai dari ε-closure({q₀}), yaitu q₀ beserta semua state yang bisa dicapai
  dengan ε saja.
- Setiap simbol input: ikuti δ dari **setiap** state di himpunan, gabungkan
  hasilnya, lalu ambil ε-closure-nya.
- String **diterima** jika himpunan terakhir mengandung paling sedikit satu
  anggota F (himpunan terakhir ∩ F ≠ ∅), selain itu **ditolak**.
- Jika himpunan menjadi kosong (semua cabang mati), simulasi tetap membaca
  sisa input dengan himpunan kosong, lalu ditolak.
- Simbol input di luar Σ tetap error, sama dengan DFA (bagian 7).

Jejak: **himpunan state per langkah**, satu langkah per simbol input seperti
jejak DFA. Setiap langkah mencatat hasil δ dan ε-closure secara terpisah,
serta panah yang dipakai (untuk menyorot beberapa panah sekaligus di
diagram):

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

- Urutan state di setiap himpunan mengikuti baris `states:`.
- Tanpa ε-transisi, `moved` sama dengan `to` dan `epsilonEdges` kosong.
- `epsilonEdges` berisi setiap ε-transisi (p, q) dengan p di dalam
  ε-closure itu, yaitu panah yang ditelusuri untuk mendapatkan closure.
  `edges` berisi setiap (q, a, p) dengan q di `from` dan p di δ(q, a).
  Tujuan yang ditulis dua kali di file dihitung sekali.
- Pohon komputasi (setiap kemungkinan jalan ditelusuri terpisah) bukan
  bentuk utama jejak, karena jumlah cabangnya bisa eksponensial. Bisa menjadi
  fitur tambahan kelak, misalnya hanya untuk input pendek.

## 9. Konversi (tahap 6)

### 9.1 NFA -> DFA (konstruksi subset)

Wajib ada bersama NFA, tidak boleh menyusul. Hasilnya dokumen `.fa` berisi
`type: DFA`.

- State DFA = himpunan state NFA. State awal DFA = ε-closure({q₀}). State DFA
  adalah state akhir jika himpunannya mengandung paling sedikit satu anggota F.
- Hanya himpunan yang **terjangkau** dari state awal DFA yang dibuat, seperti
  saat mengerjakan di kertas (bukan seluruh 2ⁿ himpunan bagian).
- **Nama state** memakai **kurung siku**: `[` + nama-nama state NFA dipisah
  koma tanpa spasi + `]`, misalnya `[q0,q2]`.
  - Himpunan kosong (dead state) bernama `[]`. `[]` hanya muncul jika ada
    langkah yang hasilnya himpunan kosong. Bukan `Ø`/`ø` (huruf Latin yang
    mirip ∅).
  - Urutan nama di dalamnya mengikuti urutan di baris `states:` NFA (bukan
    urutan abjad, yang menaruh `q10` sebelum `q2`).
  - Kurung siku, bukan kurung kurawal, supaya jelas bedanya: `{q0, q1}`
    adalah himpunan state, `[q0,q1]` adalah satu state hasil penggabungan.
  - Konversi wajib mendeteksi tabrakan nama (dua himpunan berbeda
    menghasilkan nama yang sama) dan melaporkannya sebagai error.
- **Tampilan langkah** (di halaman web dan di CLI):
  - Tabel langkah demi langkah: satu baris per pasangan (himpunan, simbol),
    berisi himpunan asal, simbol, gabungan δ, ε-closure (jika NFA punya
    ε-transisi), himpunan hasil, dan keterangan "baru" atau "sudah ada".
  - Tabel transisi subset (bentuk buku teks) di bawahnya sebagai ringkasan:
    baris = state DFA, kolom = simbol, dengan tanda state awal (→) dan state
    akhir (*).
  - CLI mencetak kedua tabel itu, selain menulis file hasil.

### 9.2 DFA -> NFA

Setiap DFA adalah NFA dengan δ_N(q, a) = {δ_D(q, a)}; Q, Σ, q₀, dan F tidak
berubah. Algoritma ini terpisah dari konstruksi subset. Hasilnya dokumen
`.fa` dengan `type: NFA`; nama state tidak berubah.

- Setiap transisi ditulis dengan kurung kurawal: `q0 0 -> q1` menjadi
  `q0 0 -> {q1}`, supaya terlihat bahwa hasil δ berubah dari satu state
  menjadi himpunan state.
- Konversi dasar mempertahankan semua state, supaya setiap baris mudah
  dicocokkan dengan DFA asal.
- Pilihan "buang dead state": state yang tidak punya jalan ke state akhir
  dibuang beserta panah yang menuju ke sana (di NFA transisi yang tidak
  ditulis berarti δ = ∅, jadi bahasa yang diterima tidak berubah).
  Keterangan menyebut state yang dibuang dan alasannya ("dari state ini
  tidak ada jalan ke state akhir"). State awal tidak pernah dibuang, juga
  jika bahasanya ∅.
- State tak terjangkau tidak dibuang otomatis (sama dengan keputusan W1:
  penghapusan hanya manual). Tetapi state tak terjangkau yang juga dead
  state ikut dibuang jika pilihan "buang dead state" dipakai, karena ia
  memenuhi definisi dead state.
- Teks hasil memuat komentar yang menyebut dead state yang dibuang, mis.
  `# dead state dibuang: mati (dari state ini tidak ada jalan ke state akhir)`.
- DFA dari file `.dfa` lama boleh memakai nama state atau simbol yang tidak
  sah di `.fa` (nama berisi `{ }` atau koma di luar kurung siku, simbol `λ`).
  Konversi berhenti dengan pesan, mis. `konversi gagal: nama state 'a,b' ...
  di file .fa; ganti namanya dulu`, bukan menghasilkan file yang rusak.
- Tabel pemetaan ditampilkan, satu baris per transisi:
  `δ(q0, 0) = q1` -> `δ(q0, 0) = {q1}`, ditambah baris yang dihapus jika
  dead state dibuang. CLI juga mencetak tabel ini.

### 9.3 Ganti format `.dfa` <-> `.fa` (bukan konversi)

Karena isi `.dfa` dibaca sama dengan `.fa` + `type: DFA` (bagian 8.1),
mengganti format DFA bukan konversi:

- "Jadikan .fa (type: DFA)": dokumen `.dfa` menjadi dokumen `.fa` mode DFA.
- "Jadikan .dfa": dokumen `.fa` mode DFA menjadi dokumen `.dfa` (tanpa baris
  `type:`). Tidak tersedia untuk mode NFA; NFA menjadi DFA hanya lewat
  konversi NFA -> DFA (bagian 9.1).

### 9.4 Konversi di CLI

- Perintah `ke-dfa <file.fa> [hasil.fa]` (NFA -> DFA) dan
  `ke-nfa <file.fa|file.dfa> [hasil.fa] [--buang-dead-state]` (DFA -> NFA).
  `ke-dfa` hanya menerima NFA, `ke-nfa` hanya menerima DFA; automata yang
  tidak valid ditolak sebelum dikonversi.
- Tanpa nama file hasil: `<nama>-dfa.fa` atau `<nama>-nfa.fa` di folder yang
  sama dengan file asal.
- File hasil tidak pernah menimpa file yang sudah ada; penolakannya muncul
  sebelum tabel dicetak.
- CLI hanya menerima file berekstensi `.fa` atau `.dfa`, karena ekstensi
  menentukan cara membaca (bagian 8.1).

## 10. Halaman web untuk DFA dan NFA (tahap 6)

Aturan CLI tidak berubah: file `.fa` dibaca menurut baris `type:` di
dalamnya, file `.dfa` selalu DFA. Bagian ini hanya untuk halaman web.

- **Widget jenis automata** (DFA / NFA) di dekat kotak definisi selalu
  menunjukkan mode dokumen yang sedang dibuka.
- **Dokumen `.dfa`** (dibuka dari file `.dfa`, termasuk contoh `.dfa`):
  penanganannya sama dengan sebelum tahap 6. Teks ditampilkan apa adanya dan
  selalu dibaca sebagai DFA. Widget menunjukkan DFA dan terkunci. File `.dfa`
  hanya bisa dibuka, tidak bisa dibuat baru.
- **Dokumen `.fa`**: mode DFA atau NFA dipilih lewat widget. Baris `type:`
  tidak ditampilkan di kotak definisi; saat membuka file `.fa`, baris itu
  dibaca ke widget lalu disembunyikan dari teks (tanpa baris `type:` widget
  menunjukkan NFA). Baris `type:` yang diketik atau ditempel ke kotak
  definisi otomatis dipindah ke widget lalu dihapus dari teks.
- **Membuat baru**: menu "DFA baru" dan "NFA baru". Keduanya membuat dokumen
  `.fa` dengan mode sesuai menu.
- **Saat halaman pertama kali dibuka**: dokumen "NFA baru" berisi automata
  satu state tanpa transisi, yang langsung valid sebagai NFA:

  ```
  states: q0
  alphabet: 0 1
  start: q0
  accept:
  ```

  (Sebagai DFA dengan Σ = {0, 1} isi ini tidak valid karena V6a, jadi
  titik awalnya NFA.)
- **Menyimpan**: Simpan selalu memakai format dokumen saat ini (`.fa` atau
  `.dfa`), tanpa pilihan format. Untuk dokumen `.fa`, aplikasi selalu menulis
  `type: DFA` atau `type: NFA` di baris pertama sesuai widget, jadi file
  `.fa` yang disimpan aplikasi ini selalu punya baris `type:`. Dokumen `.dfa`
  disimpan apa adanya, tanpa baris `type:`.
- **Ganti format** hanya lewat menu di bagian 9.3. **NFA menjadi DFA** hanya
  lewat menu konversi NFA -> DFA (bagian 9.1).
- **Konversi di halaman web**: tombol konversi sesuai jenis dokumen (NFA ->
  DFA untuk NFA, DFA -> NFA untuk DFA, dengan pilihan "buang dead state").
  Tabel konversi (bagian 9.1 dan 9.2) ditampilkan di halaman asal. **Hasil
  konversi dibuka sebagai dokumen baru di tab browser baru**, sehingga
  automata asal tetap ada di tab semula dan keduanya bisa dibandingkan. Nama
  dokumen hasil: `<nama>-dfa.fa` atau `<nama>-nfa.fa`. Tabel konversi
  ditandai usang jika definisi atau jenis di tab asal berubah.
- **Tabel jejak NFA** memisahkan kolom hasil δ dan kolom ε-closure; animasi
  menyorot beberapa state dan panah sekaligus (bagian 8.6).
  - Tabel punya baris 0 (himpunan awal). Kolom ε-closure hanya ada jika NFA
    punya ε-transisi; tanpa ε, kolom gabungan δ sudah himpunan sesudahnya.
  - Setiap posisi menyorot seluruh himpunan state aktif, serta panah δ dan
    panah ε yang dipakai pada langkah itu (posisi 0: panah ε untuk
    ε-closure({q₀})). Panah ε disorot sama dengan panah δ; teks langkah
    menyebut gabungan δ dan ε-closure.
  - Di akhir input: jika DITERIMA, state akhir di himpunan terakhir ditandai
    hijau (state lain tetap ditandai aktif); jika DITOLAK, semua state di
    himpunan terakhir ditandai merah. Himpunan kosong tidak menyorot apa pun.
    Hasil selalu juga ditulis sebagai kata.
  - Putar otomatis, tombol, dan aturan gerak dikurangi sama dengan DFA (5d).
- **Mengganti dokumen**: jika isi, format, atau jenis dokumen berubah sejak
  terakhir dibuka atau disimpan, halaman meminta konfirmasi sebelum "DFA
  baru"/"NFA baru", memilih contoh, atau membuka file.
- **Nama state panjang di diagram**: lingkaran membesar sampai cukup untuk
  sekitar 13 huruf (mis. `[q0,q1,q2,q3]` hasil konversi), dan jarak antar
  state ikut diperbesar sebanding; nama yang lebih panjang lagi ditulis
  dengan huruf lebih kecil (paling kecil 9 px).
- **Pembaca layar**: hasil simulasi dan konversi diumumkan sebagai ringkasan
  satu kalimat, tidak dengan membacakan seluruh tabel.
- Catatan: teks yang disalin dari kotak definisi tidak membawa baris
  `type:`. Jika ditempel ke file `.fa` di luar aplikasi, file itu dibaca
  sebagai NFA.
- Untuk pemeriksaan dan simulasi, halaman mengirim teks kotak definisi apa
  adanya bersama format dan jenis dari widget (field `type` di API), bukan
  teks yang diberi baris `type:` di atasnya. Dengan begitu nomor baris di
  pesan error tetap sesuai kotak definisi. Jika jenis diberikan dari luar,
  baris `type: DFA`/`type: NFA` di teks ditolak (halaman selalu
  memindahkannya ke widget lebih dulu); nilai lain dilaporkan seperti biasa.
- "DFA baru" berisi satu state q0 dengan loop untuk 0 dan 1, karena DFA wajib
  punya transisi untuk setiap simbol (V6); "NFA baru" sama dengan dokumen awal.
- Membuka file selain `.fa` dan `.dfa` ditolak dengan pesan (sama dengan CLI).
- "Jadikan .fa (type: DFA)" membuang baris `type:` yang sah dari teks `.dfa`
  (selama ini diabaikan) dan memberi tahu pengguna.

## 11. Rencana perluasan lain (belum dikerjakan)

- Konfigurasi gambar graf transisi (tata letak bawaan, posisi node, tampilan)
  di file terpisah, mirip CSS terhadap HTML, sehingga file `.dfa`/`.fa` tetap
  hanya berisi 5-tuple. Posisi node TIDAK ditulis di dalam file automata
  (keputusan 2026-10-08). Bentuk dan nama file konfigurasi belum diputuskan.
  Posisi hasil geser node (sub tahap 5f) sudah disimpan sebagai lapisan data
  tersendiri (`Graf.terapkanGeser`), sehingga nanti bisa disimpan ke file itu.

### Gagasan jangka panjang (belum diputuskan)

Dua gagasan di bawah ini dicatat agar tidak hilang. Keduanya belum diputuskan
dan belum dijadwalkan.

**A. Editor diagram transisi grafis di web.** Mahasiswa menggambar state dan
transisi langsung di diagram (DFA maupun NFA), lalu halaman menghasilkan teks
`.fa` yang setara. Teks automata tetap satu-satunya format simpan: diagram
hanyalah cara lain untuk menulis 5-tuple yang sama. Posisi node mengikuti
keputusan yang sudah ada, yaitu disimpan di file konfigurasi gambar yang
terpisah, bukan di dalam file `.fa`/`.dfa`.

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

Catatan: NFA (dengan ε) dan konversi NFA <-> DFA sudah ada sejak tahap 6.
Kemampuan ini masih memerlukan modul baru, antara lain regex (dan konversi
regex <-> NFA), uji ekuivalensi bahasa dua automata, dan minimalisasi DFA.
Untuk pumping lemma, Tutor AI lebih cocok sebagai pembimbing langkah
(memilih string, membagi xyz, memeriksa tiap kasus) daripada pembuktian
otomatis, karena pembuktian umumnya tidak bisa diotomatiskan.

## 12. Riwayat keputusan

Catat keputusan baru di sini, terbaru di atas.

Catatan penomoran: baris yang ditulis sebelum penataan ulang 2026-11-23
memakai nomor bagian lama. "Bagian 8" dan "rincian (a)-(j) bagian 8" di
baris-baris itu sekarang ada di bagian 8-10 (NFA, konversi, halaman web)
dan bagian 11 (rencana lain dan gagasan jangka panjang); "bagian 9" lama
adalah bagian 12 ini.

| Tanggal | Keputusan | Alasan |
|---------|-----------|--------|
| 2026-11-23 | Merapikan bagian 11: butir "posisi node di dalam file (`layout: ...`)" dihapus karena bertentangan dengan keputusan 2026-10-08 (konfigurasi gambar di file terpisah); gagasan A dan B disesuaikan dengan keadaan sesudah tahap 6 (format `.fa`; NFA dan konversi sudah ada) | Spesifikasi tidak memuat rencana yang saling bertentangan atau sudah usang |
| 2026-11-23 | Penyelesaian tahap 6 (sub tahap 6k): konfirmasi sebelum mengganti dokumen yang berubah; lingkaran state membesar sampai ±13 huruf dengan jarak antar state ikut diperbesar, nama lebih panjang memakai huruf lebih kecil (min 9 px); hasil simulasi/konversi diumumkan sebagai ringkasan untuk pembaca layar | Pekerjaan mahasiswa tidak hilang tanpa sengaja; nama hasil konversi terbaca; tabel panjang tidak dibacakan seluruhnya |
| 2026-11-23 | Hasil konversi di halaman web dibuka sebagai dokumen baru di tab browser baru; tabel konversi tetap di tab asal | Automata asal tidak hilang dan bisa dibandingkan dengan hasilnya |
| 2026-11-23 | Animasi jejak NFA (bagian 10): sorot seluruh himpunan aktif dan semua panah δ/ε langkah itu; di akhir, state akhir di himpunan hijau jika DITERIMA, semua merah jika DITOLAK; tabel dengan baris 0 dan kolom ε-closure hanya jika ada ε-transisi | Mahasiswa melihat semua cabang NFA sekaligus; hasil akhir jelas walau himpunannya berisi banyak state |
| 2026-11-23 | Halaman web (bagian 10): teks dikirim apa adanya dengan field `type` dari widget (bukan diberi baris `type:`); templat "DFA baru" (q0 dengan loop 0 dan 1); file selain `.fa`/`.dfa` ditolak saat dibuka; "Jadikan .fa" membuang baris `type:` dari teks `.dfa` | Nomor baris di pesan error tetap sesuai kotak definisi; DFA baru langsung valid; sama dengan CLI |
| 2026-11-23 | CLI (bagian 9.4): perintah `ke-dfa` dan `ke-nfa`; nama hasil bawaan `<nama>-dfa.fa`/`<nama>-nfa.fa`; file yang sudah ada tidak ditimpa; hanya ekstensi `.fa`/`.dfa` yang diterima (sebelumnya file apa pun dibaca sebagai DFA) | Nama perintah berbahasa Indonesia dan mudah diingat; tidak ada hasil kerja yang hilang; ekstensi menentukan cara membaca |
| 2026-11-23 | Konversi DFA -> NFA (bagian 9.2): DFA dari `.dfa` dengan nama/simbol yang tidak sah di `.fa` membuat konversi berhenti dengan pesan; state tak terjangkau yang juga dead ikut dibuang jika "buang dead state" dipilih; teks hasil menyebut dead state yang dibuang | Tidak menghasilkan file `.fa` yang rusak; definisi dead state berlaku sama untuk semua state |
| 2026-11-23 | Nama file spesifikasi diganti dari `spesifikasi-dfa.md` menjadi `spesifikasi-fa.md` | Isinya mencakup DFA dan NFA, sejalan dengan ekstensi `.fa` |
| 2026-11-23 | Halaman web pertama kali dibuka dengan dokumen "NFA baru": `states: q0`, `alphabet: 0 1`, `start: q0`, `accept:` (tanpa transisi) | Langsung valid sebagai NFA (sebagai DFA melanggar V6a); titik awal untuk menambah state dan transisi |
| 2026-11-23 | Validasi NFA (bagian 8.5): V1-V5 tetap berlaku (V4 menerima juga ε/eps/λ/lam); nilai `type:` tak dikenal di `.fa` adalah error; W1 menghitung ε-transisi sebagai jalan | Hanya V6 yang khas DFA; jenis file harus pasti; state yang dicapai lewat ε memang terjangkau |
| 2026-11-23 | Penataan ulang spesifikasi: keputusan tahap 6 dipindah dari catatan rencana ke bagian 8 (format `.fa` dan NFA), 9 (konversi), dan 10 (halaman web); rencana lain menjadi bagian 11, riwayat bagian 12, pertanyaan terbuka bagian 13. Isi keputusan tidak berubah; beberapa turunan yang belum dibahas tersendiri ditandai di bagian 8.5 | Satu acuan utama yang tersusun per topik; bagian yang sudah diimplementasikan dibedakan dari yang belum |
| 2026-11-23 | Konversi DFA -> NFA (rincian (j)): δ_N(q, a) = {δ_D(q, a)}, setiap tujuan ditulis `{p}`; semua state dipertahankan, dengan pilihan "buang dead state" (state awal tidak pernah dibuang); state tak terjangkau tidak dibuang otomatis; tabel pemetaan ditampilkan dan dicetak CLI; hasil `.fa` `type: NFA`. Himpunan satu anggota `{q1}` sah di `.fa` | Kurung kurawal memperlihatkan perubahan bentuk δ; baris mudah dicocokkan dengan DFA asal; membuang dead state menunjukkan NFA lebih ringkas tanpa mengubah bahasa |
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

## 13. Pertanyaan terbuka

- [x] Perlu opsi dead state implisit? Tidak (lihat riwayat keputusan)
- [x] Perlu komentar di akhir baris? Ya, `#` memulai komentar sampai akhir baris (lihat riwayat keputusan)
- [x] Format keluaran jejak simulasi? Lihat "Hasil simulasi" di bagian 7
- [x] Aturan validasi NFA di bagian 8.5 (V1-V5, nilai `type:` tak dikenal,
  W1 dengan ε)? Disetujui (lihat riwayat keputusan)
- [x] Dokumen saat halaman web pertama kali dibuka? NFA baru satu state tanpa
  transisi, Σ = {0, 1}, F kosong (bagian 10)
- [x] Halaman web: hasil konversi ditampilkan bagaimana? Sebagai dokumen baru
  di tab browser baru; automata asal tetap di tab semula (bagian 10)
