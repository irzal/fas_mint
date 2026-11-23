// Kode sisi browser. Semua logika DFA/NFA ada di server (src/),
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
const widgetJenis = document.getElementById('widget-jenis');
const keteranganJenis = document.getElementById('keterangan-jenis');
const tombolJadikanFa = document.getElementById('tombol-jadikan-fa');
const tombolJadikanDfa = document.getElementById('tombol-jadikan-dfa');
const tombolKonversi = document.getElementById('tombol-konversi');
const labelBuangDead = document.getElementById('label-buang-dead');
const centangBuangDead = document.getElementById('buang-dead-state');
const bagianKonversi = document.getElementById('bagian-konversi');
const hasilKonversi = document.getElementById('hasil-konversi');

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
  // Ikon hanya hiasan (kata di judul sudah menjelaskan), jadi tidak dibacakan.
  const p = el('p');
  const i = el('span', ikon);
  i.setAttribute('aria-hidden', 'true');
  p.append(i, ' ' + judul);
  k.appendChild(p);
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

// Ringkasan untuk pembaca layar (elemen #pengumuman, role=status). Hasil
// simulasi dan konversi berisi tabel panjang, jadi yang diumumkan hanya
// ringkasannya, bukan seluruh isi wadah.
function umumkan(teks) {
  const p = document.getElementById('pengumuman');
  p.textContent = '';
  // Diisi sesaat kemudian supaya pengumuman yang sama tetap dibacakan ulang.
  const tanpaIkon = teks.replace(/^[✔✖⚠ℹ]\s*/, ''); // ikon hanya hiasan, tidak dibacakan
  setTimeout(() => { p.textContent = tanpaIkon; }, 50);
}

// Himpunan state untuk dibaca: {q0, q1}; himpunan kosong: ∅.
function himpunan(states) {
  return states.length === 0 ? '∅' : `{${states.join(', ')}}`;
}

// ---------- dokumen .fa / .dfa dan jenis automata (spesifikasi bagian 10) ----------

// Dokumen yang sedang dibuka:
//   format: 'fa' atau 'dfa' (dari file yang dibuka; dokumen baru selalu 'fa')
//   jenis:  'DFA' atau 'NFA' (dokumen .dfa selalu 'DFA')
// Untuk dokumen .fa, baris type: TIDAK ada di kotak definisi: jenisnya
// dipegang di sini dan ditampilkan lewat pilihan jenis (widget). Teks dikirim
// ke server apa adanya bersama format dan jenis, jadi nomor baris di pesan
// error tetap sesuai kotak definisi. Baris type: baru ditulis saat menyimpan.
const dokumen = { format: 'fa', jenis: 'NFA' };

// Keadaan dokumen saat terakhir dibuka atau disimpan. Jika berbeda dengan
// sekarang, ada perubahan yang belum disimpan.
let dokumenAman = { teks: '', format: 'fa', jenis: 'NFA' };

function tandaiAman() {
  dokumenAman = { teks: teksDfa.value, format: dokumen.format, jenis: dokumen.jenis };
}

function adaPerubahan() {
  return (
    teksDfa.value !== dokumenAman.teks || dokumen.format !== dokumenAman.format || dokumen.jenis !== dokumenAman.jenis
  );
}

// Browser memberi peringatan bawaannya jika halaman ditutup atau dimuat ulang
// selagi ada perubahan yang belum disimpan.
window.addEventListener('beforeunload', (e) => {
  if (!adaPerubahan()) return;
  e.preventDefault();
  e.returnValue = ''; // diperlukan sebagian browser
});

// Sebelum isi kotak definisi diganti dokumen lain: tanya dulu jika ada
// perubahan yang belum disimpan. Mengembalikan true jika boleh diganti.
function bolehGantiDokumen() {
  return !adaPerubahan() || window.confirm('Perubahan pada dokumen ini belum disimpan dan akan hilang. Lanjutkan?');
}

