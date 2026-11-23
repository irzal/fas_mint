// Tes konversi NFA -> DFA, konstruksi subset (sub tahap 6d).
// Acuan: spesifikasi-fa.md bagian 9.1.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFa } = require('../src/parser');
const { validateDfa, warnDfa, validateNfa } = require('../src/validator');
const { simulate, simulateNfa } = require('../src/simulator');
const { nfaToDfa, namaHimpunan } = require('../src/converter');

const nfaDari = (teks) => {
  const h = parseFa(teks, 'fa');
  assert.equal(h.type, 'NFA');
  assert.deepEqual(validateNfa(h.automaton), []);
  return h.automaton;
};

const berakhiran01 = nfaDari(
  'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 0 -> {q0, q1}\nq0 1 -> q0\nq1 1 -> q2\n'
);

// ---------- contoh buku teks ----------

test('berakhiran 01: tabel langkah demi langkah sama dengan pengerjaan di kertas', () => {
  const h = nfaToDfa(berakhiran01);
  assert.deepEqual(h.start, { states: ['q0'], epsilonEdges: [], name: '[q0]' });
  assert.deepEqual(
    h.steps.map((s) => [s.fromName, s.symbol, s.moved, s.toName, s.isNew]),
    [
      ['[q0]', '0', ['q0', 'q1'], '[q0,q1]', true],
      ['[q0]', '1', ['q0'], '[q0]', false],
      ['[q0,q1]', '0', ['q0', 'q1'], '[q0,q1]', false],
      ['[q0,q1]', '1', ['q0', 'q2'], '[q0,q2]', true],
      ['[q0,q2]', '0', ['q0', 'q1'], '[q0,q1]', false],
      ['[q0,q2]', '1', ['q0'], '[q0]', false],
    ]
  );
  assert.equal(h.usesEpsilon, false);
});

test('berakhiran 01: tabel transisi subset (ringkasan) dengan tanda awal dan akhir', () => {
  const t = nfaToDfa(berakhiran01).table;
  assert.deepEqual(
    t.map((r) => [r.name, r.isStart, r.isAccept, r.transitions.map((x) => x.toName)]),
    [
      ['[q0]', true, false, ['[q0,q1]', '[q0]']],
      ['[q0,q1]', false, false, ['[q0,q1]', '[q0,q2]']],
      ['[q0,q2]', false, true, ['[q0,q1]', '[q0]']],
    ]
  );
});

test('berakhiran 01: teks .fa hasil konversi', () => {
  assert.equal(
    nfaToDfa(berakhiran01).text,
    'type: DFA\n' +
      '# hasil konversi NFA -> DFA (konstruksi subset)\n' +
      'states: [q0] [q0,q1] [q0,q2]\n' +
      'alphabet: 0 1\n' +
      'start: [q0]\n' +
      'accept: [q0,q2]\n' +
      '\n' +
      '[q0] 0 -> [q0,q1]\n' +
      '[q0] 1 -> [q0]\n' +
      '[q0,q1] 0 -> [q0,q1]\n' +
      '[q0,q1] 1 -> [q0,q2]\n' +
      '[q0,q2] 0 -> [q0,q1]\n' +
      '[q0,q2] 1 -> [q0]\n'
  );
});

test('hanya himpunan terjangkau yang dibuat (3 state, bukan 2³ = 8)', () => {
  assert.equal(nfaToDfa(berakhiran01).table.length, 3);
});

test('objek dfa sama dengan hasil parse teksnya, valid, tanpa state tak terjangkau', () => {
  const h = nfaToDfa(berakhiran01);
  const ulang = parseFa(h.text, 'fa');
  assert.equal(ulang.type, 'DFA');
  assert.deepEqual(h.dfa, ulang.automaton);
  assert.deepEqual(validateDfa(h.dfa), []);
  assert.deepEqual(warnDfa(h.dfa), []);
});

// ---------- ε dan dead state ----------

test('ε: state awal DFA adalah ε-closure({q₀}), kolom ε-closure terpisah', () => {
  const a = nfaDari('states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\nq0 ε -> q1\nq1 0 -> q2\nq2 eps -> q0\n');
  const h = nfaToDfa(a);
  assert.equal(h.usesEpsilon, true);
  assert.deepEqual(h.start, { states: ['q0', 'q1'], epsilonEdges: [{ from: 'q0', to: 'q1' }], name: '[q0,q1]' });
  const pertama = h.steps[0];
  assert.deepEqual([pertama.symbol, pertama.moved, pertama.to, pertama.toName], ['0', ['q2'], ['q0', 'q1', 'q2'], '[q0,q1,q2]']);
  assert.deepEqual(pertama.epsilonEdges, [{ from: 'q0', to: 'q1' }, { from: 'q2', to: 'q0' }]);
});

test('himpunan kosong menjadi dead state [] yang kembali ke dirinya sendiri', () => {
  const a = nfaDari('states: q0 q1\nalphabet: 0 1\nstart: q0\naccept: q1\nq0 0 -> q1\n');
  const h = nfaToDfa(a);
  assert.deepEqual(h.dfa.states, ['[q0]', '[q1]', '[]']);
  const mati = h.table.find((r) => r.name === '[]');
  assert.deepEqual(mati.transitions, [{ symbol: '0', toName: '[]' }, { symbol: '1', toName: '[]' }]);
  assert.equal(mati.isAccept, false);
});

