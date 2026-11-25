// Tes model graf dan tata letak (public/graf.js). Murni logika, tanpa browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDfa } = require('../src/parser');
const { buatGraf, hitungTataLetak, TATA_LETAK, DAFTAR_TATA_LETAK } = require('../public/graf');

const contoh = parseDfa(fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8'));

const tr = (from, symbol, to) => ({ from, symbol, to, line: 1 });
const dfaDari = (states, start, transitions, accept = []) => ({
  states, alphabet: ['a', 'b'], start, accept, transitions,
});

test('node: penanda awal, akhir, dan lapis dari berakhiran-01', () => {
  const { nodes } = buatGraf(contoh);
  assert.deepEqual(
    nodes.map((n) => [n.id, n.awal, n.akhir, n.terjangkau, n.lapis]),
    [
      ['q0', true, false, true, 0],
      ['q1', false, false, true, 1],
      ['q2', false, true, true, 2],
    ]
  );
});

test('sisi: satu per pasangan (asal, tujuan), loop dan bolak-balik ditandai', () => {
  const { edges } = buatGraf(contoh);
  const ringkas = edges.map((e) => `${e.from}>${e.to}:${e.symbols.join(',')}${e.loop ? ' loop' : ''}${e.bolakBalik ? ' pp' : ''}`);
  assert.deepEqual(ringkas, [
    'q0>q1:0',
    'q0>q0:1 loop',
    'q1>q1:0 loop',
    'q1>q2:1 pp', // q2 -> q1 ada
    'q2>q1:0 pp',
    'q2>q0:1',
  ]);
});

test('beberapa simbol pada pasangan yang sama digabung, tanpa duplikat', () => {
  const dfa = dfaDari(['x', 'y'], 'x', [tr('x', 'a', 'y'), tr('x', 'b', 'y'), tr('x', 'a', 'y'), tr('y', 'a', 'y'), tr('y', 'b', 'x')]);
  const { edges } = buatGraf(dfa);
  assert.equal(edges.length, 3);
  assert.deepEqual(edges[0].symbols, ['a', 'b']);
});

test('state tak terjangkau: lapis null dan terjangkau false', () => {
  const dfa = dfaDari(['s', 'z', 'y'], 's', [tr('s', 'a', 's'), tr('z', 'a', 'y'), tr('y', 'a', 'z')]);
  const { nodes } = buatGraf(dfa);
  assert.deepEqual(nodes.map((n) => [n.id, n.lapis]), [['s', 0], ['z', null], ['y', null]]);
  assert.deepEqual(nodes.filter((n) => !n.terjangkau).map((n) => n.id), ['z', 'y']);
});

test('lapis = jarak terpendek, bukan jarak pertama yang ditemui', () => {
  // s -> a -> b -> c, tetapi juga s -> c langsung: c ada di lapis 1.
  const dfa = dfaDari(['s', 'a', 'b', 'c'], 's', [tr('s', 'a', 'a'), tr('a', 'a', 'b'), tr('b', 'a', 'c'), tr('s', 'b', 'c')]);
  const lapis = Object.fromEntries(buatGraf(dfa).nodes.map((n) => [n.id, n.lapis]));
  assert.deepEqual(lapis, { s: 0, a: 1, b: 2, c: 1 });
});

test('buatGraf toleran pada DFA belum valid: transisi ke state asing dilewati, duplikat Q digabung', () => {
  const dfa = dfaDari(['q0', 'q0', 'q1'], 'q0', [tr('q0', 'a', 'q1'), tr('q0', 'b', 'q9'), tr('q7', 'a', 'q0')]);
  const graf = buatGraf(dfa);
  assert.deepEqual(graf.nodes.map((n) => n.id), ['q0', 'q1']);
  assert.equal(graf.edges.length, 1);
});

test('state awal yang tidak ada di Q: tidak ada yang terjangkau, tidak melempar', () => {
  const graf = buatGraf(dfaDari(['q0'], 'zz', [tr('q0', 'a', 'q0')]));
  assert.deepEqual(graf.nodes.map((n) => [n.awal, n.terjangkau]), [[false, false]]);
});

test('nama state aneh ("__proto__", "constructor") tidak merusak peta', () => {
  const dfa = dfaDari(['__proto__', 'constructor'], '__proto__', [tr('__proto__', 'a', 'constructor'), tr('constructor', 'a', '__proto__')]);
  const graf = buatGraf(dfa);
  assert.equal(graf.edges.length, 2);
  assert.ok(hitungTataLetak(graf).posisi.has('__proto__'));
});

test('berlapis: berakhiran-01 menjadi tiga kolom kiri ke kanan', () => {
  const { posisi, lebar, tinggi } = hitungTataLetak(buatGraf(contoh), 'berlapis');
  const xs = ['q0', 'q1', 'q2'].map((id) => posisi.get(id).x);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
  assert.equal(new Set(['q0', 'q1', 'q2'].map((id) => posisi.get(id).y)).size, 1); // satu baris
  assert.ok(lebar > xs[2] && tinggi > 0);
});

test('berlapis: state sekolom ditumpuk ke bawah dan dipusatkan', () => {
  // s -> A, B (lapis 1) -> C (lapis 2)
  const dfa = dfaDari(['s', 'A', 'B', 'C'], 's', [tr('s', 'a', 'A'), tr('s', 'b', 'B'), tr('A', 'a', 'C'), tr('B', 'a', 'C')]);
  const { posisi } = hitungTataLetak(buatGraf(dfa), 'berlapis');
  assert.equal(posisi.get('A').x, posisi.get('B').x);
  assert.ok(posisi.get('A').y < posisi.get('B').y);
  assert.equal(posisi.get('s').y, (posisi.get('A').y + posisi.get('B').y) / 2); // dipusatkan
  assert.equal(posisi.get('C').y, posisi.get('s').y);
});

test('berlapis: state tak terjangkau di kolom tersendiri paling kanan', () => {
  const dfa = dfaDari(['s', 'z'], 's', [tr('s', 'a', 's'), tr('z', 'a', 'z')]);
  const { posisi } = hitungTataLetak(buatGraf(dfa), 'berlapis');
  assert.ok(posisi.get('z').x > posisi.get('s').x);
});

test('melingkar: state awal paling kiri, searah jarum jam, semua berjarak sama dari pusat', () => {
  const dfa = dfaDari(['a', 'b', 'c', 'd', 'e'], 'a', [
    tr('a', 'a', 'b'), tr('b', 'a', 'c'), tr('c', 'a', 'd'), tr('d', 'a', 'e'), tr('e', 'a', 'a'),
  ]);
  const { posisi, lebar, tinggi } = hitungTataLetak(buatGraf(dfa), 'melingkar');
  const pusat = { x: lebar / 2, y: tinggi / 2 };
  assert.equal(posisi.get('a').y, pusat.y);
  assert.ok(posisi.get('a').x < pusat.x); // paling kiri (sumbu x negatif)
  for (const id of ['b', 'c', 'd', 'e']) assert.ok(posisi.get('a').x < posisi.get(id).x);
  assert.ok(posisi.get('b').y < pusat.y); // berikutnya naik ke atas (searah jarum jam)
  const jarak = (p) => Math.hypot(p.x - pusat.x, p.y - pusat.y);
  const j0 = jarak(posisi.get('a'));
  for (const id of ['b', 'c', 'd', 'e']) assert.ok(Math.abs(jarak(posisi.get(id)) - j0) < 0.1);
});

test('melingkar: satu state ada di tengah', () => {
  const { posisi, lebar, tinggi } = hitungTataLetak(buatGraf(dfaDari(['s'], 's', [tr('s', 'a', 's')])), 'melingkar');
  assert.deepEqual(posisi.get('s'), { x: lebar / 2, y: tinggi / 2 });
});

test('graf kosong tidak melempar di semua tata letak', () => {
  const kosong = buatGraf({ states: [], alphabet: [], start: '', accept: [], transitions: [] });
  for (const nama of Object.keys(TATA_LETAK)) {
    const { posisi, lebar, tinggi } = hitungTataLetak(kosong, nama);
    assert.equal(posisi.size, 0, nama);
    assert.ok(lebar > 0 && tinggi > 0, nama);
  }
});

test('tata letak tidak dikenal melempar error; bawaan adalah berlapis', () => {
  const graf = buatGraf(contoh);
  assert.throws(() => hitungTataLetak(graf, 'bintang'), /tata letak 'bintang' tidak dikenal/);
  assert.throws(() => hitungTataLetak(graf, 'toString'), /tidak dikenal/);
  assert.deepEqual(hitungTataLetak(graf).posisi, hitungTataLetak(graf, 'berlapis').posisi);
});

test('DAFTAR_TATA_LETAK cocok dengan TATA_LETAK, bawaan di urutan pertama', () => {
  assert.deepEqual(DAFTAR_TATA_LETAK.map((t) => t.nama).sort(), Object.keys(TATA_LETAK).sort());
  assert.equal(DAFTAR_TATA_LETAK[0].nama, 'berlapis');
});

// Sifat umum untuk semua tata letak pada DFA acak: tiap node punya posisi, semua
// di dalam kanvas (dengan ruang untuk loop), dan tidak ada dua node bertumpuk.
test('semua tata letak: posisi lengkap, di dalam kanvas, tidak bertumpuk (200 DFA acak)', () => {
  let x = 7;
  const rnd = (n) => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) % n);
  for (let kasus = 0; kasus < 200; kasus++) {
    const jumlah = 1 + rnd(12);
    const states = Array.from({ length: jumlah }, (_, i) => `s${i}`);
    const transitions = [];
    for (const s of states) for (const a of ['a', 'b']) if (rnd(4) > 0) transitions.push(tr(s, a, states[rnd(jumlah)]));
    const graf = buatGraf(dfaDari(states, states[rnd(jumlah)], transitions));
    for (const nama of Object.keys(TATA_LETAK)) {
      const { posisi, lebar, tinggi } = hitungTataLetak(graf, nama);
      assert.equal(posisi.size, jumlah, `${nama} kasus ${kasus}`);
      const titik = [...posisi.values()];
      for (const p of titik) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.x >= 0 && p.x <= lebar && p.y >= 0 && p.y <= tinggi, `${nama} di luar kanvas`);
      }
      for (let i = 0; i < titik.length; i++) {
        for (let j = i + 1; j < titik.length; j++) {
          assert.ok(Math.hypot(titik[i].x - titik[j].x, titik[i].y - titik[j].y) >= 60, `${nama} bertumpuk, kasus ${kasus}`);
        }
      }
    }
  }
});