// Isi body permintaan ke /api/analisis dan /api/simulasi.
function bodyDokumen() {
  return dokumen.format === 'fa'
    ? { teks: teksDfa.value, format: 'fa', type: dokumen.jenis }
    : { teks: teksDfa.value, format: 'dfa' };
}

// Menyelaraskan widget dan tombol ganti format dengan `dokumen`.
function perbaruiWidget() {
  for (const r of widgetJenis.querySelectorAll('input[name="jenis"]')) r.checked = r.value === dokumen.jenis;
  widgetJenis.disabled = dokumen.format === 'dfa';
  keteranganJenis.textContent =
    dokumen.format === 'dfa'
      ? 'Dokumen .dfa selalu dibaca sebagai DFA. Pakai "Jadikan .fa" untuk bisa memilih jenis.'
      : `Dokumen .fa. Saat disimpan, baris "type: ${dokumen.jenis}" ditulis di baris pertama file.`;
  tombolJadikanFa.hidden = dokumen.format !== 'dfa';
  tombolJadikanDfa.hidden = !(dokumen.format === 'fa' && dokumen.jenis === 'DFA');
  // Konversi sesuai jenis: NFA -> DFA untuk NFA, DFA -> NFA untuk DFA.
  tombolKonversi.textContent = dokumen.jenis === 'NFA' ? 'Konversi NFA → DFA' : 'Konversi DFA → NFA';
  labelBuangDead.hidden = dokumen.jenis !== 'DFA';
}

// Definisi atau jenis berubah: hasil simulasi dan tabel konversi tidak berlaku lagi.
function definisiBerubah() {
  hasilKedaluwarsa();
  konversiKedaluwarsa();
}

// Membuka teks sebagai dokumen baru (dari file, contoh, atau menu baru).
// Untuk .fa, baris type: yang sah dipindah ke widget (tanpa type: -> NFA).
// `jenisBaru` (opsional) dipakai menu "DFA baru"/"NFA baru".
function bukaDokumen(teks, format, nama, jenisBaru) {
  if (format === 'fa') {
    const p = Berkas.pisahkanBarisType(teks);
    dokumen.jenis = jenisBaru ?? p.jenis ?? 'NFA';
    teks = p.teks;
  } else {
    dokumen.jenis = 'DFA';
  }
  dokumen.format = format;
  teksDfa.value = teks;
  namaBerkas.value = Berkas.namaBerkas(nama, format);
  tandaiAman();
  perbaruiWidget();
  definisiBerubah();
  periksa();
}

function dokumenBaru(jenis) {
  if (!bolehGantiDokumen()) return;
  bukaDokumen(Berkas.TEMPLAT[jenis], 'fa', 'automata.fa', jenis);
  pilihContoh.value = contohTerakhir = '';
  infoBerkasOk(`Dokumen ${jenis} baru.`);
}

widgetJenis.addEventListener('change', (e) => {
  if (e.target.name !== 'jenis' || dokumen.format !== 'fa') return;
  dokumen.jenis = e.target.value;
  perbaruiWidget();
  definisiBerubah();
  periksa();
});

document.getElementById('tombol-dfa-baru').addEventListener('click', () => dokumenBaru('DFA'));
document.getElementById('tombol-nfa-baru').addEventListener('click', () => dokumenBaru('NFA'));

// Ganti format (bukan konversi, spesifikasi bagian 9.3).
tombolJadikanFa.addEventListener('click', () => {
  // Baris type: di dokumen .dfa selama ini diabaikan; di .fa jenisnya DFA.
  const p = Berkas.pisahkanBarisType(teksDfa.value);
  teksDfa.value = p.teks;
  dokumen.format = 'fa';
  dokumen.jenis = 'DFA';
  namaBerkas.value = Berkas.namaBerkas(namaBerkas.value, 'fa');
  perbaruiWidget();
  definisiBerubah();
  periksa();
  infoBerkasOk(
    `Sekarang dokumen .fa dengan jenis DFA (${namaBerkas.value}).` +
      (p.jumlah > 0 ? ' Baris type: di teks dihapus; jenis dipilih lewat pilihan jenis.' : '')
  );
});
tombolJadikanDfa.addEventListener('click', () => {
  dokumen.format = 'dfa';
  dokumen.jenis = 'DFA';
  namaBerkas.value = Berkas.namaBerkas(namaBerkas.value, 'dfa');
  perbaruiWidget();
  definisiBerubah();
  periksa();
  infoBerkasOk(`Sekarang dokumen .dfa (${namaBerkas.value}).`);
});

