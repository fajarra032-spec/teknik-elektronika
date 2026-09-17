/**
 * routes/admin/tagihan.js
 * Admin: Mengelola tagihan mahasiswa (daftar, detail, edit, hapus, import/export CSV)
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getAllMahasiswa } = require('../../helpers/cache');

router.use(verifyToken);
router.use(isAdmin);

// Helper: mendapatkan angkatan dari NIM
function getAngkatanFromNim(nim) {
  if (!nim || nim.length < 2) return null;
  return '20' + nim.substring(0, 2);
}

// ========== RUTE UTAMA (daftar) ==========
router.get('/', async (req, res) => {
  try {
    const { angkatan, search } = req.query;

    // ✅ CACHE: sebelumnya query 'users' (role=mahasiswa) dibaca ULANG dari
    // Firestore setiap kali halaman ini dibuka. getAllMahasiswa() pakai
    // cache bersama 10 menit (helpers/cache.js).
    const semuaMahasiswa = await getAllMahasiswa(db);

    const angkatanSet = new Set();
    let mahasiswaTerfilter = [];
    for (const data of semuaMahasiswa) {
      const nim = data.nim || '';
      const angkatanMhs = getAngkatanFromNim(nim);
      if (angkatanMhs) angkatanSet.add(angkatanMhs);

      if (angkatan && angkatanMhs !== angkatan) continue;
      if (search) {
        const searchLower = search.toLowerCase();
        const nimMatch = nim.toLowerCase().includes(searchLower);
        const namaMatch = (data.nama || '').toLowerCase().includes(searchLower);
        if (!nimMatch && !namaMatch) continue;
      }
      mahasiswaTerfilter.push({ id: data.id, nim, nama: data.nama || '-' });
    }
    mahasiswaTerfilter.sort((a, b) => a.nama.localeCompare(b.nama));
    const angkatanList = Array.from(angkatanSet).sort().reverse();

    // ✅ PAGINASI: default 10/halaman + "Tampilkan Semua". Dokumen `tagihan`
    // HANYA dibaca untuk mahasiswa yang benar-benar tampil di halaman ini -
    // sebelumnya dibaca untuk SEMUA mahasiswa terfilter setiap kunjungan
    // (dan satu-satu berurutan, bukan paralel).
    const TAGIHAN_PAGE_SIZE = 10;
    const showAll = req.query.all === '1';
    const totalMahasiswa = mahasiswaTerfilter.length;
    const buildUrl = (params) => {
      const usp = new URLSearchParams();
      if (angkatan) usp.set('angkatan', angkatan);
      if (search) usp.set('search', search);
      Object.entries(params).forEach(([k, v]) => usp.set(k, v));
      return `/admin/tagihan?${usp.toString()}`;
    };

    let halamanMahasiswa = mahasiswaTerfilter;
    let pageInfo = null;
    if (!showAll) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const start = (page - 1) * TAGIHAN_PAGE_SIZE;
      const paged = mahasiswaTerfilter.slice(start, start + TAGIHAN_PAGE_SIZE);
      const hasPrev = page > 1;
      const hasNext = start + TAGIHAN_PAGE_SIZE < totalMahasiswa;
      pageInfo = {
        hasPrev,
        hasNext,
        prevUrl: hasPrev ? buildUrl({ page: page - 1 }) : null,
        nextUrl: hasNext ? buildUrl({ page: page + 1 }) : null,
        allUrl: buildUrl({ all: '1' }),
        count: paged.length,
        total: totalMahasiswa
      };
      halamanMahasiswa = paged;
    }

    // Baca dokumen tagihan untuk mahasiswa di halaman ini SECARA PARALEL
    // (db.getAll batch) - bukan satu-satu berurutan seperti sebelumnya.
    let mahasiswaList = [];
    if (halamanMahasiswa.length > 0) {
      const tagihanRefs = halamanMahasiswa.map(m => db.collection('tagihan').doc(m.id));
      const tagihanDocs = await db.getAll(...tagihanRefs);
      mahasiswaList = halamanMahasiswa.map((m, idx) => {
        const tagihanDoc = tagihanDocs[idx];
        let totalBelumLunas = 0;
        let tagihanCount = 0;
        if (tagihanDoc.exists) {
          const tagihan = tagihanDoc.data().semester || [];
          tagihanCount = tagihan.length;
          tagihan.forEach(t => {
            if (t.status !== 'lunas') totalBelumLunas += t.jumlah || 0;
          });
        }
        return { ...m, tagihanCount, totalBelumLunas };
      });
    }

    // Notifikasi import/export
    let importResult = null, importError = null;
    if (req.query.import === 'done' && req.session.importResult) {
      importResult = req.session.importResult;
      delete req.session.importResult;
    }
    if (req.session.importError) {
      importError = req.session.importError;
      delete req.session.importError;
    }

    res.render('admin/tagihan_list', {
      title: 'Kelola Tagihan Mahasiswa',
      mahasiswaList,
      totalMahasiswa,
      angkatanList,
      filters: { angkatan: angkatan || '', search: search || '' },
      importResult,
      importError,
      pageInfo,
      showAll,
      pageListUrl: buildUrl({ page: 1 })
    });
  } catch (error) {
    console.error('Error memuat daftar tagihan:', error);
    res.status(500).render('error', { message: 'Gagal memuat daftar tagihan' });
  }
});

// ========== EKSPORT CSV ==========
router.get('/export', async (req, res) => {
  try {
    const { angkatan, search } = req.query;

    const mahasiswaSnapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .orderBy('nim')
      .get();

    const rows = [];
    rows.push(['NIM', 'Nama', 'Semester', 'Jumlah', 'Jatuh Tempo', 'Status']);

    for (const doc of mahasiswaSnapshot.docs) {
      const data = doc.data();
      const nim = data.nim || '';
      const angkatanMhs = getAngkatanFromNim(nim);
      if (angkatan && angkatanMhs !== angkatan) continue;
      if (search) {
        const searchLower = search.toLowerCase();
        const nimMatch = nim.toLowerCase().includes(searchLower);
        const namaMatch = (data.nama || '').toLowerCase().includes(searchLower);
        if (!nimMatch && !namaMatch) continue;
      }

      const tagihanDoc = await db.collection('tagihan').doc(doc.id).get();
      if (tagihanDoc.exists) {
        const tagihanList = tagihanDoc.data().semester || [];
        for (const t of tagihanList) {
          rows.push([
            nim,
            data.nama || '',
            t.semester || '',
            t.jumlah || '',
            t.jatuhTempo || '',
            t.status || 'belum lunas'
          ]);
        }
      } else {
        rows.push([nim, data.nama || '', '', '', '', '']);
      }
    }

    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=tagihan_export.csv');
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('Error export tagihan:', error);
    res.status(500).send('Gagal ekspor data');
  }
});

// ========== TEMPLATE CSV UNTUK IMPORT ==========
router.get('/template', (req, res) => {
  const headers = ['nim', 'semester', 'jumlah', 'jatuh_tempo', 'status'];
  const example = ['20230101', 'Semester 1', '2000000', '2025-01-15', 'belum lunas'];
  const csvContent = [headers, example].map(row => row.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=template_tagihan.csv');
  res.send('\uFEFF' + csvContent);
});

// ========== IMPORT CSV ==========
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file || file.mimetype !== 'text/csv') {
      req.session.importError = 'File harus berformat CSV';
      return res.redirect('/admin/tagihan');
    }

    let csvContent = file.buffer.toString('utf8');
    if (csvContent.charCodeAt(0) === 0xFEFF) csvContent = csvContent.substring(1);
    const lines = csvContent.split(/\r?\n/);
    if (lines.length < 2) {
      req.session.importError = 'File CSV kosong';
      return res.redirect('/admin/tagihan');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['nim', 'semester', 'jumlah'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) {
      req.session.importError = `Header tidak lengkap: ${missing.join(', ')}. Header wajib: nim, semester, jumlah.`;
      return res.redirect('/admin/tagihan');
    }

    let success = 0, failed = 0, errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      const values = line.split(',').map(v => v.trim());
      if (values.length < headers.length) {
        failed++;
        errors.push(`Baris ${i}: Jumlah kolom tidak sesuai`);
        continue;
      }

      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const nim = row.nim;
      const semester = row.semester;
      const jumlah = parseFloat(row.jumlah);
      const jatuhTempo = row.jatuh_tempo || null;
      let status = row.status ? row.status.toLowerCase() : 'belum lunas';
      if (!['belum lunas', 'lunas'].includes(status)) status = 'belum lunas';

      if (!nim || !semester || isNaN(jumlah)) {
        failed++;
        errors.push(`Baris ${i}: NIM, semester, dan jumlah (angka) wajib diisi`);
        continue;
      }

      // Cari mahasiswa berdasarkan NIM
      const userSnapshot = await db.collection('users')
        .where('nim', '==', nim)
        .where('role', '==', 'mahasiswa')
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        failed++;
        errors.push(`Baris ${i}: NIM ${nim} tidak ditemukan`);
        continue;
      }

      const userId = userSnapshot.docs[0].id;
      const tagihanRef = db.collection('tagihan').doc(userId);
      const tagihanDoc = await tagihanRef.get();

      const newTagihan = {
        semester,
        jumlah,
        jatuhTempo: jatuhTempo || null,
        status
      };

      if (tagihanDoc.exists) {
        const data = tagihanDoc.data();
        const semesterList = data.semester || [];
        const existingIndex = semesterList.findIndex(t => t.semester === semester);
        if (existingIndex !== -1) {
          semesterList[existingIndex] = newTagihan;
        } else {
          semesterList.push(newTagihan);
        }
        await tagihanRef.update({ semester: semesterList });
      } else {
        await tagihanRef.set({ semester: [newTagihan] });
      }
      success++;
    }

    req.session.importResult = { success, failed, errors };
    res.redirect('/admin/tagihan?import=done');
  } catch (error) {
    console.error('Import error:', error);
    req.session.importError = 'Gagal memproses file: ' + error.message;
    res.redirect('/admin/tagihan');
  }
});

// ========== RUTE DETAIL, TAMBAH, EDIT, HAPUS ==========

// GET /admin/tagihan/mahasiswa/:id - Detail tagihan per mahasiswa
router.get('/mahasiswa/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).render('error', { message: 'Mahasiswa tidak ditemukan' });
    }
    const mahasiswa = { id: userId, ...userDoc.data() };

    const tagihanDoc = await db.collection('tagihan').doc(userId).get();
    const tagihan = tagihanDoc.exists ? tagihanDoc.data().semester || [] : [];

    res.render('admin/tagihan_detail', {
      title: `Tagihan - ${mahasiswa.nama}`,
      mahasiswa,
      tagihan
    });
  } catch (error) {
    console.error('Error detail tagihan:', error);
    res.status(500).render('error', { message: 'Gagal memuat detail tagihan' });
  }
});

// GET /admin/tagihan/mahasiswa/:id/tambah - Form tambah tagihan baru
router.get('/mahasiswa/:id/tambah', async (req, res) => {
  try {
    const userId = req.params.id;
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).render('error', { message: 'Mahasiswa tidak ditemukan' });
    }
    const mahasiswa = { id: userId, ...userDoc.data() };

    res.render('admin/tagihan_form', {
      title: 'Tambah Tagihan',
      mahasiswa,
      tagihan: null
    });
  } catch (error) {
    console.error('Error load form tambah:', error);
    res.status(500).render('error', { message: 'Gagal memuat form' });
  }
});

// POST /admin/tagihan/mahasiswa/:id/tambah - Simpan tagihan baru
router.post('/mahasiswa/:id/tambah', async (req, res) => {
  try {
    const userId = req.params.id;
    const { semester, jumlah, jatuhTempo } = req.body;

    if (!semester || !jumlah) {
      return res.status(400).send('Semester dan jumlah wajib diisi');
    }

    const tagihanRef = db.collection('tagihan').doc(userId);
    const tagihanDoc = await tagihanRef.get();

    const newTagihan = {
      semester,
      jumlah: parseFloat(jumlah),
      jatuhTempo: jatuhTempo || null,
      status: 'belum lunas'
    };

    if (tagihanDoc.exists) {
      const data = tagihanDoc.data();
      const semesterList = data.semester || [];
      semesterList.push(newTagihan);
      await tagihanRef.update({ semester: semesterList });
    } else {
      await tagihanRef.set({ semester: [newTagihan] });
    }

    res.redirect(`/admin/tagihan/mahasiswa/${userId}`);
  } catch (error) {
    console.error('Error tambah tagihan:', error);
    res.status(500).send('Gagal menambah tagihan');
  }
});

// GET /admin/tagihan/edit/:userId/:index - Form edit tagihan
router.get('/edit/:userId/:index', async (req, res) => {
  try {
    const { userId, index } = req.params;
    const tagihanDoc = await db.collection('tagihan').doc(userId).get();
    if (!tagihanDoc.exists) {
      return res.status(404).send('Data tagihan tidak ditemukan');
    }
    const semesterList = tagihanDoc.data().semester || [];
    const tagihan = semesterList[parseInt(index)];
    if (!tagihan) {
      return res.status(404).send('Tagihan tidak ditemukan');
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const mahasiswa = userDoc.exists ? { id: userId, ...userDoc.data() } : { nama: 'Unknown' };

    res.render('admin/tagihan_form', {
      title: 'Edit Tagihan',
      mahasiswa,
      tagihan,
      index
    });
  } catch (error) {
    console.error('Error load edit:', error);
    res.status(500).send('Gagal memuat form edit');
  }
});

// POST /admin/tagihan/update/:userId/:index - Update tagihan
router.post('/update/:userId/:index', async (req, res) => {
  try {
    const { userId, index } = req.params;
    const { semester, jumlah, jatuhTempo, status } = req.body;

    const tagihanRef = db.collection('tagihan').doc(userId);
    const tagihanDoc = await tagihanRef.get();
    if (!tagihanDoc.exists) {
      return res.status(404).send('Data tagihan tidak ditemukan');
    }

    const semesterList = tagihanDoc.data().semester || [];
    if (!semesterList[parseInt(index)]) {
      return res.status(404).send('Tagihan tidak ditemukan');
    }

    semesterList[parseInt(index)] = {
      semester,
      jumlah: parseFloat(jumlah),
      jatuhTempo: jatuhTempo || null,
      status: status || 'belum lunas'
    };

    await tagihanRef.update({ semester: semesterList });
    res.redirect(`/admin/tagihan/mahasiswa/${userId}`);
  } catch (error) {
    console.error('Error update tagihan:', error);
    res.status(500).send('Gagal update tagihan');
  }
});

// POST /admin/tagihan/delete/:userId/:index - Hapus tagihan
router.post('/delete/:userId/:index', async (req, res) => {
  try {
    const { userId, index } = req.params;
    const tagihanRef = db.collection('tagihan').doc(userId);
    const tagihanDoc = await tagihanRef.get();
    if (!tagihanDoc.exists) {
      return res.status(404).send('Data tagihan tidak ditemukan');
    }

    const semesterList = tagihanDoc.data().semester || [];
    if (!semesterList[parseInt(index)]) {
      return res.status(404).send('Tagihan tidak ditemukan');
    }

    semesterList.splice(parseInt(index), 1);
    await tagihanRef.update({ semester: semesterList });
    res.redirect(`/admin/tagihan/mahasiswa/${userId}`);
  } catch (error) {
    console.error('Error hapus tagihan:', error);
    res.status(500).send('Gagal hapus tagihan');
  }
});

module.exports = router;