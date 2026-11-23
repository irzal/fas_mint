// Tes penggambar diagram state (public/gambar.js), bagian yang murni hitungan.
// Elemen SVG sendiri (buatSvg) butuh browser, jadi dicoba langsung di halaman.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDfa } = require('../src/parser');
const { buatGraf, hitungTataLetak, DAFTAR_TATA_LETAK } = require('../public/graf');
const { susunGambar, titikKurva } = require('../public/gambar');

const FOLDER_CONTOH = path.join(__dirname, '..', 'contoh');
const bacaContoh = (nama) => parseDfa(fs.readFileSync(path.join(FOLDER_CONTOH, nama), 'utf8'));

function gambarDari(dfa, tataLetak = 'berlapis') {
  const graf = buatGraf(dfa);
  return susunGambar(graf, hitungTataLetak(graf, tataLetak));
}

const tr = (from, symbol, to) => ({ from, symbol, to, line: 1 });
const dfaDari = (states, start, transitions, accept = []) => ({
  states, alphabet: ['0', '1'], start, accept, transitions,
});

// Titik-titik di sepanjang kurva, untuk memeriksa jarak ke state.
const sampel = (kurva) => Array.from({ length: 41 }, (_, i) => titikKurva(kurva, i / 40));
const jarak = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('state, state akhir, dan state awal dari berakhiran-01', () => {
  const g = gambarDari(bacaContoh('berakhiran-01.dfa'));
  assert.deepEqual(
    g.states.map((s) => [s.id, s.awal, s.akhir, s.terjangkau]),
    [
      ['q0', true, false, true],
      ['q1', false, false, true],
      ['q2', false, true, true],
    ]
  );
  // Panah awal datang dari kiri dan berujung di tepi lingkaran q0.
  const q0 = g.states[0];
  const ujung = g.panahAwal.kurva[3];
  assert.equal(ujung.y, q0.y);
  assert.equal(ujung.x, q0.x - g.radius);
  assert.ok(g.panahAwal.kurva[0].x < ujung.x);
});

test('satu panah per pasangan (asal, tujuan); simbol digabung "a, b"', () => {
  const g = gambarDari(bacaContoh('mengandung-ab.dfa'));
  assert.deepEqual(
    g.panah.map((p) => `${p.from}>${p.to}:${p.label}${p.loop ? ' loop' : ''}`),
    ['awal>sudah_a:a', 'awal>awal:b loop', 'sudah_a>sudah_a:a loop', 'sudah_a>ketemu:b', 'ketemu>ketemu:a, b loop']
  );
});

test('ujung panah menyentuh tepi lingkaran asal dan tujuan', () => {
  const g = gambarDari(bacaContoh('kelipatan-3.dfa'));
  const pusat = new Map(g.states.map((s) => [s.id, s]));
  for (const p of g.panah) {
    const [awal, , , akhir] = p.kurva;
    assert.ok(Math.abs(jarak(awal, pusat.get(p.from)) - g.radius) < 0.01, `${p.from}>${p.to} pangkal`);
    assert.ok(Math.abs(jarak(akhir, pusat.get(p.to)) - g.radius) < 0.01, `${p.from}>${p.to} ujung`);
  }
});

test('panah bolak-balik p -> q dan q -> p melengkung ke sisi berlawanan', () => {
  const g = gambarDari(bacaContoh('jumlah-0-genap.dfa'));
  const pergi = g.panah.find((p) => p.from === 'genap' && p.to === 'ganjil');
  const pulang = g.panah.find((p) => p.from === 'ganjil' && p.to === 'genap');
  const yTengah = g.states[0].y; // berlapis: keduanya di baris yang sama
  const puncakPergi = titikKurva(pergi.kurva, 0.5).y;
  const puncakPulang = titikKurva(pulang.kurva, 0.5).y;
  assert.ok((puncakPergi - yTengah) * (puncakPulang - yTengah) < 0, 'satu di atas, satu di bawah');
  assert.ok(pergi.labelY < yTengah && pulang.labelY > yTengah, 'label di sisi luar lengkungan');
});

test('panah tidak menembus state lain (q2 -> q0 melewati q1 di baris yang sama)', () => {
  const g = gambarDari(bacaContoh('berakhiran-01.dfa'));
  const q1 = g.states.find((s) => s.id === 'q1');
  const balik = g.panah.find((p) => p.from === 'q2' && p.to === 'q0');
  for (const t of sampel(balik.kurva)) assert.ok(jarak(t, q1) > g.radius, 'kurva masuk ke lingkaran q1');
});