// ---------- pemeriksaan langsung saat mengetik ----------

function tampilkanAnalisis(a) {
  if (a.syntaxError) {
    return ganti(statusDfa, kotak('galat', '✖', 'Sintaks salah:', [a.syntaxError]));
  }
  if (a.errors.length > 0) {
    return ganti(statusDfa, kotak('galat', '✖', `Bukan ${a.type} yang valid:`, a.errors));
  }
  const anak = [kotak('ok', '✔', `${a.type} valid`)];
  if (a.warnings.length > 0) anak.push(kotak('peringatan', '⚠', 'Peringatan:', a.warnings));
  ganti(statusDfa, ...anak);
}

let nomorPermintaan = 0; // jawaban yang datang terlambat dari ketikan lama diabaikan

async function periksa() {
  const saya = ++nomorPermintaan;
  if (teksDfa.value.trim() === '') {
    automataTerakhir = null;
    analisisTerakhir = null;
    gambarDiagram();
    return ganti(statusDfa, kotak('netral', 'ℹ', 'Belum ada definisi.'));
  }
  try {
    const res = await fetch('/api/analisis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyDokumen()),
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

// Automata (DFA atau NFA) terakhir yang berhasil dibaca (hasil parse dari
// server). Dipakai lagi saat tata letak diganti, tanpa bertanya ke server.
let automataTerakhir = null;

// Posisi hasil geser pengguna (sub tahap 5f), dipisah per tata letak:
// nama tata letak -> Map(nama state -> {x, y}). Hanya hidup selama halaman
// terbuka. Tetap berlaku saat teks .dfa diubah, selama nama statenya masih ada.
const posisiGeser = new Map();
const tombolKembalikanPosisi = document.getElementById('tombol-kembalikan-posisi');

function geserTataLetakIni() {
  if (!posisiGeser.has(pilihTataLetak.value)) posisiGeser.set(pilihTataLetak.value, new Map());
  return posisiGeser.get(pilihTataLetak.value);
}

const SKALA_MIN_DIAGRAM = 0.75;

// Gambar terakhir (hasil Gambar.susunGambar), dipakai saat menyeret.
let gambarTerakhir = null;

// Elemen <svg> dari DFA terakhir. `kotakTetap` (opsional) menahan bingkai gambar
// selama menyeret, supaya diagram tidak bergeser di bawah kursor.
function buatSvgDiagram(kotakTetap) {
  const graf = Graf.buatGraf(automataTerakhir);
  // Nama state panjang -> lingkaran besar -> jarak antar state ikut diperbesar
  // (sebelum posisi hasil geser diterapkan, supaya posisi geser tetap tepat).
  const faktor = Gambar.faktorJarak(Gambar.hitungRadius(graf.nodes));
  const bawaan = Graf.skalakanTataLetak(Graf.hitungTataLetak(graf, pilihTataLetak.value), faktor);
  const tataLetak = Graf.terapkanGeser(bawaan, geserTataLetakIni());
  gambarTerakhir = Gambar.susunGambar(graf, tataLetak);
  if (kotakTetap) gambarTerakhir.kotak = kotakTetap;
  const judul = `Diagram state: ${graf.nodes.length} state, ${graf.edges.length} panah transisi`;
  const svg = Gambar.buatSvg(gambarTerakhir, judul);
  // Di layar sempit gambar boleh mengecil, tetapi tidak di bawah 75% supaya
  // tulisannya tetap terbaca; selebihnya diagram digulung ke samping.
  svg.style.minWidth = `${Math.round(gambarTerakhir.kotak.lebar * SKALA_MIN_DIAGRAM)}px`;
  return svg;
}

function gambarDiagram() {
  diagram.classList.remove('usang');
  tombolKembalikanPosisi.disabled = geserTataLetakIni().size === 0;
  gambarTerakhir = null;
  if (!automataTerakhir) return ganti(diagram, el('p', 'Diagram muncul setelah definisi bisa dibaca.', 'keterangan'));
  if (automataTerakhir.states.length === 0) return ganti(diagram, el('p', 'Belum ada state untuk digambar.', 'keterangan'));
  const fokus = stateBerfokus();
  ganti(diagram, buatSvgDiagram());
  kembalikanFokus(fokus);
  tampilkanJejak();
}

// Saat diseret, hanya <svg> yang diganti; catatan di bawahnya (mis. "sintaks
// belum benar") dibiarkan.
function gambarUlangSvg(kotakTetap) {
  const lama = diagram.querySelector('svg');
  if (!lama || !automataTerakhir) return;
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
  if (a.automaton) {
    automataTerakhir = a.automaton;
    gambarDiagram();
    if (a.errors.length > 0) {
      diagram.appendChild(kotak('peringatan', '⚠', `${a.type} belum valid, jadi diagram ini bisa belum lengkap.`));
    }
    return;
  }
  // Sintaks salah (biasanya karena sedang mengetik): diagram terakhir dibiarkan,
  // tetapi dipudarkan dan diberi catatan supaya tidak dikira gambar terbaru.
  if (!automataTerakhir) return gambarDiagram();
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

// ---------- animasi jejak (sub tahap 5d untuk DFA, 6i untuk NFA) ----------

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

// Jejak simulasi terakhir: { jenis: 'DFA'|'NFA', automaton, hasil, posisi }.
// null = tidak ada.
let jejak = null;

// Keadaan jejak di posisi sekarang (apa yang disorot dan teks penjelasannya).
function keadaanSekarang() {
  return jejak.jenis === 'NFA'
    ? Animasi.keadaanJejakNfa(jejak.automaton, jejak.hasil, jejak.posisi)
    : Animasi.keadaanJejak(jejak.automaton.start, jejak.hasil, jejak.posisi);
}
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
  const k = keadaanSekarang();
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
  const ikon = el('span', timerJejak ? '⏸' : '▶');
  ikon.setAttribute('aria-hidden', 'true');
  tombolPutar.replaceChildren(ikon, timerJejak ? ' Jeda' : ' Putar');
  // Selama diputar, teks langkah tidak diumumkan tiap detik oleh pembaca layar;
  // saat dijeda atau dijalankan per langkah, diumumkan.
  teksJejak.setAttribute('aria-live', timerJejak ? 'off' : 'polite');
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

// Tabel jejak NFA: himpunan state per langkah (spesifikasi bagian 8.6).
// Baris 0 adalah himpunan awal, ε-closure({q₀}). Kolom gabungan δ dan
// ε-closure dipisah; kolom ε-closure hanya ada jika NFA punya ε-transisi
// (tanpa ε, gabungan δ sudah himpunan sesudahnya).
function tabelJejakNfa(r, adaEpsilon) {
  const tabel = el('table');
  const kepala = el('tr');
  const judul = adaEpsilon
    ? ['No', 'Himpunan sebelum', 'Simbol', 'Gabungan δ', 'ε-closure (sesudah)']
    : ['No', 'Himpunan sebelum', 'Simbol', 'Gabungan δ (sesudah)'];
  for (const h of judul) kepala.appendChild(el('th', h));
  tabel.appendChild(kepala);
  const baris = (nomor, sel) => {
    const tr = el('tr');
    tr.dataset.langkah = String(nomor); // disorot oleh animasi jejak
    for (const isi of sel) tr.appendChild(el('td', isi));
    tabel.appendChild(tr);
  };
  baris(0, adaEpsilon ? ['0', '(awal)', '', '', himpunan(r.start.states)] : ['0', '(awal)', '', himpunan(r.start.states)]);
  r.steps.forEach((s, i) => {
    const sel = [String(i + 1), himpunan(s.from), s.symbol, himpunan(s.moved)];
    if (adaEpsilon) sel.push(himpunan(s.to));
    baris(i + 1, sel);
  });
  return tabel;
}

// Pohon komputasi NFA (tampilan tambahan): setiap kemungkinan jalan
// ditelusuri terpisah. Disembunyikan dalam <details> supaya tabel jejak tetap
// yang utama; jika pohonnya terlalu besar, hanya diberi keterangan.
function bagianPohon(pohon, teksInput) {
  const d = el('details', undefined, 'pohon');
  d.appendChild(el('summary', 'Pohon komputasi (setiap kemungkinan jalan)'));
  if (!pohon || pohon.terlaluBesar) {
    d.appendChild(
      el('p', `Pohon terlalu besar untuk ditampilkan (lebih dari ${pohon ? pohon.maksSimpul : 200} simpul). Coba input yang lebih pendek.`)
    );
  } else {
    d.appendChild(gulung(el('pre', Animasi.teksPohon(pohon, teksInput).join('\n'))));
  }
  return d;
}

function tampilkanSimulasiNfa(data) {
  const r = data.result;
  const status = r.accepted
    ? kotak('ok', '✔', `DITERIMA: himpunan terakhir ${himpunan(r.finalStates)} memuat state akhir`)
    : kotak('galat', '✖', `DITOLAK: himpunan terakhir ${himpunan(r.finalStates)} tidak memuat state akhir`);
  status.classList.add('status-hasil');
  umumkan(status.textContent.trim());
  const adaEpsilon = data.automaton.transitions.some((t) => t.symbol === 'ε' && t.to.length > 0);
  ganti(
    hasil,
    status,
    el('h3', 'Jejak (himpunan state per langkah)'),
    gulung(tabelJejakNfa(r, adaEpsilon)),
    bagianPohon(data.tree, input.value)
  );

  // Sama dengan DFA: diagram digambar dari NFA yang baru disimulasikan, lalu
  // jejaknya diputar (beberapa state dan panah disorot sekaligus).
  jejak = { jenis: 'NFA', automaton: data.automaton, hasil: r, posisi: 0 };
  perbaruiDiagram({ syntaxError: null, type: data.type, errors: [], warnings: data.warnings, automaton: data.automaton });
  if (!kurangiGerak.matches) putarJejak();
}

function tampilkanSimulasi(data) {
  if (data.errors.length > 0) {
    umumkan(`Tidak dijalankan: bukan ${data.type} yang valid.`);
    return ganti(hasil, kotak('galat', '✖', `Tidak dijalankan: bukan ${data.type} yang valid.`, data.errors));
  }
  if (data.type === 'NFA') return tampilkanSimulasiNfa(data);
  const r = data.result;
  const status = r.accepted
    ? kotak('ok', '✔', `DITERIMA, berhenti di ${r.finalState}`)
    : kotak('galat', '✖', `DITOLAK, berhenti di ${r.finalState}`);
  status.classList.add('status-hasil');
  umumkan(status.textContent.trim());
  ganti(hasil, status, el('h3', 'Jejak'), tabelJejak(r.steps));

  // Diagram digambar dari DFA yang baru saja disimulasikan, supaya animasi
  // pasti cocok dengan gambarnya.
  jejak = { jenis: 'DFA', automaton: data.automaton, hasil: r, posisi: 0 };
  perbaruiDiagram({ syntaxError: null, type: data.type, errors: [], warnings: data.warnings, automaton: data.automaton });
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
      body: JSON.stringify({ ...bodyDokumen(), input: input.value }),
    });
    const data = await res.json();
    if (data.error) {
      ganti(hasil, kotak('galat', '✖', 'Error:', [data.error]));
      umumkan(`Error: ${data.error}`);
      if (data.position) tandaiSimbol(input.value, data.position);
      return;
    }
    tampilkanSimulasi(data);
  } catch {
    ganti(hasil, kotak('galat', '✖', 'Tidak bisa menghubungi server.'));
  }
}

// ---------- konversi (sub tahap 6j, spesifikasi bagian 9 dan 10) ----------

let konversiBerlaku = false;

function konversiKedaluwarsa() {
  if (!konversiBerlaku) return;
  konversiBerlaku = false;
  ganti(hasilKonversi, kotak('netral', 'ℹ', 'Definisi atau jenis berubah. Tekan tombol konversi lagi.'));
}

// Tabel lebar dibungkus wadah yang bisa digulung ke samping, supaya halaman
// tidak ikut melebar melewati layar.
function gulung(isi) {
  const d = el('div', undefined, 'gulung');
  d.appendChild(isi);
  return d;
}

// Tabel dari judul kolom dan baris (isi sel selalu teks), sudah dibungkus gulung().
function tabel(judul, baris, kelasSel = () => '') {
  const t = el('table');
  const kepala = el('tr');
  for (const h of judul) kepala.appendChild(el('th', h));
  t.appendChild(kepala);
  baris.forEach((b, i) => {
    const tr = el('tr');
    b.forEach((isi, j) => tr.appendChild(el('td', isi, kelasSel(i, j))));
    t.appendChild(tr);
  });
  return gulung(t);
}

// Nama dokumen hasil: automata.fa -> automata-dfa.fa
function namaHasilKonversi(akhiran) {
  const dasar = Berkas.namaBerkas(namaBerkas.value, 'fa').replace(/\.fa$/, '');
  return `${dasar}-${akhiran}.fa`;
}

// Hasil konversi dibuka sebagai dokumen baru di tab browser baru (spesifikasi
// bagian 10). Isinya dititipkan di bagian # alamat (tidak dikirim ke server),
// lalu dibaca saat halaman di tab baru dimuat (lihat bukaDariAlamat).
function bukaDiTabBaru(nama, teks) {
  const muatan = encodeURIComponent(JSON.stringify({ nama, teks }));
  window.open(`${location.pathname}#buka=${muatan}`, '_blank', 'noopener');
}

function tombolBukaHasil(nama, teks) {
  const b = el('button', `Buka hasil sebagai dokumen baru (${nama})`);
  b.type = 'button';
  b.addEventListener('click', () => bukaDiTabBaru(nama, teks));
  return b;
}

function tampilkanKeDfa(h, q0) {
  const awal = h.start.states;
  const teksAwal =
    awal.length === 1 && awal[0] === q0
      ? `Langkah 0: state awal DFA = ${himpunan(awal)} → ${h.start.name}`
      : `Langkah 0: state awal DFA = ε-closure({${q0}}) = ${himpunan(awal)} → ${h.start.name}`;
  const judul = h.usesEpsilon
    ? ['No', 'Himpunan', 'Simbol', 'Gabungan δ', 'ε-closure', 'Hasil', 'Keterangan']
    : ['No', 'Himpunan', 'Simbol', 'Gabungan δ', 'Hasil', 'Keterangan'];
  const baris = h.steps.map((s, i) => {
    const b = [String(i + 1), s.fromName, s.symbol, himpunan(s.moved)];
    if (h.usesEpsilon) b.push(himpunan(s.to));
    b.push(s.toName, s.isNew ? 'baru' : 'sudah ada');
    return b;
  });
  const kolomKet = judul.length - 1;
  const alfabet = h.table[0] ? h.table[0].transitions.map((t) => t.symbol) : [];
  const ringkas = h.table.map((r) => [
    (r.isStart ? '→ ' : '') + (r.isAccept ? '* ' : '') + r.name,
    ...r.transitions.map((t) => t.toName),
  ]);
  const nama = namaHasilKonversi('dfa');
  ganti(
    hasilKonversi,
    kotak('ok', '✔', `NFA → DFA (konstruksi subset): ${h.table.length} state DFA.`),
    el('h3', 'Langkah demi langkah'),
    el('p', teksAwal, 'langkah0'),
    baris.length > 0 ? tabel(judul, baris, (i, j) => (j === kolomKet && h.steps[i].isNew ? 'baru' : '')) : el('p', 'Tidak ada langkah (alfabet kosong).'),
    el('h3', 'Tabel transisi DFA (→ state awal, * state akhir)'),
    tabel(['State DFA', ...alfabet], ringkas),
    tombolBukaHasil(nama, h.text)
  );
}

function tampilkanKeNfa(h) {
  const baris = h.mapping.map((m) => [
    `δ(${m.from}, ${m.symbol}) = ${m.dfaTo}`,
    m.removed ? '(dihapus: dead state)' : `δ(${m.from}, ${m.symbol}) = {${m.nfaTo.join(', ')}}`,
  ]);
  const anak = [kotak('ok', '✔', 'DFA → NFA: δ_N(q, a) = {δ_D(q, a)}.'), el('h3', 'Tabel pemetaan')];
  anak.push(baris.length > 0 ? tabel(['DFA', 'NFA'], baris) : el('p', 'Tidak ada transisi.'));
  if (h.removedStates.length > 0) {
    anak.push(kotak('netral', 'ℹ', 'Dead state dibuang:', h.removedStates.map((r) => `${r.state} (${r.reason})`)));
  }
  anak.push(tombolBukaHasil(namaHasilKonversi('nfa'), h.text));
  ganti(hasilKonversi, ...anak);
}

async function jalankanKonversi() {
  const arah = dokumen.jenis === 'NFA' ? 'ke-dfa' : 'ke-nfa';
  bagianKonversi.hidden = false;
  konversiBerlaku = true;
  try {
    const res = await fetch('/api/konversi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bodyDokumen(), arah, buangDeadState: arah === 'ke-nfa' && centangBuangDead.checked }),
    });
    const data = await res.json();
    if (data.error) {
      umumkan(`Tidak bisa dikonversi: ${data.error}`);
      return ganti(hasilKonversi, kotak('galat', '✖', 'Tidak bisa dikonversi:', [data.error]));
    }
    if (data.errors.length > 0) {
      umumkan(`Tidak dikonversi: bukan ${data.type} yang valid.`);
      return ganti(hasilKonversi, kotak('galat', '✖', `Tidak dikonversi: bukan ${data.type} yang valid.`, data.errors));
    }
    if (arah === 'ke-dfa') {
      tampilkanKeDfa(data.hasil, data.automaton.start);
      umumkan(`Konversi NFA ke DFA selesai: ${data.hasil.table.length} state DFA. Tabel ada di bagian Konversi.`);
    } else {
      tampilkanKeNfa(data.hasil);
      umumkan('Konversi DFA ke NFA selesai. Tabel pemetaan ada di bagian Konversi.');
    }
    bagianKonversi.scrollIntoView({ behavior: kurangiGerak.matches ? 'auto' : 'smooth', block: 'start' });
  } catch {
    ganti(hasilKonversi, kotak('galat', '✖', 'Tidak bisa menghubungi server.'));
  }
}

