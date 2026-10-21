"""Penyimpanan lokal WeselGuard (SQLite) di Raspberry Pi.

Semua ringkasan siklus disimpan, termasuk yang normal, karena tren indeks kesehatan
hanya bisa dihitung kalau siklus normal ikut tercatat.
"""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"
DB_PATH = DATA / "weselguard.db"

SKEMA = """
CREATE TABLE IF NOT EXISTS siklus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wesel_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    rms REAL, kurtosis REAL, puncak_hz REAL, durasi_s REAL,
    indeks REAL, skor_kecocokan REAL, kondisi_kandidat TEXT, status TEXT
);
CREATE INDEX IF NOT EXISTS idx_siklus_wesel_ts ON siklus (wesel_id, ts);

CREATE TABLE IF NOT EXISTS profil_normal (
    wesel_id TEXT NOT NULL, fitur TEXT NOT NULL, rata REAL, simpangan REAL, jumlah INTEGER,
    PRIMARY KEY (wesel_id, fitur)
);

CREATE TABLE IF NOT EXISTS ringkasan_harian (
    wesel_id TEXT NOT NULL, tanggal TEXT NOT NULL,
    indeks_rata REAL, indeks_min REAL, jumlah_siklus INTEGER, jumlah_anomali INTEGER,
    PRIMARY KEY (wesel_id, tanggal)
);

CREATE TABLE IF NOT EXISTS riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wesel_id TEXT NOT NULL, tanggal TEXT, kondisi TEXT, kelas TEXT,
    keputusan_petugas TEXT, catatan TEXT
);

CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    wesel_id TEXT NOT NULL, jenis TEXT NOT NULL,
    kondisi TEXT, kelas TEXT, ringkasan TEXT, alasan TEXT,
    langkah TEXT, rujukan TEXT, status TEXT NOT NULL,
    catatan_petugas TEXT, dibuat TEXT
);

CREATE TABLE IF NOT EXISTS pengguna (
    username TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    peran TEXT NOT NULL CHECK (peran IN ('admin', 'petugas', 'pengamat', 'pengelola')),
    hash_sandi TEXT NOT NULL,
    aktif INTEGER NOT NULL DEFAULT 1,
    dibuat TEXT
);

CREATE TABLE IF NOT EXISTS notifikasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    jenis TEXT NOT NULL,      -- status, work_order, keputusan, sensor, koneksi
    tingkat TEXT NOT NULL CHECK (tingkat IN ('info', 'peringatan', 'kritis')),
    wesel_id TEXT,
    judul TEXT NOT NULL,
    pesan TEXT,
    ref_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifikasi_ts ON notifikasi (ts);

CREATE TABLE IF NOT EXISTS notifikasi_dibaca (
    notifikasi_id INTEGER NOT NULL REFERENCES notifikasi(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    PRIMARY KEY (notifikasi_id, username)
);

CREATE TABLE IF NOT EXISTS status_terakhir (
    wesel_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    sejak TEXT NOT NULL,
    senyap INTEGER NOT NULL DEFAULT 0,
    puncak TEXT NOT NULL DEFAULT 'Normal'
);

CREATE TABLE IF NOT EXISTS audit_pengguna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL, oleh TEXT NOT NULL, target TEXT NOT NULL,
    aksi TEXT NOT NULL, detail TEXT
);

CREATE TABLE IF NOT EXISTS sesi (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES pengguna(username) ON DELETE CASCADE,
    dibuat TEXT NOT NULL,
    kedaluwarsa TEXT NOT NULL
);
"""


@contextmanager
def koneksi():
    """Satu koneksi per pemakaian. Mode WAL agar penerima data, server, dan agen
    bisa membaca dan menulis bersamaan tanpa saling mengunci terlalu lama."""
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def siapkan():
    with koneksi() as con:
        con.executescript(SKEMA)
        kolom = [r[1] for r in con.execute("PRAGMA table_info(work_orders)")]
        # database dari versi sebelumnya: tambahkan kolom baru di akhir tabel
        for nama in ("diputuskan_oleh", "diputuskan_pada"):
            if nama not in kolom:
                con.execute(f"ALTER TABLE work_orders ADD COLUMN {nama} TEXT")
        sql_pengguna = con.execute("SELECT sql FROM sqlite_master WHERE name='pengguna'").fetchone()[0]
        if "'pengelola'" not in sql_pengguna:  # tambah peran pengelola ke tabel lama
            con.executescript("""
                ALTER TABLE pengguna RENAME TO pengguna_lama;
                CREATE TABLE pengguna (
                    username TEXT PRIMARY KEY, nama TEXT NOT NULL,
                    peran TEXT NOT NULL CHECK (peran IN ('admin', 'petugas', 'pengamat', 'pengelola')),
                    hash_sandi TEXT NOT NULL, aktif INTEGER NOT NULL DEFAULT 1, dibuat TEXT);
                INSERT INTO pengguna SELECT username, nama, peran, hash_sandi, aktif, dibuat FROM pengguna_lama;
                DROP TABLE pengguna_lama;""")
        if "puncak" not in [r[1] for r in con.execute("PRAGMA table_info(status_terakhir)")]:
            con.execute("ALTER TABLE status_terakhir ADD COLUMN puncak TEXT NOT NULL DEFAULT 'Normal'")


