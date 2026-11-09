/**
 * data/lkmBlueprints.js
 *
 * Kumpulan "blueprint" cetak LKM: tiap modul praktikum yang belum punya
 * template cetak khusus (views/lkm_xxx_print.ejs) memiliki susunan blok
 * sendiri yang dirender oleh views/lkm_blueprint_print.ejs. Susunan tiap
 * modul berbeda dan mengikuti isi praktikumnya (lihat data/lkmBlueprints/*.js).
 *
 * Disambungkan ke data/modulPraktikumData.js (field `viewCetak` dan `blueprint`).
 */
module.exports = Object.assign(
  {},
  require('./lkmBlueprints/pla'),
  require('./lkmBlueprints/ak'),
  require('./lkmBlueprints/dsi'),
  require('./lkmBlueprints/tp'),
  require('./lkmBlueprints/mgt'),
  require('./lkmBlueprints/dstl'),
  require('./lkmBlueprints/pt'),
  require('./lkmBlueprints/k3'),
  require('./lkmBlueprints/pp')
);
