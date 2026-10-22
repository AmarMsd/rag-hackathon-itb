#!/usr/bin/env python3
"""Meringkas ekspor Overpass (rel, wesel, stasiun) menjadi peta kecil untuk dashboard.

Pemakaian:
  python3 scripts/olah_peta_osm.py data_wesel.json public/peta/peta_osm.json

Query Overpass yang dipakai:
  [out:json][timeout:180];
  ( way["railway"="rail"](-7.45,107.0,-6.45,108.6);
    node["railway"="switch"](-7.45,107.0,-6.45,108.6);
    node["railway"="station"](-7.45,107.0,-6.45,108.6); );
  out body; >; out skel qt;

Koordinat diproyeksikan ke meter di sekitar Bandung (x ke timur, y ke selatan) dan garis rel
disederhanakan (Ramer-Douglas-Peucker, toleransi 6 m), supaya peta bisa digambar tanpa
peta latar dari internet. Data: (c) OpenStreetMap contributors, lisensi ODbL.
"""
import json
import math
import sys

LAT0, LON0 = -6.92, 107.60
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574
TOLERANSI_M = 6


def proyeksi(lat, lon):
    return (lon - LON0) * KX, (LAT0 - lat) * KY


def rdp(titik, tol):
    if len(titik) < 3:
        return titik
    (x1, y1), (x2, y2) = titik[0], titik[-1]
    dx, dy = x2 - x1, y2 - y1
    panjang = math.hypot(dx, dy) or 1e-9
    jauh, idx = 0, 0
    for i in range(1, len(titik) - 1):
        x, y = titik[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / panjang
        if d > jauh:
            jauh, idx = d, i
    if jauh <= tol:
        return [titik[0], titik[-1]]
    return rdp(titik[: idx + 1], tol)[:-1] + rdp(titik[idx:], tol)


def main(masuk, keluar):
    el = json.load(open(masuk, encoding="utf-8"))["elements"]
    koordinat = {e["id"]: (e["lat"], e["lon"]) for e in el if e["type"] == "node" and "lat" in e}
    rel = []
    for w in (e for e in el if e["type"] == "way"):
        t = w.get("tags", {})
        if t.get("railway") != "rail":
            continue
        kelas = "cepat" if t.get("gauge") == "1435" else ("layanan" if "service" in t else "utama")
        titik = [proyeksi(*koordinat[n]) for n in w["nodes"] if n in koordinat]
        titik = rdp(titik, TOLERANSI_M)
        if len(titik) >= 2:
            rel.append({"k": kelas, "p": [v for x, y in titik for v in (round(x), round(y))]})
    wesel, stasiun = [], []
    for n in (e for e in el if e["type"] == "node" and "tags" in e):
        x, y = proyeksi(n["lat"], n["lon"])
        jenis = n["tags"].get("railway")
        if jenis == "switch":
            wesel.append({"id": n["id"], "x": round(x), "y": round(y), "ref": n["tags"].get("ref")})
        elif jenis == "station" and n["tags"].get("name"):
            stasiun.append({"nama": n["tags"]["name"], "x": round(x), "y": round(y)})
    hasil = {
        "sumber": "OpenStreetMap (ODbL), diunduh lewat Overpass",
        "proyeksi": {"lat0": LAT0, "lon0": LON0, "satuan": "meter, x ke timur, y ke selatan"},
        "rel": rel, "wesel": wesel, "stasiun": stasiun,
    }
    json.dump(hasil, open(keluar, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(rel)} ruas rel, {sum(len(r['p']) // 2 for r in rel)} titik, {len(wesel)} wesel, {len(stasiun)} stasiun -> {keluar}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
