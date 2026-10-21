"""Basis pengetahuan dari dokumen yang diunggah pengelola.

Alur: unggah -> ekstrak teks per halaman -> potong -> status DRAF -> diperiksa pengelola
-> AKTIF (dipakai agen dan pencarian) / NONAKTIF. Dokumen yang teksnya tidak terbaca
(misalnya PDF hasil scan) berstatus GAGAL.
"""
import hashlib
import io
import json
import re
from datetime import datetime

from . import database as db

FOLDER = db.DATA / "dokumen"
UKURAN_MAKS = 20 * 1024 * 1024
JENIS_FILE = {".pdf", ".txt", ".md"}
KATEGORI = ("regulasi", "manual", "sop", "riwayat_kerusakan", "lainnya")
KATA_PER_POTONGAN, TUMPANG_TINDIH = 180, 40

SKEMA = """
CREATE TABLE IF NOT EXISTS dokumen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    judul TEXT NOT NULL,
    kategori TEXT NOT NULL,
    nama_file TEXT,
    berkas TEXT,
    hash_sha256 TEXT UNIQUE,
    ukuran INTEGER,
    jumlah_halaman INTEGER,
    jumlah_potongan INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('draf', 'aktif', 'nonaktif', 'gagal')),
    pesan TEXT,
    diunggah_oleh TEXT, diunggah_pada TEXT,
    diubah_oleh TEXT, diubah_pada TEXT
);
CREATE TABLE IF NOT EXISTS potongan_dokumen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dokumen_id INTEGER NOT NULL REFERENCES dokumen(id) ON DELETE CASCADE,
    halaman INTEGER, urutan INTEGER, isi TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_potongan_dokumen ON potongan_dokumen (dokumen_id);
"""


class GalatDokumen(Exception):
    """Kesalahan yang pesannya aman ditampilkan ke pengguna."""


def _sekarang():
    return datetime.now().isoformat(timespec="seconds")


def _potong(teks):
    kata = teks.split()
    langkah = KATA_PER_POTONGAN - TUMPANG_TINDIH
    for mulai in range(0, max(len(kata) - TUMPANG_TINDIH, 1), langkah):
        yield " ".join(kata[mulai:mulai + KATA_PER_POTONGAN])


def _halaman_teks(data: bytes, akhiran: str):
    if akhiran == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            raise GalatDokumen("Pustaka pypdf belum terpasang di gateway. Jalankan: pip install pypdf")
        try:
            pembaca = PdfReader(io.BytesIO(data))
            if pembaca.is_encrypted:
                raise GalatDokumen("PDF terkunci kata sandi. Buka kuncinya dulu lalu unggah ulang.")
            return [p.extract_text() or "" for p in pembaca.pages]
        except GalatDokumen:
            raise
        except Exception as e:
            raise GalatDokumen(f"PDF tidak bisa dibaca ({type(e).__name__}). File mungkin rusak.")
    try:
        teks = data.decode("utf-8")
    except UnicodeDecodeError:
        teks = data.decode("latin-1")
    return [teks]


