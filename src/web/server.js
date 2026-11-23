// Server web sederhana memakai modul http bawaan Node (tanpa Express).
// Tahap 5. Tugas server hanya dua:
//   1. menyajikan file statis di folder public/
//   2. menyediakan API JSON yang memanggil modul yang sama dengan CLI.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { jalankanFa, analisisFa, konversiFa } = require('../fas');

const FOLDER_PUBLIC = path.join(__dirname, '..', '..', 'public');
const FOLDER_CONTOH = path.join(__dirname, '..', '..', 'contoh');

const JENIS_FILE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function kirimJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const MAKS_BODY = 100_000; // byte

// Mengumpulkan potongan sebagai Buffer lalu men-decode sekali di akhir, supaya
// karakter multibyte (δ, Σ, ε, emoji) tidak rusak jika terbelah di batas potongan.
// Jika melewati MAKS_BODY, ditolak dengan err.kode = 'BODY_BESAR'; sisa kiriman
// dibuang tanpa disimpan (koneksi tidak diputus, supaya jawaban 413 masih terkirim).
function bacaBody(req) {
  return new Promise((resolve, reject) => {
    const potongan = [];
    let ukuran = 0;
    let terlalu = false;
    req.on('data', (bagian) => {
      if (terlalu) return;
      ukuran += bagian.length;
      if (ukuran > MAKS_BODY) {
        terlalu = true;
        potongan.length = 0;
        const err = new Error('body terlalu besar');
        err.kode = 'BODY_BESAR';
        return reject(err);
      }
      potongan.push(bagian);
    });
    req.on('end', () => resolve(Buffer.concat(potongan).toString('utf8')));
    req.on('error', reject);
  });
}

// File contoh yang disajikan: .dfa (format lama) dan .fa (tahap 6).
const adalahFileContoh = (f) => f.endsWith('.dfa') || f.endsWith('.fa');

// GET /api/contoh  -> daftar nama file .dfa dan .fa di folder contoh/
// Jika folder tidak bisa dibaca (mis. tidak ikut terdeploy), jawab 500 dengan pesan
// yang jelas, bukan membiarkan error itu menghentikan server. Alamat folder di server
// hanya ditulis ke log, tidak dikirim ke pengguna.
function daftarContoh(res, folder) {
  let nama;
  try {
    nama = fs.readdirSync(folder).filter(adalahFileContoh).sort();
  } catch (err) {
    console.error(`gagal membaca folder contoh (${folder}): ${err.message}`);
    return kirimJson(res, 500, { error: 'folder contoh tidak bisa dibaca di server' });
  }
  kirimJson(res, 200, { contoh: nama });
}

// GET /api/contoh/<nama>.dfa atau <nama>.fa  -> isi file contoh sebagai teks
function ambilContoh(res, nama, folder) {
  // path.basename mencegah akses ke luar folder contoh/ (misalnya "../")
  const file = path.join(folder, path.basename(nama));
  let isi;
  try {
    if (!adalahFileContoh(file) || !fs.existsSync(file)) throw Object.assign(new Error('tidak ada'), { code: 'ENOENT' });
    isi = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`gagal membaca contoh (${file}): ${err.message}`);
    return kirimJson(res, err.code === 'ENOENT' ? 404 : 500, {
      error: err.code === 'ENOENT' ? 'contoh tidak ditemukan' : 'contoh tidak bisa dibaca di server',
    });
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(isi);
}

// Membaca body JSON dan memastikan field yang diminta berupa teks.
// Jika tidak sesuai, langsung menjawab 400 dan mengembalikan null.
async function bacaJson(req, res, ...fieldTeks) {
  let teks;
  try {
    teks = await bacaBody(req);
  } catch (err) {
    if (err.kode === 'BODY_BESAR') {
      kirimJson(res, 413, { error: `body terlalu besar (maksimum ${MAKS_BODY} byte)` });
    } else {
      kirimJson(res, 400, { error: 'gagal membaca body' });
    }
    return null;
  }
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    kirimJson(res, 400, { error: 'body harus JSON yang valid' });
    return null;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    kirimJson(res, 400, { error: 'body harus berupa objek JSON' });
    return null;
  }
  if (fieldTeks.some((f) => typeof data[f] !== 'string')) {
    const daftar = fieldTeks.map((f) => `"${f}"`).join(' dan ');
    kirimJson(res, 400, { error: `field ${daftar} wajib berupa teks` });
    return null;
  }
  return data;
}

