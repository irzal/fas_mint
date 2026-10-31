// Tes titik masuk hosting (server.js di akar): server harus menyala, baik file ini
// dijalankan langsung maupun hanya dimuat lewat require() seperti di beberapa hosting.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const AKAR = path.join(__dirname, '..');

// Mencari port kosong: buka port 0, catat nomornya, lalu tutup lagi.
function portKosong() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// Menjalankan proses Node, menunggu server menjawab, memeriksa, lalu menghentikan prosesnya.
async function denganProses(argumen, periksa) {
  const port = await portKosong();
  const anak = spawn(process.execPath, argumen, {
    cwd: AKAR,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  try {
    let res;
    for (let i = 0; i < 50 && !res; i++) {
      try {
        res = await fetch(`http://127.0.0.1:${port}/`);
      } catch {
        await new Promise((r) => setTimeout(r, 100)); // belum menyala, coba lagi
      }
    }
    assert.ok(res, 'server tidak menyala dalam 5 detik');
    await periksa(port, res);
  } finally {
    anak.kill();
  }
}

test('node server.js: server menyala di port dari PORT', async () => {
  await denganProses(['server.js'], async (port, res) => {
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Finite Automata Simulator/);
    const contoh = await (await fetch(`http://127.0.0.1:${port}/api/contoh`)).json();
    assert.ok(contoh.contoh.includes('berakhiran-01.dfa'));
  });
});

test('dimuat lewat require() (seperti hosting): server tetap menyala', async () => {
  // Meniru hosting yang memuat file masuk, bukan menjalankannya langsung.
  await denganProses(['-e', "require('./server.js')"], async (port, res) => {
    assert.equal(res.status, 200);
    const hasil = await (await fetch(`http://127.0.0.1:${port}/api/analisis`, {
      method: 'POST',
      body: JSON.stringify({ dfa: 'states: q0\nalphabet:\nstart: q0\naccept:\n' }),
    })).json();
    assert.equal(hasil.syntaxError, null);
  });
});

test('src/web/server.js dimuat lewat require() tidak menyalakan server (perilaku lama tetap)', async () => {
  // Inilah penyebab dibutuhkannya server.js di akar: memuat modul ini saja tidak
  // membuka port. Proses yang hanya me-require-nya langsung selesai tanpa mendengarkan.
  const kode = await new Promise((resolve) => {
    const anak = spawn(process.execPath, ['-e', "require('./src/web/server')"], { cwd: AKAR, stdio: 'ignore' });
    anak.on('exit', resolve);
  });
  assert.equal(kode, 0); // selesai sendiri (tidak ada server yang menahan proses)
});
