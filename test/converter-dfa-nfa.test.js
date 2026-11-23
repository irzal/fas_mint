// Tes konversi DFA -> NFA (sub tahap 6e). Acuan: spesifikasi-fa.md bagian 9.2.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFa, parseDfa } = require('../src/parser');
const { validateDfa, validateNfa, warnNfa } = require('../src/validator');
const { simulate, simulateNfa } = require('../src/simulator');
const { dfaToNfa, nfaToDfa, findDeadStates } = require('../src/converter');

const FOLDER = path.join(__dirname, '..', 'contoh');
const contoh = (nama) => parseDfa(fs.readFileSync(path.join(FOLDER, nama), 'utf8'));
const CONTOH_VALID = ['berakhiran-01.dfa', 'jumlah-0-genap.dfa', 'kelipatan-3.dfa', 'mengandung-ab.dfa'];

// DFA dengan dead state 'mati': menerima 0 0* saja.
const denganMati = parseDfa(
  'states: q0 q1 mati\nalphabet: 0 1\nstart: q0\naccept: q1\n' +
    'q0 0 -> q1\nq0 1 -> mati\nq1 0 -> q1\nq1 1 -> mati\nmati 0 -> mati\nmati 1 -> mati\n'
);

function semuaString(alfabet, panjangMaks) {
  const hasil = [''];
  let lapis = [''];
  for (let n = 1; n <= panjangMaks; n++) {
    lapis = lapis.flatMap((s) => alfabet.map((a) => s + a));
    hasil.push(...lapis);
  }
  return hasil;
}

// ---------- konversi dasar ----------

test('berakhiran 01: setiap tujuan ditulis {p}, Q, Σ, q₀, F tidak berubah', () => {
  const h = dfaToNfa(contoh('berakhiran-01.dfa'));
  assert.equal(
    h.text,
    'type: NFA\n# hasil konversi DFA -> NFA\nstates: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\n\n' +
      'q0 0 -> {q1}\nq0 1 -> {q0}\nq1 0 -> {q1}\nq1 1 -> {q2}\nq2 0 -> {q1}\nq2 1 -> {q0}\n'
  );
  assert.deepEqual(h.removedStates, []);
});

test('objek nfa sama dengan hasil parse teksnya, valid, tanpa peringatan', () => {
  const h = dfaToNfa(contoh('kelipatan-3.dfa'));
  const ulang = parseFa(h.text, 'fa');
  assert.equal(ulang.type, 'NFA');
  assert.deepEqual(h.nfa, ulang.automaton);
  assert.deepEqual(validateNfa(h.nfa), []);
  assert.deepEqual(warnNfa(h.nfa), []);
});

test('tabel pemetaan: satu baris per transisi DFA, urutan file', () => {
  const h = dfaToNfa(contoh('berakhiran-01.dfa'));
  assert.deepEqual(h.mapping[0], { from: 'q0', symbol: '0', dfaTo: 'q1', nfaTo: ['q1'], removed: false });
  assert.equal(h.mapping.length, 6);
  assert.ok(h.mapping.every((m) => !m.removed));
});

test('semua contoh DFA: NFA hasil konversi menerima bahasa yang sama', () => {
  for (const nama of CONTOH_VALID) {
    const dfa = contoh(nama);
    for (const opsi of [{}, { removeDeadStates: true }]) {
      const nfa = dfaToNfa(dfa, opsi).nfa;
      for (const input of semuaString(dfa.alphabet, 6)) {
        assert.equal(simulateNfa(nfa, input).accepted, simulate(dfa, input).accepted, `${nama} ${JSON.stringify(opsi)} '${input}'`);
      }
    }
  }
});

test('DFA dari file .fa ber-type: DFA juga bisa dikonversi', () => {
  const h = parseFa('type: DFA\nstates: a b\nalphabet: x\nstart: a\naccept: b\na x -> b\nb x -> a\n', 'fa');
  assert.equal(dfaToNfa(h.automaton).text.split('\n').slice(-3).join('|'), 'a x -> {b}|b x -> {a}|');
});

// ---------- buang dead state ----------

test('findDeadStates: state tanpa jalan ke state akhir', () => {
  assert.deepEqual(findDeadStates(denganMati), ['mati']);
  assert.deepEqual(findDeadStates(contoh('berakhiran-01.dfa')), []);
});

