// Titik masuk untuk hosting (mis. Hostinger): isi "file masuk" aplikasi dengan berkas ini.
//
// src/web/server.js hanya menyalakan server jika dijalankan langsung
// (node src/web/server.js). Beberapa hosting justru memuat file masuk lewat
// require(), sehingga server tidak pernah menyala. Berkas ini selalu menyalakannya,
// baik dijalankan langsung maupun dimuat lewat require().
//
// Port dibaca dari variabel lingkungan PORT (diberikan hosting), bawaan 3000.

const { buatServer } = require('./src/web/server');

const port = Number(process.env.PORT) || 3000;
buatServer().listen(port, () => {
  console.log(`FAS berjalan di port ${port}`);
});