test('[] tidak muncul jika tidak ada langkah yang hasilnya kosong', () => {
  assert.ok(!nfaToDfa(berakhiran01).dfa.states.includes('[]'));
});

test('ε-transisi tanpa tujuan ({}) tidak dihitung sebagai pemakaian ε', () => {
  const a = nfaDari('states: q0\nalphabet: 0\nstart: q0\naccept:\nq0 ε -> {}\nq0 0 -> q0\n');
  assert.equal(nfaToDfa(a).usesEpsilon, false);
});

// ---------- nama state ----------

test('namaHimpunan: kurung siku, koma tanpa spasi; himpunan kosong []', () => {
  assert.equal(namaHimpunan(['q0', 'q2']), '[q0,q2]');
  assert.equal(namaHimpunan([]), '[]');
});

test('nama mengikuti urutan states: NFA (q2 sebelum q10)', () => {
  const a = nfaDari('states: q2 q10\nalphabet: 0\nstart: q2\naccept:\nq2 0 -> {q10, q2}\nq10 0 -> q10\n');
  assert.deepEqual(nfaToDfa(a).dfa.states, ['[q2]', '[q2,q10]']);
});

test('tabrakan nama dilaporkan sebagai error', () => {
  // {'[a', 'b]'} dan {'[a,b]'} sama-sama bernama '[[a,b]]'
  const a = nfaDari('states: s [a b] [a,b]\nalphabet: 0 1\nstart: s\naccept:\ns 0 -> [a\ns 0 -> b]\ns 1 -> [a,b]\n');
  assert.throws(() => nfaToDfa(a), /konversi gagal: himpunan \{\[a, b\]\} dan \{\[a,b\]\} sama-sama bernama '\[\[a,b\]\]'/);
});

test('NFA hasil konversi sebelumnya (nama berkurung siku) bisa dikonversi lagi', () => {
  const dfa = nfaToDfa(berakhiran01).dfa;
  const teks = nfaToDfa(berakhiran01).text.replace('type: DFA', 'type: NFA');
  const h = nfaToDfa(parseFa(teks, 'fa').automaton);
  assert.deepEqual(h.dfa.states, dfa.states.map((s) => `[${s}]`));
});

// ---------- kasus tepi ----------

test('alfabet kosong: DFA hanya berisi state awal, tanpa transisi', () => {
  const a = nfaDari('states: q0 q1\nalphabet:\nstart: q0\naccept: q1\nq0 ε -> q1\n');
  const h = nfaToDfa(a);
  assert.deepEqual(h.steps, []);
  assert.equal(h.text, 'type: DFA\n# hasil konversi NFA -> DFA (konstruksi subset)\nstates: [q0,q1]\nalphabet:\nstart: [q0,q1]\naccept: [q0,q1]\n');
  assert.deepEqual(validateDfa(h.dfa), []);
});

test('F kosong: DFA tanpa state akhir (baris accept: kosong)', () => {
  const a = nfaDari('states: q0\nalphabet: 0 1\nstart: q0\naccept:\n');
  const h = nfaToDfa(a);
  assert.deepEqual(h.dfa.accept, []);
  assert.deepEqual(h.dfa.states, ['[q0]', '[]']);
  assert.deepEqual(validateDfa(h.dfa), []);
});

test('nfaToDfa tidak mengubah objek NFA', () => {
  const salinan = JSON.parse(JSON.stringify(berakhiran01));
  nfaToDfa(berakhiran01);
  assert.deepEqual(berakhiran01, salinan);
});

// ---------- uji sifat: bahasa yang diterima sama ----------

// Pembangkit acak sederhana yang bisa diulang (hasil selalu sama).
function acak(benih) {
  let x = benih;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function semuaString(alfabet, panjangMaks) {
  const hasil = [''];
  let lapis = [''];
  for (let n = 1; n <= panjangMaks; n++) {
    lapis = lapis.flatMap((s) => alfabet.map((a) => s + a));
    hasil.push(...lapis);
  }
  return hasil;
}

test('NFA acak (dengan ε): DFA hasil konversi valid dan menerima bahasa yang sama', () => {
  const r = acak(42);
  const pilih = (daftar) => daftar[Math.floor(r() * daftar.length)];
  for (let n = 0; n < 200; n++) {
    const jumlahState = 1 + Math.floor(r() * 4);
    const Q = Array.from({ length: jumlahState }, (_, i) => `q${i}`);
    const baris = [];
    for (const q of Q) {
      for (const a of ['0', '1', 'ε']) {
        const tujuan = Q.filter(() => r() < 0.35);
        if (tujuan.length > 0 || r() < 0.2) baris.push(`${q} ${a} -> {${tujuan.join(', ')}}`);
      }
    }
    const F = Q.filter(() => r() < 0.4);
    const teks = `states: ${Q.join(' ')}\nalphabet: 0 1\nstart: ${pilih(Q)}\naccept: ${F.join(' ')}\n${baris.join('\n')}\n`;
    const nfa = nfaDari(teks);
    const h = nfaToDfa(nfa);
    assert.deepEqual(validateDfa(h.dfa), [], teks);
    assert.ok(h.dfa.states.length <= 2 ** jumlahState, teks);
    for (const input of semuaString(['0', '1'], 6)) {
      assert.equal(simulate(h.dfa, input).accepted, simulateNfa(nfa, input).accepted, `${teks}\ninput '${input}'`);
    }
  }
});
