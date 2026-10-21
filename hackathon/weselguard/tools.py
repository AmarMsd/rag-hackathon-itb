"""Tools agen edge WeselGuard. Semua berjalan lokal di Raspberry Pi."""
import json
import math
import re
from datetime import datetime
from pathlib import Path

DATA = Path(__file__).parent / "data"


def _baca(nama):
    return json.loads((DATA / nama).read_text(encoding="utf-8"))


def _tulis(nama, isi):
    (DATA / nama).write_text(json.dumps(isi, indent=2, ensure_ascii=False), encoding="utf-8")


STOPWORD = set("""dan atau yang di ke dari untuk dengan pada dalam adalah ini itu
harus dapat akan oleh sebagai bila jika tidak serta secara para juga""".split())


def _token(teks):
    return [k for k in re.findall(r"[a-z0-9]+", teks.lower().replace("_", " "))
            if k not in STOPWORD]


_INDEKS = {}


def _cari(nama_file, kueri, jumlah, saring=None):
    """Pencarian kata kunci gaya BM25. Indeks dibuat sekali lalu disimpan di memori."""
    if nama_file not in _INDEKS:
        dok = _baca(nama_file) if (DATA / nama_file).exists() else []
        token = [_token(d.get("judul", "") + " " + d["isi"]) for d in dok]
        df = {}
        for t in token:
            for k in set(t):
                df[k] = df.get(k, 0) + 1
        rata = sum(map(len, token)) / max(len(token), 1)
        _INDEKS[nama_file] = (dok, token, df, rata)
    dok, token, df, rata = _INDEKS[nama_file]
    n, k1, b = len(dok), 1.5, 0.75
    skor = []
    for d, t in zip(dok, token):
        if saring and not saring(d):
            continue
        nilai = 0.0
        for k in set(_token(kueri)):
            f = t.count(k)
            if f:
                idf = math.log(1 + (n - df[k] + 0.5) / (df[k] + 0.5))
                nilai += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(t) / rata))
        if nilai > 0:
            skor.append((nilai, d))
    skor.sort(key=lambda x: -x[0])
    return [d for _, d in skor[:jumlah]]


def deteksi_anomali(wesel_id: str) -> dict:
    """Mengambil hasil deteksi Lapis 1 (bukan LLM) untuk satu wesel.

    Args:
        wesel_id: ID wesel, contoh "W-12".

    Returns:
        Kondisi kandidat, skor kecocokan (0-1), indeks kesehatan (0-100), dan ciri sinyal.
    """
    data = _baca("hasil_deteksi.json")
    if wesel_id not in data:
        return {"status": "error", "pesan": f"Tidak ada data deteksi untuk {wesel_id}."}
    return {"status": "ok", "wesel_id": wesel_id, **data[wesel_id]}


def cari_manual(gejala: str, bab: int = 0) -> dict:
    """Mencari subbab manual contoh yang paling relevan dengan gejala (RAG).

    Args:
        gejala: Deskripsi gejala atau kondisi, contoh "kurtosis tinggi bantalan aus".
        bab: Batasi ke bab tertentu (3 gejala, 4 urgensi, 5 langkah). 0 berarti semua bab.

    Returns:
        Maksimal dua subbab manual yang paling relevan.
    """
    hasil = _cari("manual.json", gejala, 2, lambda s: bab in (0, s["bab"]))
    if not hasil:
        return {"status": "kosong", "pesan": "Tidak ada subbab relevan. Coba kata kunci lain."}
    return {"status": "ok", "hasil": [{"id": s["id"], "judul": s["judul"], "isi": s["isi"]} for s in hasil]}


def cari_regulasi(kueri: str, sumber: str = "") -> dict:
    """Mencari ketentuan resmi di PM 10/2011 (persyaratan teknis persinyalan, termasuk
    penggerak wesel) dan PM 32/2011 (standar dan tata cara perawatan prasarana).
    Pakai untuk memastikan batas operasi atau kewajiban perawatan, lalu sebut sumber dan halamannya.

    Args:
        kueri: Kata kunci, contoh "penggerak wesel pembalikan lidah detik".
        sumber: "PM 10/2011" atau "PM 32/2011" untuk membatasi pencarian. Kosong berarti keduanya.

    Returns:
        Maksimal tiga potongan peraturan beserta sumber dan halamannya.
    """
    hasil = _cari("regulasi.json", kueri, 3, lambda d: sumber in ("", d["sumber"]))
    if not hasil:
        return {"status": "kosong", "pesan": "Tidak ditemukan. Coba kata kunci lain."}
    return {"status": "ok", "hasil": [
        {"sumber": d["sumber"], "judul": d["judul"], "halaman": d["halaman"], "isi": d["isi"]}
        for d in hasil]}