test('buang dead state: state, panah dari dan ke state itu dibuang, dengan keterangan', () => {
  const h = dfaToNfa(denganMati, { removeDeadStates: true });
  assert.deepEqual(h.removedStates, [{ state: 'mati', reason: 'dari state ini tidak ada jalan ke state akhir' }]);
  assert.deepEqual(h.nfa.states, ['q0', 'q1']);
  assert.deepEqual(
    h.nfa.transitions.map((t) => [t.from, t.symbol, t.to]),
    [['q0', '0', ['q1']], ['q1', '0', ['q1']]]
  );
  assert.deepEqual(
    h.mapping.map((m) => [m.from, m.symbol, m.dfaTo, m.nfaTo, m.removed]),
    [
      ['q0', '0', 'q1', ['q1'], false],
      ['q0', '1', 'mati', null, true],
      ['q1', '0', 'q1', ['q1'], false],
      ['q1', '1', 'mati', null, true],
      ['mati', '0', 'mati', null, true],
      ['mati', '1', 'mati', null, true],
    ]
  );
  assert.match(h.text, /# dead state dibuang: mati \(dari state ini tidak ada jalan ke state akhir\)/);
  assert.deepEqual(validateNfa(h.nfa), []);
});

test('tanpa pilihan buang, dead state tetap ada', () => {
  const h = dfaToNfa(denganMati);
  assert.deepEqual(h.nfa.states, ['q0', 'q1', 'mati']);
  assert.deepEqual(h.removedStates, []);
});

test('state awal tidak pernah dibuang, juga jika bahasanya ∅ (F kosong)', () => {
  const dfa = parseDfa('states: q0 q1\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> q1\nq1 0 -> q0\n');
  const h = dfaToNfa(dfa, { removeDeadStates: true });
  assert.deepEqual(h.nfa.states, ['q0']);
  assert.deepEqual(h.removedStates.map((r) => r.state), ['q1']);
  assert.deepEqual(h.nfa.transitions, []);
  assert.equal(simulateNfa(h.nfa, '00').accepted, false);
});

test('loop di state awal yang dead tetap ada (state awal tidak dibuang)', () => {
  const dfa = parseDfa('states: q0\nalphabet: 0\nstart: q0\naccept:\nq0 0 -> q0\n');
  const h = dfaToNfa(dfa, { removeDeadStates: true });
  assert.deepEqual(h.removedStates, []);
  assert.deepEqual(h.nfa.transitions.map((t) => t.to), [['q0']]);
});

test('state tak terjangkau yang masih punya jalan ke state akhir tidak dibuang', () => {
  const dfa = parseDfa(
    'states: q0 q1 lain\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> q1\nq1 0 -> q1\nlain 0 -> q1\n'
  );
  const h = dfaToNfa(dfa, { removeDeadStates: true });
  assert.deepEqual(h.nfa.states, ['q0', 'q1', 'lain']);
});

test('state tak terjangkau yang juga dead ikut dibuang sebagai dead state', () => {
  const dfa = parseDfa(
    'states: q0 q1 yatim\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> q1\nq1 0 -> q1\nyatim 0 -> yatim\n'
  );
  assert.deepEqual(dfaToNfa(dfa, { removeDeadStates: true }).removedStates.map((r) => r.state), ['yatim']);
});

// ---------- nama dan simbol dari file .dfa lama ----------

test('nama state .dfa yang tidak sah di .fa: konversi berhenti dengan pesan', () => {
  const koma = parseDfa('states: a,b\nalphabet: 0\nstart: a,b\naccept:\na,b 0 -> a,b\n');
  assert.throws(() => dfaToNfa(koma), /konversi gagal: nama state 'a,b' tidak boleh mengandung koma di luar kurung siku.*ganti namanya dulu/);
  const kurawal = parseDfa('states: {q0}\nalphabet: 0\nstart: {q0}\naccept:\n{q0} 0 -> {q0}\n');
  assert.throws(() => dfaToNfa(kurawal), /nama state '\{q0\}' tidak boleh mengandung '\{' atau '\}'/);
});

test('simbol λ di alfabet .dfa: konversi berhenti dengan pesan', () => {
  const dfa = parseDfa('states: q0\nalphabet: λ\nstart: q0\naccept:\nq0 λ -> q0\n');
  assert.throws(() => dfaToNfa(dfa), /konversi gagal: simbol 'λ' dicadangkan untuk string kosong/);
});

test('nama berkurung siku (hasil konversi NFA -> DFA) sah dan bisa dikonversi', () => {
  const nfa0 = parseFa('states: q0 q1\nalphabet: 0\nstart: q0\naccept: q1\nq0 0 -> {q0, q1}\n', 'fa').automaton;
  const dfa = nfaToDfa(nfa0).dfa;
  const h = dfaToNfa(dfa);
  assert.deepEqual(h.nfa.states, ['[q0]', '[q0,q1]']);
  assert.match(h.text, /\[q0\] 0 -> \{\[q0,q1\]\}/);
});

// ---------- bolak-balik dan kasus tepi ----------

test('DFA -> NFA -> DFA menerima bahasa yang sama dengan DFA asal', () => {
  for (const nama of CONTOH_VALID) {
    const dfa = contoh(nama);
    const kembali = nfaToDfa(dfaToNfa(dfa, { removeDeadStates: true }).nfa).dfa;
    assert.deepEqual(validateDfa(kembali), [], nama);
    for (const input of semuaString(dfa.alphabet, 5)) {
      assert.equal(simulate(kembali, input).accepted, simulate(dfa, input).accepted, `${nama} '${input}'`);
    }
  }
});

test('alfabet kosong: NFA tanpa transisi', () => {
  const dfa = parseDfa('states: q0\nalphabet:\nstart: q0\naccept: q0\n');
  const h = dfaToNfa(dfa);
  assert.equal(h.text, 'type: NFA\n# hasil konversi DFA -> NFA\nstates: q0\nalphabet:\nstart: q0\naccept: q0\n');
  assert.deepEqual(h.mapping, []);
});

test('dfaToNfa tidak mengubah objek DFA', () => {
  const salinan = JSON.parse(JSON.stringify(denganMati));
  dfaToNfa(denganMati, { removeDeadStates: true });
  assert.deepEqual(denganMati, salinan);
});
