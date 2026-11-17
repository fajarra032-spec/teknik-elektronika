#!/usr/bin/env python3
# scripts/import-riwayat-pengajaran.py
#
# Impor riwayat pengajaran Ganjil 2024/2025 ke Firestore `bebanMengajar`.
# Default: DRY-RUN. Tambahkan --confirm untuk benar-benar menulis.
#
# Jalankan dari root proyek:
#   python scripts/import-riwayat-pengajaran.py
#   python scripts/import-riwayat-pengajaran.py --confirm
#
# File data: data/riwayat_pengajaran_ganjil_2024_2025.json
# Kredensial: .env (FIREBASE_*) atau config/serviceAccountKey.json
#
# Script hanya menulis koleksi `bebanMengajar`; tidak mengubah jadwal,
# mataKuliah, mahasiswa, akun dosen, dan tidak menghapus dokumen apa pun.

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PERIODE_ID = "ganjil-2024-2025"
PERIODE_LABEL = "Ganjil 2024/2025"
PERIODE_URUTAN = 4048  # 2 * 2024 + 0 (Ganjil)
TANDA = "import-riwayat-pengajaran-2024-2025"


def slug(value):
    value = str(value or "").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def kunci_nama(nama):
    # Sama dengan helpers/namaDosen.js di aplikasi.
    depan = str(nama or "").split(",")[0].lower()
    depan = re.sub(r"[^a-z\s.]", " ", depan)
    depan = re.sub(r"\b(dr|drs|ir|prof|h|hj)\.", " ", depan)
    depan = re.sub(r"[^a-z\s]", "", depan)
    return re.sub(r"\s+", " ", depan).strip()


def init_firestore():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        sys.exit(
            "Paket firebase-admin belum terpasang.\n"
            "Jalankan: python -m pip install firebase-admin python-dotenv"
        )

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    pid = os.environ.get("FIREBASE_PROJECT_ID")
    email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    key = os.environ.get("FIREBASE_PRIVATE_KEY")

    if pid and email and key:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": pid,
            "client_email": email,
            "private_key": key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        })
    else:
        path = Path("config") / "serviceAccountKey.json"
        if not path.exists():
            sys.exit(
                "Kredensial Firebase tidak ditemukan. Gunakan variabel FIREBASE_* "
                "di .env atau file config/serviceAccountKey.json."
            )
        cred = credentials.Certificate(str(path))

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return firestore.client()


def semester_kurikulum(value):
    value = str(value).strip().upper()
    if value in ("I", "1", "SEMESTER I"):
        return 1
    if value in ("III", "3", "SEMESTER III"):
        return 3
    raise ValueError(f"Semester kurikulum tidak dikenali: {value}")


def baca_data(path):
    if not path.exists():
        raise FileNotFoundError(
            f"File data tidak ditemukan: {path}\n"
            "Letakkan JSON di data/riwayat_pengajaran_ganjil_2024_2025.json"
        )
    with path.open(encoding="utf-8") as f:
        rows = json.load(f)
    if not isinstance(rows, list) or not rows:
        raise ValueError("Data JSON kosong atau formatnya bukan daftar.")
    return rows


