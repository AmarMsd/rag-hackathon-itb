"""Pencarian gabungan untuk kotak cari dashboard: wesel, work order, riwayat, manual, dan regulasi."""
from . import database as db
from . import lapis1
from .tools import _cari, _cari_dokumen

JENIS = ("wesel", "work_order", "riwayat", "manual", "dokumen")


def cari(q: str, jenis: str = "semua", batas: int = 5) -> dict:
    q = q.strip()
    pola = f"%{q}%"
    pilih = JENIS if jenis == "semua" else (jenis,)
    hasil = {}
    with db.koneksi() as con:
        if "wesel" in pilih:
            ids = [w for w in db.daftar_wesel() if q.lower() in w.lower()][:batas]
            hasil["wesel"] = [{k: s[k] for k in ("wesel_id", "status", "indeks_kesehatan", "kondisi_kandidat")}
                              for w in ids if (s := lapis1.status_wesel(w))]
        if "work_order" in pilih:
            hasil["work_order"] = db.baris(con.execute(
                """SELECT id, wesel_id, jenis, kelas, status, ringkasan, alasan, dibuat FROM work_orders
                   WHERE id LIKE ? OR wesel_id LIKE ? OR ringkasan LIKE ? OR alasan LIKE ?
                         OR kondisi LIKE ? OR catatan_petugas LIKE ?
                   ORDER BY dibuat DESC LIMIT ?""", (pola,) * 6 + (batas,)))
        if "riwayat" in pilih:
            hasil["riwayat"] = db.baris(con.execute(
                """SELECT * FROM riwayat WHERE wesel_id LIKE ? OR kondisi LIKE ? OR catatan LIKE ?
                   ORDER BY tanggal DESC LIMIT ?""", (pola, pola.replace(" ", "_"), pola, batas)))
    if "manual" in pilih:
        hasil["manual"] = [{"id": s["id"], "judul": s["judul"], "cuplikan": s["isi"][:200]}
                           for s in _cari("manual.json", q, batas)]
    if "dokumen" in pilih:
        hasil["dokumen"] = [{"dokumen_id": d["dokumen_id"], "judul": d["judul"], "kategori": d["kategori"],
                             "halaman": d["halaman"], "cuplikan": d["isi"][:200]}
                            for d in _cari_dokumen(q, batas)]
    return {"q": q, "jumlah": sum(len(v) for v in hasil.values()), "hasil": hasil}
