// Tes validator. Satu kasus per aturan V1-V6b di spesifikasi bagian 5.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { parseDfa } = require('../src/parser');
const { validateDfa, warnDfa, findUnreachable, removeUnreachable } = require('../src/validator');

// DFA dasar yang valid (berakhiran 01); tiap tes mengubah satu bagian saja.
function dasar(ubah = {}) {
  return {
    states: ['q0', 'q1', 'q2'],
    alphabet: ['0', '1'],
    start: 'q0',
    accept: ['q2'],
    transitions: [
      ['q0', '0', 'q1'], ['q0', '1', 'q0'],
      ['q1', '0', 'q1'], ['q1', '1', 'q2'],
      ['q2', '0', 'q1'], ['q2', '1', 'q0'],
    ].map(([from, symbol, to], i) => ({ from, symbol, to, line: i + 1 })),
    ...ubah,
  };
}

const tr = (from, symbol, to) => ({ from, symbol, to, line: 99 });
const tanpa = (dfa, from, symbol) =>
  dfa.transitions.filter((t) => !(t.from === from && t.symbol === symbol));

test('contoh berakhiran-01.dfa valid (tidak ada error)', () => {
  const teks = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  assert.deepEqual(validateDfa(parseDfa(teks)), []);
  assert.deepEqual(validateDfa(dasar()), []);
});

test("V1: state awal 'q9' tidak ada di Q", () => {
  assert.deepEqual(validateDfa(dasar({ start: 'q9' })), ["state awal 'q9' tidak ada di Q"]);
});

test("V2: state akhir 'q5' tidak ada di Q", () => {
  assert.deepEqual(validateDfa(dasar({ accept: ['q2', 'q5'] })), ["state akhir 'q5' tidak ada di Q"]);
});

test("V3: state 'q1' ditulis dua kali di Q", () => {
  assert.deepEqual(
    validateDfa(dasar({ states: ['q0', 'q1', 'q1', 'q2'] })),
    ["state 'q1' ditulis dua kali di Q"]
  );
});

test('V3: duplikat di Σ dilaporkan; tiga kali tetap satu pesan', () => {
  assert.deepEqual(
    validateDfa(dasar({ alphabet: ['0', '1', '1', '1'] })),
    ["simbol '1' ditulis dua kali di Σ"]
  );
});

test("V4: simbol 'a' tidak ada di Σ", () => {
  const dfa = dasar();
  dfa.transitions.push(tr('q0', 'a', 'q1'));
  assert.deepEqual(validateDfa(dfa), ["simbol 'a' tidak ada di Σ"]);
});

test("V5: state 'q7' tidak ada di Q", () => {
  const dfa = dasar();
  dfa.transitions.push(tr('q7', '0', 'q0'));
  dfa.transitions.push(tr('q0', '0', 'q7'));
  assert.deepEqual(validateDfa(dfa), ["state 'q7' tidak ada di Q", "state 'q7' tidak ada di Q"]);
});

test('V6a: δ(q1, 1) belum didefinisikan', () => {
  const dfa = dasar();
  dfa.transitions = tanpa(dfa, 'q1', '1');
  assert.deepEqual(validateDfa(dfa), ['δ(q1, 1) belum didefinisikan']);
});

test('V6b: δ(q0, 0) didefinisikan dua kali, itu bukan DFA', () => {
  const dfa = dasar();
  dfa.transitions.push(tr('q0', '0', 'q0'));
  assert.deepEqual(validateDfa(dfa), ['δ(q0, 0) didefinisikan dua kali, itu bukan DFA']);
});

test('V6b: transisi ganda dengan tujuan sama pun tetap error', () => {
  const dfa = dasar();
  dfa.transitions.push(tr('q0', '0', 'q1'));
  assert.deepEqual(validateDfa(dfa), ['δ(q0, 0) didefinisikan dua kali, itu bukan DFA']);
});

