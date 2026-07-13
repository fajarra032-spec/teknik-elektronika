/**
 * routes/mahasiswa/elkLibrary.js
 * ELK Library khusus mahasiswa: HANYA menampilkan buku (tidak seperti
 * halaman publik /elk-library yang menampilkan semua jenis karya dan bisa
 * difilter berpindah tipe). Halaman ini sengaja tidak punya filter tipe
 * sama sekali supaya selalu terkunci ke koleksi buku.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);

const ITEMS_PER_PAGE = 9;

router.get('/', async (req, res) => {
  try {
    const { search, tahun, page = 1 } = req.query;
    const currentPage = parseInt(page) || 1;

    const bukuSnapshot = await db.collection('buku')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .get();

    let bukuList = bukuSnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data };
    });

    if (search && search.trim() !== '') {
      const lowerSearch = search.toLowerCase();
      bukuList = bukuList.filter(item =>
        (item.judul || '').toLowerCase().includes(lowerSearch) ||
        (item.penulis || '').toLowerCase().includes(lowerSearch) ||
        (item.deskripsi || '').toLowerCase().includes(lowerSearch)
      );
    }
    if (tahun && tahun.trim() !== '') {
      const tahunNum = parseInt(tahun);
      bukuList = bukuList.filter(item => item.tahun === tahunNum);
    }

    const tahunSet = new Set();
    bukuSnapshot.docs.forEach(doc => { if (doc.data().tahun) tahunSet.add(doc.data().tahun); });
    const tahunList = Array.from(tahunSet).sort((a, b) => b - a);

    const totalItemsFiltered = bukuList.length;
    const totalPages = Math.ceil(totalItemsFiltered / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = bukuList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    res.render('mahasiswa/elkLibrary/index', {
      title: 'ELK Library - Buku',
      items: paginatedItems,
      filters: { search: search || '', tahun: tahun || '' },
      tahunList,
      currentPage,
      totalPages,
      totalBuku: bukuSnapshot.size
    });
  } catch (error) {
    console.error('Error ELK Library mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat ELK Library' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('buku').doc(req.params.id).get();
    if (!doc.exists || doc.data().status !== 'approved') {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Buku tidak ditemukan' });
    }
    const data = doc.data();
    const item = { id: doc.id, ...data };
    await doc.ref.update({ views: (data.views || 0) + 1 });

    res.render('mahasiswa/elkLibrary/detail', {
      title: item.judul || 'Detail Buku',
      item
    });
  } catch (error) {
    console.error('Error detail buku mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail buku' });
  }
});

module.exports = router;
