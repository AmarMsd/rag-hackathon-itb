"""Lapis 1 untuk rig (getaran HP sebagai peniru siklus gerak point machine).

Berdampingan dengan lapis1.py (untuk getaran bantalan, data KAIST dan simulasi), bukan pengganti.
Menulis ke tabel `siklus` yang sama dengan arti kolom yang sama, sehingga status_wesel(), tren(),
dashboard, dan agen membaca wesel rig tanpa perubahan.

Keputusan per siklus:
  1. model_rig (random forest) + pemeriksa z terhadap profil kelas -> kelas atau tidak_dikenal
  2. Siklus berbentuk normal (nseg, aktif, kurt cocok dengan profil normal) tetapi lebih lama
     -> perpindahan_melambat (degradasi, peringatan dini), bukan tidak_dikenal
  3. Indeks dari durasi: 100 sampai DUR_AMAN, turun linear ke 40 di batas PM 10 (5 dtk)
     sehingga status mengikuti BATAS_B dan BATAS_A di lapis1.py; plafon indeks per kondisi

Label kondisi dari data latih tidak pernah lewat sini; yang disimpan adalah prediksi model.
"""
import json
from datetime import datetime

import joblib
import numpy as np

from . import database as db
from .lapis1 import BATAS_A, status_dari, status_wesel

try:
    from . import notifikasi  # ada di backend versi baru
except ImportError:
    notifikasi = None

SUMBER = "rig"
Z_DUR_MELAMBAT = 2.0            # dur lebih dari 2 sd di atas normal -> perpindahan melambat
SKOR_DEGRADASI = 0.8            # kecocokan aturan degradasi (di atas SKOR_MINIMUM)
FITUR_BENTUK = ("nseg", "aktif", "kurt")

NAMA = {"normal": "normal", "lambat": "perpindahan_lambat", "macet": "macet", "slip": "slip",
        "penguncian": "penguncian_tidak_sempurna", "tak_dikenal": "tidak_dikenal"}
# Plafon indeks per kondisi: penguncian tidak sempurna berbahaya walau durasinya hampir normal
PLAFON = {"perpindahan_lambat": 100, "macet": 0, "slip": 0, "penguncian_tidak_sempurna": 35,
          "tidak_dikenal": 60}

_model = _fitur = _prof = None


def muat(model_path: str, profil_path: str):
    global _model, _fitur, _prof
    m = joblib.load(model_path)
    _model, _fitur = m["model"], m["fitur"]
    _prof = json.load(open(profil_path))
    _siapkan_tabel()


def _siapkan_tabel():
    with db.koneksi() as con:
        kolom = [r[1] for r in con.execute("PRAGMA table_info(siklus)")]
        for nama, tipe in (("sumber", "TEXT"), ("nseg", "INTEGER"), ("aktif", "REAL")):
            if nama not in kolom:
                con.execute(f"ALTER TABLE siklus ADD COLUMN {nama} {tipe}")
        con.execute("""CREATE TABLE IF NOT EXISTS node_status (
            wesel_id TEXT PRIMARY KEY, sumber TEXT, terakhir TEXT, uptime_s INTEGER,
            jumlah_siklus INTEGER, diam_mg REAL, rssi REAL, snr REAL)""")


def _z(msg, kelas):
    pk = _prof["profil_kelas"][kelas]
    return {f: (msg[f] - pk["mean"][f]) / pk["std"][f] for f in _fitur}


def _indeks_durasi(dur: float) -> float:
    pn = _prof["profil_kelas"]["normal"]
    aman = pn["mean"]["dur"] + Z_DUR_MELAMBAT * pn["std"]["dur"]
    batas = _prof["batas_pm10_detik"]
    if dur <= aman:
        return 100.0
    return max(0.0, 100.0 - (100.0 - BATAS_A) * (dur - aman) / (batas - aman))


