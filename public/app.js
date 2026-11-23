// Kode sisi browser. Semua logika DFA ada di server (src/),
// halaman ini hanya mengirim teks dan menampilkan hasil.
// Teks dari pengguna/server selalu dipasang lewat textContent, bukan innerHTML.

const pilihContoh = document.getElementById('pilih-contoh');
const teksDfa = document.getElementById('teks-dfa');
const input = document.getElementById('input');
const tandaInput = document.getElementById('tanda-input');
const statusDfa = document.getElementById('status-dfa');
const hasil = document.getElementById('hasil');
const namaBerkas = document.getElementById('nama-berkas');
const pilihBerkas = document.getElementById('pilih-berkas');
const infoBerkas = document.getElementById('info-berkas');
const pilihTataLetak = document.getElementById('pilih-tata-letak');
const diagram = document.getElementById('diagram');

// ---------- pembantu DOM ----------

function el(tag, teks, kelas) {
  const e = document.createElement(tag);
  if (teks !== undefined) e.textContent = teks;
  if (kelas) e.className = kelas;
  return e;
}

// Kotak pesan: ikon + judul, lalu (opsional) daftar butir.
function kotak(kelas, ikon, judul, butir = []) {
  const k = el('div', undefined, 'kotak ' + kelas);
  k.appendChild(el('p', ikon + ' ' + judul));
  if (butir.length > 0) {
    const ul = el('ul');
    for (const b of butir) ul.appendChild(el('li', b));
    k.appendChild(ul);
  }
  return k;
}

function ganti(wadah, ...anak) {
  wadah.replaceChildren(...anak);
}

// ---------- pemeriksaan langsung saat mengetik ----------

function tampilkanAnalisis(a) {
  if (a.syntaxError) {
    return ganti(statusDfa, kotak('galat', '✖', 'Sintaks salah:', [a.syntaxError]));
  }
  if (a.errors.length > 0) {
    return ganti(statusDfa, kotak('galat', '✖', 'Bukan DFA yang valid:', a.errors));
  }
  const anak = [kotak('ok', '✔', 'DFA valid')];
  if (a.warnings.length > 0) anak.push(kotak('peringatan', '⚠', 'Peringatan:', a.warnings));
  ganti(statusDfa, ...anak);
}

let nomorPermintaan = 0; // jawaban yang datang terlambat dari ketikan lama diabaikan

async function periksa() {
  const saya = ++nomorPermintaan;
  if (teksDfa.value.trim() === '') {
    dfaTerakhir = null;
    analisisTerakhir = null;
    gambarDiagram();
    return ganti(statusDfa, kotak('netral', 'ℹ', 'Belum ada definisi.'));
  }
  try {
    const res = await fetch('/api/analisis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dfa: teksDfa.value }),
    });
    const data = await res.json();
    if (saya !== nomorPermintaan) return;
    if (data.error) return ganti(statusDfa, kotak('galat', '✖', 'Error:', [data.error]));
    tampilkanAnalisis(data);
    perbaruiDiagram(data);
  } catch {
    if (saya === nomorPermintaan) {
      ganti(statusDfa, kotak('galat', '✖', 'Tidak bisa menghubungi server.'));
    }
  }
}

// ---------- diagram state ----------

// DFA terakhir yang berhasil dibaca (hasil parse dari server). Dipakai lagi saat
// tata letak diganti, tanpa bertanya ke server.
let dfaTerakhir = null;

// Posisi hasil geser pengguna (sub tahap 5f), dipisah per tata letak:
// nama tata letak -> Map(nama state -> {x, y}). Hanya hidup selama halaman
// terbuka. Tetap berlaku saat teks .dfa diubah, selama nama statenya masih ada.
const posisiGeser = new Map();
const tombolKembalikanPosisi = document.getElementById('tombol-kembalikan-posisi');

function geserTataLetakIni() {
  if (!posisiGeser.has(pilihTataLetak.value)) posisiGeser.set(pilihTataLetak.value, new Map());
  return posisiGeser.get(pilihTataLetak.value);
}

// Gambar terakhir (hasil Gambar.susunGambar), dipakai saat menyeret.
let gambarTerakhir = null;