// ---------- posisi hasil geser (sub tahap 5f) ----------

const { terapkanGeser } = require('../public/graf');

test('terapkanGeser: posisi geser menimpa bawaan, state lain tetap', () => {
  const graf = buatGraf(contoh);
  const bawaan = hitungTataLetak(graf, 'berlapis');
  const hasil = terapkanGeser(bawaan, new Map([['q1', { x: 5, y: 7 }]]));
  assert.deepEqual(hasil.posisi.get('q1'), { x: 5, y: 7 });
  assert.deepEqual(hasil.posisi.get('q0'), bawaan.posisi.get('q0'));
  assert.deepEqual(hasil.posisi.get('q2'), bawaan.posisi.get('q2'));
  assert.equal(hasil.lebar, bawaan.lebar);
});

test('terapkanGeser: nama yang tidak ada di Q diabaikan', () => {
  const bawaan = hitungTataLetak(buatGraf(contoh), 'berlapis');
  const hasil = terapkanGeser(bawaan, new Map([['qHilang', { x: 1, y: 1 }]]));
  assert.deepEqual([...hasil.posisi.keys()], ['q0', 'q1', 'q2']);
});

test('terapkanGeser: objek asli (tata letak dan geser) tidak berubah', () => {
  const bawaan = hitungTataLetak(buatGraf(contoh), 'melingkar');
  const salinan = new Map([...bawaan.posisi].map(([k, v]) => [k, { ...v }]));
  const geser = new Map([['q0', { x: 1, y: 2 }]]);
  const hasil = terapkanGeser(bawaan, geser);
  hasil.posisi.get('q0').x = 999;
  assert.deepEqual(bawaan.posisi, salinan);
  assert.deepEqual(geser.get('q0'), { x: 1, y: 2 });
});

