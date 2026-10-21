"""Simulator data sensor untuk menguji WeselGuard sebelum penerima LoRa siap.

Pemakaian:
  python simulasi.py --reset     # isi ulang data: kalibrasi + 14 hari siklus (akun login tetap)
  python simulasi.py --live      # kirim 1 siklus per wesel setiap 3 detik (seperti data masuk)

Skenario:
  W-07  aus pelan-pelan: indeks turun dari sekitar 95 ke 78, masih "normal" (Waspada tren)
  W-12  bantalan aus yang makin parah dalam 10 hari terakhir
  W-03  poros tidak sejajar, sudah parah
  W-21  pola tidak dikenal yang muncul tiba-tiba 2 hari terakhir
  W-15  normal dan stabil, sebagai pembanding
"""
import argparse
import random
import time
from datetime import datetime, timedelta

from weselguard import database as db
from weselguard import lapis1

NORMAL = {"rms": (0.21, 0.015), "kurtosis": (3.0, 0.2), "puncak_hz": (48, 1.5), "durasi_s": (3.9, 0.08)}
HARI, SIKLUS_PER_HARI = 14, 24

# target: nilai ciri saat kerusakan penuh; tahap(hari_ke) -> 0..1 seberapa jauh kerusakan berjalan
SKENARIO = {
    "W-07": {"target": {"rms": 0.325, "kurtosis": 3.6, "durasi_s": 3.97}, "frek": None,
             "tahap": lambda d: d / HARI},
    "W-12": {"target": {"rms": 0.33, "kurtosis": 5.6, "durasi_s": 4.0}, "frek": 162,
             "tahap": lambda d: max(0, (d - 4) / (HARI - 4))},
    "W-03": {"target": {"rms": 0.47, "kurtosis": 3.6, "durasi_s": 4.8}, "frek": 96,
             "tahap": lambda d: 0.5 + 0.5 * d / HARI},
    "W-21": {"target": {"rms": 0.29, "kurtosis": 7.0, "durasi_s": 3.95}, "frek": 310,
             "tahap": lambda d: 1.0 if d >= HARI - 2 else 0.0},
    "W-15": {"target": {}, "frek": None, "tahap": lambda d: 0.0},
}


def acak(f):
    rata, sd = NORMAL[f]
    return random.gauss(rata, sd)


def buat_ciri(wesel_id, hari_ke):
    sk = SKENARIO[wesel_id]
    p = min(1.0, sk["tahap"](hari_ke))
    ciri = {}
    for f in ("rms", "kurtosis", "durasi_s"):
        dasar = NORMAL[f][0]
        tujuan = sk["target"].get(f, dasar)
        ciri[f] = round(acak(f) + (tujuan - dasar) * p, 3)
    muncul = sk["frek"] and p > 0.35
    ciri["puncak_hz"] = round(random.gauss(sk["frek"], 2) if muncul else acak("puncak_hz"), 1)
    return ciri


def reset():
    # Menghapus data sensor, riwayat, dan work order. Akun login dan sesinya TIDAK dihapus.
    with db.koneksi() as con:
        for tabel in ("siklus", "profil_normal", "ringkasan_harian", "riwayat", "work_orders",
                      "notifikasi_dibaca", "notifikasi", "status_terakhir"):
            con.execute(f"DELETE FROM {tabel}")
    db.impor_json()
    awal = datetime.now().replace(minute=0, second=0, microsecond=0) - timedelta(days=HARI)
    for w in SKENARIO:
        lapis1.kalibrasi(w, [{f: acak(f) for f in NORMAL} for _ in range(60)])
        for d in range(HARI + 1):
            for j in range(SIKLUS_PER_HARI):
                ts = awal + timedelta(days=d, hours=j)
                if ts > datetime.now():
                    break
                lapis1.proses_siklus(w, buat_ciri(w, d), ts.isoformat(timespec="seconds"))
    for s in lapis1.status_semua():
        t = s["tren"]
        print(f"{s['wesel_id']}: {s['status']:<14} indeks {s['indeks_kesehatan']:>3}  "
              f"laju {t['laju_per_hari']}/hari  {s['kondisi_kandidat']} ({s['skor_kecocokan']})")


def live():
    print("Mengirim siklus setiap 3 detik. Tekan Ctrl+C untuk berhenti.")
    while True:
        for w in SKENARIO:
            h = lapis1.proses_siklus(w, buat_ciri(w, HARI))
            print(f"{h['ts']} {w}: indeks {h['indeks']:>5} {h['status']}")
        time.sleep(3)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--live", action="store_true")
    a = ap.parse_args()
    if a.reset:
        reset()
    if a.live:
        live()
    if not (a.reset or a.live):
        ap.print_help()
