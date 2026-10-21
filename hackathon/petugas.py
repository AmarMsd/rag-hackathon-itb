"""Layar petugas sederhana: lihat, setujui, atau tolak work order.

Pemakaian:
  python petugas.py                       # lihat yang menunggu
  python petugas.py setujui WO-001
  python petugas.py tolak WO-001 "alasan"
"""
import json
import sys
from datetime import date
from pathlib import Path

DATA = Path(__file__).parent / "weselguard" / "data"
wo_file, riwayat_file = DATA / "work_orders.json", DATA / "riwayat.json"
daftar = json.loads(wo_file.read_text(encoding="utf-8"))

if len(sys.argv) == 1:
    menunggu = [w for w in daftar if w["status"].startswith("MENUNGGU")]
    if not menunggu:
        print("Tidak ada yang menunggu.")
    for w in menunggu:
        print(f"\n[{w['id']}] {w['wesel_id']} | {w['status']}")
        print("  " + w.get("ringkasan", w.get("alasan", "")))
        if "langkah" in w:
            print(f"  Kelas {w['kelas']} | {w['rujukan']}\n  {w['langkah']}")
    sys.exit()

aksi, wo_id = sys.argv[1], sys.argv[2]
catatan = sys.argv[3] if len(sys.argv) > 3 else ""
wo = next((w for w in daftar if w["id"] == wo_id), None)
if wo is None or aksi not in ("setujui", "tolak"):
    sys.exit("Work order tidak ditemukan atau aksi salah (setujui/tolak).")

wo["status"] = "DISETUJUI" if aksi == "setujui" else "DITOLAK"
wo_file.write_text(json.dumps(daftar, indent=2, ensure_ascii=False), encoding="utf-8")

if "kondisi" in wo:  # keputusan petugas masuk riwayat, dibaca agen lewat cek_riwayat
    riwayat = json.loads(riwayat_file.read_text(encoding="utf-8"))
    riwayat.append({"wesel_id": wo["wesel_id"], "tanggal": date.today().isoformat(),
                    "kondisi": wo["kondisi"], "kelas": wo["kelas"],
                    "keputusan_petugas": "disetujui" if aksi == "setujui" else "ditolak",
                    "catatan": catatan})
    riwayat_file.write_text(json.dumps(riwayat, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"{wo_id} -> {wo['status']}")