test('terapkanGeser: geser kosong dan Q kosong', () => {
  const bawaan = hitungTataLetak(buatGraf(contoh), 'berlapis');
  assert.deepEqual(terapkanGeser(bawaan, new Map()).posisi, bawaan.posisi);
  const kosong = hitungTataLetak(buatGraf(dfaDari([], '', [])), 'berlapis');
  assert.equal(terapkanGeser(kosong, new Map([['q0', { x: 1, y: 1 }]])).posisi.size, 0);
});

// ---------- NFA (sub tahap 6h) ----------

test('buatGraf NFA: satu panah per tujuan, label simbol digabung, ε sebagai label', () => {
  const nfa = {
    states: ['q0', 'q1', 'q2'],
    alphabet: ['0'],
    start: 'q0',
    accept: ['q2'],
    transitions: [
      { from: 'q0', symbol: '0', to: ['q0', 'q1'], line: 5 },
      { from: 'q0', symbol: 'ε', to: ['q1'], line: 6 },
      { from: 'q1', symbol: '0', to: [], line: 7 },
      { from: 'q1', symbol: '0', to: ['q2', 'qx'], line: 8 },
    ],
  };
  const { nodes, edges } = buatGraf(nfa);
  assert.deepEqual(
    edges.map((e) => `${e.from}>${e.to}:${e.symbols.join(',')}${e.loop ? ' loop' : ''}`),
    ['q0>q0:0 loop', 'q0>q1:0,ε', 'q1>q2:0']
  );
  assert.deepEqual(nodes.map((n) => [n.id, n.terjangkau]), [['q0', true], ['q1', true], ['q2', true]]);
});
