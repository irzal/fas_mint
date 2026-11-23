// Tes parser untuk format .fa dan NFA (sub tahap 6a).
// Acuan: spesifikasi-fa.md bagian 8.1-8.4.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFa, parseDfa } = require('../src/parser');

const kepala = 'states: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\n';
const nfa = (isi) => parseFa(kepala + isi, 'fa');

// ---------- jenis file dan baris type: (bagian 8.1) ----------

test('.fa tanpa baris type: dibaca sebagai NFA', () => {
  const h = parseFa(kepala, 'fa');
  assert.equal(h.type, 'NFA');
  assert.deepEqual(h.warnings, []);
});

test('format bawaan parseFa adalah fa', () => {
  assert.equal(parseFa(kepala).type, 'NFA');
});

test('.fa dengan type: NFA dan type: DFA', () => {
  assert.equal(parseFa('type: NFA\n' + kepala, 'fa').type, 'NFA');
  assert.equal(parseFa('type: DFA\n' + kepala, 'fa').type, 'DFA');
});

test('.fa type: DFA dibaca sama dengan file .dfa berisi isi yang sama', () => {
  const isi = fs.readFileSync(path.join(__dirname, '..', 'contoh', 'berakhiran-01.dfa'), 'utf8');
  const hasil = parseFa('type: DFA\n' + isi, 'fa');
  const lama = parseDfa(isi);
  // nomor baris bergeser satu karena baris type: di atas
  const geser = lama.transitions.map((t) => ({ ...t, line: t.line + 1 }));
  assert.deepEqual(hasil.automaton, { ...lama, transitions: geser });
});

test('type: boleh didahului komentar dan baris kosong', () => {
  const h = parseFa('# judul\n\n   # menjorok\ntype: DFA  # jenis\n' + kepala, 'fa');
  assert.equal(h.type, 'DFA');
});

test('error: type: bukan baris bermakna pertama', () => {
  assert.throws(() => parseFa(kepala + 'type: NFA\n', 'fa'), /baris 5: 'type:' harus menjadi baris pertama/);
  assert.throws(() => parseFa('type: NFA\ntype: NFA\n' + kepala, 'fa'), /baris 2: 'type:' harus menjadi baris pertama/);
});

test('error: nilai type: tidak dikenal, dengan saran huruf besar', () => {
  assert.throws(() => parseFa('type: NDA\n' + kepala, 'fa'), /baris 1: type 'NDA' tidak dikenal; pilih DFA atau NFA$/);
  assert.throws(() => parseFa('type: nfa\n' + kepala, 'fa'), /type 'nfa' tidak dikenal.*maksud Anda 'NFA'\?/);
  assert.throws(() => parseFa('type:\n' + kepala, 'fa'), /type '' tidak dikenal/);
  assert.throws(() => parseFa('type: DFA NFA\n' + kepala, 'fa'), /type 'DFA NFA' tidak dikenal/);
});

test('header Type: (salah huruf) di .fa diberi saran type:', () => {
  assert.throws(() => parseFa('Type: NFA\n' + kepala, 'fa'), /header 'Type:'.*maksud Anda 'type:'\?/);
});

test('.dfa: type: DFA diabaikan tanpa pesan', () => {
  const h = parseFa('type: DFA\n' + kepala, 'dfa');
  assert.equal(h.type, 'DFA');
  assert.deepEqual(h.warnings, []);
});

test('.dfa: type: lain diabaikan dengan peringatan, di baris mana pun', () => {
  const h = parseFa(kepala + 'type: NFA\nq0 0 -> q1\n', 'dfa');
  assert.equal(h.type, 'DFA');
  assert.equal(h.automaton.transitions.length, 1);
  assert.deepEqual(h.warnings, [
    "baris 5: baris 'type: NFA' diabaikan: file .dfa selalu dibaca sebagai DFA; simpan sebagai .fa jika maksudnya NFA",
  ]);
});