tombolKonversi.addEventListener('click', jalankanKonversi);
centangBuangDead.addEventListener('change', konversiKedaluwarsa);

// Tab baru yang dibuka oleh bukaDiTabBaru: ambil dokumen dari bagian # alamat.
// Mengembalikan true jika ada dokumen yang dibuka.
function bukaDariAlamat() {
  if (!location.hash.startsWith('#buka=')) return false;
  const muatan = location.hash.slice('#buka='.length); // baca dulu, baru bersihkan alamat
  history.replaceState(null, '', location.pathname);
  try {
    const { nama, teks } = JSON.parse(decodeURIComponent(muatan));
    const format = Berkas.formatDariNama(nama);
    if (typeof teks !== 'string' || !format || Berkas.periksaBerkas({ teks, ukuran: teks.length })) return false;
    bukaDokumen(teks, format, nama);
    // Hasil konversi hanya ada di tab ini (belum pernah disimpan), jadi
    // dianggap berubah: menutup tab atau mengganti dokumen akan ditanyakan.
    dokumenAman = { teks: null, format, jenis: dokumen.jenis };
    infoBerkasOk(`Dokumen baru dari konversi: ${namaBerkas.value} (${dokumen.jenis}). Simpan jika ingin disimpan.`);
    return true;
  } catch {
    return false;
  }
}

