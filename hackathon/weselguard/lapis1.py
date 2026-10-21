"""Lapis 1: deteksi dengan kode biasa (bukan LLM).

Alur per siklus: ciri getaran -> bandingkan dengan profil normal wesel itu -> indeks
kesehatan 0-100 dan kandidat kondisi -> simpan ke SQLite (siklus normal juga disimpan).
Per wesel: rata-rata siklus terakhir + tren harian -> status, termasuk "Waspada tren".
"""
import math
from datetime import datetime
from statistics import mean, pstdev

from . import database as db

FITUR = ("rms", "kurtosis", "puncak_hz", "durasi_s")

# Ambang status, sesuai Klasifikasi Bab 4 manual contoh
BATAS_B, BATAS_A = 70, 40
SKOR_MINIMUM = 0.6
# Tren: dianggap menurun bila turun >= 1 poin/hari selama >= 5 hari dan total turun >= 8 poin
LAJU_TREN, HARI_MINIMUM, TURUN_MINIMUM = -1.0, 5, 8

# Tanda gejala dari manual Bab 3. Bobot frekuensi paling besar karena paling khas.
GEJALA = {
    "bantalan_aus": [("rms_naik", 0.25), ("kurtosis_tinggi", 0.25), ("frek_150_170", 0.5)],
    "poros_tidak_sejajar": [("rms_naik", 0.25), ("durasi_naik", 0.25), ("frek_90_100", 0.5)],
}


def kalibrasi(wesel_id: str, siklus_normal: list[dict]):
    """Menyimpan profil normal dari siklus yang direkam saat wesel dalam kondisi baik."""
    if len(siklus_normal) < 20:
        raise ValueError("Kalibrasi butuh minimal 20 siklus normal.")
    profil = {f: (mean(s[f] for s in siklus_normal), max(pstdev(s[f] for s in siklus_normal), 1e-6),
                  len(siklus_normal)) for f in FITUR}
    db.simpan_profil(wesel_id, profil)


def _z(ciri, profil):
    return {f: (ciri[f] - profil[f][0]) / profil[f][1] for f in FITUR}


def indeks_kesehatan(ciri: dict, profil: dict) -> float:
    z = _z(ciri, profil)
    naik = lambda f: min(max(z[f], 0), 20)  # hanya kenaikan yang dihitung sebagai memburuk
    keparahan = 0.45 * naik("rms") + 0.3 * naik("kurtosis") + 0.25 * naik("durasi_s")
    if abs(ciri["puncak_hz"] - profil["puncak_hz"][0]) > 20:  # muncul puncak frekuensi baru
        keparahan += 2
    return round(max(0.0, min(100.0, 100 - 5 * keparahan)), 1)


def cocokkan_gejala(ciri: dict, profil: dict):
    z = _z(ciri, profil)
    tanda = {
        "rms_naik": z["rms"] > 3,
        "kurtosis_tinggi": ciri["kurtosis"] > 5,
        "durasi_naik": z["durasi_s"] > 3,
        "frek_150_170": 150 <= ciri["puncak_hz"] <= 170,
        "frek_90_100": 90 <= ciri["puncak_hz"] <= 100,
    }
    skor = {k: round(sum(b for t, b in aturan if tanda[t]), 2) for k, aturan in GEJALA.items()}
    terbaik = max(skor, key=skor.get)
    return terbaik, skor[terbaik]


def status_dari(indeks: float, skor: float) -> str:
    if indeks >= BATAS_B:
        return "Normal"
    if skor < SKOR_MINIMUM:
        return "Tidak dikenal"
    return "Bahaya" if indeks < BATAS_A else "Waspada"