test('parseDfa tetap menerima .dfa berisi baris type: (peringatan tidak dikembalikan)', () => {
  assert.deepEqual(parseDfa('type: NFA\n' + kepala).states, ['q0', 'q1', 'q2']);
});

test('error: format selain fa dan dfa', () => {
  assert.throws(() => parseFa(kepala, 'nfa'), /format 'nfa' tidak dikenal/);
});

// ---------- transisi NFA (bagian 8.3 dan 8.4) ----------

test('NFA: tujuan tunggal menjadi himpunan satu anggota', () => {
  assert.deepEqual(nfa('q0 1 -> q0\n').automaton.transitions, [{ from: 'q0', symbol: '1', to: ['q0'], line: 5 }]);
});

test('NFA: notasi himpunan, dengan dan tanpa spasi setelah koma', () => {
  const t = nfa('q0 0 -> {q0, q1}\nq1 0 -> {q1,q2}\nq2 0 -> {  q0 ,q2  }\n').automaton.transitions;
  assert.deepEqual(t.map((x) => x.to), [['q0', 'q1'], ['q1', 'q2'], ['q0', 'q2']]);
});

test('NFA: {q1} sama dengan q1, dan {} (atau { }) adalah himpunan kosong', () => {
  const t = nfa('q0 0 -> {q1}\nq0 1 -> {}\nq1 1 -> { }\n').automaton.transitions;
  assert.deepEqual(t.map((x) => x.to), [['q1'], [], []]);
});

test('NFA: baris -> {} tetap tercatat (asal dan simbolnya diperiksa validator)', () => {
  assert.deepEqual(nfa('q9 a -> {}\n').automaton.transitions, [{ from: 'q9', symbol: 'a', to: [], line: 5 }]);
});

test('NFA: tulisan string kosong ε, eps, λ, lam dinormalkan menjadi ε', () => {
  const t = nfa('q0 ε -> q1\nq0 eps -> q2\nq1 λ -> q2\nq1 lam -> {q0, q2}\n').automaton.transitions;
  assert.deepEqual(t.map((x) => x.symbol), ['ε', 'ε', 'ε', 'ε']);
});

test('NFA: bentuk satu baris dan beberapa baris boleh dicampur (tetap entri terpisah)', () => {
  const t = nfa('q0 0 -> q0\nq0 0 -> {q1, q2}\n').automaton.transitions;
  assert.deepEqual(t.map((x) => [x.from, x.symbol, x.to]), [['q0', '0', ['q0']], ['q0', '0', ['q1', 'q2']]]);
});

test('NFA: nama berkurung siku di dalam himpunan, koma di dalamnya bukan pemisah', () => {
  const h = parseFa(
    'states: [q0,q1] q2 []\nalphabet: 0\nstart: [q0,q1]\naccept: []\n[q0,q1] 0 -> {[q0,q1], q2, []}\n',
    'fa'
  );
  assert.deepEqual(h.automaton.transitions[0].to, ['[q0,q1]', 'q2', '[]']);
  assert.deepEqual(h.automaton.states, ['[q0,q1]', 'q2', '[]']);
});

test('contoh NFA di spesifikasi bagian 8.2', () => {
  const h = parseFa(
    'type: NFA\n# NFA: string biner berakhiran 01\nstates: q0 q1 q2\nalphabet: 0 1\nstart: q0\naccept: q2\n\n' +
      'q0 0 -> {q0, q1}    # menebak\nq0 1 -> q0\nq1 1 -> q2\n',
    'fa'
  );
  assert.equal(h.type, 'NFA');
  assert.deepEqual(h.automaton.transitions, [
    { from: 'q0', symbol: '0', to: ['q0', 'q1'], line: 8 },
    { from: 'q0', symbol: '1', to: ['q0'], line: 9 },
    { from: 'q1', symbol: '1', to: ['q2'], line: 10 },
  ]);
});

