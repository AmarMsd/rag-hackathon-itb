"""Notifikasi tersimpan WeselGuard.

Sumber notifikasi:
- perubahan status wesel (dicek setiap siklus masuk)
- work order / eskalasi baru dari agen, dan keputusan petugas
- sensor yang tidak mengirim data, dan perubahan koneksi online/offline (dicek berkala oleh server)
Status "dibaca" disimpan per akun, jadi setiap petugas punya tanda bacanya sendiri.
"""
import os
from datetime import datetime, timedelta

from . import database as db

PERINGKAT = {"Normal": 0, "Waspada tren": 1, "Waspada": 2, "Tidak dikenal": 3, "Bahaya": 4}
TINGKAT_STATUS = {"Waspada tren": "peringatan", "Waspada": "peringatan",
                  "Tidak dikenal": "kritis", "Bahaya": "kritis"}
JAM_STABIL = 6  # wesel dianggap pulih setelah Normal terus-menerus selama 6 jam
BATAS_SENYAP_MENIT = int(os.getenv("WESELGUARD_BATAS_SENYAP_MENIT", "120"))


def buat(jenis, tingkat, judul, pesan="", wesel_id=None, ref_id=None, ts=None) -> int:
    with db.koneksi() as con:
        cur = con.execute(
            "INSERT INTO notifikasi (ts, jenis, tingkat, wesel_id, judul, pesan, ref_id) VALUES (?,?,?,?,?,?,?)",
            (ts or datetime.now().isoformat(timespec="seconds"), jenis, tingkat, wesel_id, judul, pesan, ref_id))
        return cur.lastrowid


def daftar(username: str, hanya_belum_dibaca=False, batas=50, sebelum_id: int | None = None):
    sql = """SELECT n.*, (d.username IS NOT NULL) AS dibaca FROM notifikasi n
             LEFT JOIN notifikasi_dibaca d ON d.notifikasi_id = n.id AND d.username = ?
             WHERE 1=1"""
    arg = [username]
    if hanya_belum_dibaca:
        sql += " AND d.username IS NULL"
    if sebelum_id:  # untuk memuat halaman berikutnya
        sql += " AND n.id < ?"
        arg.append(sebelum_id)
    sql += " ORDER BY n.id DESC LIMIT ?"
    arg.append(batas)
    with db.koneksi() as con:
        hasil = db.baris(con.execute(sql, arg))
    for h in hasil:
        h["dibaca"] = bool(h["dibaca"])
    return hasil


def jumlah_belum_dibaca(username: str) -> dict:
    with db.koneksi() as con:
        rows = con.execute(
            """SELECT n.tingkat, COUNT(*) FROM notifikasi n
               LEFT JOIN notifikasi_dibaca d ON d.notifikasi_id = n.id AND d.username = ?
               WHERE d.username IS NULL GROUP BY n.tingkat""", (username,)).fetchall()
    per_tingkat = {r[0]: r[1] for r in rows}
    return {"belum_dibaca": sum(per_tingkat.values()), "per_tingkat": per_tingkat}


def tandai_dibaca(username: str, notifikasi_id: int | None = None):
    with db.koneksi() as con:
        if notifikasi_id is None:
            con.execute("""INSERT OR IGNORE INTO notifikasi_dibaca
                           SELECT id, ? FROM notifikasi""", (username,))
        else:
            con.execute("INSERT OR IGNORE INTO notifikasi_dibaca VALUES (?, ?)", (notifikasi_id, username))


# ---------- Pemeriksa otomatis ----------