test('semua contoh, semua tata letak: tidak ada panah antar state yang menembus state lain', () => {
  for (const nama of fs.readdirSync(FOLDER_CONTOH).filter((f) => f.endsWith('.dfa'))) {
    for (const { nama: tataLetak } of DAFTAR_TATA_LETAK) {
      const g = gambarDari(bacaContoh(nama), tataLetak);
      for (const p of g.panah.filter((x) => !x.loop)) {
        for (const s of g.states.filter((x) => x.id !== p.from && x.id !== p.to)) {
          for (const t of sampel(p.kurva)) {
            assert.ok(jarak(t, s) > g.radius, `${nama}/${tataLetak}: ${p.from}>${p.to} menembus ${s.id}`);
          }
        }
      }
    }
  }
});

test('loop state awal tidak diletakkan di kiri (tempat panah awal)', () => {
  // Satu-satunya state: atas, bawah, kanan sama-sama lega; kiri dilarang.
  const g = gambarDari(dfaDari(['q0'], 'q0', [tr('q0', '0', 'q0'), tr('q0', '1', 'q0')], ['q0']));
  const loop = g.panah[0];
  assert.equal(loop.loop, true);
  assert.equal(loop.label, '0, 1');
  assert.notEqual(loop.arahLoop, 'kiri');
});

test('kotak gambar memuat semua lingkaran, kurva, dan label', () => {
  for (const nama of fs.readdirSync(FOLDER_CONTOH).filter((f) => f.endsWith('.dfa'))) {
    for (const { nama: tataLetak } of DAFTAR_TATA_LETAK) {
      const g = gambarDari(bacaContoh(nama), tataLetak);
      const k = g.kotak;
      const di = (p) => p.x >= k.x && p.x <= k.x + k.lebar && p.y >= k.y && p.y <= k.y + k.tinggi;
      for (const s of g.states) {
        assert.ok(di({ x: s.x - g.radius, y: s.y - g.radius }) && di({ x: s.x + g.radius, y: s.y + g.radius }), `${nama}/${tataLetak} ${s.id}`);
      }
      for (const p of g.panah) {
        for (const t of sampel(p.kurva)) assert.ok(di(t), `${nama}/${tataLetak} ${p.from}>${p.to}`);
        assert.ok(di({ x: p.labelX, y: p.labelY }), `${nama}/${tataLetak} label ${p.label}`);
      }
    }
  }
});

test('atribut d berisi angka saja (tidak ada NaN/Infinity)', () => {
  for (const nama of fs.readdirSync(FOLDER_CONTOH).filter((f) => f.endsWith('.dfa'))) {
    for (const { nama: tataLetak } of DAFTAR_TATA_LETAK) {
      const g = gambarDari(bacaContoh(nama), tataLetak);
      for (const p of g.panah) assert.match(p.d, /^M [-\d. ]+ C [-\d. ]+$/, `${nama}/${tataLetak}`);
      for (const v of Object.values(g.kotak)) assert.ok(Number.isFinite(v));
    }
  }
});

test('jari-jari membesar untuk nama state panjang, dalam batas', () => {
  const pendek = gambarDari(dfaDari(['q0'], 'q0', []));
  const sedang = gambarDari(dfaDari(['sudah_a'], 'sudah_a', []));
  const panjang = gambarDari(dfaDari(['nama_state_yang_sangat_panjang'], 'nama_state_yang_sangat_panjang', []));
  assert.equal(pendek.radius, 24);
  assert.ok(sedang.radius > 24 && sedang.radius <= 40);
  assert.equal(panjang.radius, 66);
});

test('state tak terjangkau ditandai terjangkau: false', () => {
  const g = gambarDari(dfaDari(['q0', 'q1'], 'q0', [tr('q0', '0', 'q0'), tr('q1', '0', 'q0')]));
  assert.deepEqual(g.states.map((s) => [s.id, s.terjangkau]), [['q0', true], ['q1', false]]);
});

// ---------- kasus tepi ----------

test('Q kosong: gambar kosong tanpa error', () => {
  const g = gambarDari(dfaDari([], '', []));
  assert.deepEqual(g.states, []);
  assert.deepEqual(g.panah, []);
  assert.equal(g.panahAwal, null);
  assert.ok(g.kotak.lebar > 0 && g.kotak.tinggi > 0);
});