def baris(rows):
    return [dict(r) for r in rows]


# ---------- Siklus dan ringkasan ----------

def simpan_siklus(data: dict):
    with koneksi() as con:
        con.execute(
            """INSERT INTO siklus (wesel_id, ts, rms, kurtosis, puncak_hz, durasi_s,
               indeks, skor_kecocokan, kondisi_kandidat, status)
               VALUES (:wesel_id, :ts, :rms, :kurtosis, :puncak_hz, :durasi_s,
               :indeks, :skor_kecocokan, :kondisi_kandidat, :status)""", data)


def siklus_terakhir(wesel_id: str, jumlah: int = 10):
    with koneksi() as con:
        return baris(con.execute(
            "SELECT * FROM siklus WHERE wesel_id=? ORDER BY ts DESC LIMIT ?", (wesel_id, jumlah)))


def daftar_wesel():
    with koneksi() as con:
        return [r[0] for r in con.execute("SELECT DISTINCT wesel_id FROM siklus ORDER BY wesel_id")]


def harian(wesel_id: str, hari: int = 14):
    """Rata-rata indeks per hari: dari siklus yang masih ada, ditambah arsip harian."""
    batas = (datetime.now() - timedelta(days=hari)).date().isoformat()
    with koneksi() as con:
        baru = baris(con.execute(
            """SELECT date(ts) AS tanggal, AVG(indeks) AS indeks_rata, MIN(indeks) AS indeks_min,
                      COUNT(*) AS jumlah_siklus, SUM(status != 'Normal') AS jumlah_anomali
               FROM siklus WHERE wesel_id=? AND date(ts) >= ? GROUP BY date(ts)""", (wesel_id, batas)))
        arsip = baris(con.execute(
            "SELECT * FROM ringkasan_harian WHERE wesel_id=? AND tanggal >= ?", (wesel_id, batas)))
    gabung = {r["tanggal"]: r for r in arsip}
    gabung.update({r["tanggal"]: r for r in baru})
    return [gabung[t] for t in sorted(gabung)]


def bersihkan(simpan_hari: int = 90):
    """Arsipkan siklus lama menjadi ringkasan harian, lalu hapus siklusnya."""
    batas = (datetime.now() - timedelta(days=simpan_hari)).date().isoformat()
    with koneksi() as con:
        con.execute(
            """INSERT OR REPLACE INTO ringkasan_harian
               SELECT wesel_id, date(ts), AVG(indeks), MIN(indeks), COUNT(*), SUM(status != 'Normal')
               FROM siklus WHERE date(ts) < ? GROUP BY wesel_id, date(ts)""", (batas,))
        hapus = con.execute("DELETE FROM siklus WHERE date(ts) < ?", (batas,)).rowcount
    return hapus


# ---------- Profil normal ----------

def simpan_profil(wesel_id: str, profil: dict):
    with koneksi() as con:
        for fitur, (rata, simpangan, jumlah) in profil.items():
            con.execute("INSERT OR REPLACE INTO profil_normal VALUES (?,?,?,?,?)",
                        (wesel_id, fitur, rata, simpangan, jumlah))


def ambil_profil(wesel_id: str):
    with koneksi() as con:
        rows = con.execute("SELECT * FROM profil_normal WHERE wesel_id=?", (wesel_id,)).fetchall()
    return {r["fitur"]: (r["rata"], r["simpangan"]) for r in rows}


# ---------- Riwayat dan work order ----------

def riwayat(wesel_id: str | None = None):
    with koneksi() as con:
        if wesel_id:
            return baris(con.execute("SELECT * FROM riwayat WHERE wesel_id=? ORDER BY tanggal", (wesel_id,)))
        return baris(con.execute("SELECT * FROM riwayat ORDER BY tanggal"))


def tambah_riwayat(wesel_id, tanggal, kondisi, kelas, keputusan, catatan):
    with koneksi() as con:
        con.execute("INSERT INTO riwayat (wesel_id, tanggal, kondisi, kelas, keputusan_petugas, catatan) "
                    "VALUES (?,?,?,?,?,?)", (wesel_id, tanggal, kondisi, kelas, keputusan, catatan))


