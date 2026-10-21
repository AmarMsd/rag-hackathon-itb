#!/usr/bin/env python3
# LoRa Receiver - Raspberry Pi 4 + RFM95W
# Library: pip install adafruit-circuitpython-rfm9x
#
# Wiring (nomor pin fisik header Pi):
#   RFM95W 3.3V -> pin 17 (3V3)     GND  -> pin 20 (GND)
#   SCK   -> pin 23 (GPIO 11)       MISO -> pin 21 (GPIO 9)
#   MOSI  -> pin 19 (GPIO 10)       NSS  -> pin 29 (GPIO 5)
#   RESET -> pin 22 (GPIO 25)       DIO0 -> tidak wajib untuk script ini

import time

import board
import busio
import digitalio
import adafruit_rfm9x

FREQ_MHZ = 923.0  # harus sama dengan ESP32 (923E6)

cs = digitalio.DigitalInOut(board.D5)
reset = digitalio.DigitalInOut(board.D25)
spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)

try:
    rfm9x = adafruit_rfm9x.RFM9x(spi, cs, reset, FREQ_MHZ)
except RuntimeError as e:
    print("RFM95W tidak terdeteksi - cek wiring dan SPI:", e)
    raise SystemExit(1)

# Setting radio harus SAMA dengan sender
rfm9x.spreading_factor = 7
rfm9x.signal_bandwidth = 125000
rfm9x.coding_rate = 5          # 4/5
rfm9x.enable_crc = True

print(f"LoRa receiver siap di {FREQ_MHZ} MHz, menunggu paket...")

while True:
    # with_header=True: library Adafruit default-nya membuang 4 byte pertama
    # (header RadioHead). ESP32 dengan library Sandeep Mistry tidak mengirim
    # header itu, jadi kita ambil seluruh paket apa adanya.
    packet = rfm9x.receive(timeout=5.0, with_header=True)
    if packet is None:
        continue

    try:
        text = bytes(packet).decode("utf-8")
    except UnicodeDecodeError:
        text = repr(bytes(packet))

    stamp = time.strftime("%H:%M:%S")
    print(f"[{stamp}] {text} | RSSI: {rfm9x.last_rssi} dBm | SNR: {rfm9x.last_snr:.1f} dB")
