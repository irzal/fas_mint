// Penggambar diagram state (lapisan ke-3, lihat komentar di awal graf.js).
//
// Dua bagian yang sengaja dipisah:
//   1. susunGambar(graf, tataLetak) -> daftar bentuk (lingkaran, kurva, teks)
//      dengan koordinat. Murni hitungan, tanpa DOM, jadi bisa dites di Node.
//   2. buatSvg(gambar)               -> elemen <svg> untuk halaman (butuh browser).
//
// Notasi diagram mengikuti buku teks:
//   - state = lingkaran berisi nama state
//   - state akhir (anggota F) = lingkaran ganda
//   - state awal q₀ = ditunjuk panah yang datang dari luar (dari kiri)
//   - transisi δ(p, a) = q = panah dari p ke q berlabel a; beberapa simbol
//     dengan asal dan tujuan sama digabung dalam satu panah, labelnya "a, b"
//   - δ(p, a) = p = loop (panah yang kembali ke state itu sendiri)
// Tambahan: state tak terjangkau dari q₀ digambar dengan garis putus-putus.
//
// Setiap panah disimpan sebagai kurva Bézier kubik [p0, c1, c2, p3]:
// garis lurus pun ditulis begitu (titik kendali di atas garis), supaya semua
// panah diperlakukan sama.