def main():
    parser = argparse.ArgumentParser(
        description="Impor riwayat pengajaran Ganjil 2024/2025 ke Firestore."
    )
    parser.add_argument("--confirm", action="store_true",
                        help="Simpan data ke Firestore. Tanpa opsi ini hanya simulasi.")
    parser.add_argument("--data", default="data/riwayat_pengajaran_ganjil_2024_2025.json",
                        help="Lokasi file JSON sumber.")
    args = parser.parse_args()

    mode = "KONFIRMASI - AKAN MENULIS" if args.confirm else "DRY-RUN - TIDAK MENULIS"
    print(f"Mode       : {mode}")
    print(f"Periode    : {PERIODE_LABEL}")
    print(f"Koleksi    : bebanMengajar")
    print("Operasi    : upsert saja; tidak ada penghapusan")
    print()

    rows = baca_data(Path(args.data))
    db = init_firestore()

    # Pemetaan dosen mengikuti cara kerja sinkronisasi JS:
    # cocokkan kunci nama, dan jika duplikat pilih yang dipakai di mataKuliah
    # hanya bila tepat satu dokumen dosen yang memenuhi.
    dosen_docs = list(db.collection("dosen").stream())
    per_kunci = {}
    for doc in dosen_docs:
        key = kunci_nama((doc.to_dict() or {}).get("nama", ""))
        per_kunci.setdefault(key, []).append(doc)

    mk_docs = list(db.collection("mataKuliah").stream())
    dosen_dipakai = set()
    for doc in mk_docs:
        dosen_dipakai.update((doc.to_dict() or {}).get("dosenIds", []) or [])

    semua_nama = sorted({
        nama
        for row in rows
        for nama in row.get("dosenPengampu", [])
    })
    pemetaan = {}
    print("--- Pencocokan dosen ---")
    for nama in semua_nama:
        cocok = per_kunci.get(kunci_nama(nama), [])
        if len(cocok) == 1:
            pemetaan[nama] = cocok[0].id
            print(f"  OK  {nama} -> {(cocok[0].to_dict() or {}).get('nama')} [{cocok[0].id}]")
        elif len(cocok) > 1:
            dipakai = [d for d in cocok if d.id in dosen_dipakai]
            if len(dipakai) == 1:
                pemetaan[nama] = dipakai[0].id
                print(f"  OK  {nama} -> dipilih dari duplikat [{dipakai[0].id}]")
            else:
                pemetaan[nama] = None
                print(f"  PERIKSA  {nama}: ditemukan {len(cocok)} dokumen dosen; tidak ditautkan")
        else:
            pemetaan[nama] = None
            print(f"  BELUM ADA  {nama}: tetap dicatat dengan id null")

    print("\n--- Validasi dan ringkasan sesi ---")
    dokumen = []
    ids = set()
    total_alokasi = {}
    for row in rows:
        kelas = str(row["kelas"]).strip()
        nama_mk = str(row["mataKuliah"]).strip()
        sks_total = float(row["sksMataKuliah"])
        nama_dosen = row.get("dosenPengampu") or []
        if not nama_dosen:
            raise ValueError(f"Tidak ada dosen pengampu: {kelas} / {nama_mk}")

        allocations = row.get("alokasiSksPerDosen") or []
        if len(allocations) != len(nama_dosen):
            raise ValueError(f"Alokasi SKS tidak lengkap: {kelas} / {nama_mk}")
        alloc_by_name = {x["nama"]: float(x["sks"]) for x in allocations}
        if set(alloc_by_name) != set(nama_dosen):
            raise ValueError(f"Nama pada alokasi SKS tidak cocok: {kelas} / {nama_mk}")
        if round(sum(alloc_by_name.values()), 2) != round(sks_total, 2):
            raise ValueError(f"Total alokasi SKS tidak sama dengan SKS MK: {kelas} / {nama_mk}")

        # Pola ID sama dengan data/jadwalBebanDosen.js:
        # `${periodeId}__${slug(kelas.join('+'))}__${slug(kodeMk)}`
        # Data jadwal 2024/2025 tidak memuat kode MK, sehingga nama MK
        # digunakan sebagai komponen terakhir agar ID tetap deterministik.
        doc_id = f"{PERIODE_ID}__{slug(kelas)}__{slug(nama_mk)}"
        if doc_id in ids:
            raise ValueError(f"ID dokumen ganda: {doc_id}")
        ids.add(doc_id)

        semester_kur = semester_kurikulum(row["semester"])
        dosen_data = []
        for nama in nama_dosen:
            alokasi = alloc_by_name[nama]
            dosen_data.append({
                "nama": nama,
                "key": kunci_nama(nama),
                "id": pemetaan.get(nama),
                # SKS yang menjadi bagian dosen ini (dibagi rata).
                "sks": alokasi,
                "alokasiSks": alokasi,
            })
            total_alokasi[nama] = total_alokasi.get(nama, 0) + alokasi

        data = {
            "periodeId": PERIODE_ID,
            "periodeLabel": PERIODE_LABEL,
            "urutan": PERIODE_URUTAN,
            "kelas": [kelas],
            "gabungan": False,
            "semesterKurikulum": semester_kur,
            "kodeMk": None,
            "namaMk": nama_mk,
            "sks": sks_total,
            "sksSistem": None,
            "sksDokumen": sks_total,
            "sksKurikulum": None,
            "dosen": dosen_data,
            "keterangan": f"{row['hari']} {row['jam']} | {row['ruang']}",
            "sumber": row.get("sumber", "Jadwal Perkuliahan Semester Ganjil 2024/2025"),
            "dibuatOleh": TANDA,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            # Metadata arsip tambahan; tidak mengubah koleksi jadwal.
            "tanggalDokumenJadwal": row.get("tanggalDokumenJadwal"),
            "hari": row.get("hari"),
            "jam": row.get("jam"),
            "ruang": row.get("ruang"),
            "alokasiSksMetode": "dibagi_rata",
        }
        dokumen.append((doc_id, data, kelas, nama_mk))

    print(f"Jumlah sesi             : {len(dokumen)}")
    print(f"Jumlah penugasan dosen  : {sum(len(d[1]['dosen']) for d in dokumen)}")
    print("\n--- Rekap alokasi SKS per dosen (dibagi rata) ---")
    for nama, total in sorted(total_alokasi.items()):
        print(f"  {nama:<30} {total:g} SKS")

    # Lindungi dokumen yang sudah ada dan bukan hasil impor ini.
    siap_tulis = []
    dilewati = []
    for doc_id, data, kelas, nama_mk in dokumen:
        existing = db.collection("bebanMengajar").document(doc_id).get()
        if existing.exists:
            existing_data = existing.to_dict() or {}
            if existing_data.get("dibuatOleh") != TANDA:
                dilewati.append((doc_id, existing_data.get("dibuatOleh")))
                print(f"  LEWATI {doc_id}: dokumen sudah ada dan bukan milik script ini")
                continue
        siap_tulis.append((doc_id, data))

    print(f"\nDokumen siap ditulis : {len(siap_tulis)}")
    print(f"Dokumen dilewati     : {len(dilewati)}")
    if not args.confirm:
        print("\nDRY-RUN selesai. Tidak ada data yang ditulis.")
        print("Jika ringkasan sudah benar, jalankan ulang dengan --confirm.")
        return

    batch = db.batch()
    for doc_id, data in siap_tulis:
        ref = db.collection("bebanMengajar").document(doc_id)
        batch.set(ref, data)
    if siap_tulis:
        batch.commit()

    print(f"\nSELESAI: {len(siap_tulis)} dokumen berhasil di-upsert ke bebanMengajar.")
    print("Tidak ada dokumen yang dihapus atau koleksi lain yang diubah.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nGAGAL: {exc}", file=sys.stderr)
        sys.exit(1)