def work_orders(hanya_terbuka: bool = False):
    sql = "SELECT * FROM work_orders"
    if hanya_terbuka:
        sql += " WHERE status LIKE 'MENUNGGU%'"
    with koneksi() as con:
        return baris(con.execute(sql + " ORDER BY dibuat"))


def tambah_work_order(data: dict) -> dict:
    with koneksi() as con:
        n = con.execute("SELECT COUNT(*) FROM work_orders").fetchone()[0]
        awalan = "ESK" if data["jenis"] == "ESKALASI" else "WO"
        data = {"kondisi": None, "kelas": None, "ringkasan": None, "alasan": None, "langkah": None,
                "rujukan": None, "catatan_petugas": None, "diputuskan_oleh": None, "diputuskan_pada": None, **data,
                "id": f"{awalan}-{n + 1:03d}", "dibuat": datetime.now().isoformat(timespec="seconds")}
        con.execute("""INSERT INTO work_orders VALUES (:id, :wesel_id, :jenis, :kondisi, :kelas, :ringkasan,
                       :alasan, :langkah, :rujukan, :status, :catatan_petugas, :dibuat, :diputuskan_oleh,
                       :diputuskan_pada)""", data)
    return data


def ubah_status_work_order(wo_id: str, status: str, catatan: str = "", oleh: str | None = None):
    with koneksi() as con:
        con.execute("UPDATE work_orders SET status=?, catatan_petugas=?, diputuskan_oleh=?, diputuskan_pada=? "
                    "WHERE id=?", (status, catatan, oleh, datetime.now().isoformat(timespec="seconds"), wo_id))
        row = con.execute("SELECT * FROM work_orders WHERE id=?", (wo_id,)).fetchone()
    return dict(row) if row else None


def impor_json():
    """Memindahkan riwayat.json dan work_orders.json lama ke database (sekali saja)."""
    with koneksi() as con:
        if con.execute("SELECT COUNT(*) FROM riwayat").fetchone()[0] == 0 and (DATA / "riwayat.json").exists():
            for r in json.loads((DATA / "riwayat.json").read_text(encoding="utf-8")):
                con.execute("INSERT INTO riwayat (wesel_id, tanggal, kondisi, kelas, keputusan_petugas, catatan) "
                            "VALUES (?,?,?,?,?,?)", (r["wesel_id"], r["tanggal"], r["kondisi"], r["kelas"],
                                                     r["keputusan_petugas"], r.get("catatan", "")))


# ---------- Pengguna dan sesi login ----------

ITERASI_HASH = 200_000
LAMA_SESI_JAM = 12  # satu sif kerja


def _hash_sandi(sandi: str, garam: bytes | None = None) -> str:
    garam = garam or secrets.token_bytes(16)
    turunan = hashlib.pbkdf2_hmac("sha256", sandi.encode(), garam, ITERASI_HASH)
    return f"pbkdf2_sha256${ITERASI_HASH}${garam.hex()}${turunan.hex()}"


def _cek_sandi(sandi: str, tersimpan: str) -> bool:
    _, iterasi, garam, turunan = tersimpan.split("$")
    uji = hashlib.pbkdf2_hmac("sha256", sandi.encode(), bytes.fromhex(garam), int(iterasi))
    return hmac.compare_digest(uji.hex(), turunan)


def _hash_token(token: str) -> str:
    # Database hanya menyimpan hash token, sehingga isi database yang bocor tidak bisa dipakai login.
    return hashlib.sha256(token.encode()).hexdigest()


PERAN = ("admin", "petugas", "pengelola", "pengamat")
POLA_USERNAME = re.compile(r"^[a-z0-9_.-]{3,30}$")


def _validasi_sandi(sandi: str):
    if len(sandi) < 8:
        raise ValueError("Kata sandi minimal 8 karakter.")


def tambah_pengguna(username: str, nama: str, peran: str, sandi: str):
    username = username.strip().lower()
    if not POLA_USERNAME.match(username):
        raise ValueError("Username 3-30 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.")
    if peran not in PERAN:
        raise ValueError(f"Peran harus salah satu dari: {', '.join(PERAN)}.")
    if not nama.strip():
        raise ValueError("Nama wajib diisi.")
    _validasi_sandi(sandi)
    with koneksi() as con:
        if con.execute("SELECT 1 FROM pengguna WHERE username=?", (username,)).fetchone():
            raise ValueError(f"Username {username} sudah dipakai.")
        con.execute("INSERT INTO pengguna (username, nama, peran, hash_sandi, dibuat) VALUES (?,?,?,?,?)",
                    (username, nama.strip(), peran, _hash_sandi(sandi), datetime.now().isoformat(timespec="seconds")))


def ambil_pengguna(username: str):
    with koneksi() as con:
        r = con.execute("SELECT username, nama, peran, aktif, dibuat FROM pengguna WHERE username=?",
                        (username,)).fetchone()
    return dict(r) if r else None