// Elemen <svg> dari DFA terakhir. `kotakTetap` (opsional) menahan bingkai gambar
// selama menyeret, supaya diagram tidak bergeser di bawah kursor.
function buatSvgDiagram(kotakTetap) {
  const graf = Graf.buatGraf(dfaTerakhir);
  const tataLetak = Graf.terapkanGeser(Graf.hitungTataLetak(graf, pilihTataLetak.value), geserTataLetakIni());
  gambarTerakhir = Gambar.susunGambar(graf, tataLetak);
  if (kotakTetap) gambarTerakhir.kotak = kotakTetap;
  const judul = `Diagram state: ${graf.nodes.length} state, ${graf.edges.length} panah transisi`;
  return Gambar.buatSvg(gambarTerakhir, judul);
}

function gambarDiagram() {
  diagram.classList.remove('usang');
  tombolKembalikanPosisi.disabled = geserTataLetakIni().size === 0;
  gambarTerakhir = null;
  if (!dfaTerakhir) return ganti(diagram, el('p', 'Diagram muncul setelah definisi DFA bisa dibaca.', 'keterangan'));
  if (dfaTerakhir.states.length === 0) return ganti(diagram, el('p', 'Belum ada state untuk digambar.', 'keterangan'));
  const fokus = stateBerfokus();
  ganti(diagram, buatSvgDiagram());
  kembalikanFokus(fokus);
  tampilkanJejak();
}

// Saat diseret, hanya <svg> yang diganti; catatan di bawahnya (mis. "sintaks
// belum benar") dibiarkan.
function gambarUlangSvg(kotakTetap) {
  const lama = diagram.querySelector('svg');
  if (!lama || !dfaTerakhir) return;
  const fokus = stateBerfokus();
  lama.replaceWith(buatSvgDiagram(kotakTetap));
  tombolKembalikanPosisi.disabled = geserTataLetakIni().size === 0;
  kembalikanFokus(fokus);
  tampilkanJejak();
}

// SVG digambar ulang dari nol, jadi state yang sedang difokus (keyboard) dicari
// lagi lewat namanya dan difokus kembali.
function stateBerfokus() {
  const g = document.activeElement?.closest?.('#diagram .state');
  return g ? g.dataset.state : null;
}
function kembalikanFokus(nama) {
  if (nama === null) return;
  for (const g of diagram.querySelectorAll('.state')) {
    if (g.dataset.state === nama) g.focus();
  }
}

// ---------- menggeser state (sub tahap 5f) ----------

// Koordinat layar (piksel di jendela) -> koordinat di dalam gambar SVG.
function keKoordinatGambar(svg, e) {
  const titik = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: titik.x, y: titik.y };
}

const AMBANG_SERET = 3; // piksel; gerakan lebih kecil dianggap klik, bukan seret
let seret = null; // { id, dx, dy, kotak, mulaiX, mulaiY, bergerak }

diagram.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('.state');
  if (!g || e.button !== 0 || !gambarTerakhir) return;
  const svg = diagram.querySelector('svg');
  const s = gambarTerakhir.states.find((x) => x.id === g.dataset.state);
  const p = keKoordinatGambar(svg, e);
  // dx, dy: jarak titik pegang ke pusat state, supaya state tidak "melompat" ke kursor.
  seret = { id: s.id, dx: s.x - p.x, dy: s.y - p.y, kotak: gambarTerakhir.kotak, mulaiX: e.clientX, mulaiY: e.clientY, bergerak: false };
  diagram.setPointerCapture(e.pointerId);
  g.focus();
  e.preventDefault();
});

diagram.addEventListener('pointermove', (e) => {
  if (!seret) return;
  if (!seret.bergerak && Math.hypot(e.clientX - seret.mulaiX, e.clientY - seret.mulaiY) < AMBANG_SERET) return;
  seret.bergerak = true;
  diagram.classList.add('menyeret');
  const p = keKoordinatGambar(diagram.querySelector('svg'), e);
  geserTataLetakIni().set(seret.id, { x: Math.round(p.x + seret.dx), y: Math.round(p.y + seret.dy) });
  gambarUlangSvg(seret.kotak);
});

function selesaiSeret() {
  if (!seret) return;
  const bergerak = seret.bergerak;
  seret = null;
  diagram.classList.remove('menyeret');
  if (bergerak) gambarUlangSvg(); // bingkai gambar dihitung ulang
}
diagram.addEventListener('pointerup', selesaiSeret);
diagram.addEventListener('pointercancel', selesaiSeret);