// Isi file dikirim di field "teks". Nama lama "dfa" tetap diterima supaya
// klien lama tetap jalan (jika keduanya ada, "teks" yang dipakai). Isinya
// boleh teks .dfa maupun .fa. Jika tidak ada, menjawab 400 dan mengembalikan null.
function teksDariBody(data, res) {
  if (typeof data.teks === 'string') return data.teks;
  if (typeof data.dfa === 'string') return data.dfa;
  kirimJson(res, 400, { error: 'field "teks" (atau "dfa") wajib berupa teks' });
  return null;
}

// Field "format" (opsional): "fa" atau "dfa", yaitu format file yang isinya
// dikirim (spesifikasi bagian 8.1). Bawaan "dfa", supaya klien lama yang
// tidak mengirim format tetap berperilaku sama.
// Jika format tidak sah, langsung menjawab 400 dan mengembalikan null.
function formatDariBody(data, res) {
  if (data.format === undefined) return 'dfa';
  if (data.format === 'fa' || data.format === 'dfa') return data.format;
  kirimJson(res, 400, { error: 'field "format" harus "fa" atau "dfa"' });
  return null;
}

// Field "type" (opsional, hanya dengan format "fa"): jenis automata yang dipilih
// di luar teks, mis. lewat pilihan jenis di halaman web yang menyembunyikan
// baris type: (spesifikasi bagian 10). Teks dikirim apa adanya, jadi nomor
// baris di pesan error tetap tepat. Jika tidak sah, menjawab 400 dan
// mengembalikan false.
function jenisDariBody(data, format, res) {
  if (data.type === undefined) return true;
  if (format === 'fa' && (data.type === 'DFA' || data.type === 'NFA')) return true;
  kirimJson(res, 400, { error: 'field "type" harus "DFA" atau "NFA", dan hanya dengan format "fa"' });
  return false;
}

// POST /api/simulasi  body: { "teks": "<isi file>", "input": "0101", "format"?: "fa"|"dfa", "type"?: "DFA"|"NFA" }
// 200: { type, errors, warnings, automaton, dfa, result }
//      (dfa = automaton, dipertahankan untuk klien lama; result berbentuk jejak
//      DFA atau NFA sesuai type, atau null jika ada error)
// 400: { error, position? }  (sintaks salah, atau simbol input di luar Σ; position
//      = posisi simbol itu, mulai dari 1)
async function simulasi(req, res) {
  const data = await bacaJson(req, res, 'input');
  if (!data) return;
  const teks = teksDariBody(data, res);
  if (teks === null) return;
  const format = formatDariBody(data, res);
  if (!format || !jenisDariBody(data, format, res)) return;
  try {
    const h = jalankanFa(teks, format, data.input, data.type);
    kirimJson(res, 200, { ...h, dfa: h.automaton });
  } catch (err) {
    kirimJson(res, 400, { error: err.message, position: err.position });
  }
}

// POST /api/analisis  body: { "teks": "<isi file>", "format"?: "fa"|"dfa", "type"?: "DFA"|"NFA" }
// Pemeriksaan tanpa simulasi (untuk pratinjau saat mengetik). Selalu 200:
// { syntaxError, type, errors, warnings, automaton, dfa }
async function analisisDfa(req, res) {
  const data = await bacaJson(req, res);
  if (!data) return;
  const teks = teksDariBody(data, res);
  if (teks === null) return;
  const format = formatDariBody(data, res);
  if (!format || !jenisDariBody(data, format, res)) return;
  const h = analisisFa(teks, format, data.type);
  kirimJson(res, 200, { ...h, dfa: h.automaton });
}

