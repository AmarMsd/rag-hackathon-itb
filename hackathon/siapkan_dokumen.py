"""Mengubah dokumen PDF menjadi potongan teks untuk RAG (weselguard/data/regulasi.json).

Pemakaian:
  python siapkan_dokumen.py dokumen/*.pdf

Butuh: pip install pypdf
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

KELUAR = Path(__file__).parent / "weselguard" / "data" / "regulasi.json"
KATA_PER_POTONGAN = 180
TUMPANG_TINDIH = 40

JUDUL_DIKENAL = {
    "PM 10/2011": "Persyaratan Teknis Peralatan Persinyalan",
    "PM 32/2011": "Standar dan Tata Cara Perawatan Prasarana Perkeretaapian",
}


def nama_sumber(path):
    m = re.search(r"pm\D*(\d+)\D*tahun\D*(\d{4})", path.stem, re.I)
    return f"PM {m.group(1)}/{m.group(2)}" if m else path.stem


def potong(teks):
    kata = teks.split()
    langkah = KATA_PER_POTONGAN - TUMPANG_TINDIH
    for mulai in range(0, max(len(kata) - TUMPANG_TINDIH, 1), langkah):
        yield " ".join(kata[mulai:mulai + KATA_PER_POTONGAN])


def proses(path):
    sumber = nama_sumber(path)
    judul = JUDUL_DIKENAL.get(sumber, path.stem)
    hasil = []
    for nomor, halaman in enumerate(PdfReader(path).pages, start=1):
        teks = re.sub(r"\s+", " ", halaman.extract_text() or "").strip()
        if len(teks.split()) < 15:  # halaman kosong atau hasil scan
            continue
        for i, isi in enumerate(potong(teks), start=1):
            hasil.append({"id": f"{sumber} hlm.{nomor}-{i}", "sumber": sumber,
                          "judul": judul, "halaman": nomor, "isi": isi})
    print(f"{sumber}: {len(hasil)} potongan")
    return hasil


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Pemakaian: python siapkan_dokumen.py dokumen/*.pdf")
    semua = [p for f in sys.argv[1:] for p in proses(Path(f))]
    KELUAR.write_text(json.dumps(semua, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Tersimpan {len(semua)} potongan di {KELUAR}")