// Tombol panah: geser state yang difokus 10 piksel (dengan Shift: 1 piksel).
const ARAH_TOMBOL = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
diagram.addEventListener('keydown', (e) => {
  const g = e.target.closest('.state');
  const arah = ARAH_TOMBOL[e.key];
  if (!g || !arah || !gambarTerakhir) return;
  e.preventDefault(); // jangan menggulung halaman
  const langkah = e.shiftKey ? 1 : 10;
  const s = gambarTerakhir.states.find((x) => x.id === g.dataset.state);
  geserTataLetakIni().set(s.id, { x: s.x + arah[0] * langkah, y: s.y + arah[1] * langkah });
  gambarUlangSvg();
});

tombolKembalikanPosisi.addEventListener('click', () => {
  posisiGeser.delete(pilihTataLetak.value);
  gambarUlangSvg();
});

// Dipanggil dengan hasil /api/analisis (atau hasil terakhir, saat tata letak diganti).
let analisisTerakhir = null;
function perbaruiDiagram(a) {
  analisisTerakhir = a;
  if (a.dfa) {
    dfaTerakhir = a.dfa;
    gambarDiagram();
    if (a.errors.length > 0) {
      diagram.appendChild(kotak('peringatan', '⚠', 'DFA belum valid, jadi diagram ini bisa belum lengkap.'));
    }
    return;
  }
  // Sintaks salah (biasanya karena sedang mengetik): diagram terakhir dibiarkan,
  // tetapi dipudarkan dan diberi catatan supaya tidak dikira gambar terbaru.
  if (!dfaTerakhir) return gambarDiagram();
  gambarDiagram();
  diagram.classList.add('usang');
  diagram.appendChild(kotak('netral', 'ℹ', 'Sintaks belum benar. Diagram di atas dari definisi terakhir yang terbaca.'));
}

for (const t of Graf.DAFTAR_TATA_LETAK) {
  const opsi = el('option', t.label);
  opsi.value = t.nama;
  pilihTataLetak.appendChild(opsi);
}
pilihTataLetak.addEventListener('change', () => {
  if (analisisTerakhir) perbaruiDiagram(analisisTerakhir);
  else gambarDiagram();
});

// ---------- animasi jejak (sub tahap 5d) ----------

const kendaliJejak = document.getElementById('kendali-jejak');
const pitaInput = document.getElementById('pita-input');
const teksJejak = document.getElementById('teks-jejak');
const tombolAwal = document.getElementById('jejak-awal');
const tombolMundur = document.getElementById('jejak-mundur');
const tombolPutar = document.getElementById('jejak-putar');
const tombolMaju = document.getElementById('jejak-maju');

const JEDA_LANGKAH = 1000; // milidetik per langkah saat diputar
// Jika pengguna meminta gerak dikurangi (pengaturan sistem), animasi tidak
// diputar otomatis; langkah tetap bisa dijalankan dengan tombol.
const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)');

// Jejak simulasi terakhir: { start, hasil, posisi }. null = tidak ada.
let jejak = null;
let timerJejak = null;

// Pita input: simbol yang sudah dibaca, simbol yang baru dibaca, dan sisanya.
function gambarPita(steps, posisi) {
  if (steps.length === 0) return ganti(pitaInput, el('span', 'ε', 'simbol'));
  ganti(pitaInput, ...steps.map((s, i) => {
    let kelas = 'simbol';
    if (i + 1 < posisi) kelas += ' dibaca';
    if (i + 1 === posisi) kelas += ' sekarang';
    return el('span', s.symbol, kelas);
  }));
}

// Pasang keadaan posisi sekarang ke semua tampilan: diagram, pita, teks, tabel, tombol.
function tampilkanJejak() {
  const svg = diagram.querySelector('svg');
  if (!jejak) {
    Animasi.sorotDiagram(svg, null);
    return;
  }
  const k = Animasi.keadaanJejak(jejak.start, jejak.hasil, jejak.posisi);
  kendaliJejak.hidden = false;
  Animasi.sorotDiagram(svg, k);
  gambarPita(jejak.hasil.steps, k.posisi);
  teksJejak.textContent = k.teks;
  for (const baris of hasil.querySelectorAll('tr[data-langkah]')) {
    baris.classList.toggle('aktif', Number(baris.dataset.langkah) === k.posisi);
  }
  tombolAwal.disabled = k.posisi === 0;
  tombolMundur.disabled = k.posisi === 0;
  tombolMaju.disabled = k.selesai;
  tombolPutar.textContent = timerJejak ? '⏸ Jeda' : '▶ Putar';
}

function keJejak(posisi) {
  if (!jejak) return;
  jejak.posisi = Math.max(0, Math.min(jejak.hasil.steps.length, posisi));
  tampilkanJejak();
}

