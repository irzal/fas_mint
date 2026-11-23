// Tes simulator NFA (sub tahap 6c). Acuan: spesifikasi-fa.md bagian 8.6.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFa, parseDfa } = require('../src/parser');
const { simulate, simulateNfa, epsilonClosure, move } = require('../src/simulator');

const nfaDari = (teks) => {
  const h = parseFa(teks, 'fa');
  assert.equal(h.type, 'NFA');
  return h.automaton;
};

// Contoh spesifikasi 8.2: string biner berakhiran 01.
const berakhiran01 = nfaDari(
  'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n'
);

// NFA dengan ε: q0 -ε-> q1, q1 -0-> q2, q2 -ε-> q0. F = {q2}.
const denganEpsilon = nfaDari(
  'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 ε -> q1\nq1 0 -> q2\nq2 eps -> q0\n'
);

// ---------- contoh tanpa ε ----------

test('berakhiran 01, input 001: jejak himpunan per langkah dan DITERIMA', () => {
  const h = simulateNfa(berakhiran01, '001');
  assert.equal(h.accepted, true);
  assert.deepEqual(h.start, { states: ['q0'], epsilonEdges: [] });
  assert.deepEqual(
    h.steps.map((s) => [s.from, s.symbol, s.moved, s.to]),
    [
      [['q0'], '0', ['q0', 'q1'], ['q0', 'q1']],
      [['q0', 'q1'], '0', ['q0', 'q1'], ['q0', 'q1']],
      [['q0', 'q1'], '1', ['q0', 'q2'], ['q0', 'q2']],
    ]
  );
  assert.deepEqual(h.finalStates, ['q0', 'q2']);
});

test('panah δ yang dipakai dicatat per langkah', () => {
  const h = simulateNfa(berakhiran01, '01');
  assert.deepEqual(h.steps[1].edges, [
    { from: 'q0', symbol: '1', to: 'q0' },
    { from: 'q1', symbol: '1', to: 'q2' },
  ]);
  // tanpa ε-transisi: moved sama dengan to, epsilonEdges kosong
  for (const s of h.steps) {
    assert.deepEqual(s.moved, s.to);
    assert.deepEqual(s.epsilonEdges, []);
  }
});

test('berakhiran 01: input yang ditolak', () => {
  for (const input of ['0', '1', '00', '010', '0110']) {
    assert.equal(simulateNfa(berakhiran01, input).accepted, false, input);
  }
});

// ---------- ε-closure ----------

test('ε-closure: langkah ke-0 dan setiap langkah memisahkan moved dan to', () => {
  const h = simulateNfa(denganEpsilon, '0');
  assert.deepEqual(h.start, { states: ['q0', 'q1'], epsilonEdges: [{ from: 'q0', to: 'q1' }] });
  assert.deepEqual(h.steps[0].moved, ['q2']);
  assert.deepEqual(h.steps[0].edges, [{ from: 'q1', symbol: '0', to: 'q2' }]);
  // ε-closure({q2}) = {q2, q0, q1}, ditulis menurut urutan states:
  assert.deepEqual(h.steps[0].to, ['q0', 'q1', 'q2']);
  assert.deepEqual(h.steps[0].epsilonEdges, [
    { from: 'q0', to: 'q1' },
    { from: 'q2', to: 'q0' },
  ]);
  assert.equal(h.accepted, true);
});

test('ε-closure dengan siklus ε berhenti dan memuat semua state di siklus', () => {
  const a = nfaDari('states: a b c\nalphabet: 0\nstart: a\naccept:\na ε -> b\nb ε -> c\nc ε -> a\n');
  assert.deepEqual(epsilonClosure(a, ['b']).states, ['a', 'b', 'c']);
});

test('input kosong ε: diterima jika ε-closure({q₀}) memuat state akhir', () => {
  const a = nfaDari('states: q0 q1\nalphabet: 0\nstart: q0\naccept: q1\nq0 ε -> q1\n');
  const h = simulateNfa(a, '');
  assert.deepEqual(h.steps, []);
  assert.deepEqual(h.finalStates, ['q0', 'q1']);
  assert.equal(h.accepted, true);
  assert.equal(simulateNfa(berakhiran01, '').accepted, false);
});

// ---------- himpunan kosong dan error ----------

test('himpunan menjadi kosong: sisa input tetap dibaca, lalu DITOLAK', () => {
  // q1 tidak punya transisi 0, q2 tidak punya transisi sama sekali
  const a = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 1 -> q1\nq1 1 -> q2\n');
  const h = simulateNfa(a, '1001');
  assert.equal(h.steps.length, 4);
  assert.deepEqual(h.steps.map((s) => s.to), [['q1'], [], [], []]);
  assert.deepEqual(h.steps[2], { from: [], symbol: '0', moved: [], edges: [], to: [], epsilonEdges: [] });
  assert.deepEqual(h.finalStates, []);
  assert.equal(h.accepted, false);
});