def unggah(nama_file: str, data: bytes, judul: str, kategori: str, oleh: str) -> dict:
    akhiran = "." + nama_file.rsplit(".", 1)[-1].lower() if "." in nama_file else ""
    if akhiran not in JENIS_FILE:
        raise GalatDokumen(f"Jenis file tidak didukung. Gunakan: {', '.join(sorted(JENIS_FILE))}.")
    if kategori not in KATEGORI:
        raise GalatDokumen(f"Kategori harus salah satu dari: {', '.join(KATEGORI)}.")
    if not judul.strip():
        raise GalatDokumen("Judul dokumen wajib diisi.")
    if len(data) > UKURAN_MAKS:
        raise GalatDokumen(f"Ukuran file melebihi {UKURAN_MAKS // (1024 * 1024)} MB.")
    if not data:
        raise GalatDokumen("File kosong.")
    sidik = hashlib.sha256(data).hexdigest()
    with db.koneksi() as con:
        ada = con.execute("SELECT id, judul FROM dokumen WHERE hash_sha256=?", (sidik,)).fetchone()
    if ada:
        raise GalatDokumen(f"File yang sama sudah pernah diunggah sebagai dokumen #{ada['id']} ({ada['judul']}).")

    status, pesan, potongan, halaman = "draf", "Siap diperiksa sebelum diaktifkan.", [], []
    try:
        halaman = _halaman_teks(data, akhiran)
        for nomor, teks in enumerate(halaman, start=1):
            teks = re.sub(r"\s+", " ", teks).strip()
            if len(teks.split()) >= 15:
                potongan += [(nomor, i, isi) for i, isi in enumerate(_potong(teks), start=1)]
        if not potongan:
            status, pesan = "gagal", ("Tidak ada teks yang bisa dibaca. Kemungkinan PDF hasil scan (gambar); "
                                      "gunakan PDF yang teksnya bisa disalin.")
    except GalatDokumen as e:
        status, pesan = "gagal", str(e)

    FOLDER.mkdir(parents=True, exist_ok=True)
    aman = re.sub(r"[^A-Za-z0-9._-]+", "_", nama_file)[-80:]
    with db.koneksi() as con:
        cur = con.execute(
            """INSERT INTO dokumen (judul, kategori, nama_file, hash_sha256, ukuran, jumlah_halaman,
               jumlah_potongan, status, pesan, diunggah_oleh, diunggah_pada)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (judul.strip(), kategori, nama_file, sidik, len(data), len(halaman), len(potongan),
             status, pesan, oleh, _sekarang()))
        did = cur.lastrowid
        berkas = f"{did}_{aman}"
        con.execute("UPDATE dokumen SET berkas=? WHERE id=?", (berkas, did))
        con.executemany("INSERT INTO potongan_dokumen (dokumen_id, halaman, urutan, isi) VALUES (?,?,?,?)",
                        [(did, h, u, isi) for h, u, isi in potongan])
    (FOLDER / berkas).write_bytes(data)
    return detail(did)


def daftar(status: str | None = None, kategori: str | None = None):
    sql, arg = "SELECT * FROM dokumen WHERE 1=1", []
    if status:
        sql += " AND status=?"
        arg.append(status)
    if kategori:
        sql += " AND kategori=?"
        arg.append(kategori)
    with db.koneksi() as con:
        return [_rapikan(r) for r in db.baris(con.execute(sql + " ORDER BY id DESC", arg))]


def _rapikan(d):
    d.pop("hash_sha256", None)
    d["bisa_diunduh"] = bool(d.get("berkas")) and (FOLDER / d["berkas"]).exists()
    d.pop("berkas", None)
    return d


def detail(did: int, mulai: int = 0, jumlah: int = 10):
    with db.koneksi() as con:
        d = con.execute("SELECT * FROM dokumen WHERE id=?", (did,)).fetchone()
        if d is None:
            return None
        pot = db.baris(con.execute(
            "SELECT halaman, urutan, isi FROM potongan_dokumen WHERE dokumen_id=? ORDER BY id LIMIT ? OFFSET ?",
            (did, jumlah, mulai)))
    return {**_rapikan(dict(d)), "potongan": pot, "potongan_mulai": mulai}


def ubah_status(did: int, status: str, oleh: str):
    d = detail(did, jumlah=0)
    if d is None:
        raise GalatDokumen("Dokumen tidak ditemukan.")
    if d["status"] == "gagal":
        raise GalatDokumen("Dokumen gagal diproses dan tidak bisa diaktifkan. Hapus lalu unggah file yang benar.")
    with db.koneksi() as con:
        pesan = "Dipakai agen dan pencarian." if status == "aktif" else "Tidak dipakai agen dan pencarian."
        con.execute("UPDATE dokumen SET status=?, pesan=?, diubah_oleh=?, diubah_pada=? WHERE id=?",
                    (status, pesan, oleh, _sekarang(), did))
    return detail(did)


def hapus(did: int):
    with db.koneksi() as con:
        d = con.execute("SELECT berkas FROM dokumen WHERE id=?", (did,)).fetchone()
        if d is None:
            raise GalatDokumen("Dokumen tidak ditemukan.")
        con.execute("DELETE FROM potongan_dokumen WHERE dokumen_id=?", (did,))
        con.execute("DELETE FROM dokumen WHERE id=?", (did,))
    if d["berkas"] and (FOLDER / d["berkas"]).exists():
        (FOLDER / d["berkas"]).unlink()


def path_berkas(did: int):
    with db.koneksi() as con:
        d = con.execute("SELECT berkas, nama_file FROM dokumen WHERE id=?", (did,)).fetchone()
    if d is None or not d["berkas"] or not (FOLDER / d["berkas"]).exists():
        return None, None
    return FOLDER / d["berkas"], d["nama_file"]


def potongan_aktif(kategori: str | None = None, dokumen_id: int | None = None, termasuk_draf=False):
    """Potongan untuk mesin pencari. Default: hanya dokumen AKTIF."""
    sql = """SELECT p.id, p.halaman, p.isi, d.id AS dokumen_id, d.judul, d.kategori
             FROM potongan_dokumen p JOIN dokumen d ON d.id = p.dokumen_id WHERE 1=1"""
    arg = []
    if not termasuk_draf:
        sql += " AND d.status='aktif'"
    if kategori:
        sql += " AND d.kategori=?"
        arg.append(kategori)
    if dokumen_id:
        sql += " AND d.id=?"
        arg.append(dokumen_id)
    with db.koneksi() as con:
        return db.baris(con.execute(sql + " ORDER BY p.id", arg))


def tanda_tangan_indeks():
    """Berubah setiap kali ada dokumen diaktifkan, dinonaktifkan, atau dihapus."""
    with db.koneksi() as con:
        r = con.execute("""SELECT COUNT(*), COALESCE(SUM(p.id), 0) FROM potongan_dokumen p
                           JOIN dokumen d ON d.id = p.dokumen_id WHERE d.status='aktif'""").fetchone()
    return (r[0], r[1])


def impor_regulasi_lama():
    """Sekali saja: memindahkan isi regulasi.json (hasil siapkan_dokumen.py) menjadi dokumen aktif."""
    berkas = db.DATA / "regulasi.json"
    with db.koneksi() as con:
        con.executescript(SKEMA)
        if con.execute("SELECT COUNT(*) FROM dokumen").fetchone()[0] or not berkas.exists():
            return
        per_sumber = {}
        for p in json.loads(berkas.read_text(encoding="utf-8")):
            per_sumber.setdefault((p["sumber"], p["judul"]), []).append(p)
        for (sumber, judul), isi in per_sumber.items():
            cur = con.execute(
                """INSERT INTO dokumen (judul, kategori, nama_file, jumlah_halaman, jumlah_potongan, status,
                   pesan, diunggah_oleh, diunggah_pada) VALUES (?,?,?,?,?,?,?,?,?)""",
                (f"{sumber} tentang {judul}", "regulasi", None, max(p["halaman"] for p in isi), len(isi),
                 "aktif", "Dipindahkan dari regulasi.json.", "sistem", _sekarang()))
            con.executemany("INSERT INTO potongan_dokumen (dokumen_id, halaman, urutan, isi) VALUES (?,?,?,?)",
                            [(cur.lastrowid, p["halaman"], i, p["isi"]) for i, p in enumerate(isi, 1)])


impor_regulasi_lama()