test('NFA error: banyak tujuan tanpa kurung kurawal, dengan saran penulisan', () => {
  assert.throws(() => nfa('q0 0 -> q0 q1\n'), /baris 5: tujuan 'q0 q1' berisi spasi; tulis banyak tujuan sebagai himpunan, mis\. \{q0, q1\}/);
});

test('NFA error: himpunan tidak ditutup, elemen kosong, elemen berspasi', () => {
  assert.throws(() => nfa('q0 0 -> {q0, q1\n'), /baris 5: himpunan '\{q0, q1' harus ditutup/);
  assert.throws(() => nfa('q0 0 -> {q0,,q1}\n'), /elemen kosong/);
  assert.throws(() => nfa('q0 0 -> {q0,}\n'), /elemen kosong/);
  assert.throws(() => nfa('q0 0 -> {q0 q1}\n'), /elemen 'q0 q1'.*pisahkan state dengan koma/);
});

test('NFA error: baris yang bukan transisi tetap dilaporkan', () => {
  assert.throws(() => nfa('q0 0 q1\n'), /baris 5: tidak dikenali 'q0 0 q1'/);
});

// ---------- DFA di file .fa (bagian 8.4 butir 5) ----------

test('.fa type: DFA: notasi himpunan ditolak, juga {q1} satu anggota', () => {
  const dfa = (isi) => parseFa('type: DFA\n' + kepala + isi, 'fa');
  assert.throws(() => dfa('q0 0 -> {q0, q1}\n'), /baris 6: notasi himpunan '\{q0, q1\}' hanya untuk NFA/);
  assert.throws(() => dfa('q0 0 -> {q1}\n'), /hanya untuk NFA/);
  assert.throws(() => dfa('q0 0 -> q1 q2\n'), /tidak dikenali/);
});

test('.fa type: DFA: tulisan string kosong tidak dinormalkan (ditolak validator lewat V4)', () => {
  const h = parseFa('type: DFA\n' + kepala + 'q0 eps -> q1\n', 'fa');
  assert.equal(h.automaton.transitions[0].symbol, 'eps');
});

// ---------- nama state dan simbol di .fa ----------

test('.fa: nama state tidak boleh berisi kurung kurawal', () => {
  assert.throws(() => parseFa('states: {q0}\nalphabet: 0\nstart: q0\naccept:\n', 'fa'), /baris 1: nama state '\{q0\}' tidak boleh mengandung '\{' atau '\}'/);
  assert.throws(() => nfa('{q0} 0 -> q1\n'), /baris 5.*'\{q0\}'/);
  assert.throws(() => nfa('q0 0 -> q}\n'), /baris 5.*'q\}'/);
});

test('.fa: koma di nama state hanya boleh di dalam kurung siku', () => {
  assert.throws(() => parseFa('states: a,b\nalphabet: 0\nstart: a,b\naccept:\n', 'fa'), /baris 1: nama state 'a,b' tidak boleh mengandung koma di luar kurung siku/);
  assert.throws(() => nfa('q0 0 -> {[a,b],c,d}\nq0 1 -> x,y\n'), /baris 6.*'x,y'/);
  assert.equal(parseFa('states: [a,b]\nalphabet: 0\nstart: [a,b]\naccept:\n', 'fa').automaton.start, '[a,b]');
});

test('.dfa tidak berubah: kurung kurawal dan koma di nama state tetap boleh', () => {
  const dfa = parseDfa('states: {q0} a,b\nalphabet: 0\nstart: {q0}\naccept: a,b\n{q0} 0 -> a,b\n');
  assert.deepEqual(dfa.states, ['{q0}', 'a,b']);
  assert.equal(dfa.transitions[0].to, 'a,b');
});