test('semua pelanggaran dikumpulkan sekaligus', () => {
  const dfa = dasar({ start: 'q9' });
  dfa.transitions = tanpa(dfa, 'q1', '1');
  dfa.transitions.push(tr('q0', '0', 'q0'));
  assert.deepEqual(validateDfa(dfa), [
    "state awal 'q9' tidak ada di Q",
    'δ(q0, 0) didefinisikan dua kali, itu bukan DFA',
    'δ(q1, 1) belum didefinisikan',
  ]);
});

test('transisi dengan simbol/state tak dikenal tidak dihitung di V6', () => {
  // Transisi q0 'a' -> q1 hanya melanggar V4; pasangan sah tetap lengkap.
  const dfa = dasar();
  dfa.transitions.push(tr('q0', 'a', 'q1'));
  assert.equal(validateDfa(dfa).length, 1);
});

test('alfabet kosong: DFA valid tanpa transisi', () => {
  const dfa = { states: ['q0'], alphabet: [], start: 'q0', accept: ['q0'], transitions: [] };
  assert.deepEqual(validateDfa(dfa), []);
});

test('accept kosong (F = ∅) valid', () => {
  assert.deepEqual(validateDfa(dasar({ accept: [] })), []);
});

// DFA valid dengan q2 yang tidak bisa dicapai dari q0.
function denganTakTerjangkau() {
  return {
    states: ['q0', 'q1', 'q2'],
    alphabet: ['0', '1'],
    start: 'q0',
    accept: ['q1', 'q2'],
    transitions: [
      ['q0', '0', 'q1'], ['q0', '1', 'q0'],
      ['q1', '0', 'q1'], ['q1', '1', 'q0'],
      ['q2', '0', 'q1'], ['q2', '1', 'q2'],
    ].map(([from, symbol, to], i) => ({ from, symbol, to, line: i + 1 })),
  };
}

test('W1: state tak terjangkau hanya diberi peringatan, bukan error', () => {
  const dfa = denganTakTerjangkau();
  assert.deepEqual(validateDfa(dfa), []);
  assert.deepEqual(warnDfa(dfa), ["state 'q2' tidak terjangkau dari state awal 'q0'"]);
});

test('W1: DFA tanpa state tak terjangkau tidak menghasilkan peringatan', () => {
  assert.deepEqual(warnDfa(dasar()), []);
});

test('keterjangkauan mengikuti rantai transisi, bukan hanya tetangga langsung', () => {
  // q0 -> q1 -> q2 -> q3; q4 terpisah.
  const dfa = {
    states: ['q0', 'q1', 'q2', 'q3', 'q4'], alphabet: ['a'], start: 'q0', accept: [],
    transitions: [tr('q0', 'a', 'q1'), tr('q1', 'a', 'q2'), tr('q2', 'a', 'q3'), tr('q3', 'a', 'q3'), tr('q4', 'a', 'q4')],
  };
  assert.deepEqual(findUnreachable(dfa), ['q4']);
});

test('state yang hanya dicapai dari state tak terjangkau juga tak terjangkau', () => {
  const dfa = {
    states: ['q0', 'x', 'y'], alphabet: ['a'], start: 'q0', accept: [],
    transitions: [tr('q0', 'a', 'q0'), tr('x', 'a', 'y'), tr('y', 'a', 'y')],
  };
  assert.deepEqual(findUnreachable(dfa), ['x', 'y']);
});

test('removeUnreachable membuang state, transisi, dan keanggotaan accept-nya', () => {
  const asli = denganTakTerjangkau();
  const baru = removeUnreachable(asli);
  assert.deepEqual(baru.states, ['q0', 'q1']);
  assert.deepEqual(baru.accept, ['q1']);
  assert.equal(baru.start, 'q0');
  assert.deepEqual(baru.alphabet, ['0', '1']);
  assert.equal(baru.transitions.length, 4);
  assert.ok(baru.transitions.every((t) => t.from !== 'q2'));
  assert.deepEqual(validateDfa(baru), []);
  assert.deepEqual(warnDfa(baru), []);
});

test('removeUnreachable tidak mengubah objek asli', () => {
  const asli = denganTakTerjangkau();
  const salinan = JSON.parse(JSON.stringify(asli));
  removeUnreachable(asli);
  assert.deepEqual(asli, salinan);
});

