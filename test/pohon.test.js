// Tes pohon komputasi NFA (tampilan tambahan, spesifikasi bagian 8.6).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFa } = require('../src/parser');
const { simulateNfa, pohonKomputasi } = require('../src/simulator');
const { jalankanFa } = require('../src/fas');
const { teksPohon } = require('../public/animasi');
const { main } = require('../src/cli');

const nfaDari = (teks) => parseFa(teks, 'fa').automaton;
const b01 = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n');
const eps = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 ε -> q1\nq1 0 -> q2\nq2 eps -> q0\n');

// Semua simpul pohon (penelusuran mendalam).
function semuaSimpul(s) {
  return [s, ...s.anak.flatMap(semuaSimpul)];
}

test('berakhiran 01, input 001: cabang diterima, ditolak, dan mati', () => {
  assert.deepEqual(teksPohon(pohonKomputasi(b01, '001'), '001'), [
    'q0',
    '├─0→ q0',
    '│   ├─0→ q0',
    '│   │   └─1→ q0  ✖ ditolak (q0 ∉ F)',
    '│   └─0→ q1',
    '│       └─1→ q2  ✔ diterima (q2 ∈ F)',
    '└─0→ q1  ✖ mati: δ(q1, 0) = ∅',
  ]);
  assert.equal(pohonKomputasi(b01, '001').jumlahSimpul, 7);
});

test('langkah ε tampil sebagai cabang ε; siklus ε berhenti', () => {
  assert.deepEqual(teksPohon(pohonKomputasi(eps, '0'), '0'), [
    'q0',
    '└─ε→ q1',
    '    └─0→ q2  ✔ diterima (q2 ∈ F)',
    '        └─ε→ q0  ✖ ditolak (q0 ∉ F)',
    '            └─ε→ q1  ✖ ditolak (q1 ∉ F)',
  ]);
  const siklus = nfaDari('states: a b\nalphabet: 0\nstart: a\naccept:\na ε -> b\nb ε -> a\n');
  const p = pohonKomputasi(siklus, '');
  assert.equal(p.terlaluBesar, false);
  assert.deepEqual(semuaSimpul(p.root).map((s) => s.state), ['a', 'b']);
});

test('input kosong: akar adalah satu-satunya simpul jika tanpa ε', () => {
  const p = pohonKomputasi(b01, '');
  assert.deepEqual(teksPohon(p, ''), ['q0  ✖ ditolak (q0 ∉ F)']);
});

test('pohon terlalu besar: root null dan terlaluBesar true', () => {
  // Setiap simbol menggandakan jalan: 2^n simpul.
  const ganda = nfaDari('states: a b\nalphabet: 0\nstart: a\naccept: b\na 0 -> {a, b}\nb 0 -> {a, b}\n');
  const p = pohonKomputasi(ganda, '0'.repeat(10));
  assert.equal(p.terlaluBesar, true);
  assert.equal(p.root, null);
  assert.equal(p.maksSimpul, 200);
  assert.equal(pohonKomputasi(ganda, '0'.repeat(3)).terlaluBesar, false);
  assert.equal(pohonKomputasi(ganda, '0'.repeat(3), { maksSimpul: 5 }).terlaluBesar, true);
});

function acak(benih) {
  let x = benih;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

test('NFA acak (dengan ε): diterima jika dan hanya jika ada cabang diterima; ujung pohon = himpunan terakhir', () => {
  const r = acak(7);
  let dicoba = 0;
  for (let n = 0; n < 150; n++) {
    const Q = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => `q${i}`);
    const baris = [];
    for (const q of Q) for (const a of ['0', '1', 'ε']) {
      const tujuan = Q.filter(() => r() < 0.4);
      if (tujuan.length > 0) baris.push(`${q} ${a} -> {${tujuan.join(', ')}}`);
    }
    const teks = `states: ${Q.join(' ')}\nalphabet: 0 1\nstart: q0\naccept: ${Q.filter(() => r() < 0.4).join(' ')}\n${baris.join('\n')}\n`;
    const nfa = nfaDari(teks);
    for (const input of ['', '0', '1', '01', '110', '0101']) {
      const p = pohonKomputasi(nfa, input);
      if (p.terlaluBesar) continue;
      dicoba++;
      const simpul = semuaSimpul(p.root);
      const h = simulateNfa(nfa, input);
      assert.equal(simpul.some((s) => s.akhir === 'diterima'), h.accepted, `${teks}\n'${input}'`);
      // State di simpul yang sudah membaca seluruh input = himpunan terakhir.
      const akhir = [...new Set(simpul.filter((s) => s.dibaca === [...input].length).map((s) => s.state))].sort();
      assert.deepEqual(akhir, [...h.finalStates].sort(), `${teks}\n'${input}'`);
    }
  }
  assert.ok(dicoba > 500);
});

test('jalankanFa: tree untuk NFA, null untuk DFA', () => {
  const nfa = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'nfa-berakhiran-01.fa'), 'utf8');
  assert.equal(jalankanFa(nfa, 'fa', '01').tree.root.state, 'q0');
  const dfa = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  assert.equal(jalankanFa(dfa, 'dfa', '01').tree, null);
});

test('CLI --pohon mencetak pohon untuk NFA; argumen asing ditolak', () => {
  const out = [];
  const kode = main([path.join(__dirname, '..', 'contoh', 'nfa-berakhiran-01.fa'), '01', '--pohon'], { out: (t) => out.push(t), err: () => {} });
  assert.equal(kode, 0);
  assert.deepEqual(out.slice(out.indexOf('Pohon komputasi:')), [
    'Pohon komputasi:',
    '  q0',
    '  ├─0→ q0',
    '  │   └─1→ q0  ✖ ditolak (q0 ∉ F)',
    '  └─0→ q1',
    '      └─1→ q2  ✔ diterima (q2 ∈ F)',
  ]);
  const salah = [];
  assert.equal(main(['a.fa', '01', '--asing'], { out: (t) => salah.push(t), err: () => {} }), 1);
  assert.equal(salah[0], 'Pemakaian:');
  // --pohon pada DFA tidak mencetak apa-apa tambahan
  const d = [];
  main([path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), '01', '--pohon'], { out: (t) => d.push(t), err: () => {} });
  assert.equal(d.at(-1), 'Hasil: DITERIMA (berhenti di q2)');
});