def cek_riwayat(wesel_id: str) -> dict:
    """Membaca kejadian dan keputusan petugas sebelumnya pada wesel yang sama.

    Args:
        wesel_id: ID wesel, contoh "W-12".

    Returns:
        Daftar kejadian sebelumnya beserta keputusan dan catatan petugas.
    """
    riwayat = [r for r in _baca("riwayat.json") if r["wesel_id"] == wesel_id]
    return {"status": "ok", "jumlah": len(riwayat), "kejadian": riwayat}


def nilai_urgensi(indeks_kesehatan: int, kejadian_berulang: bool) -> dict:
    """Menentukan Klasifikasi A, B, atau C sesuai Bab 4 manual (aturan pasti, bukan tebakan).

    Args:
        indeks_kesehatan: Indeks kesehatan 0-100 dari deteksi_anomali.
        kejadian_berulang: True jika kerusakan yang sama pernah terjadi dan ditangani (lihat cek_riwayat).

    Returns:
        Kelas urgensi, tenggat penanganan, dan alasan.
    """
    if indeks_kesehatan < 40:
        kelas = "A"
    elif indeks_kesehatan < 70:
        kelas = "B"
    else:
        kelas = "C"
    alasan = f"Indeks kesehatan {indeks_kesehatan} menghasilkan Klasifikasi {kelas} (Bab 4.1)."
    if kejadian_berulang and kelas != "A":
        kelas = {"C": "B", "B": "A"}[kelas]
        alasan += f" Kejadian berulang, dinaikkan menjadi Klasifikasi {kelas}."
    tenggat = {"A": "24 jam", "B": "7 hari", "C": "pemeriksaan rutin berikutnya"}[kelas]
    return {"status": "ok", "kelas": kelas, "tenggat": tenggat, "alasan": alasan}


def buat_work_order(wesel_id: str, kondisi: str, kelas: str, ringkasan: str) -> dict:
    """Menyusun work order berisi langkah pemeriksaan Bab 5, berstatus menunggu persetujuan petugas.

    Args:
        wesel_id: ID wesel.
        kondisi: Kondisi hasil diagnosis, contoh "bantalan_aus" atau "poros_tidak_sejajar".
        kelas: Kelas urgensi dari nilai_urgensi ("A", "B", atau "C").
        ringkasan: Penjelasan singkat diagnosis dan alasannya untuk petugas.

    Returns:
        Work order yang tersimpan dengan status MENUNGGU_PERSETUJUAN.
    """
    langkah = next((s for s in _baca("manual.json") if s.get("kondisi") == kondisi), None)
    if langkah is None:
        return {"status": "error", "pesan": f"Bab 5 tidak memuat langkah untuk '{kondisi}'. Pertimbangkan eskalasi."}
    daftar = _baca("work_orders.json")
    wo = {
        "id": f"WO-{len(daftar) + 1:03d}",
        "wesel_id": wesel_id,
        "kondisi": kondisi,
        "kelas": kelas,
        "ringkasan": ringkasan,
        "langkah": langkah["isi"],
        "rujukan": f"Manual {langkah['id']}",
        "status": "MENUNGGU_PERSETUJUAN",
        "dibuat": datetime.now().isoformat(timespec="seconds"),
    }
    daftar.append(wo)
    _tulis("work_orders.json", daftar)
    return {"status": "ok", "work_order": wo}


def eskalasi(wesel_id: str, alasan: str) -> dict:
    """Meminta teknisi ahli memeriksa langsung saat pola tidak dikenal atau data meragukan.

    Args:
        wesel_id: ID wesel.
        alasan: Mengapa agen tidak bisa menyimpulkan sendiri.

    Returns:
        Konfirmasi permintaan eskalasi.
    """
    daftar = _baca("work_orders.json")
    item = {
        "id": f"ESK-{len(daftar) + 1:03d}",
        "wesel_id": wesel_id,
        "jenis": "ESKALASI",
        "alasan": alasan,
        "status": "MENUNGGU_TEKNISI_AHLI",
        "dibuat": datetime.now().isoformat(timespec="seconds"),
    }
    daftar.append(item)
    _tulis("work_orders.json", daftar)
    return {"status": "ok", "eskalasi": item}
