#!/usr/bin/env python3
"""Menambahkan subbab manual contoh untuk kondisi rig (gerak point machine) ke manual.json.

Aman dijalankan berulang: subbab dengan id yang sudah ada tidak ditambah lagi.
Jalankan ulang setelah siapkan_dokumen.py kalau skrip itu menulis ulang manual.json.

Pemakaian (dari ~/hackathon/hackathon):
  python3 tambah_manual_rig.py
Lalu restart server.py, karena indeks pencarian manual disimpan di memori saat pertama dipakai.

Field `kondisi` di Bab 5 harus sama persis dengan kondisi_kandidat dari lapis1_rig.py,
karena buat_work_order() mencari langkah berdasarkan field itu.
Pola tidak dikenal sengaja tidak punya langkah Bab 5 (memakai 3.3), supaya agen tetap eskalasi.
"""
import json
from pathlib import Path

MANUAL = Path(__file__).parent / "weselguard" / "data" / "manual.json"

TAMBAHAN = [
    {"id": "3.4", "bab": 3, "judul": "Gejala perpindahan wesel melambat",
     "isi": "Bentuk getaran siklus gerak masih normal (satu kali gerak utuh, tanpa jeda), tetapi durasi "
            "perpindahan terus memanjang dibanding profil normal, walau masih di bawah batas 5 detik. "
            "Biasanya tanda awal gesekan bertambah pada bantalan geser lidah wesel atau kurang pelumasan. "
            "Ditangani sebagai degradasi dan peringatan dini, bukan pola asing."},
    {"id": "3.5", "bab": 3, "judul": "Gejala perpindahan lambat dan macet",
     "isi": "Perpindahan lambat: durasi gerak melewati batas 5 detik (PM 10/2011) tetapi gerak selesai. "
            "Macet: penggerak terus bekerja sampai batas waktu sekitar 10 detik tanpa menyelesaikan gerak, "
            "biasanya karena benda asing di antara lidah dan rel lantak atau lidah terganjal. "
            "Keduanya melanggar batas waktu perpindahan dan berbahaya untuk operasi."},
    {"id": "3.6", "bab": 3, "judul": "Gejala slip lalu kembali",
     "isi": "Penggerak bekerja sampai batas waktu karena lidah terganjal, kopling slip, lalu penggerak berbalik "
            "dan lidah kembali ke kedudukan semula. Terlihat sebagai gerak panjang sekitar 10 detik, jeda singkat, "
            "lalu gerak pendek. Wesel tidak berpindah kedudukan dan harus dianggap tidak aman dilalui."},
    {"id": "3.7", "bab": 3, "judul": "Gejala penguncian tidak sempurna",
     "isi": "Gerak utama selesai dalam durasi wajar, tetapi diikuti beberapa getaran pendek berulang di akhir "
            "siklus karena penguncian lidah tidak masuk bersih. Durasi hampir normal sehingga mudah terlewat, "
            "padahal lidah yang tidak terkunci sempurna berbahaya. Diperlakukan sebagai kondisi berbahaya."},
    {"id": "5.3", "bab": 5, "judul": "Langkah pemeriksaan perpindahan melambat",
     "kondisi": "perpindahan_melambat",
     "isi": "1. Periksa kekencangan dudukan sensor terlebih dahulu. 2. Bersihkan dan lumasi bantalan geser lidah "
            "wesel. 3. Periksa hambatan di sepanjang lintasan lidah. 4. Ukur arus motor penggerak saat bergerak dan "
            "bandingkan dengan catatan sebelumnya. 5. Uji gerak wesel tiga kali dan catat durasi siklus."},
    {"id": "5.4", "bab": 5, "judul": "Langkah pemeriksaan perpindahan lambat",
     "kondisi": "perpindahan_lambat",
     "isi": "1. Amankan wesel sesuai prosedur keselamatan dan laporkan ke pengatur perjalanan. 2. Periksa benda asing "
            "dan hambatan di lintasan lidah. 3. Bersihkan dan lumasi bantalan geser. 4. Periksa tegangan suplai dan "
            "arus motor penggerak. 5. Uji gerak tiga kali; durasi harus di bawah 5 detik sebelum wesel dipakai lagi."},
    {"id": "5.5", "bab": 5, "judul": "Langkah pemeriksaan wesel macet",
     "kondisi": "macet",
     "isi": "1. Amankan wesel, laporkan ke pengatur perjalanan, jangan dilalui. 2. Periksa dan singkirkan benda asing "
            "di antara lidah dan rel lantak. 3. Periksa batang penggerak dan sambungannya. 4. Periksa motor dan "
            "kopling penggerak. 5. Uji gerak tiga kali ke kedua arah dan catat durasi siklus."},
    {"id": "5.6", "bab": 5, "judul": "Langkah pemeriksaan slip lalu kembali",
     "kondisi": "slip",
     "isi": "1. Amankan wesel, laporkan ke pengatur perjalanan, jangan dilalui. 2. Pastikan kedudukan lidah yang "
            "sebenarnya di lapangan. 3. Periksa ganjalan dan benda asing di lintasan lidah. 4. Periksa dan setel "
            "kopling slip penggerak. 5. Uji gerak tiga kali ke kedua arah dan catat durasi siklus."},
    {"id": "5.7", "bab": 5, "judul": "Langkah pemeriksaan penguncian tidak sempurna",
     "kondisi": "penguncian_tidak_sempurna",
     "isi": "1. Amankan wesel, laporkan ke pengatur perjalanan, jangan dilalui. 2. Periksa celah lidah terhadap rel "
            "lantak pada kedudukan terkunci. 3. Periksa dan setel batang pengunci dan detektor. 4. Periksa keausan "
            "komponen pengunci. 5. Uji gerak tiga kali dan pastikan penguncian masuk bersih setiap kali."},
]

manual = json.loads(MANUAL.read_text(encoding="utf-8"))
ada = {s["id"] for s in manual}
baru = [s for s in TAMBAHAN if s["id"] not in ada]
bentrok = [s["id"] for s in TAMBAHAN if s["id"] in ada and
           next(m for m in manual if m["id"] == s["id"])["judul"] != s["judul"]]
if bentrok:
    raise SystemExit(f"Id {bentrok} sudah dipakai subbab lain di manual.json. Ubah id di skrip ini dulu.")
manual += baru
manual.sort(key=lambda s: [int(x) for x in s["id"].split(".")])
MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Ditambahkan {len(baru)} subbab: {[s['id'] for s in baru] or 'tidak ada (sudah lengkap)'}")
print(f"manual.json sekarang {len(manual)} subbab.")
