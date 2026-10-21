"""Laporan harian WeselGuard: ringkasan per wesel, kejadian, dan keputusan petugas dalam satu hari."""
import csv
import io
from datetime import date

from . import database as db
from . import lapis1


def buat(tanggal: str | None = None) -> dict:
    tanggal = tanggal or date.today().isoformat()
    hari_ini = tanggal == date.today().isoformat()
    with db.koneksi() as con:
        per_wesel = db.baris(con.execute(
            """SELECT wesel_id, COUNT(*) AS jumlah_siklus, ROUND(AVG(indeks), 1) AS indeks_rata,
                      MIN(indeks) AS indeks_min, MAX(indeks) AS indeks_maks,
                      SUM(status != 'Normal') AS siklus_anomali
               FROM siklus WHERE date(ts) = ? GROUP BY wesel_id ORDER BY wesel_id""", (tanggal,)))
        arsip = db.baris(con.execute(
            "SELECT * FROM ringkasan_harian WHERE tanggal = ? ORDER BY wesel_id", (tanggal,)))
        wo_baru = db.baris(con.execute(
            "SELECT * FROM work_orders WHERE date(dibuat) = ? ORDER BY dibuat", (tanggal,)))
        keputusan = db.baris(con.execute(
            "SELECT * FROM work_orders WHERE date(diputuskan_pada) = ? ORDER BY diputuskan_pada", (tanggal,)))
        notif = db.baris(con.execute(
            "SELECT tingkat, COUNT(*) AS jumlah FROM notifikasi WHERE date(ts) = ? GROUP BY tingkat", (tanggal,)))
        akhir_hari = {r["wesel_id"]: r["status"] for r in con.execute(
            """SELECT s.wesel_id, s.status FROM siklus s
               JOIN (SELECT wesel_id, MAX(ts) AS ts FROM siklus WHERE date(ts) = ? GROUP BY wesel_id) m
               ON m.wesel_id = s.wesel_id AND m.ts = s.ts""", (tanggal,))}

    if not per_wesel and arsip:  # tanggal lama yang siklusnya sudah diarsipkan
        per_wesel = [{"wesel_id": a["wesel_id"], "jumlah_siklus": a["jumlah_siklus"],
                      "indeks_rata": round(a["indeks_rata"], 1), "indeks_min": a["indeks_min"],
                      "indeks_maks": None, "siklus_anomali": a["jumlah_anomali"]} for a in arsip]

    terkini = {s["wesel_id"]: s for s in lapis1.status_semua()} if hari_ini else {}
    for w in per_wesel:
        if hari_ini and w["wesel_id"] in terkini:
            s = terkini[w["wesel_id"]]
            w["status"] = s["status"]
            w["laju_per_hari"] = s["tren"]["laju_per_hari"]
        else:
            w["status"] = akhir_hari.get(w["wesel_id"], "Tidak ada data")
            w["laju_per_hari"] = None

    jumlah_status = {}
    for w in per_wesel:
        jumlah_status[w["status"]] = jumlah_status.get(w["status"], 0) + 1

    return {
        "tanggal": tanggal,
        "status_dari": "kondisi terkini" if hari_ini else "siklus terakhir hari itu",
        "ringkasan": {
            "wesel_dipantau": len(per_wesel),
            "total_siklus": sum(w["jumlah_siklus"] for w in per_wesel),
            "siklus_anomali": sum(w["siklus_anomali"] or 0 for w in per_wesel),
            "jumlah_per_status": jumlah_status,
            "work_order_baru": sum(w["jenis"] == "WORK_ORDER" for w in wo_baru),
            "eskalasi_baru": sum(w["jenis"] == "ESKALASI" for w in wo_baru),
            "disetujui": sum(k["status"] == "DISETUJUI" for k in keputusan),
            "ditolak": sum(k["status"] == "DITOLAK" for k in keputusan),
            "notifikasi": {n["tingkat"]: n["jumlah"] for n in notif},
        },
        "per_wesel": per_wesel,
        "work_order_baru": [{k: w[k] for k in ("id", "wesel_id", "jenis", "kelas", "status", "ringkasan", "alasan", "dibuat")}
                            for w in wo_baru],
        "keputusan_petugas": [{k: w[k] for k in ("id", "wesel_id", "status", "catatan_petugas",
                                                 "diputuskan_oleh", "diputuskan_pada")} for w in keputusan],
    }


def ke_markdown(lap: dict) -> str:
    r = lap["ringkasan"]
    baris = [f"# Laporan Harian WeselGuard, {lap['tanggal']}", "",
             f"Wesel dipantau: {r['wesel_dipantau']}. Siklus diterima: {r['total_siklus']} "
             f"({r['siklus_anomali']} di luar status Normal).",
             "Status (" + lap["status_dari"] + "): " +
             (", ".join(f"{k} {v}" for k, v in r["jumlah_per_status"].items()) or "tidak ada data") + ".",
             f"Work order baru: {r['work_order_baru']}, eskalasi baru: {r['eskalasi_baru']}. "
             f"Keputusan petugas: {r['disetujui']} disetujui, {r['ditolak']} ditolak.", "",
             "## Kondisi per wesel", "",
             "| Wesel | Status | Indeks rata-rata | Indeks terendah | Siklus | Siklus anomali | Laju/hari |",
             "|---|---|---|---|---|---|---|"]
    for w in lap["per_wesel"]:
        laju = "" if w["laju_per_hari"] is None else w["laju_per_hari"]
        baris.append(f"| {w['wesel_id']} | {w['status']} | {w['indeks_rata']} | {w['indeks_min']} | "
                     f"{w['jumlah_siklus']} | {w['siklus_anomali']} | {laju} |")
    baris += ["", "## Usulan agen hari ini", ""]
    baris += [f"- {w['id']} {w['wesel_id']} ({'Eskalasi' if w['jenis'] == 'ESKALASI' else 'Kelas ' + str(w['kelas'])}), "
              f"status {w['status'].lower().replace('_', ' ')}: {w['ringkasan'] or w['alasan'] or ''}"
              for w in lap["work_order_baru"]] or ["Tidak ada."]
    baris += ["", "## Keputusan petugas hari ini", ""]
    baris += [f"- {k['id']} {k['wesel_id']}: {k['status'].lower()} oleh {k['diputuskan_oleh'] or '-'}"
              f"{', catatan: ' + k['catatan_petugas'] if k['catatan_petugas'] else ''}"
              for k in lap["keputusan_petugas"]] or ["Tidak ada."]
    baris += ["", "Laju per hari adalah perubahan rata-rata indeks harian 14 hari terakhir; "
              "perkiraan berdasarkan laju ini bersifat kasar, bukan prediksi sisa umur."]
    return "\n".join(baris) + "\n"


def ke_csv(lap: dict) -> str:
    buf = io.StringIO()
    kolom = ["tanggal", "wesel_id", "status", "indeks_rata", "indeks_min", "indeks_maks",
             "jumlah_siklus", "siklus_anomali", "laju_per_hari"]
    tulis = csv.DictWriter(buf, fieldnames=kolom, extrasaction="ignore")
    tulis.writeheader()
    for w in lap["per_wesel"]:
        tulis.writerow({"tanggal": lap["tanggal"], **w})
    return buf.getvalue()