test('alfabet kosong dan F kosong: state tetap digambar, tanpa panah transisi', () => {
  const g = gambarDari({ states: ['q0', 'q1'], alphabet: [], start: 'q0', accept: [], transitions: [] });
  assert.equal(g.states.length, 2);
  assert.ok(g.states.every((s) => !s.akhir));
  assert.deepEqual(g.panah, []);
  assert.notEqual(g.panahAwal, null);
});

test('state awal tidak ada di Q (DFA belum valid): tanpa panah awal', () => {
  const g = gambarDari(dfaDari(['q0'], 'qx', [tr('q0', '0', 'q0')]));
  assert.equal(g.panahAwal, null);
  assert.equal(g.panah.length, 1);
});

test('transisi ke state yang tidak ada di Q dilewati', () => {
  const g = gambarDari(dfaDari(['q0'], 'q0', [tr('q0', '0', 'qx'), tr('q0', '1', 'q0')]));
  assert.deepEqual(g.panah.map((p) => `${p.from}>${p.to}`), ['q0>q0']);
});

// ---------- nama state panjang (sub tahap 6k) ----------

const { hitungRadius, faktorJarak, ukuranHuruf } = require('../public/gambar');
const { skalakanTataLetak } = require('../public/graf');

test('nama hasil konversi [q0,q1,q2,q3] muat dengan huruf biasa; nama sangat panjang dikecilkan', () => {
  const r = hitungRadius([{ id: '[q0,q1,q2,q3]' }]);
  assert.ok(r > 40 && r <= 66);
  assert.equal(ukuranHuruf('[q0,q1,q2,q3]', r), 14);
  assert.equal(ukuranHuruf('q0', 24), 14);
  const sangat = 'nama_state_yang_sangat_panjang_sekali';
  const kecil = ukuranHuruf(sangat, 66);
  assert.ok(kecil < 14 && kecil >= 9);
  assert.equal(ukuranHuruf('x'.repeat(200), 66), 9);
});

test('faktorJarak: 1 untuk lingkaran biasa, lebih dari 1 untuk lingkaran besar', () => {
  assert.equal(faktorJarak(24), 1);
  assert.equal(faktorJarak(40), 1);
  assert.equal(faktorJarak(60), 1.5);
});

test('skalakanTataLetak mengalikan posisi, lebar, dan tinggi; faktor 1 tidak mengubah', () => {
  const graf = buatGraf(dfaDari(['a', 'b'], 'a', [tr('a', '0', 'b')]));
  const t = hitungTataLetak(graf, 'berlapis');
  const dua = skalakanTataLetak(t, 2);
  assert.deepEqual(dua.posisi.get('b'), { x: t.posisi.get('b').x * 2, y: t.posisi.get('b').y * 2 });
  assert.equal(dua.lebar, t.lebar * 2);
  assert.deepEqual(skalakanTataLetak(t, 1), t);
});

test('DFA hasil konversi (nama panjang): lingkaran tidak berimpitan, panah tidak menembus state lain', () => {
  const { nfaToDfa } = require('../src/converter');
  const { parseFa } = require('../src/parser');
  const teks = fs.readFileSync(path.join(FOLDER_CONTOH, 'nfa-ketiga-dari-akhir-1.fa'), 'utf8');
  const dfa = nfaToDfa(parseFa(teks, 'fa').automaton).dfa;
  for (const { nama: tataLetak } of DAFTAR_TATA_LETAK) {
    const graf = buatGraf(dfa);
    const faktor = faktorJarak(hitungRadius(graf.nodes));
    const g = susunGambar(graf, skalakanTataLetak(hitungTataLetak(graf, tataLetak), faktor));
    for (const a of g.states) {
      for (const b of g.states) {
        if (a !== b) assert.ok(jarak(a, b) > 2 * g.radius, `${tataLetak}: ${a.id} dan ${b.id} berimpitan`);
      }
    }
    for (const p of g.panah.filter((x) => !x.loop)) {
      for (const s of g.states.filter((x) => x.id !== p.from && x.id !== p.to)) {
        for (const t of sampel(p.kurva)) assert.ok(jarak(t, s) > g.radius, `${tataLetak}: ${p.from}>${p.to} menembus ${s.id}`);
      }
    }
  }
});
