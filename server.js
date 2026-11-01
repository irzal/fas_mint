// Titik masuk untuk hosting (mis. Hostinger): isi "file masuk" aplikasi dengan berkas ini.
//
// src/web/server.js hanya menyalakan server jika dijalankan langsung
// (node src/web/server.js). Hostinger memuat file masuk lewat require() dan tidak
// mendukung penjaga `require.main === module`, sehingga server tidak pernah menyala.
// Berkas ini selalu menyalakannya, baik dijalankan langsung maupun dimuat lewat require().
//
// Port dibaca dari variabel lingkungan PORT (diberikan hosting), bawaan 3000.
// Log menulis nilai PORT yang diterima dan tiap permintaan yang masuk, supaya mudah
// diperiksa di log hosting apakah permintaan sampai ke aplikasi.

const { buatServer } = require('./src/web/server');

const port = Number(process.env.PORT) || 3000;
buatServer({ catatan: console.log }).listen(port, () => {
  console.log(`FAS berjalan di port ${port} (PORT dari lingkungan: ${process.env.PORT ?? 'tidak diatur'})`);
});
