"""Mengelola akun login dashboard WeselGuard.

Pemakaian:
  python kelola_pengguna.py tambah budi "Budi Santoso" petugas
  python kelola_pengguna.py daftar
  python kelola_pengguna.py sandi budi          # ganti kata sandi (semua sesinya dikeluarkan)
  python kelola_pengguna.py nonaktif budi       # blokir akun dan keluarkan dari semua perangkat
  python kelola_pengguna.py aktif budi

Peran: admin, petugas (bisa menganalisis dan memutuskan), pengamat (hanya melihat, cocok untuk juri).
"""
import sys
from getpass import getpass

from weselguard import database as db


def minta_sandi():
    sandi = getpass("Kata sandi (minimal 8 karakter): ")
    if sandi != getpass("Ulangi kata sandi: "):
        sys.exit("Kata sandi tidak sama.")
    return sandi


perintah = sys.argv[1:] or ["bantuan"]
try:
    if perintah[0] == "tambah" and len(perintah) == 4:
        _, username, nama, peran = perintah
        db.tambah_pengguna(username.lower(), nama, peran, minta_sandi())
        print(f"Akun {username.lower()} ({peran}) dibuat.")
    elif perintah[0] == "daftar":
        for p in db.daftar_pengguna():
            print(f"{p['username']:<15} {p['nama']:<25} {p['peran']:<9} {'aktif' if p['aktif'] else 'nonaktif'}")
    elif perintah[0] == "sandi" and len(perintah) == 2:
        db.ganti_sandi(perintah[1].lower(), minta_sandi())
        print("Kata sandi diganti. Semua sesi akun ini telah dikeluarkan.")
    elif perintah[0] in ("aktif", "nonaktif") and len(perintah) == 2:
        db.atur_aktif(perintah[1].lower(), perintah[0] == "aktif")
        print(f"Akun {perintah[1].lower()} sekarang {perintah[0]}.")
    else:
        print(__doc__)
except (ValueError, Exception) as e:  # contoh: username sudah ada, peran tidak dikenal
    sys.exit(f"Gagal: {e}")
