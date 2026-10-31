// Model graf transisi dan tata letaknya. Murni logika (tanpa DOM), jadi dipakai
// browser (lewat <script>) dan dites di Node (lewat require).
//
// Tiga lapisan yang sengaja dipisah:
//   1. buatGraf(dfa)               -> node dan sisi (tanpa posisi)
//   2. hitungTataLetak(graf, nama) -> posisi tiap node, dari fungsi di TATA_LETAK
//   3. penggambar (sub tahap 5c)   -> SVG dari graf + posisi
// Menambah tata letak baru cukup menulis satu fungsi dan mendaftarkannya di
// TATA_LETAK; lapisan lain tidak perlu diubah.

(function (root) {
  const JARAK_KOLOM = 150; // jarak antar kolom (tata letak berlapis)
  const JARAK_BARIS = 110; // jarak antar node dalam satu kolom
  const MARGIN = 70; // ruang kosong di tepi, untuk loop dan sisi melengkung
  const JARAK_MELINGKAR = 100; // jarak sepanjang busur antar node (tata letak melingkar)
  const RADIUS_MIN = 90;

  const bulatkan = (x) => Math.round(x * 100) / 100;

  /**
   * Node dan sisi dari objek Dfa. Tidak memuat posisi.
   *
   * node: { id, awal, akhir, terjangkau, lapis, urutan }
   *   - lapis: jumlah transisi minimum dari state awal (penelusuran melebar);
   *     null jika tidak terjangkau.
   *   - urutan: nomor urut penemuan; node terjangkau dahulu (state awal = 0),
   *     lalu yang tak terjangkau menurut urutan `states`. Tata letak memakainya
   *     agar hasilnya stabil.
   * sisi: { from, to, symbols, loop, bolakBalik }
   *   - satu sisi per pasangan (from, to); beberapa simbol digabung di `symbols`
   *     menurut urutan transisi di file (tanpa duplikat).
   *   - loop: from sama dengan to.
   *   - bolakBalik: ada sisi sebaliknya (to -> from); penggambar melengkungkannya
   *     agar tidak bertumpuk.
   * Transisi yang menyebut state di luar `states` dilewati (DFA belum valid).
   *
   * @param {{ states: string[], start: string, accept: string[],
   *   transitions: { from: string, symbol: string, to: string }[] }} dfa
   * @returns {{ nodes: object[], edges: object[] }}
   */
  function buatGraf(dfa) {
    const ids = [...new Set(dfa.states)];
    const ada = new Set(ids);
    const akhir = new Set(dfa.accept);

    const edges = [];
    const peta = new Map(); // from -> Map(to -> sisi)
    for (const t of dfa.transitions) {
      if (!ada.has(t.from) || !ada.has(t.to)) continue;
      if (!peta.has(t.from)) peta.set(t.from, new Map());
      const ke = peta.get(t.from);
      let sisi = ke.get(t.to);
      if (!sisi) {
        sisi = { from: t.from, to: t.to, symbols: [], loop: t.from === t.to, bolakBalik: false };
        ke.set(t.to, sisi);
        edges.push(sisi);
      }
      if (!sisi.symbols.includes(t.symbol)) sisi.symbols.push(t.symbol);
    }
    for (const sisi of edges) {
      sisi.bolakBalik = !sisi.loop && peta.get(sisi.to)?.has(sisi.from) === true;
    }

    // Penelusuran melebar dari state awal: lapis dan urutan penemuan.
    const lapis = new Map();
    const urutanBfs = [];
    if (ada.has(dfa.start)) {
      lapis.set(dfa.start, 0);
      urutanBfs.push(dfa.start);
      for (let i = 0; i < urutanBfs.length; i++) {
        const dari = urutanBfs[i];
        for (const sisi of edges) {
          if (sisi.from === dari && !lapis.has(sisi.to)) {
            lapis.set(sisi.to, lapis.get(dari) + 1);
            urutanBfs.push(sisi.to);
          }
        }
      }
    }
    const urutan = new Map(urutanBfs.map((id, i) => [id, i]));
    let berikut = urutanBfs.length;
    for (const id of ids) if (!urutan.has(id)) urutan.set(id, berikut++);

    const nodes = ids.map((id) => ({
      id,
      awal: id === dfa.start,
      akhir: akhir.has(id),
      terjangkau: lapis.has(id),
      lapis: lapis.has(id) ? lapis.get(id) : null,
      urutan: urutan.get(id),
    }));
    return { nodes, edges };
  }

  const menurutUrutan = (graf) => [...graf.nodes].sort((a, b) => a.urutan - b.urutan);

  /**
   * Tata letak berlapis: kolom ke-k berisi state yang berjarak k transisi dari
   * state awal; isi satu kolom disusun ke bawah dan dipusatkan secara vertikal.
   * State tak terjangkau ditaruh di kolom tersendiri di paling kanan.
   */
  function tataLetakBerlapis(graf) {
    const urut = menurutUrutan(graf);
    const terjangkau = urut.filter((n) => n.terjangkau);
    const kolomTakTerjangkau = terjangkau.length > 0 ? Math.max(...terjangkau.map((n) => n.lapis)) + 1 : 0;

    const kolom = new Map(); // nomor kolom -> node
    for (const n of urut) {
      const k = n.terjangkau ? n.lapis : kolomTakTerjangkau;
      if (!kolom.has(k)) kolom.set(k, []);
      kolom.get(k).push(n);
    }
    const jumlahKolom = kolom.size === 0 ? 0 : Math.max(...kolom.keys()) + 1;
    const tertinggi = Math.max(1, ...[...kolom.values()].map((isi) => isi.length));

    const posisi = new Map();
    for (const [k, isi] of kolom) {
      isi.forEach((n, i) => {
        posisi.set(n.id, {
          x: bulatkan(MARGIN + k * JARAK_KOLOM),
          y: bulatkan(MARGIN + ((tertinggi - 1) * JARAK_BARIS) / 2 + (i - (isi.length - 1) / 2) * JARAK_BARIS),
        });
      });
    }
    return {
      posisi,
      lebar: bulatkan(2 * MARGIN + Math.max(0, jumlahKolom - 1) * JARAK_KOLOM),
      tinggi: bulatkan(2 * MARGIN + (tertinggi - 1) * JARAK_BARIS),
    };
  }

  /**
   * Tata letak melingkar: semua state di keliling lingkaran, searah jarum jam,
   * mulai dari puncak. State awal (urutan 0) berada di puncak.
   */
  function tataLetakMelingkar(graf) {
    const urut = menurutUrutan(graf);
    const n = urut.length;
    const radius = n <= 1 ? 0 : Math.max(RADIUS_MIN, (n * JARAK_MELINGKAR) / (2 * Math.PI));
    const pusat = MARGIN + radius;
    const posisi = new Map();
    urut.forEach((node, i) => {
      const sudut = -Math.PI / 2 + (2 * Math.PI * i) / n;
      posisi.set(node.id, {
        x: bulatkan(pusat + radius * Math.cos(sudut)),
        y: bulatkan(pusat + radius * Math.sin(sudut)),
      });
    });
    return { posisi, lebar: bulatkan(2 * pusat), tinggi: bulatkan(2 * pusat) };
  }

  /** Daftar tata letak: nama -> fungsi (graf) => { posisi: Map, lebar, tinggi }. */
  const TATA_LETAK = {
    berlapis: tataLetakBerlapis,
    melingkar: tataLetakMelingkar,
  };

  /** Untuk menu pilihan di halaman; yang pertama adalah bawaan. */
  const DAFTAR_TATA_LETAK = [
    { nama: 'berlapis', label: 'Berlapis (kiri ke kanan dari state awal)' },
    { nama: 'melingkar', label: 'Melingkar' },
  ];

  /**
   * @param {{ nodes: object[], edges: object[] }} graf hasil buatGraf
   * @param {string} [nama] kunci di TATA_LETAK; bawaan 'berlapis'
   * @returns {{ posisi: Map<string, {x: number, y: number}>, lebar: number, tinggi: number }}
   */
  function hitungTataLetak(graf, nama = 'berlapis') {
    if (!Object.prototype.hasOwnProperty.call(TATA_LETAK, nama)) {
      throw new Error(`tata letak '${nama}' tidak dikenal`);
    }
    return TATA_LETAK[nama](graf);
  }

  const api = { buatGraf, hitungTataLetak, TATA_LETAK, DAFTAR_TATA_LETAK };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Graf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
