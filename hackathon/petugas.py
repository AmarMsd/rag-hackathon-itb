"""Layar petugas sederhana di terminal: lihat, setujui, atau tolak work order.

Pemakaian:
  python petugas.py                       # lihat yang menunggu
  python petugas.py setujui WO-001
  python petugas.py tolak WO-001 "alasan"
"""
import sys
from datetime import date

from weselguard import database as db

if len(sys.argv) == 1:
    menunggu = db.work_orders(hanya_terbuka=True)
    if not menunggu:
        print("Tidak ada yang menunggu.")
    for w in menunggu:
        print(f"\n[{w['id']}] {w['wesel_id']} | {w['status']}")
        print("  " + (w["ringkasan"] or w["alasan"] or ""))
        if w["langkah"]:
            print(f"  Kelas {w['kelas']} | {w['rujukan']}\n  {w['langkah']}")
    sys.exit()

aksi, wo_id = sys.argv[1], sys.argv[2]
catatan = sys.argv[3] if len(sys.argv) > 3 else ""
wo = next((w for w in db.work_orders(hanya_terbuka=True) if w["id"] == wo_id), None)
if wo is None or aksi not in ("setujui", "tolak"):
    sys.exit("Work order tidak ditemukan, sudah diputuskan, atau aksi salah (setujui/tolak).")
status = "DISETUJUI" if aksi == "setujui" else "DITOLAK"
db.ubah_status_work_order(wo_id, status, catatan)
if wo["jenis"] == "WORK_ORDER":
    db.tambah_riwayat(wo["wesel_id"], date.today().isoformat(), wo["kondisi"], wo["kelas"],
                      "disetujui" if aksi == "setujui" else "ditolak", catatan)
print(f"{wo_id} -> {status}")
