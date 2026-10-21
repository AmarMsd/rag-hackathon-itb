"""Memeriksa apakah gateway bisa menghubungi model di cloud (online) atau tidak (offline).

Pemeriksaan tidak memakai token model: hanya tes jaringan ke server Google dan
memastikan kredensial (ADC atau API key) masih berlaku. Hasilnya disimpan 30 detik.
"""
import os
import socket
import time
from datetime import datetime

DISIMPAN_DETIK = 30
_cache = {"waktu": 0.0, "hasil": None}


def _host():
    if os.getenv("GOOGLE_GENAI_USE_ENTERPRISE", "").lower() in ("1", "true") or \
       os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true"):
        lokasi = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
        return "aiplatform.googleapis.com" if lokasi == "global" else f"{lokasi}-aiplatform.googleapis.com"
    return "generativelanguage.googleapis.com"


def _cek_kredensial():
    if os.getenv("GOOGLE_API_KEY"):
        return True, "API key tersedia."
    try:
        import google.auth
        from google.auth.transport.requests import Request
        kred, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        kred.refresh(Request())
        return True, "Kredensial ADC berlaku."
    except Exception as e:  # kredensial tidak ada, kedaluwarsa, atau ditolak
        return False, f"Kredensial bermasalah: {type(e).__name__}. Jalankan ulang 'gcloud auth application-default login'."


def cek(paksa: bool = False) -> dict:
    sekarang = time.monotonic()
    if not paksa and _cache["hasil"] and sekarang - _cache["waktu"] < DISIMPAN_DETIK:
        return _cache["hasil"]
    host = _host()
    mulai = time.monotonic()
    try:
        socket.create_connection((host, 443), timeout=3).close()
        jaringan, latensi = True, round((time.monotonic() - mulai) * 1000)
    except OSError:
        jaringan, latensi = False, None

    if not jaringan:
        status, pesan = "offline", f"Tidak bisa menjangkau {host}. Agen tidak tersedia; deteksi Lapis 1 tetap berjalan."
    else:
        ok, pesan_kred = _cek_kredensial()
        status = "online" if ok else "terbatas"
        pesan = "Agen bisa menghubungi model." if ok else pesan_kred
    hasil = {"status": status, "agen_tersedia": status == "online", "host": host, "latensi_ms": latensi,
             "pesan": pesan, "diperiksa": datetime.now().isoformat(timespec="seconds")}
    _cache.update(waktu=sekarang, hasil=hasil)
    return hasil
