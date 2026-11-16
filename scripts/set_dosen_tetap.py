#!/usr/bin/env python3
"""
scripts/set_dosen_tetap.py

Menetapkan DOSEN TETAP (= Dosen Homebase, field `statusDosen` = 'homebase')
untuk:
    Fajar Ramadhan, Miftahul Hairia, Ariani Amri, Suardi, Rahman Syam, Gunawan Tari

Pencocokan nama tahan gelar/tanda baca/huruf besar-kecil
(mis. "Dr. Suardi, S.T., M.T." cocok dengan "Suardi"), dan toleran salah ketik
kecil (mis. "Miiftahul Hairia"). Kalau nama cocok ke >1 dokumen atau tidak
ditemukan, TIDAK ditebak: hanya dilaporkan.

DEFAULT DRY-RUN (hanya simulasi). Tambahkan --confirm untuk menulis.

Pemakaian (jalankan dari ROOT proyek):
    pip install firebase-admin python-dotenv
    python3 scripts/set_dosen_tetap.py                       # dry-run
    python3 scripts/set_dosen_tetap.py --confirm             # tulis
    python3 scripts/set_dosen_tetap.py --confirm --sisanya-bantu
        # dosen lain di luar daftar ikut ditetapkan 'bantu'

Kredensial Firebase: sama seperti aplikasi - env FIREBASE_PROJECT_ID,
FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (dibaca juga dari .env),
atau file config/serviceAccountKey.json.
"""
import os
import re
import sys
import difflib
from datetime import datetime, timezone

DOSEN_TETAP = [
    "Fajar Ramadhan",
    "Miftahul Hairia",
    "Ariani Amri",
    "Suardi",
    "Rahman Syam",
    "Gunawan Tari",
]

STATUS_TETAP = "homebase"
STATUS_LAIN = "bantu"
AMBANG_MIRIP = 0.88  # toleransi salah ketik kecil


def kunci_nama(nama):
    """Padanan helpers/namaDosen.js: buang gelar depan & belakang, huruf kecil."""
    depan = str(nama or "").split(",")[0].lower()
    depan = re.sub(r"[^a-z\s.]", " ", depan)
    depan = re.sub(r"\b(dr|drs|ir|prof|h|hj)\.", " ", depan)
    depan = re.sub(r"[^a-z\s]", "", depan)
    return re.sub(r"\s+", " ", depan).strip()


def cari_cocok(target, kandidat):
    """kandidat: list (id, nama). Return (daftar_cocok, metode)."""
    kt = kunci_nama(target)
    persis = [(i, n) for i, n in kandidat if kunci_nama(n) == kt]
    if persis:
        return persis, "persis"
    mirip = [
        (i, n) for i, n in kandidat
        if difflib.SequenceMatcher(None, kt, kunci_nama(n)).ratio() >= AMBANG_MIRIP
    ]
    return mirip, "mirip"


def init_firestore():
    import firebase_admin
    from firebase_admin import credentials, firestore
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
        path = os.path.join("config", "serviceAccountKey.json")
        if not os.path.exists(path):
            sys.exit("Kredensial Firebase tidak ditemukan (env FIREBASE_* atau config/serviceAccountKey.json). "
                     "Jalankan dari root proyek.")
        cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)
    return firestore.client()


def main():
    konfirmasi = "--confirm" in sys.argv
    sisanya_bantu = "--sisanya-bantu" in sys.argv
    print("Mode:", "🔴 KONFIRMASI - AKAN MENULIS" if konfirmasi else "🟡 DRY-RUN - hanya simulasi")

    db = init_firestore()
    docs = list(db.collection("dosen").stream())
    kandidat = [(d.id, (d.to_dict() or {}).get("nama", "")) for d in docs]
    status_now = {d.id: (d.to_dict() or {}).get("statusDosen") for d in docs}
    print(f"Total dosen di sistem: {len(docs)}\n")

    id_tetap, bermasalah = set(), []
    for target in DOSEN_TETAP:
        cocok, metode = cari_cocok(target, kandidat)
        if len(cocok) == 1:
            did, nama = cocok[0]
            id_tetap.add(did)
            tanda = "" if metode == "persis" else "  (cocok MIRIP - periksa!)"
            print(f"✅ {target:<18} -> {nama}  [{did}]{tanda}")
        elif not cocok:
            print(f"❌ {target:<18} -> TIDAK DITEMUKAN di koleksi dosen")
            bermasalah.append(target)
        else:
            print(f"⚠️  {target:<18} -> cocok ke {len(cocok)} dokumen, dilewati: "
                  + "; ".join(f"{n} [{i}]" for i, n in cocok))
            bermasalah.append(target)

    id_bantu = set()
    if sisanya_bantu:
        id_bantu = {i for i, _ in kandidat} - id_tetap
        print(f"\nDosen lain yang akan ditetapkan '{STATUS_LAIN}': {len(id_bantu)}")
        if bermasalah:
            print("⚠️  Ada nama yang bermasalah di atas; --sisanya-bantu akan ikut menandai dosen "
                  "yang sebenarnya tetap sebagai 'bantu'. Selesaikan dulu masalahnya, lalu ulangi.")
            if konfirmasi:
                sys.exit("Dibatalkan demi keamanan (tidak ada yang ditulis).")

    ubah = {i: STATUS_TETAP for i in id_tetap if status_now.get(i) != STATUS_TETAP}
    ubah.update({i: STATUS_LAIN for i in id_bantu if status_now.get(i) != STATUS_LAIN})
    print(f"\nPerubahan yang diperlukan: {len(ubah)} dokumen "
          f"({sum(v == STATUS_TETAP for v in ubah.values())} tetap, "
          f"{sum(v == STATUS_LAIN for v in ubah.values())} bantu)")

    if konfirmasi and ubah:
        sekarang = datetime.now(timezone.utc).isoformat()
        batch = db.batch()
        for n, (did, status) in enumerate(ubah.items(), 1):
            batch.update(db.collection("dosen").document(did),
                         {"statusDosen": status, "updatedAt": sekarang})
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
        print("✔ Selesai ditulis. Restart server (atau tunggu cache dosen kedaluwarsa) agar daftar ikut terbarui.")
    elif not konfirmasi:
        print("Dry-run selesai. Tambahkan --confirm untuk menulis.")


if __name__ == "__main__":
    main()