def jumlah_admin_aktif(kecuali: str | None = None) -> int:
    with koneksi() as con:
        return con.execute("SELECT COUNT(*) FROM pengguna WHERE peran='admin' AND aktif=1 AND username != ?",
                           (kecuali or "",)).fetchone()[0]


def ubah_pengguna(username: str, nama: str | None = None, peran: str | None = None):
    if peran is not None and peran not in PERAN:
        raise ValueError(f"Peran harus salah satu dari: {', '.join(PERAN)}.")
    if nama is not None and not nama.strip():
        raise ValueError("Nama tidak boleh kosong.")
    with koneksi() as con:
        if nama is not None:
            con.execute("UPDATE pengguna SET nama=? WHERE username=?", (nama.strip(), username))
        if peran is not None:
            con.execute("UPDATE pengguna SET peran=? WHERE username=?", (peran, username))
            con.execute("DELETE FROM sesi WHERE username=?", (username,))  # wajib masuk ulang dengan peran baru


def ganti_sandi(username: str, sandi: str, pertahankan_token: str | None = None):
    """Mengganti kata sandi dan mengeluarkan semua sesi akun itu, kecuali sesi yang sedang dipakai
    (bila pertahankan_token diisi, misalnya saat seseorang mengganti sandinya sendiri)."""
    _validasi_sandi(sandi)
    with koneksi() as con:
        con.execute("UPDATE pengguna SET hash_sandi=? WHERE username=?", (_hash_sandi(sandi), username))
        con.execute("DELETE FROM sesi WHERE username=? AND token_hash != ?",
                    (username, _hash_token(pertahankan_token) if pertahankan_token else ""))


def cocokkan_sandi(username: str, sandi: str) -> bool:
    with koneksi() as con:
        r = con.execute("SELECT hash_sandi FROM pengguna WHERE username=?", (username,)).fetchone()
    return bool(r) and _cek_sandi(sandi, r["hash_sandi"])


def atur_aktif(username: str, aktif: bool):
    with koneksi() as con:
        con.execute("UPDATE pengguna SET aktif=? WHERE username=?", (int(aktif), username))
        if not aktif:
            con.execute("DELETE FROM sesi WHERE username=?", (username,))


def daftar_pengguna():
    with koneksi() as con:
        return baris(con.execute(
            """SELECT p.username, p.nama, p.peran, p.aktif, p.dibuat,
                      (SELECT MAX(dibuat) FROM sesi s WHERE s.username = p.username) AS masuk_terakhir
               FROM pengguna p ORDER BY p.username"""))


def catat_audit(oleh: str, target: str, aksi: str, detail: str = ""):
    with koneksi() as con:
        con.execute("INSERT INTO audit_pengguna (ts, oleh, target, aksi, detail) VALUES (?,?,?,?,?)",
                    (datetime.now().isoformat(timespec="seconds"), oleh, target, aksi, detail))


def daftar_audit(batas: int = 50):
    with koneksi() as con:
        return baris(con.execute("SELECT * FROM audit_pengguna ORDER BY id DESC LIMIT ?", (batas,)))


def masuk(username: str, sandi: str) -> tuple[str, dict] | None:
    """Memeriksa kata sandi. Jika benar, membuat sesi baru dan mengembalikan (token, pengguna)."""
    with koneksi() as con:
        row = con.execute("SELECT * FROM pengguna WHERE username=? AND aktif=1", (username,)).fetchone()
    if row is None or not _cek_sandi(sandi, row["hash_sandi"]):
        return None
    token = secrets.token_urlsafe(32)
    sekarang = datetime.now()
    with koneksi() as con:
        con.execute("DELETE FROM sesi WHERE kedaluwarsa < ?", (sekarang.isoformat(),))
        con.execute("INSERT INTO sesi VALUES (?,?,?,?)",
                    (_hash_token(token), username, sekarang.isoformat(timespec="seconds"),
                     (sekarang + timedelta(hours=LAMA_SESI_JAM)).isoformat(timespec="seconds")))
    return token, {"username": row["username"], "nama": row["nama"], "peran": row["peran"]}


def pengguna_dari_token(token: str | None) -> dict | None:
    if not token:
        return None
    with koneksi() as con:
        row = con.execute(
            """SELECT p.username, p.nama, p.peran FROM sesi s JOIN pengguna p ON p.username = s.username
               WHERE s.token_hash=? AND s.kedaluwarsa > ? AND p.aktif=1""",
            (_hash_token(token), datetime.now().isoformat())).fetchone()
    return dict(row) if row else None


def keluar(token: str | None):
    if token:
        with koneksi() as con:
            con.execute("DELETE FROM sesi WHERE token_hash=?", (_hash_token(token),))


siapkan()
