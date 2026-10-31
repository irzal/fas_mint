// Server web sederhana memakai modul http bawaan Node (tanpa Express).
// Tahap 5. Tugas server hanya dua:
//   1. menyajikan file statis di folder public/
//   2. menyediakan API JSON yang memanggil modul yang sama dengan CLI.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { jalankan, analisis } = require('../fas');

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

// GET /api/contoh  -> daftar nama file .dfa di folder contoh/
function daftarContoh(res) {
  const nama = fs.readdirSync(FOLDER_CONTOH).filter((f) => f.endsWith('.dfa'));
  kirimJson(res, 200, { contoh: nama });
}

// GET /api/contoh/<nama>.dfa  -> isi file contoh sebagai teks
function ambilContoh(res, nama) {
  // path.basename mencegah akses ke luar folder contoh/ (misalnya "../")
  const file = path.join(FOLDER_CONTOH, path.basename(nama));
  if (!file.endsWith('.dfa') || !fs.existsSync(file)) {
    return kirimJson(res, 404, { error: 'contoh tidak ditemukan' });
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(file, 'utf8'));
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
  if (data === null || typeof data !== 'object' || fieldTeks.some((f) => typeof data[f] !== 'string')) {
    const daftar = fieldTeks.map((f) => `"${f}"`).join(' dan ');
    kirimJson(res, 400, { error: `field ${daftar} wajib berupa teks` });
    return null;
  }
  return data;
}

// POST /api/simulasi  body: { "dfa": "<isi file .dfa>", "input": "0101" }
// 200: { errors, warnings, dfa, result }
// 400: { error, position? }  (sintaks salah, atau simbol input di luar Σ; position
//      = posisi simbol itu, mulai dari 1)
async function simulasi(req, res) {
  const data = await bacaJson(req, res, 'dfa', 'input');
  if (!data) return;
  try {
    kirimJson(res, 200, jalankan(data.dfa, data.input));
  } catch (err) {
    kirimJson(res, 400, { error: err.message, position: err.position });
  }
}

// POST /api/analisis  body: { "dfa": "<isi file .dfa>" }
// Pemeriksaan tanpa simulasi (untuk pratinjau saat mengetik). Selalu 200:
// { syntaxError, errors, warnings, dfa }
async function analisisDfa(req, res) {
  const data = await bacaJson(req, res, 'dfa');
  if (!data) return;
  kirimJson(res, 200, analisis(data.dfa));
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

function buatServer() {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && pathname === '/api/contoh') return daftarContoh(res);
    if (req.method === 'GET' && pathname.startsWith('/api/contoh/')) {
      // decodeURIComponent melempar URIError untuk kode % yang rusak (mis. %E0).
      // Tanpa try/catch, error itu tidak tertangkap dan seluruh server berhenti.
      let nama;
      try {
        nama = decodeURIComponent(pathname.slice('/api/contoh/'.length));
      } catch {
        return kirimJson(res, 400, { error: 'nama contoh tidak valid' });
      }
      return ambilContoh(res, nama);
    }
    if (req.method === 'POST' && pathname === '/api/simulasi') return simulasi(req, res);
    if (req.method === 'POST' && pathname === '/api/analisis') return analisisDfa(req, res);
    if (req.method === 'GET') return fileStatis(res, pathname);

    kirimJson(res, 405, { error: 'method tidak didukung' });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  buatServer().listen(port, () => {
    console.log(`FAS berjalan di http://localhost:${port}`);
  });
}

module.exports = { buatServer };