function jedaJejak() {
  clearInterval(timerJejak);
  timerJejak = null;
  if (jejak) tampilkanJejak();
}

function putarJejak() {
  if (!jejak) return;
  if (jejak.hasil.steps.length === 0) return tampilkanJejak(); // input ε: tidak ada yang diputar
  if (jejak.posisi === jejak.hasil.steps.length) jejak.posisi = 0; // sudah di akhir: ulang dari awal
  clearInterval(timerJejak);
  timerJejak = setInterval(() => {
    keJejak(jejak.posisi + 1);
    if (jejak.posisi === jejak.hasil.steps.length) jedaJejak();
  }, JEDA_LANGKAH);
  tampilkanJejak();
}

// Dipanggil saat definisi/input berubah atau simulasi baru dimulai.
function hentikanJejak() {
  clearInterval(timerJejak);
  timerJejak = null;
  jejak = null;
  kendaliJejak.hidden = true;
  Animasi.sorotDiagram(diagram.querySelector('svg'), null);
}

tombolAwal.addEventListener('click', () => { jedaJejak(); keJejak(0); });
tombolMundur.addEventListener('click', () => { jedaJejak(); keJejak(jejak.posisi - 1); });
tombolMaju.addEventListener('click', () => { jedaJejak(); keJejak(jejak.posisi + 1); });
tombolPutar.addEventListener('click', () => (timerJejak ? jedaJejak() : putarJejak()));

let timerPeriksa;
function jadwalkanPeriksa() {
  clearTimeout(timerPeriksa);
  timerPeriksa = setTimeout(periksa, 400);
}

// ---------- hasil simulasi ----------

// Hasil simulasi hanya berlaku untuk definisi dan input saat tombol ditekan.
// Begitu salah satunya berubah, hasil lama diganti catatan agar tidak menyesatkan.
let hasilBerlaku = false;

function hasilKedaluwarsa() {
  ganti(tandaInput);
  hentikanJejak();
  if (!hasilBerlaku) return;
  hasilBerlaku = false;
  ganti(hasil, kotak('netral', 'ℹ', 'Definisi atau input berubah. Tekan Jalankan untuk menjalankan ulang.'));
}

// Menandai simbol yang salah: input diulang di bawah kotaknya, simbolnya disorot.
function tandaiSimbol(teks, posisi) {
  const simbol = [...teks];
  const sebelum = simbol.slice(0, posisi - 1).join('');
  const salah = simbol[posisi - 1] ?? '';
  const sesudah = simbol.slice(posisi).join('');
  ganti(tandaInput, document.createTextNode(sebelum), el('mark', salah), document.createTextNode(sesudah));
}

function tabelJejak(steps) {
  if (steps.length === 0) return el('p', 'Tidak ada langkah (string kosong ε).');
  const tabel = el('table');
  const kepala = el('tr');
  for (const h of ['No', 'δ(asal, simbol)', 'tujuan']) kepala.appendChild(el('th', h));
  tabel.appendChild(kepala);
  steps.forEach((s, i) => {
    const baris = el('tr');
    baris.dataset.langkah = String(i + 1); // disorot oleh animasi jejak
    baris.appendChild(el('td', String(i + 1)));
    baris.appendChild(el('td', `δ(${s.from}, ${s.symbol})`));
    baris.appendChild(el('td', s.to));
    tabel.appendChild(baris);
  });
  return tabel;
}

function tampilkanSimulasi(data) {
  if (data.errors.length > 0) {
    return ganti(hasil, kotak('galat', '✖', 'Tidak dijalankan: bukan DFA yang valid.', data.errors));
  }
  const r = data.result;
  const status = r.accepted
    ? kotak('ok', '✔', `DITERIMA, berhenti di ${r.finalState}`)
    : kotak('galat', '✖', `DITOLAK, berhenti di ${r.finalState}`);
  status.classList.add('status-hasil');
  ganti(hasil, status, el('h3', 'Jejak'), tabelJejak(r.steps));

  // Diagram digambar dari DFA yang baru saja disimulasikan, supaya animasi
  // pasti cocok dengan gambarnya.
  jejak = { start: data.dfa.start, hasil: r, posisi: 0 };
  perbaruiDiagram({ syntaxError: null, errors: [], warnings: data.warnings, dfa: data.dfa });
  if (!kurangiGerak.matches) putarJejak();
}