def nilai(msg: dict) -> dict:
    """Keputusan lapis 1 untuk satu pesan siklus rig (tanpa menyimpan)."""
    x = np.array([[msg[f] for f in _fitur]])
    kelas = _model.predict(x)[0]
    yakin = float(_model.predict_proba(x).max())
    z = _z(msg, kelas)
    f_max = max(z, key=lambda f: abs(z[f]))
    if abs(z[f_max]) > _prof["z_maks"]:
        kelas = "tak_dikenal"

    # Bentuk normal tetapi lebih lambat: degradasi, bukan pola asing
    zn = _z(msg, "normal")
    bentuk_normal = all(abs(zn[f]) <= _prof["z_maks"] for f in FITUR_BENTUK)
    melambat = bentuk_normal and zn["dur"] > Z_DUR_MELAMBAT and msg["dur"] <= _prof["batas_pm10_detik"]

    if melambat and kelas in ("normal", "tak_dikenal"):
        kondisi, skor = "perpindahan_melambat", SKOR_DEGRADASI
    elif kelas == "normal":
        kondisi, skor = "normal", 1.0
    elif kelas == "tak_dikenal":
        kondisi, skor = "tidak_dikenal", 0.0
    else:
        kondisi, skor = NAMA[kelas], round(yakin, 2)

    indeks = _indeks_durasi(msg["dur"])
    if kondisi in PLAFON:
        indeks = min(indeks, PLAFON[kondisi])
    indeks = round(indeks, 1)
    status = status_dari(indeks, skor)
    alasan = ""
    if kondisi == "tidak_dikenal":
        pk = _prof["profil_kelas"][_model.predict(x)[0]]
        alasan = f"{f_max} {msg[f_max]} jauh dari profil ({pk['mean'][f_max]:.2f} ± {pk['std'][f_max]:.2f})"
    elif kondisi == "perpindahan_melambat":
        alasan = f"bentuk siklus normal, durasi {msg['dur']:.2f} dtk (normal {_prof['profil_kelas']['normal']['mean']['dur']:.2f})"
    return {"kondisi": kondisi, "skor": skor, "indeks": indeks, "status": status,
            "langgar_pm10": msg["dur"] > _prof["batas_pm10_detik"], "alasan": alasan}


def proses_pesan(msg: dict, ts: str | None = None) -> dict:
    """Dipanggil penerima LoRa untuk setiap pesan siklus. Menyimpan ke tabel siklus."""
    if not db.ambil_profil(msg["pm"]):  # wesel rig baru, atau sesudah simulasi.py --reset
        kalibrasi_dari_profil(msg["pm"])
    h = nilai(msg)
    baris = {"wesel_id": msg["pm"], "ts": ts or datetime.now().isoformat(timespec="seconds"),
             "rms": msg["rms"], "kurtosis": msg["kurt"], "puncak_hz": msg["f1"], "durasi_s": msg["dur"],
             "indeks": h["indeks"], "skor_kecocokan": h["skor"], "kondisi_kandidat": h["kondisi"],
             "status": h["status"], "sumber": SUMBER, "nseg": msg["nseg"], "aktif": msg["aktif"]}
    with db.koneksi() as con:
        con.execute(
            """INSERT INTO siklus (wesel_id, ts, rms, kurtosis, puncak_hz, durasi_s, indeks,
               skor_kecocokan, kondisi_kandidat, status, sumber, nseg, aktif)
               VALUES (:wesel_id, :ts, :rms, :kurtosis, :puncak_hz, :durasi_s, :indeks,
               :skor_kecocokan, :kondisi_kandidat, :status, :sumber, :nseg, :aktif)""", baris)
    # Sama dengan lapis1.proses_siklus(): periksa status wesel untuk notifikasi.
    # Gagal kirim notifikasi tidak boleh menghentikan penyimpanan siklus berikutnya.
    if notifikasi:
        try:
            info = status_wesel(msg["pm"])
            if info:
                notifikasi.cek_status(info, baris["ts"])
        except Exception as e:  # noqa: BLE001
            print(f"    notifikasi gagal: {e}")
    return {**baris, **h}


def catat_hidup(msg: dict):
    """Simpan sinyal masih hidup node, supaya dashboard/agen bisa tahu sensor mati."""
    with db.koneksi() as con:
        con.execute("INSERT OR REPLACE INTO node_status VALUES (?,?,?,?,?,?,?,?)",
                    (msg["pm"], SUMBER, datetime.now().isoformat(timespec="seconds"), msg.get("up"),
                     msg.get("cyc"), msg.get("diam_mg"), msg.get("rssi"), msg.get("snr")))


def kalibrasi_dari_profil(wesel_id: str):
    """Isi profil_normal di database dari profil normal model_rig, untuk dibaca tools agen."""
    pn = _prof["profil_kelas"]["normal"]
    peta = {"durasi_s": "dur", "kurtosis": "kurt", "nseg": "nseg", "aktif": "aktif"}
    db.simpan_profil(wesel_id, {k: (pn["mean"][v], pn["std"][v], pn["n"]) for k, v in peta.items()})
