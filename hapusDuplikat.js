// scripts/exportEdomPerRespon.js

const { db } = require('./config/firebaseAdmin');
const fs = require('fs');

async function exportEDOM() {

    console.log("==========================================");
    console.log(" EXPORT EDOM UAS PER RESPON");
    console.log("==========================================");

    try {

        //---------------------------------------
        // Ambil daftar pertanyaan
        //---------------------------------------

        const qSnap = await db.collection('edom_kuisioner')
            .orderBy('urutan')
            .get();

        const questions = [];

        qSnap.forEach(doc => {

            questions.push({
                id: doc.id,
                pertanyaan: doc.data().pertanyaan,
                tipe: doc.data().tipe
            });

        });

        //---------------------------------------
        // Ambil semua respon
        //---------------------------------------

        const responSnap = await db.collection('edom_respon').get();

        if (responSnap.empty) {

            console.log("Tidak ada data.");
            return;
        }

        //---------------------------------------
        // Header CSV
        //---------------------------------------

        const header = [
            "No",
            "Tanggal",
            "Periode",
            "Dosen",
            "Kode MK",
            "Mata Kuliah",
            "Responden"
        ];

        questions.forEach(q => {
            header.push(q.pertanyaan);
        });

        header.push("Nilai Akhir");

        const rows = [];
        rows.push(header);

        //---------------------------------------
        // Isi Data
        //---------------------------------------

        let no = 1;

        responSnap.forEach(doc => {

            const data = doc.data();

            const row = [];

            row.push(no);

            row.push(
                data.createdAt
                    ? new Date(data.createdAt).toLocaleString('id-ID')
                    : ""
            );

            row.push(data.periodeNama || data.periodeId || "");
            row.push(data.dosenNama || "");
            row.push(data.mkKode || "");
            row.push(data.mkNama || "");

            // Anonim
            row.push("R" + String(no).padStart(4, "0"));

            questions.forEach(q => {

                let value = "";

                if (Array.isArray(data.jawaban)) {

                    const jawab = data.jawaban.find(j => j.pertanyaanId === q.id);

                    if (jawab) {

                        if (q.tipe === "rating") {

                            value = jawab.nilai ?? "";

                        } else {

                            value = jawab.jawabanTeks ?? "";

                        }

                    }

                }

                row.push(
                    `"${String(value).replace(/"/g,'""')}"`
                );

            });

            row.push(data.nilaiRata ?? "");

            rows.push(row);

            no++;

        });

        //---------------------------------------
        // Simpan CSV
        //---------------------------------------

        const csv = rows.map(r => r.join(",")).join("\n");

        const filename =
            `EDOM_PER_RESPON_${new Date().toISOString().slice(0,10)}.csv`;

        fs.writeFileSync(filename, csv);

        console.log("");
        console.log("==========================================");
        console.log("Jumlah Pertanyaan :", questions.length);
        console.log("Jumlah Respon     :", responSnap.size);
        console.log("==========================================");
        console.log("CSV berhasil dibuat");
        console.log(filename);
        console.log("==========================================");

    } catch(err){

        console.error(err);

    }

    process.exit();

}

exportEDOM();