async function jalankan() {
  ganti(tandaInput);
  hentikanJejak();
  hasilBerlaku = true;
  try {
    const res = await fetch('/api/simulasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dfa: teksDfa.value, input: input.value }),
    });
    const data = await res.json();
    if (data.error) {
      ganti(hasil, kotak('galat', '✖', 'Error:', [data.error]));
      if (data.position) tandaiSimbol(input.value, data.position);
      return;
    }
    tampilkanSimulasi(data);
  } catch {
    ganti(hasil, kotak('galat', '✖', 'Tidak bisa menghubungi server.'));
  }
}

// ---------- simpan dan buka file .dfa (di sisi browser) ----------

function infoBerkasOk(teks) {
  ganti(infoBerkas, kotak('ok', '✔', teks));
}

function infoBerkasGalat(teks) {
  ganti(infoBerkas, kotak('galat', '✖', teks));
}

// Simpan: mengunduh isi kotak definisi sebagai file teks UTF-8.
function simpanBerkas() {
  const nama = Berkas.namaBerkasDfa(namaBerkas.value);
  namaBerkas.value = nama;
  const blob = new Blob([Berkas.siapkanTeksSimpan(teksDfa.value)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  infoBerkasOk(`Disimpan sebagai ${nama} (folder unduhan browser).`);
}

// Buka: membaca file dari komputer ke kotak definisi, lalu langsung diperiksa.
async function bukaBerkas(berkas) {
  if (!berkas) return;
  try {
    const teks = await berkas.text(); // di-decode sebagai UTF-8
    const masalah = Berkas.periksaBerkas({ teks, ukuran: berkas.size });
    if (masalah) return infoBerkasGalat(`Tidak bisa membuka ${berkas.name}: ${masalah}.`);
    teksDfa.value = teks;
    namaBerkas.value = Berkas.namaBerkasDfa(berkas.name);
    pilihContoh.value = '';
    hasilKedaluwarsa();
    periksa();
    infoBerkasOk(`Dibuka: ${berkas.name}.`);
  } catch {
    infoBerkasGalat(`Tidak bisa membaca ${berkas.name}.`);
  }
}

document.getElementById('tombol-simpan').addEventListener('click', simpanBerkas);
document.getElementById('tombol-buka').addEventListener('click', () => pilihBerkas.click());
pilihBerkas.addEventListener('change', async () => {
  await bukaBerkas(pilihBerkas.files[0]);
  pilihBerkas.value = ''; // supaya memilih file yang sama lagi tetap memicu 'change'
});

// Seret-lepas file ke kotak definisi.
teksDfa.addEventListener('dragover', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  e.preventDefault();
  teksDfa.classList.add('seret');
});
teksDfa.addEventListener('dragleave', () => teksDfa.classList.remove('seret'));
teksDfa.addEventListener('drop', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  e.preventDefault();
  teksDfa.classList.remove('seret');
  bukaBerkas(e.dataTransfer.files[0]);
});

// ---------- contoh dan pemasangan ----------

// Jika daftar contoh gagal dimuat, beri tahu pengguna (bukan diam-diam kosong) dan
// sebutkan penyebabnya, supaya masalah di server mudah dilacak.
async function muatDaftarContoh() {
  try {
    const res = await fetch('/api/contoh');
    if (!res.ok) throw new Error(`server menjawab ${res.status}`);
    const data = await res.json();
    if (data.contoh.length === 0) {
      return infoBerkasGalat('Daftar contoh kosong: tidak ada file .dfa di folder contoh server.');
    }
    for (const nama of data.contoh) {
      const opsi = el('option', nama);
      opsi.value = nama;
      pilihContoh.appendChild(opsi);
    }
  } catch (err) {
    infoBerkasGalat(`Daftar contoh tidak bisa dimuat (${err.message}).`);
  }
}

pilihContoh.addEventListener('change', async () => {
  if (!pilihContoh.value) return;
  const res = await fetch('/api/contoh/' + encodeURIComponent(pilihContoh.value));
  teksDfa.value = await res.text();
  namaBerkas.value = Berkas.namaBerkasDfa(pilihContoh.value);
  ganti(infoBerkas);
  hasilKedaluwarsa();
  periksa();
});

teksDfa.addEventListener('input', () => {
  ganti(infoBerkas);
  hasilKedaluwarsa();
  jadwalkanPeriksa();
});
input.addEventListener('input', hasilKedaluwarsa);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') jalankan(); });
document.getElementById('tombol-jalankan').addEventListener('click', jalankan);

muatDaftarContoh();
periksa();