def proses_siklus(wesel_id: str, ciri: dict, ts: str | None = None) -> dict:
    """Dipanggil untuk SETIAP siklus yang diterima (nanti dari penerima LoRa)."""
    profil = db.ambil_profil(wesel_id)
    if not profil:
        raise ValueError(f"{wesel_id} belum dikalibrasi.")
    indeks = indeks_kesehatan(ciri, profil)
    if indeks >= BATAS_B:
        kondisi, skor = "normal", 1.0
    else:
        kondisi, skor = cocokkan_gejala(ciri, profil)
    hasil = {"wesel_id": wesel_id, "ts": ts or datetime.now().isoformat(timespec="seconds"),
             **{f: ciri[f] for f in FITUR}, "indeks": indeks, "skor_kecocokan": skor,
             "kondisi_kandidat": kondisi, "status": status_dari(indeks, skor)}
    db.simpan_siklus(hasil)
    return hasil


def tren(wesel_id: str, hari: int = 14) -> dict:
    """Laju perubahan indeks harian (regresi linear) dan perkiraan kasar kapan menyentuh batas."""
    data = db.harian(wesel_id, hari)
    titik = [(datetime.fromisoformat(d["tanggal"]).toordinal(), d["indeks_rata"]) for d in data]
    hasil = {"hari_data": len(titik),
             "harian": [{"tanggal": d["tanggal"], "indeks_rata": round(d["indeks_rata"], 1)} for d in data]}
    if len(titik) < 3:
        return {**hasil, "laju_per_hari": None, "menurun": False}
    xs, ys = zip(*titik)
    mx, my = mean(xs), mean(ys)
    laju = sum((x - mx) * (y - my) for x, y in titik) / sum((x - mx) ** 2 for x in xs)
    sekarang, tertinggi = ys[-1], max(ys)
    menurun = len(titik) >= HARI_MINIMUM and laju <= LAJU_TREN and tertinggi - sekarang >= TURUN_MINIMUM

    def hari_ke(batas):
        if laju >= 0 or sekarang <= batas:
            return None
        return math.ceil((sekarang - batas) / -laju)

    return {**hasil, "laju_per_hari": round(laju, 2), "menurun": menurun,
            "indeks_tertinggi": round(tertinggi, 1), "indeks_hari_ini": round(sekarang, 1),
            "perkiraan_hari_ke_batas_B": hari_ke(BATAS_B), "perkiraan_hari_ke_batas_A": hari_ke(BATAS_A)}


def status_wesel(wesel_id: str) -> dict | None:
    """Status satu wesel dari 10 siklus terakhir (agar tidak naik-turun karena derau) + tren."""
    terakhir = db.siklus_terakhir(wesel_id, 10)
    if not terakhir:
        return None
    akhir = terakhir[0]
    indeks = round(mean(s["indeks"] for s in terakhir), 1)
    t = tren(wesel_id)
    # kondisi diambil dari siklus yang memang anomali, bukan dari satu siklus terakhir saja
    anomali = [s for s in terakhir if s["kondisi_kandidat"] != "normal"]
    if indeks < BATAS_B and anomali:
        kondisi = max({s["kondisi_kandidat"] for s in anomali},
                      key=lambda k: sum(s["kondisi_kandidat"] == k for s in anomali))
        skor = round(mean(s["skor_kecocokan"] for s in anomali if s["kondisi_kandidat"] == kondisi), 2)
    else:
        kondisi, skor = "normal", 1.0
    status = status_dari(indeks, skor)
    if status == "Normal" and t["menurun"]:
        status = "Waspada tren"
    return {"wesel_id": wesel_id, "status": status, "indeks_kesehatan": round(indeks),
            "kondisi_kandidat": kondisi, "skor_kecocokan": skor,
            "siklus_terakhir": akhir["ts"],
            "ciri": {"rms": akhir["rms"], "kurtosis": akhir["kurtosis"],
                     "puncak_frekuensi_hz": akhir["puncak_hz"], "durasi_siklus_s": akhir["durasi_s"]},
            "tren": {k: t.get(k) for k in ("laju_per_hari", "menurun", "indeks_tertinggi",
                                           "perkiraan_hari_ke_batas_B", "perkiraan_hari_ke_batas_A")}}


def status_semua() -> list[dict]:
    return [s for w in db.daftar_wesel() if (s := status_wesel(w))]
