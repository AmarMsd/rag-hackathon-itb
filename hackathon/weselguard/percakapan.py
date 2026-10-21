"""Riwayat percakapan per akun.

Isi percakapan (pesan, panggilan tool, jawaban) disimpan oleh ADK di percakapan.db.
Modul ini menyimpan data ringkasnya di weselguard.db: pemilik, judul, cuplikan, waktu,
sehingga daftar percakapan bisa ditampilkan cepat tanpa membuka setiap sesi.
"""
import os
from datetime import datetime, timedelta

from . import database as db

SIMPAN_HARI = int(os.getenv("WESELGUARD_SIMPAN_PERCAKAPAN_HARI", "30"))

SKEMA = """
CREATE TABLE IF NOT EXISTS percakapan (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('chat', 'analisis')),
    judul TEXT NOT NULL,
    cuplikan TEXT,
    jumlah_pesan INTEGER NOT NULL DEFAULT 0,
    dibuat TEXT NOT NULL,
    diperbarui TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_percakapan_pemilik ON percakapan (username, diperbarui);
"""

with db.koneksi() as _con:
    _con.executescript(SKEMA)


def _sekarang():
    return datetime.now().isoformat(timespec="seconds")


def judul_dari(pesan: str, panjang: int = 60) -> str:
    pesan = " ".join(pesan.split())
    if len(pesan) <= panjang:
        return pesan
    return pesan[:panjang].rsplit(" ", 1)[0] + "…"


def catat(session_id: str, username: str, jenis: str, pesan: str, jawaban: str, judul: str | None = None):
    cuplikan = judul_dari(jawaban or "", 140)
    with db.koneksi() as con:
        ada = con.execute("SELECT 1 FROM percakapan WHERE id=?", (session_id,)).fetchone()
        if ada:
            con.execute("""UPDATE percakapan SET cuplikan=?, jumlah_pesan=jumlah_pesan+2, diperbarui=?
                           WHERE id=?""", (cuplikan, _sekarang(), session_id))
        else:
            con.execute("""INSERT INTO percakapan (id, username, jenis, judul, cuplikan, jumlah_pesan, dibuat, diperbarui)
                           VALUES (?,?,?,?,?,2,?,?)""",
                        (session_id, username, jenis, judul or judul_dari(pesan), cuplikan, _sekarang(), _sekarang()))


def daftar(username: str, jenis: str | None = None, batas: int = 30, sebelum: str | None = None):
    sql, arg = "SELECT * FROM percakapan WHERE username=?", [username]
    if jenis:
        sql += " AND jenis=?"
        arg.append(jenis)
    if sebelum:  # halaman berikutnya: kirim nilai 'diperbarui' dari item terakhir
        sql += " AND diperbarui < ?"
        arg.append(sebelum)
    with db.koneksi() as con:
        return db.baris(con.execute(sql + " ORDER BY diperbarui DESC LIMIT ?", arg + [batas]))


def ambil(username: str, session_id: str):
    with db.koneksi() as con:
        r = con.execute("SELECT * FROM percakapan WHERE id=? AND username=?", (session_id, username)).fetchone()
    return dict(r) if r else None


def ubah_judul(username: str, session_id: str, judul: str):
    with db.koneksi() as con:
        con.execute("UPDATE percakapan SET judul=? WHERE id=? AND username=?",
                    (judul_dari(judul, 100), session_id, username))


def hapus(username: str, session_id: str):
    with db.koneksi() as con:
        con.execute("DELETE FROM percakapan WHERE id=? AND username=?", (session_id, username))


def milik(username: str) -> list[str]:
    with db.koneksi() as con:
        return [r[0] for r in con.execute("SELECT id FROM percakapan WHERE username=?", (username,))]


def kedaluwarsa() -> list[tuple[str, str]]:
    batas = (datetime.now() - timedelta(days=SIMPAN_HARI)).isoformat(timespec="seconds")
    with db.koneksi() as con:
        return [(r[0], r[1]) for r in con.execute(
            "SELECT username, id FROM percakapan WHERE diperbarui < ?", (batas,))]


def ke_pesan(events) -> list[dict]:
    """Mengubah event sesi ADK menjadi daftar pesan yang mudah ditampilkan dashboard:
    pesan petugas, lalu jawaban agen beserta langkah (tool) yang dipakainya."""
    pesan, agen = [], None
    for ev in events:
        ts = datetime.fromtimestamp(ev.timestamp).isoformat(timespec="seconds") if ev.timestamp else None
        bagian = ev.content.parts if ev.content and ev.content.parts else []
        teks = "".join(p.text or "" for p in bagian if not getattr(p, "thought", False))
        if ev.author == "user":
            if teks:
                pesan.append({"peran": "petugas", "teks": teks, "ts": ts})
            agen = None
            continue
        if agen is None:
            agen = {"peran": "agen", "teks": "", "langkah": [], "ts": ts}
            pesan.append(agen)
        for fc in ev.get_function_calls():
            agen["langkah"].append({"jenis": "panggil", "tool": fc.name, "data": dict(fc.args or {})})
        for fr in ev.get_function_responses():
            agen["langkah"].append({"jenis": "hasil", "tool": fr.name, "data": fr.response})
        if teks:
            if ev.is_final_response():
                agen["teks"], agen["ts"] = teks, ts
            else:
                agen["langkah"].append({"jenis": "catatan", "tool": None, "data": teks})
    return pesan