def cek_status(info: dict, ts: str):
    """Dipanggil Lapis 1 setelah setiap siklus.

    Agar tidak berulang-ulang saat status naik-turun di sekitar ambang, setiap wesel
    menyimpan "puncak": status terburuk yang sudah diberitahukan. Notifikasi hanya dibuat
    bila status lebih buruk dari puncak itu. Puncak baru direset setelah wesel stabil
    Normal selama JAM_STABIL jam."""
    wid, status = info["wesel_id"], info["status"]
    with db.koneksi() as con:
        lama = con.execute("SELECT * FROM status_terakhir WHERE wesel_id=?", (wid,)).fetchone()
        if lama is None:  # wesel baru: catat saja sebagai keadaan awal
            con.execute("INSERT INTO status_terakhir (wesel_id, status, sejak, senyap, puncak) VALUES (?,?,?,0,?)",
                        (wid, status, ts, status))
            return
        sejak = lama["sejak"] if lama["status"] == status else ts
        puncak = lama["puncak"]
        memburuk = PERINGKAT[status] > PERINGKAT[puncak]
        pulih = (status == "Normal" and puncak != "Normal" and
                 datetime.fromisoformat(ts) - datetime.fromisoformat(sejak) >= timedelta(hours=JAM_STABIL))
        if memburuk or pulih:
            puncak = status
        con.execute("UPDATE status_terakhir SET status=?, sejak=?, senyap=0, puncak=? WHERE wesel_id=?",
                    (status, sejak, puncak, wid))
    if lama["senyap"]:
        _sensor_kembali(wid, ts)
    if memburuk:
        buat("status", TINGKAT_STATUS[status], f"{wid} masuk status {status}",
             _pesan_status(info, lama["status"]), wid, status, ts)
    elif pulih and PERINGKAT[lama["puncak"]] >= PERINGKAT["Waspada"]:
        buat("status", "info", f"{wid} kembali Normal",
             f"Stabil Normal selama {JAM_STABIL} jam setelah sebelumnya {lama['puncak']}. "
             f"Indeks kesehatan {info['indeks_kesehatan']}.", wid, status, ts)


def _pesan_status(info, status_lama):
    teks = f"Sebelumnya {status_lama}. Indeks kesehatan {info['indeks_kesehatan']}"
    t = info.get("tren") or {}
    if info["status"] == "Waspada tren" and t.get("laju_per_hari") is not None:
        teks += f", turun {abs(t['laju_per_hari'])} poin/hari dari {t['indeks_tertinggi']}"
        if t.get("perkiraan_hari_ke_batas_B"):
            teks += f"; perkiraan kasar menyentuh batas B dalam {t['perkiraan_hari_ke_batas_B']} hari bila laju tetap"
    elif info["kondisi_kandidat"] != "normal":
        teks += f", kandidat kondisi {info['kondisi_kandidat'].replace('_', ' ')}"
    return teks + "."


def _sensor_kembali(wid, ts):
    buat("sensor", "info", f"Sensor {wid} kembali mengirim data", "", wid, None, ts)


def cek_sensor_senyap():
    """Dipanggil berkala oleh server. Sekali notifikasi per kejadian senyap."""
    batas = datetime.now() - timedelta(minutes=BATAS_SENYAP_MENIT)
    with db.koneksi() as con:
        rows = con.execute(
            """SELECT st.wesel_id, MAX(s.ts) AS terakhir FROM status_terakhir st
               JOIN siklus s ON s.wesel_id = st.wesel_id
               WHERE st.senyap = 0 GROUP BY st.wesel_id HAVING MAX(s.ts) < ?""",
            (batas.isoformat(timespec="seconds"),)).fetchall()
        for r in rows:
            con.execute("UPDATE status_terakhir SET senyap=1 WHERE wesel_id=?", (r["wesel_id"],))
    for r in rows:
        jam = datetime.fromisoformat(r["terakhir"]).strftime("%d %b %H:%M")
        buat("sensor", "peringatan", f"Sensor {r['wesel_id']} tidak mengirim data",
             f"Siklus terakhir diterima {jam}, lebih dari {BATAS_SENYAP_MENIT} menit lalu. "
             "Periksa node sensor dan jalur LoRa. Wesel yang jarang bergerak juga bisa memicu ini.",
             r["wesel_id"])
