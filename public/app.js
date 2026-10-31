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
  } catch {
    if (saya === nomorPermintaan) {
      ganti(statusDfa, kotak('galat', '✖', 'Tidak bisa menghubungi server.'));
    }
  }
}

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
}

async function jalankan() {
  ganti(tandaInput);
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

async function muatDaftarContoh() {
  const res = await fetch('/api/contoh');
  const data = await res.json();
  for (const nama of data.contoh) {
    const opsi = el('option', nama);
    opsi.value = nama;
    pilihContoh.appendChild(opsi);
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