// POST /api/konversi  body: { "teks": "<isi file>", "arah": "ke-dfa"|"ke-nfa",
//   "format"?: "fa"|"dfa", "type"?: "DFA"|"NFA", "buangDeadState"?: true|false }
// 200: { type, errors, hasil }  (hasil null jika automata belum valid; untuk
//      ke-dfa berbentuk hasil nfaToDfa, untuk ke-nfa hasil dfaToNfa)
// 400: { error }  (sintaks salah, arah tidak dikenal, jenis tidak sesuai arah,
//      atau konversi gagal)
async function konversi(req, res) {
  const data = await bacaJson(req, res, 'arah');
  if (!data) return;
  const teks = teksDariBody(data, res);
  if (teks === null) return;
  const format = formatDariBody(data, res);
  if (!format || !jenisDariBody(data, format, res)) return;
  if (data.buangDeadState !== undefined && typeof data.buangDeadState !== 'boolean') {
    return kirimJson(res, 400, { error: 'field "buangDeadState" harus true atau false' });
  }
  try {
    kirimJson(res, 200, konversiFa(teks, format, data.type, data.arah, { buangDeadState: data.buangDeadState }));
  } catch (err) {
    kirimJson(res, 400, { error: err.message });
  }
}

function fileStatis(res, urlPath) {
  const relatif = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const file = path.normalize(path.join(FOLDER_PUBLIC, relatif));
  if (!file.startsWith(FOLDER_PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Tidak ditemukan');
  }
  const jenis = JENIS_FILE[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': jenis });
  res.end(fs.readFileSync(file));
}

// opsi.folderContoh: folder berisi file .dfa/.fa contoh (bawaan: contoh/ di akar proyek).
// opsi.catatan: fungsi (teks) => void untuk mencatat tiap permintaan (bawaan: tidak
//   mencatat, supaya keluaran tes tetap bersih). Hanya metode, alamat tanpa query,
//   kode jawaban, dan lama proses yang dicatat; isi permintaan (teks DFA) tidak pernah.
function buatServer(opsi = {}) {
  const folderContoh = opsi.folderContoh || FOLDER_CONTOH;
  const catatan = opsi.catatan || (() => {});
  return http.createServer((req, res) => {
    const mulai = Date.now();
    res.on('finish', () => {
      const alamat = String(req.url).split('?')[0];
      catatan(`${req.method} ${alamat} -> ${res.statusCode} (${Date.now() - mulai} ms)`);
    });
    try {
      tangani(req, res, folderContoh);
    } catch (err) {
      // Pengaman terakhir: kesalahan tak terduga di satu permintaan tidak boleh
      // menghentikan seluruh server.
      console.error(`kesalahan pada ${req.method} ${req.url}: ${err.stack || err.message}`);
      if (!res.headersSent) kirimJson(res, 500, { error: 'kesalahan di server' });
      else res.end();
    }
  });
}

function tangani(req, res, folderContoh) {
  const { pathname } = new URL(req.url, 'http://localhost');

  // Pemeriksaan hidup-tidaknya proses; tidak menyentuh disk maupun API lain.
  if (req.method === 'GET' && pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }
  if (req.method === 'GET' && pathname === '/api/contoh') return daftarContoh(res, folderContoh);
  if (req.method === 'GET' && pathname.startsWith('/api/contoh/')) {
    // decodeURIComponent melempar URIError untuk kode % yang rusak (mis. %E0).
    // Tanpa try/catch, error itu tidak tertangkap dan seluruh server berhenti.
    let nama;
    try {
      nama = decodeURIComponent(pathname.slice('/api/contoh/'.length));
    } catch {
      return kirimJson(res, 400, { error: 'nama contoh tidak valid' });
    }
    return ambilContoh(res, nama, folderContoh);
  }
  if (req.method === 'POST' && pathname === '/api/simulasi') return simulasi(req, res);
  if (req.method === 'POST' && pathname === '/api/analisis') return analisisDfa(req, res);
  if (req.method === 'POST' && pathname === '/api/konversi') return konversi(req, res);
  if (req.method === 'GET') return fileStatis(res, pathname);

  kirimJson(res, 405, { error: 'method tidak didukung' });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  buatServer({ catatan: console.log }).listen(port, () => {
    console.log(`FAS berjalan di http://localhost:${port}`);
  });
}

module.exports = { buatServer };
