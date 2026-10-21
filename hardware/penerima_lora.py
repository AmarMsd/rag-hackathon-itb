#!/usr/bin/env python3
"""
WeselGuard - penerima LoRa di Raspberry Pi 4 + RFM95W.

Menerima pesan ciri dari node, menyimpannya ke log JSONL, dan (opsional):
  --model     menampilkan prediksi model_rig untuk tiap siklus (pengecekan; tidak diteruskan)
  --mqtt      meneruskan pesan apa adanya ke broker MQTT (topik weselguard/rig/<pm>/siklus|status)
  --http      meneruskan pesan apa adanya lewat HTTP POST (JSON) ke web server
  --weselguard  folder paket weselguard (berisi database.py dan lapis1_rig.py): setiap siklus
              dinilai lapis1_rig dan disimpan ke SQLite yang dibaca dashboard dan agen.
              Butuh --model dan --profil.

Install:  pip install adafruit-circuitpython-rfm9x
          pip install scikit-learn joblib     (kalau memakai --model)
          pip install paho-mqtt               (kalau memakai --mqtt)
Jalankan: python3 penerima_lora.py
          python3 penerima_lora.py --model models/model_rig.joblib --profil models/profil_rig.json
          python3 penerima_lora.py --mqtt localhost --http http://localhost:8000/api/siklus
          python3 penerima_lora.py --model models/model_rig.joblib --profil models/profil_rig.json \
                  --weselguard ~/hackathon/hackathon/weselguard

Wiring (nomor pin fisik header Pi):
  RFM95W 3.3V -> pin 17 (3V3)     GND  -> pin 20 (GND)
  SCK   -> pin 23 (GPIO 11)       MISO -> pin 21 (GPIO 9)
  MOSI  -> pin 19 (GPIO 10)       NSS  -> pin 29 (GPIO 5)
  RESET -> pin 22 (GPIO 25)
"""
import argparse
import json
import os
import time
import urllib.request
from datetime import datetime, timezone

import board
import busio
import digitalio
import adafruit_rfm9x

FREQ_MHZ = 923.0
WAJIB_CYC = {"src", "pm", "cyc", "dur", "rms", "kurt", "f1", "nseg", "aktif", "fs"}
HB_HILANG_S = 90  # tidak ada pesan selama ini -> node dianggap mati

p = argparse.ArgumentParser()
p.add_argument("--model")
p.add_argument("--profil")
p.add_argument("--mqtt", help="host broker MQTT, misalnya localhost")
p.add_argument("--http", help="URL penerima HTTP POST")
p.add_argument("--log", default="data/lora")
p.add_argument("--weselguard", help="folder paket weselguard untuk menyimpan ke database")
args = p.parse_args()
os.makedirs(args.log, exist_ok=True)

# --- Opsional: model untuk pengecekan langsung ---
model = prof = None
if args.model:
    import joblib
    import numpy as np
    m = joblib.load(args.model)
    model, FITUR = m["model"], m["fitur"]
    prof = json.load(open(args.profil)) if args.profil else None

def prediksi(msg):
    x = np.array([[msg[f] for f in FITUR]])
    k = model.predict(x)[0]
    yakin = model.predict_proba(x).max()
    z, alasan = None, ""
    if prof:
        pk = prof["profil_kelas"][k]
        zs = {f: (msg[f] - pk["mean"][f]) / pk["std"][f] for f in FITUR}
        f_max = max(zs, key=lambda f: abs(zs[f]))
        z = abs(zs[f_max])
        if z > prof["z_maks"]:
            alasan = (f" | paling mirip {k}, tapi {f_max} {msg[f_max]} "
                      f"(profil {pk['mean'][f_max]:.2f} ± {pk['std'][f_max]:.2f})")
            k = "tak_dikenal"
    pm10 = msg["dur"] > (prof["batas_pm10_detik"] if prof else 5.0)
    return k, yakin, z, pm10, alasan

# --- Opsional: lapis 1 rig + database WeselGuard ---
L1 = None
if args.weselguard:
    import sys
    if not (args.model and args.profil):
        raise SystemExit("--weselguard butuh --model dan --profil")
    sys.path.insert(0, os.path.expanduser(args.weselguard))
    import lapis1_rig as L1  # dimuat langsung, tanpa __init__.py paket (yang mengimpor agen)
    L1.muat(args.model, args.profil)

# --- Opsional: MQTT ---
mq = None
if args.mqtt:
    import paho.mqtt.client as mqtt
    try:
        mq = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:  # paho-mqtt versi 1.x
        mq = mqtt.Client()
    mq.connect(args.mqtt, 1883, 30)
    mq.loop_start()

