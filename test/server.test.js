// Tes server web. Bagian ini sudah berjalan sejak kerangka dibuat.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { buatServer } = require('../src/web/server');

let server;
let alamat;

before(async () => {
  server = buatServer();
  await new Promise((resolve) => server.listen(0, resolve)); // port 0 = port acak yang kosong
  alamat = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test('halaman utama tersaji', async () => {
  const res = await fetch(alamat + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Finite Automata Simulator/);
});

test('daftar contoh berisi berakhiran-01.dfa', async () => {
  const res = await fetch(alamat + '/api/contoh');
  const data = await res.json();
  assert.ok(data.contoh.includes('berakhiran-01.dfa'));
});

test('isi contoh bisa diambil', async () => {
  const res = await fetch(alamat + '/api/contoh/berakhiran-01.dfa');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /states: q0 q1 q2/);
});

test('tidak bisa membaca file di luar folder contoh', async () => {
  const res = await fetch(alamat + '/api/contoh/..%2Fpackage.json');
  assert.equal(res.status, 404);
});

test('nama contoh dengan kode % rusak dijawab 400 dan server tetap hidup', async () => {
  const res = await fetch(alamat + '/api/contoh/%E0');
  assert.equal(res.status, 400);
  const lagi = await fetch(alamat + '/api/contoh');
  assert.equal(lagi.status, 200);
});

test('simulasi menolak body yang bukan JSON', async () => {
  const res = await fetch(alamat + '/api/simulasi', { method: 'POST', body: 'bukan json' });
  assert.equal(res.status, 400);
});

test('simulasi menjawab 200 dengan hasil, errors, dan warnings', async () => {
  const dfa = await (await fetch(alamat + '/api/contoh/berakhiran-01.dfa')).text();
  const res = await fetch(alamat + '/api/simulasi', {
    method: 'POST',
    body: JSON.stringify({ dfa, input: '1101' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.errors, []);
  assert.deepEqual(data.warnings, []);
  assert.equal(data.result.accepted, true);
  assert.equal(data.result.steps.length, 4);
  assert.deepEqual(data.dfa.states, ['q0', 'q1', 'q2']);
  assert.equal(data.dfa.transitions.length, 6);
});

test('simulasi menjawab 400 jika simbol input tidak ada di Σ', async () => {
  const dfa = await (await fetch(alamat + '/api/contoh/berakhiran-01.dfa')).text();
  const res = await fetch(alamat + '/api/simulasi', {
    method: 'POST',
    body: JSON.stringify({ dfa, input: '1x' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /simbol 'x' pada posisi 2/);
  assert.equal(data.position, 2);
});

test('simulasi menjawab 400 dengan pesan parser untuk file .dfa yang salah sintaks', async () => {
  const res = await fetch(alamat + '/api/simulasi', {
    method: 'POST',
    body: JSON.stringify({ dfa: 'states: q0', input: '' }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /'alphabet:' tidak ada/);
});

test('simulasi menolak body tanpa field teks yang diminta', async () => {
  const res = await fetch(alamat + '/api/simulasi', { method: 'POST', body: JSON.stringify({ dfa: 'x' }) });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /"dfa" dan "input"/);
  const res2 = await fetch(alamat + '/api/simulasi', { method: 'POST', body: 'null' });
  assert.equal(res2.status, 400);
});

test('analisis menjawab 200 dengan dfa dan tanpa result', async () => {
  const dfa = await (await fetch(alamat + '/api/contoh/berakhiran-01.dfa')).text();
  const res = await fetch(alamat + '/api/analisis', { method: 'POST', body: JSON.stringify({ dfa }) });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.syntaxError, null);
  assert.deepEqual(data.errors, []);
  assert.deepEqual(data.dfa.alphabet, ['0', '1']);
  assert.equal('result' in data, false);
});

test('analisis: sintaks salah tetap 200 dengan syntaxError', async () => {
  const res = await fetch(alamat + '/api/analisis', { method: 'POST', body: JSON.stringify({ dfa: 'states: q0\nxx' }) });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.syntaxError, /^baris 2/);
  assert.equal(data.dfa, null);
});

test('analisis menolak body yang bukan JSON atau tanpa field dfa', async () => {
  const res = await fetch(alamat + '/api/analisis', { method: 'POST', body: 'bukan json' });
  assert.equal(res.status, 400);
  const res2 = await fetch(alamat + '/api/analisis', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(res2.status, 400);
});

test('body lebih dari 100000 byte dijawab 413, bukan "bukan JSON"', async () => {
  const res = await fetch(alamat + '/api/analisis', {
    method: 'POST',
    body: JSON.stringify({ dfa: 'x'.repeat(120_000) }),
  });
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /terlalu besar/);
});

test('karakter multibyte utuh walau terbelah di batas potongan data', async () => {
  const nama = 'qδΣ';
  const badan = Buffer.from(JSON.stringify({ dfa: `states: ${nama}\nalphabet:\nstart: ${nama}\naccept:\n` }));
  // Belah tepat di tengah byte 'δ' (2 byte): potongan pertama berakhir dengan setengah karakter.
  const titik = badan.indexOf(Buffer.from('δ')) + 1;
  const data = await new Promise((resolve, reject) => {
    const req = http.request(
      alamat + '/api/analisis',
      { method: 'POST', headers: { 'Content-Length': badan.length } },
      (res) => {
        let isi = '';
        res.on('data', (b) => (isi += b));
        res.on('end', () => resolve(JSON.parse(isi)));
      }
    );
    req.on('error', reject);
    req.write(badan.subarray(0, titik));
    setTimeout(() => req.end(badan.subarray(titik)), 50); // potongan kedua datang terpisah
  });
  assert.equal(data.syntaxError, null);
  assert.deepEqual(data.dfa.states, [nama]);
});