test('removeUnreachable pada DFA yang semua statenya terjangkau memberi salinan sama', () => {
  const asli = dasar();
  const baru = removeUnreachable(asli);
  assert.deepEqual(baru, asli);
  assert.notEqual(baru, asli);
});

// Jaminan kelengkapan: validateDfa kosong  <=>  dfa benar-benar DFA lengkap.
// `benar` ditulis terpisah dan sengaja naif (tanpa Map/Set trik), sebagai pembanding.
function benar(dfa) {
  const unik = (a) => a.every((x, i) => a.indexOf(x) === i);
  if (!unik(dfa.states) || !unik(dfa.alphabet)) return false;
  if (!dfa.states.includes(dfa.start)) return false;
  if (!dfa.accept.every((s) => dfa.states.includes(s))) return false;
  const sahSemua = dfa.transitions.every(
    (t) => dfa.states.includes(t.from) && dfa.alphabet.includes(t.symbol) && dfa.states.includes(t.to)
  );
  if (!sahSemua) return false;
  for (const q of dfa.states) {
    for (const a of dfa.alphabet) {
      if (dfa.transitions.filter((t) => t.from === q && t.symbol === a).length !== 1) return false;
    }
  }
  return true;
}

// Pembangkit acak deterministik (LCG) supaya tes selalu sama hasilnya.
function acak(seed) {
  let x = seed;
  return (n) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % n;
  };
}

test('validateDfa kosong <=> DFA lengkap (3000 DFA acak hasil perusakan)', () => {
  const POOL_STATE = ['q0', 'q1', 'q2', 'zz']; // 'zz' tidak ada di Q
  const POOL_SIMBOL = ['0', '1', 'x']; // 'x' tidak ada di Σ
  const rnd = acak(2026);
  const pilih = (daftar) => daftar[rnd(daftar.length)];
  let valid = 0;
  let tidakValid = 0;

  for (let kasus = 0; kasus < 3000; kasus++) {
    const dfa = dasar();
    const jumlahRusak = rnd(4); // 0..3 perusakan; 0 = tetap utuh
    for (let i = 0; i < jumlahRusak; i++) {
      const t = dfa.transitions;
      switch (rnd(11)) {
        case 0: if (t.length) t.splice(rnd(t.length), 1); break; // hapus transisi
        case 1: t.push(tr(pilih(POOL_STATE), pilih(POOL_SIMBOL), pilih(POOL_STATE))); break; // tambah
        case 2: if (t.length) t[rnd(t.length)].from = pilih(POOL_STATE); break;
        case 3: if (t.length) t[rnd(t.length)].symbol = pilih(POOL_SIMBOL); break;
        case 4: if (t.length) t[rnd(t.length)].to = pilih(POOL_STATE); break;
        case 5: dfa.start = pilih(POOL_STATE); break;
        case 6: dfa.accept.push(pilih(POOL_STATE)); break;
        case 7: dfa.states.push(pilih(POOL_STATE)); break; // bisa duplikat atau state baru
        case 8: dfa.alphabet.push(pilih(POOL_SIMBOL)); break;
        case 9: dfa.states.splice(rnd(dfa.states.length), 1); break;
        case 10: if (t.length) t.push({ ...t[rnd(t.length)] }); break; // gandakan persis
      }
    }

    const lolos = validateDfa(dfa).length === 0;
    assert.equal(lolos, benar(dfa), 'validator dan pembanding berbeda untuk: ' + JSON.stringify(dfa));
    if (lolos) {
      // Akibat langsung jaminan: tepat satu transisi per pasangan, jadi |δ| = |Q| x |Σ|.
      assert.equal(dfa.transitions.length, dfa.states.length * dfa.alphabet.length);
      valid++;
    } else {
      tidakValid++;
    }
  }
  // Pastikan kedua sisi benar-benar teruji, bukan semuanya valid atau semuanya rusak.
  assert.ok(valid > 100, 'terlalu sedikit kasus valid: ' + valid);
  assert.ok(tidakValid > 100, 'terlalu sedikit kasus tidak valid: ' + tidakValid);
});