def teruskan(msg):
    data = json.dumps(msg, ensure_ascii=False)
    if mq:
        jenis = "siklus" if msg.get("type") == "cyc" else "status"
        mq.publish(f"weselguard/{msg['src']}/{msg['pm']}/{jenis}", data, qos=1)
    if args.http:
        try:
            req = urllib.request.Request(args.http, data=data.encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=2).read()
        except Exception as e:
            print(f"    HTTP gagal: {e}")

# --- Radio ---
cs = digitalio.DigitalInOut(board.D5)
reset = digitalio.DigitalInOut(board.D25)
spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)
try:
    rfm9x = adafruit_rfm9x.RFM9x(spi, cs, reset, FREQ_MHZ)
except RuntimeError as e:
    print("RFM95W tidak terdeteksi - cek wiring dan SPI:", e)
    raise SystemExit(1)
rfm9x.spreading_factor = 7
rfm9x.signal_bandwidth = 125000
rfm9x.coding_rate = 5
rfm9x.enable_crc = True

print(f"Penerima LoRa siap di {FREQ_MHZ} MHz"
      + (" | model aktif" if model else "") + (f" | MQTT {args.mqtt}" if mq else "")
      + (f" | HTTP {args.http}" if args.http else ""))

terakhir = {}       # pm -> waktu pesan terakhir
cyc_terakhir = {}   # pm -> nomor siklus terakhir (untuk deteksi paket hilang)
sudah_mati = set()

while True:
    packet = rfm9x.receive(timeout=5.0, with_header=True)
    now = time.time()
    for pm, t in terakhir.items():
        if now - t > HB_HILANG_S and pm not in sudah_mati:
            print(f"[{time.strftime('%H:%M:%S')}] PERINGATAN: tidak ada pesan dari {pm} "
                  f"selama {now - t:.0f} dtk, node mungkin mati")
            sudah_mati.add(pm)
    if packet is None:
        continue

    raw = bytes(packet)
    stamp = time.strftime("%H:%M:%S")
    try:
        msg = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        print(f"[{stamp}] paket bukan JSON: {raw!r} | RSSI {rfm9x.last_rssi}")
        continue

    msg["rssi"] = rfm9x.last_rssi
    msg["snr"] = round(rfm9x.last_snr, 1)
    msg["t_terima"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    pm = msg.get("pm", "?")
    terakhir[pm] = now
    sudah_mati.discard(pm)

    if msg.get("type") == "cyc" and cyc_terakhir.get(pm) == msg.get("cyc"):
        continue  # salinan kedua dari node; sudah dicatat dan diteruskan

    with open(os.path.join(args.log, time.strftime("%Y%m%d") + ".jsonl"), "a") as f:
        f.write(json.dumps(msg, ensure_ascii=False) + "\n")

    if msg.get("type") == "hb":
        if L1:
            L1.catat_hidup(msg)
        print(f"[{stamp}] {pm} hidup | uptime {msg.get('up')} dtk | siklus {msg.get('cyc')} | "
              f"diam {msg.get('diam_mg')} mg | ovr {msg.get('ovr')} | RSSI {msg['rssi']}")
    else:
        kurang = WAJIB_CYC - msg.keys()
        if kurang:
            print(f"[{stamp}] pesan siklus tidak lengkap, kurang {sorted(kurang)}: {msg}")
            continue
        hilang = ""
        if pm in cyc_terakhir:
            if msg["cyc"] == cyc_terakhir[pm]:
                continue  # salinan kedua dari node; sudah diproses
            if msg["cyc"] > cyc_terakhir[pm] + 1:
                hilang = f" | {msg['cyc'] - cyc_terakhir[pm] - 1} siklus hilang"
            elif msg["cyc"] < cyc_terakhir[pm]:
                hilang = " | node restart (nomor siklus mulai ulang)"
        cyc_terakhir[pm] = msg["cyc"]
        teks = (f"[{stamp}] {pm} siklus #{msg['cyc']}: dur {msg['dur']:.2f} dtk, nseg {msg['nseg']}, "
                f"aktif {msg['aktif']:.2f}, kurt {msg['kurt']:.2f}, f1 {msg['f1']:.0f} Hz | "
                f"RSSI {msg['rssi']} SNR {msg['snr']}{hilang}")
        if L1:
            h = L1.proses_pesan(msg)
            teks += (f"\n    -> {h['status']}: {h['kondisi']} (indeks {h['indeks']}, skor {h['skor']})"
                     + (f" | {h['alasan']}" if h["alasan"] else "")
                     + (" | MELANGGAR batas PM 10" if h["langgar_pm10"] else "") + " | tersimpan")
        elif model:
            k, yakin, z, pm10, alasan = prediksi(msg)
            teks += f"\n    -> {k} (yakin {yakin:.2f}" + (f", z {z:.1f}" if z is not None else "") + ")" + alasan
            if pm10:
                teks += " | MELANGGAR batas PM 10 (dur > 5 dtk)"
        print(teks)

    teruskan(msg)