test('simbol input di luar Σ: error dengan posisi, sama dengan DFA', () => {
  assert.throws(() => simulateNfa(berakhiran01, '01x1'), (err) => {
    assert.equal(err.message, "simbol 'x' pada posisi 3 tidak ada di Σ");
    assert.equal(err.position, 3);
    return true;
  });
  // karakter ε di input bukan anggota Σ
  assert.throws(() => simulateNfa(denganEpsilon, '0ε'), /simbol 'ε' pada posisi 2/);
});

// ---------- urutan, tujuan ganda, objek tidak berubah ----------

test('himpunan diurutkan menurut states:, bukan urutan tulisan transisi', () => {
  const a = nfaDari('states: q0 q1 q2\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> {q2, q0}\nq0 0 -> q1\n');
  const h = simulateNfa(a, '0');
  assert.deepEqual(h.steps[0].to, ['q0', 'q1', 'q2']);
  assert.deepEqual(h.steps[0].edges.map((e) => e.to), ['q0', 'q1', 'q2']);
});

test('tujuan ganda dihitung sekali (tidak ada panah ganda)', () => {
  const a = nfaDari('states: q0 q1\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> q1\nq0 0 -> {q1, q1}\n');
  assert.deepEqual(simulateNfa(a, '0').steps[0].edges, [{ from: 'q0', symbol: '0', to: 'q1' }]);
});

test('simulateNfa tidak mengubah objek NFA', () => {
  const salinan = JSON.parse(JSON.stringify(denganEpsilon));
  simulateNfa(denganEpsilon, '000');
  assert.deepEqual(denganEpsilon, salinan);
});

// ---------- fungsi pembantu yang dipakai konversi (6d) ----------

test('move tanpa ε-closure; simbol tanpa transisi menghasilkan ∅', () => {
  assert.deepEqual(move(denganEpsilon, ['q0'], '0'), { states: [], edges: [] });
  assert.deepEqual(move(denganEpsilon, ['q0', 'q1'], '0').states, ['q2']);
  assert.deepEqual(move(berakhiran01, [], '0'), { states: [], edges: [] });
});

test('epsilonClosure dari himpunan kosong adalah himpunan kosong', () => {
  assert.deepEqual(epsilonClosure(denganEpsilon, []), { states: [], epsilonEdges: [] });
});

// ---------- kasus tepi ----------

test('dokumen awal web (satu state, tanpa transisi, F kosong) selalu menolak', () => {
  const a = nfaDari('states: q0\nalphabet: 0 1\nstart: q0\naccept:\n');
  assert.equal(simulateNfa(a, '').accepted, false);
  const h = simulateNfa(a, '01');
  assert.equal(h.accepted, false);
  assert.deepEqual(h.steps.map((s) => s.to), [[], []]);
});

test('alfabet kosong: hanya input kosong yang bisa dijalankan', () => {
  const a = nfaDari('states: q0 q1\nalphabet:\nstart: q0\naccept: q1\nq0 ε -> q1\n');
  assert.equal(simulateNfa(a, '').accepted, true);
  assert.throws(() => simulateNfa(a, '0'), /tidak ada di Σ/);
});

test('DFA yang dibaca sebagai NFA memberi hasil sama dengan simulator DFA', () => {
  const folder = path.join(__dirname, '..', 'contoh');
  const masukan = ['', '0', '1', '01', '10', '001', '0101', '1110', '00000', '101101', 'a', 'ab', 'ba', 'aab', 'abba'];
  for (const nama of ['berakhiran-01.dfa', 'jumlah-0-genap.dfa', 'kelipatan-3.dfa', 'mengandung-ab.dfa']) {
    const teks = fs.readFileSync(path.join(folder, nama), 'utf8');
    const dfa = parseDfa(teks);
    const nfa = parseFa(teks, 'fa').automaton; // tanpa type: -> NFA
    for (const input of masukan) {
      if (![...input].every((c) => dfa.alphabet.includes(c))) continue;
      const d = simulate(dfa, input);
      const n = simulateNfa(nfa, input);
      assert.equal(n.accepted, d.accepted, `${nama} '${input}'`);
      assert.deepEqual(n.finalStates, [d.finalState], `${nama} '${input}'`);
      assert.deepEqual(n.steps.map((s) => s.to), d.steps.map((s) => [s.to]), `${nama} '${input}'`);
    }
  }
});