test('.fa: λ dan ε tidak boleh menjadi simbol alfabet; di .dfa λ masih boleh', () => {
  assert.throws(() => parseFa('states: q0\nalphabet: 0 λ\nstart: q0\naccept:\n', 'fa'), /baris 2: simbol 'λ' tidak boleh dipakai di alfabet/);
  assert.throws(() => parseFa('states: q0\nalphabet: ε\nstart: q0\naccept:\n', 'fa'), /simbol 'ε' tidak boleh/);
  assert.deepEqual(parseDfa('states: q0\nalphabet: λ\nstart: q0\naccept:\n').alphabet, ['λ']);
});

test('.fa: nama state tetap tidak boleh berisi ->', () => {
  assert.throws(() => parseFa('states: a->b\nalphabet: 0\nstart: q0\naccept:\n', 'fa'), /'->'/);
});

// ---------- kasus tepi ----------

test('dokumen awal halaman web (NFA satu state tanpa transisi) bisa dibaca', () => {
  const h = parseFa('states: q0\nalphabet: 0 1\nstart: q0\naccept:\n', 'fa');
  assert.equal(h.type, 'NFA');
  assert.deepEqual(h.automaton, { states: ['q0'], alphabet: ['0', '1'], start: 'q0', accept: [], transitions: [] });
});

test('NFA dengan alfabet kosong dan F kosong; transisi ε tetap boleh', () => {
  const h = parseFa('states: q0 q1\nalphabet:\nstart: q0\naccept:\nq0 ε -> q1\n', 'fa');
  assert.deepEqual(h.automaton.alphabet, []);
  assert.deepEqual(h.automaton.accept, []);
  assert.equal(h.automaton.transitions[0].symbol, 'ε');
});

test('teks kosong atau hanya type: tetap error header tidak ada', () => {
  assert.throws(() => parseFa('', 'fa'), /baris 'states:' tidak ada/);
  assert.throws(() => parseFa('type: NFA\n', 'fa'), /baris 'states:' tidak ada/);
  assert.throws(() => parseFa('', 'dfa'), /baris 'states:' tidak ada/);
});

test('semua contoh .dfa: parseFa(..., dfa) sama dengan parseDfa dan tanpa peringatan', () => {
  const folder = path.join(__dirname, '..', 'contoh');
  for (const nama of fs.readdirSync(folder).filter((f) => f.endsWith('.dfa'))) {
    const isi = fs.readFileSync(path.join(folder, nama), 'utf8');
    const h = parseFa(isi, 'dfa');
    assert.equal(h.type, 'DFA', nama);
    assert.deepEqual(h.automaton, parseDfa(isi), nama);
    assert.deepEqual(h.warnings, [], nama);
  }
});

// ---------- jenis dari luar teks (sub tahap 6h, pilihan jenis di web) ----------

test('opsi type: jenis dari luar teks, nomor baris tetap sesuai teks', () => {
  assert.equal(parseFa(kepala, 'fa', { type: 'DFA' }).type, 'DFA');
  assert.equal(parseFa(kepala, 'fa', { type: 'NFA' }).type, 'NFA');
  assert.throws(() => parseFa(kepala + 'q0 0 -> q0 q1\n', 'fa', { type: 'NFA' }), /^Error: baris 5:/);
});

test('opsi type: baris type: sah di teks ditolak; nilai tak dikenal dilaporkan biasa', () => {
  assert.throws(() => parseFa('type: NFA\n' + kepala, 'fa', { type: 'DFA' }), /baris 1: baris 'type:' tidak dipakai di sini, karena jenis automata sudah dipilih \(DFA\)/);
  assert.throws(() => parseFa(kepala + 'type: PDA\n', 'fa', { type: 'NFA' }), /baris 5: type 'PDA' tidak dikenal/);
});

test('opsi type hanya DFA/NFA dan hanya untuk format fa', () => {
  assert.throws(() => parseFa(kepala, 'dfa', { type: 'DFA' }), /hanya untuk format 'fa'/);
  assert.throws(() => parseFa(kepala, 'fa', { type: 'PDA' }), /hanya boleh DFA atau NFA/);
});