(function (root) {
  const RADIUS_MIN = 24; // jari-jari lingkaran state
  const RADIUS_MAKS = 40;
  const LEBAR_HURUF = 8.4; // perkiraan lebar satu huruf monospace 14px
  const JARAK_LINGKARAN_GANDA = 5; // jarak lingkaran dalam state akhir
  const PANJANG_PANAH_AWAL = 36;
  // Calon lengkungan panah (piksel; positif = melengkung ke kiri arah panah).
  // p -> q dan q -> p sekaligus: selalu melengkung, ke kiri arah masing-masing,
  // sehingga keduanya berada di sisi yang berlawanan dan tidak bertumpuk.
  const LENGKUNG_BOLAK_BALIK = [30, 55, 85, 120];
  const LENGKUNG_BIASA = [0, 40, -40, 70, -70, 100, -100, 130, -130];
  const JARAK_BEBAS_LABEL = 12; // label tidak boleh lebih dekat dari ini ke panah/label lain
  const JARAK_LABEL = 13; // jarak label dari tengah panah
  const RUANG_BEBAS = 6; // panah tidak boleh lebih dekat dari ini ke state lain
  const TEPI = 10; // ruang kosong di sekeliling gambar

  const bulatkan = (x) => Math.round(x * 100) / 100;

  // ---------- pembantu vektor ----------

  const tambah = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const kurang = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const kali = (a, k) => ({ x: a.x * k, y: a.y * k });
  const panjang = (a) => Math.hypot(a.x, a.y);
  const jarak = (a, b) => panjang(kurang(a, b));
  function satuan(a) {
    const p = panjang(a);
    return p === 0 ? { x: 1, y: 0 } : kali(a, 1 / p);
  }
  // Putar vektor sebesar `sudut` radian (searah jarum jam di layar, karena y ke bawah).
  function putar(a, sudut) {
    const c = Math.cos(sudut);
    const s = Math.sin(sudut);
    return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
  }

  /** Titik pada kurva Bézier kubik [p0, c1, c2, p3] untuk t di antara 0 dan 1. */
  function titikKurva(kurva, t) {
    const [p0, c1, c2, p3] = kurva;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
    };
  }

  function sampelKurva(kurva, banyak = 20) {
    const hasil = [];
    for (let i = 0; i <= banyak; i++) hasil.push(titikKurva(kurva, i / banyak));
    return hasil;
  }

  function teksD(kurva) {
    const [p0, c1, c2, p3] = kurva.map((p) => `${bulatkan(p.x)} ${bulatkan(p.y)}`);
    return `M ${p0} C ${c1} ${c2} ${p3}`;
  }

  // ---------- panah antar dua state ----------

  /**
   * Panah dari pusat `a` ke pusat `b`, melengkung sejauh `lengkung` piksel ke
   * sisi kiri arah a -> b (nilai negatif: ke kanan; 0: lurus). Ujung panah
   * dipotong di tepi lingkaran supaya kepala panah menyentuh lingkaran.
   */
  function kurvaAntara(a, b, lengkung, r) {
    const arah = satuan(kurang(b, a));
    const kiri = { x: arah.y, y: -arah.x }; // tegak lurus arah, ke kiri (di layar)
    const tengah = kali(tambah(a, b), 0.5);
    // Titik kendali kurva kuadrat; puncak lengkungnya berada di tengah + kiri*lengkung.
    const kendali = tambah(tengah, kali(kiri, 2 * lengkung));
    const p0 = tambah(a, kali(satuan(kurang(kendali, a)), r));
    const p3 = tambah(b, kali(satuan(kurang(kendali, b)), r));
    // Kurva kuadrat (p0, kendali, p3) ditulis ulang sebagai kurva kubik.
    const c1 = tambah(p0, kali(kurang(kendali, p0), 2 / 3));
    const c2 = tambah(p3, kali(kurang(kendali, p3), 2 / 3));
    const kurva = [p0, c1, c2, p3];
    // Label di sisi luar lengkungan (untuk garis lurus: di sisi kiri, yaitu di
    // atas garis untuk panah kiri ke kanan).
    const sisiLabel = lengkung < 0 ? -1 : 1;
    const label = tambah(titikKurva(kurva, 0.5), kali(kiri, sisiLabel * JARAK_LABEL));
    return { kurva, label };
  }

  // Jarak terdekat kurva ke pusat state lain (selain asal dan tujuan).
  function jarakKeStateLain(kurva, posisi, kecuali) {
    let terdekat = Infinity;
    const sampel = sampelKurva(kurva);
    for (const [id, p] of posisi) {
      if (kecuali.includes(id)) continue;
      for (const s of sampel) terdekat = Math.min(terdekat, jarak(s, p));
    }
    return terdekat;
  }

  // Jarak terdekat antara dua kumpulan titik.
  function jarakTerdekat(titikA, titikB) {
    let terdekat = Infinity;
    for (const a of titikA) for (const b of titikB) terdekat = Math.min(terdekat, jarak(a, b));
    return terdekat;
  }

  /**
   * Pilih lengkungan panah. Calon dicoba berurutan: lurus dulu, lalu lengkung
   * yang makin besar. Calon diterima jika
   *   1. kurvanya tidak menabrak state lain, dan
   *   2. labelnya tidak menimpa panah/label yang sudah ada, dan kurvanya tidak
   *      melewati label yang sudah ada.
   * Jika tidak ada calon yang memenuhi semuanya, dipilih yang paling mendekati.
   * @param {{x: number, y: number}[]} titikPanah titik-titik panah yang sudah digambar
   * @param {{x: number, y: number}[]} titikLabel posisi label yang sudah ada
   */
  function pilihKurva(sisi, posisi, r, titikPanah, titikLabel) {
    const a = posisi.get(sisi.from);
    const b = posisi.get(sisi.to);
    const calon = sisi.bolakBalik ? LENGKUNG_BOLAK_BALIK : LENGKUNG_BIASA;
    let terbaik = null;
    let skorTerbaik = null;
    for (const lengkung of calon) {
      const hasil = kurvaAntara(a, b, lengkung, r);
      const sampel = sampelKurva(hasil.kurva);
      // Syarat 1: jauh dari state lain.
      const keState = jarakKeStateLain(hasil.kurva, posisi, [sisi.from, sisi.to]) - (r + RUANG_BEBAS);
      // Syarat 2: label dan kurva tidak bertumpuk dengan yang sudah ada.
      const labelKeLain = jarakTerdekat([hasil.label], [...titikPanah, ...titikLabel]) - JARAK_BEBAS_LABEL;
      const kurvaKeLabel = jarakTerdekat(sampel, titikLabel) - JARAK_BEBAS_LABEL;
      const keRapian = Math.min(labelKeLain, kurvaKeLabel);
      if (keState >= 0 && keRapian >= 0) return hasil;
      // Menabrak state lebih buruk daripada label bertumpuk, jadi dinilai dulu.
      const skor = [Math.min(0, keState), keRapian];
      if (skorTerbaik === null || skor[0] > skorTerbaik[0] || (skor[0] === skorTerbaik[0] && skor[1] > skorTerbaik[1])) {
        terbaik = hasil;
        skorTerbaik = skor;
      }
    }
    return terbaik;
  }

  // ---------- loop δ(p, a) = p ----------

  const ARAH_LOOP = [
    { nama: 'atas', v: { x: 0, y: -1 } },
    { nama: 'bawah', v: { x: 0, y: 1 } },
    { nama: 'kanan', v: { x: 1, y: 0 } },
    { nama: 'kiri', v: { x: -1, y: 0 } },
  ];

  function kurvaLoop(pusat, arah, r) {
    const kaki = 0.45; // sudut (radian) titik pangkal loop dari arah loop
    const bukaan = 0.6; // sudut titik kendali
    const jangkau = 2.6 * r; // seberapa jauh titik kendali dari pusat
    const p0 = tambah(pusat, kali(putar(arah, -kaki), r));
    const p3 = tambah(pusat, kali(putar(arah, kaki), r));
    const c1 = tambah(pusat, kali(putar(arah, -bukaan), jangkau));
    const c2 = tambah(pusat, kali(putar(arah, bukaan), jangkau));
    const kurva = [p0, c1, c2, p3];
    const puncak = titikKurva(kurva, 0.5);
    const label = tambah(puncak, kali(arah, JARAK_LABEL));
    return { kurva, label };
  }

  /**
   * Pilih arah loop yang paling lega: urutan coba atas, bawah, kanan, kiri.
   * State awal tidak memakai kiri (di sana ada panah awal). Arah diterima jika
   * loop dan labelnya cukup jauh dari state lain dan dari panah yang sudah ada.
   */
  function pilihLoop(node, posisi, titikPanah, r) {
    const pusat = posisi.get(node.id);
    let terbaik = null;
    let skorTerbaik = -Infinity;
    for (const { nama, v } of ARAH_LOOP) {
      if (node.awal && nama === 'kiri') continue;
      const hasil = kurvaLoop(pusat, v, r);
      const titik = [...sampelKurva(hasil.kurva, 8), hasil.label];
      let keState = Infinity;
      for (const [id, p] of posisi) {
        if (id === node.id) continue;
        for (const t of titik) keState = Math.min(keState, jarak(t, p) - r);
      }
      let kePanah = Infinity;
      for (const p of titikPanah) {
        for (const t of titik) kePanah = Math.min(kePanah, jarak(t, p));
      }
      const skor = Math.min(keState - 2 * RUANG_BEBAS, kePanah - 2 * RUANG_BEBAS);
      if (skor >= 0) return { ...hasil, arah: nama };
      if (skor > skorTerbaik) {
        terbaik = { ...hasil, arah: nama };
        skorTerbaik = skor;
      }
    }
    return terbaik;
  }

  // ---------- susun seluruh gambar ----------

  /** Jari-jari lingkaran: cukup untuk nama state terpanjang, dalam batas. */
  function hitungRadius(nodes) {
    const terpanjang = Math.max(0, ...nodes.map((n) => [...n.id].length));
    return Math.min(RADIUS_MAKS, Math.max(RADIUS_MIN, (terpanjang * LEBAR_HURUF) / 2 + 8));
  }

  /**
   * @param {{ nodes: object[], edges: object[] }} graf hasil Graf.buatGraf
   * @param {{ posisi: Map<string, {x: number, y: number}> }} tataLetak hasil Graf.hitungTataLetak
   * @returns {{
   *   radius: number,
   *   kotak: { x: number, y: number, lebar: number, tinggi: number },
   *   states: { id: string, x: number, y: number, awal: boolean, akhir: boolean, terjangkau: boolean }[],
   *   panahAwal: { kurva: object[], d: string } | null,
   *   panah: { from: string, to: string, label: string, loop: boolean, arahLoop: string|null,
   *            kurva: object[], d: string, labelX: number, labelY: number }[]
   * }}
   *   `kotak` adalah batas gambar (untuk atribut viewBox), sudah termasuk tepi.
   */
  function susunGambar(graf, tataLetak) {
    const posisi = tataLetak.posisi;
    const r = hitungRadius(graf.nodes);

    const states = graf.nodes.map((n) => ({
      id: n.id,
      x: posisi.get(n.id).x,
      y: posisi.get(n.id).y,
      awal: n.awal,
      akhir: n.akhir,
      terjangkau: n.terjangkau,
    }));

    let panahAwal = null;
    const nodeAwal = graf.nodes.find((n) => n.awal);
    if (nodeAwal) {
      const p = posisi.get(nodeAwal.id);
      const kurva = [
        { x: p.x - r - PANJANG_PANAH_AWAL, y: p.y },
        { x: p.x - r - (PANJANG_PANAH_AWAL * 2) / 3, y: p.y },
        { x: p.x - r - PANJANG_PANAH_AWAL / 3, y: p.y },
        { x: p.x - r, y: p.y },
      ];
      panahAwal = { kurva, d: teksD(kurva) };
    }

    // Panah antar state dulu, baru loop, supaya loop bisa menghindari panah.
    const panah = [];
    const titikPanah = panahAwal ? sampelKurva(panahAwal.kurva, 4) : [];
    const titikLabel = [];
    for (const sisi of graf.edges) {
      if (sisi.loop) continue;
      const { kurva, label } = pilihKurva(sisi, posisi, r, titikPanah, titikLabel);
      panah.push({ sisi, kurva, label, arahLoop: null });
      titikPanah.push(...sampelKurva(kurva, 10));
      titikLabel.push(label);
    }
    for (const sisi of graf.edges) {
      if (!sisi.loop) continue;
      const node = graf.nodes.find((n) => n.id === sisi.from);
      const { kurva, label, arah } = pilihLoop(node, posisi, [...titikPanah, ...titikLabel], r);
      panah.push({ sisi, kurva, label, arahLoop: arah });
      titikPanah.push(...sampelKurva(kurva, 10));
      titikLabel.push(label);
    }
    // Kembalikan ke urutan sisi di graf (urutan transisi di file).
    panah.sort((p, q) => graf.edges.indexOf(p.sisi) - graf.edges.indexOf(q.sisi));

    const hasilPanah = panah.map(({ sisi, kurva, label, arahLoop }) => ({
      from: sisi.from,
      to: sisi.to,
      label: sisi.symbols.join(', '),
      loop: sisi.loop,
      arahLoop,
      kurva,
      d: teksD(kurva),
      labelX: bulatkan(label.x),
      labelY: bulatkan(label.y),
    }));

    return { radius: r, kotak: hitungKotak(states, panahAwal, hasilPanah, r), states, panahAwal, panah: hasilPanah };
  }

  // Batas gambar: semua lingkaran, titik kendali kurva (kurva selalu berada di
  // dalam titik-titik kendalinya), dan perkiraan kotak label.
  function hitungKotak(states, panahAwal, panah, r) {
    const titik = [];
    for (const s of states) {
      titik.push({ x: s.x - r, y: s.y - r }, { x: s.x + r, y: s.y + r });
    }
    if (panahAwal) titik.push(...panahAwal.kurva);
    for (const p of panah) {
      titik.push(...p.kurva);
      const setengah = ([...p.label].length * LEBAR_HURUF) / 2;
      titik.push({ x: p.labelX - setengah, y: p.labelY - 10 }, { x: p.labelX + setengah, y: p.labelY + 10 });
    }
    if (titik.length === 0) return { x: 0, y: 0, lebar: 2 * TEPI, tinggi: 2 * TEPI };
    const minX = Math.min(...titik.map((p) => p.x)) - TEPI;
    const minY = Math.min(...titik.map((p) => p.y)) - TEPI;
    const maksX = Math.max(...titik.map((p) => p.x)) + TEPI;
    const maksY = Math.max(...titik.map((p) => p.y)) + TEPI;
    return { x: bulatkan(minX), y: bulatkan(minY), lebar: bulatkan(maksX - minX), tinggi: bulatkan(maksY - minY) };
  }

  // ---------- elemen SVG (hanya di browser) ----------

  const NS = 'http://www.w3.org/2000/svg';

  function elSvg(tag, atribut = {}, teks) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atribut)) e.setAttribute(k, String(v));
    if (teks !== undefined) e.textContent = teks; // nama state dari pengguna: selalu sebagai teks
    return e;
  }

  /**
   * Elemen <svg> dari hasil susunGambar. Tampilan (warna, tebal garis) diatur di
   * style.css lewat nama kelas.
   * @param {ReturnType<typeof susunGambar>} gambar
   * @param {string} judul teks untuk pembaca layar
   */
  function buatSvg(gambar, judul) {
    const k = gambar.kotak;
    const svg = elSvg('svg', {
      viewBox: `${k.x} ${k.y} ${k.lebar} ${k.tinggi}`,
      width: k.lebar,
      height: k.tinggi,
      role: 'img',
      'aria-label': judul,
      class: 'graf',
    });

    // Dua kepala panah: biasa, dan untuk panah yang sedang disorot (animasi jejak).
    const defs = elSvg('defs');
    for (const [id, kelas] of [['kepala-panah', 'kepala-panah'], ['kepala-panah-sorot', 'kepala-panah sorot']]) {
      const penanda = elSvg('marker', {
        id,
        viewBox: '0 0 10 10',
        refX: 10,
        refY: 5,
        // Ukuran dalam piksel gambar, tidak ikut tebal garis, supaya kepala
        // panah yang disorot (garis lebih tebal) tidak ikut membesar.
        markerUnits: 'userSpaceOnUse',
        markerWidth: 12,
        markerHeight: 12,
        orient: 'auto',
      });
      penanda.appendChild(elSvg('path', { d: 'M 0 1 L 10 5 L 0 9 z', class: kelas }));
      defs.appendChild(penanda);
    }
    svg.appendChild(defs);

    if (gambar.panahAwal) {
      svg.appendChild(elSvg('path', { d: gambar.panahAwal.d, class: 'panah panah-awal', 'marker-end': 'url(#kepala-panah)' }));
    }

    for (const p of gambar.panah) {
      // data-from/data-to dipakai Animasi.sorotDiagram untuk mencari panah ini.
      const g = elSvg('g', { class: 'transisi', 'data-from': p.from, 'data-to': p.to });
      g.appendChild(elSvg('path', { d: p.d, class: 'panah', 'marker-end': 'url(#kepala-panah)' }));
      g.appendChild(elSvg('text', { x: p.labelX, y: p.labelY, class: 'label-panah' }, p.label));
      svg.appendChild(g);
    }

    for (const s of gambar.states) {
      const kelas = ['state'];
      if (s.akhir) kelas.push('akhir');
      if (!s.terjangkau) kelas.push('tak-terjangkau');
      const g = elSvg('g', { class: kelas.join(' '), 'data-state': s.id });
      g.appendChild(elSvg('circle', { cx: s.x, cy: s.y, r: gambar.radius }));
      if (s.akhir) {
        g.appendChild(elSvg('circle', { cx: s.x, cy: s.y, r: gambar.radius - JARAK_LINGKARAN_GANDA }));
      }
      g.appendChild(elSvg('text', { x: s.x, y: s.y }, s.id));
      svg.appendChild(g);
    }
    return svg;
  }

  const api = { susunGambar, buatSvg, titikKurva };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Gambar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