// ---------- simpan dan buka file .fa / .dfa (di sisi browser) ----------

function infoBerkasOk(teks) {
  ganti(infoBerkas, kotak('ok', '✔', teks));
}

function infoBerkasGalat(teks) {
  ganti(infoBerkas, kotak('galat', '✖', teks));
}

// Simpan: mengunduh isi kotak definisi sebagai file teks UTF-8, dengan format
// dokumen saat ini. Dokumen .fa diberi baris type: sesuai pilihan jenis.
function simpanBerkas() {
  const nama = Berkas.namaBerkas(namaBerkas.value, dokumen.format);
  namaBerkas.value = nama;
  const isi =
    dokumen.format === 'fa' ? Berkas.teksSimpanFa(teksDfa.value, dokumen.jenis) : Berkas.siapkanTeksSimpan(teksDfa.value);
  const blob = new Blob([isi], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  tandaiAman();
  infoBerkasOk(`Disimpan sebagai ${nama} (folder unduhan browser).`);
}

// Buka: membaca file dari komputer ke kotak definisi, lalu langsung diperiksa.
async function bukaBerkas(berkas) {
  if (!berkas) return;
  try {
    const teks = await berkas.text(); // di-decode sebagai UTF-8
    const format = Berkas.formatDariNama(berkas.name);
    if (!format) return infoBerkasGalat(`Tidak bisa membuka ${berkas.name}: file harus berekstensi .fa atau .dfa.`);
    const masalah = Berkas.periksaBerkas({ teks, ukuran: berkas.size });
    if (masalah) return infoBerkasGalat(`Tidak bisa membuka ${berkas.name}: ${masalah}.`);
    if (!bolehGantiDokumen()) return;
    bukaDokumen(teks, format, berkas.name);
    pilihContoh.value = contohTerakhir = '';
    infoBerkasOk(`Dibuka: ${berkas.name} (${dokumen.jenis}).`);
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
      return infoBerkasGalat('Daftar contoh kosong: tidak ada file .fa atau .dfa di folder contoh server.');
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

// Contoh yang terakhir dimuat, untuk mengembalikan pilihan jika batal.
let contohTerakhir = '';
pilihContoh.addEventListener('change', async () => {
  if (!pilihContoh.value) return;
  if (!bolehGantiDokumen()) {
    pilihContoh.value = contohTerakhir;
    return;
  }
  const nama = pilihContoh.value;
  contohTerakhir = nama;
  const res = await fetch('/api/contoh/' + encodeURIComponent(nama));
  bukaDokumen(await res.text(), Berkas.formatDariNama(nama), nama);
  ganti(infoBerkas);
});

teksDfa.addEventListener('input', () => {
  ganti(infoBerkas);
  // Dokumen .fa: baris type: yang diketik/ditempel dipindah ke widget.
  if (dokumen.format === 'fa') {
    const p = Berkas.pisahkanBarisType(teksDfa.value);
    if (p.jumlah > 0) {
      const kursor = teksDfa.selectionStart;
      teksDfa.value = p.teks;
      teksDfa.selectionStart = teksDfa.selectionEnd = Math.min(kursor, p.teks.length);
      dokumen.jenis = p.jenis;
      perbaruiWidget();
      infoBerkasOk(`Baris "type: ${p.jenis}" dipindah ke pilihan jenis automata.`);
    }
  }
  definisiBerubah();
  jadwalkanPeriksa();
});
input.addEventListener('input', hasilKedaluwarsa);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') jalankan(); });
document.getElementById('tombol-jalankan').addEventListener('click', jalankan);

muatDaftarContoh();
// Saat halaman pertama kali dibuka: dokumen "NFA baru" (spesifikasi bagian 10),
// kecuali tab ini dibuka untuk hasil konversi.
if (!bukaDariAlamat()) bukaDokumen(Berkas.TEMPLAT.NFA, 'fa', 'automata.fa');
