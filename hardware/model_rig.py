#!/usr/bin/env python3
"""
WeselGuard - model lapis 1 untuk rig (getaran HP sebagai peniru point machine).

Install:  pip install pandas numpy scikit-learn joblib
Jalankan: python model_rig.py
          (membaca data/ciri/ciri_latih.csv dan data/ciri/ciri_uji.csv)

Tiga lapis keputusan per siklus:
  1. Aturan PM 10/2011: dur > 5 detik -> melanggar batas waktu perpindahan.
     Selalu berlaku, tidak bergantung model.
  2. Random forest menebak kondisi dari FITUR.
  3. Pemeriksa dikenal/tidak: |z| tiap fitur terhadap profil kondisi yang ditebak.
     Kalau ada yang melewati Z_MAKS, hasilnya "tidak_dikenal" (agen eskalasi).
     Profil dan Z_MAKS hanya dari data latih; data uji tidak dipakai menentukan apa pun.

Fitur sengaja tanpa f1, f2, dan rms:
  f2 = bayangan sampling di rig serial, f1 dan rms bergeser antarsesi tetapi sama
  untuk semua kondisi, sehingga model akan belajar "sesi mana" bukan "kondisi apa".

Keluaran:
  models/model_rig.joblib     random forest + daftar fitur
  models/profil_rig.json      profil per kondisi, profil normal, ambang (untuk lapis 1 dan agen)
  data/ciri/prediksi_uji.csv  prediksi per siklus uji
  models/laporan_rig.txt      ringkasan hasil uji (apa adanya, termasuk yang salah)
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_predict

LATIH = "data/ciri/ciri_latih.csv"
UJI = "data/ciri/ciri_uji.csv"
OUT_MODEL = "models"
FITUR = ["dur", "nseg", "aktif", "kurt"]
# Simpangan baku minimum per fitur, supaya fitur yang hampir konstan di latih
# (misalnya nseg normal selalu 1) tidak membuat z-score meledak karena variasi wajar.
STD_MIN = {"dur": 0.15, "nseg": 0.5, "aktif": 0.03, "kurt": 0.08}
Z_MAKS = 5.0
BATAS_PM10_S = 5.0
TAK_DIKENAL = "tak_dikenal"
SEED = 0


def profil(df):
    p = {}
    for lab, g in df.groupby("label"):
        p[lab] = {"n": int(len(g)),
                  "mean": {f: round(float(g[f].mean()), 4) for f in FITUR},
                  "std": {f: round(float(max(g[f].std(ddof=1), STD_MIN[f])), 4) for f in FITUR}}
    return p


def zmaks(X, kelas, prof):
    """|z| terbesar tiap baris terhadap profil kelas yang ditebak."""
    out = np.zeros(len(X))
    for i, (x, k) in enumerate(zip(X, kelas)):
        m = np.array([prof[k]["mean"][f] for f in FITUR])
        s = np.array([prof[k]["std"][f] for f in FITUR])
        out[i] = np.max(np.abs((x - m) / s))
    return out


def putuskan(model, prof, X):
    pred = model.predict(X)
    proba = model.predict_proba(X).max(axis=1)
    z = zmaks(X, pred, prof)
    akhir = np.where(z > Z_MAKS, TAK_DIKENAL, pred)
    return pred, proba, z, akhir


def main():
    lat = pd.read_csv(LATIH)
    uji = pd.read_csv(UJI)
    lat = lat[lat.label != TAK_DIKENAL]  # pengaman ganda: tak_dikenal tidak boleh dilatih
    os.makedirs(OUT_MODEL, exist_ok=True)
    lap = []

    def tulis(s=""):
        print(s); lap.append(s)

    Xl, yl = lat[FITUR].values, lat.label.values
    tulis(f"Data latih: {len(lat)} siklus {lat.label.value_counts().to_dict()}")
    tulis(f"Data uji:   {len(uji)} siklus {uji.label.value_counts().to_dict()}")
    tulis(f"Fitur: {FITUR}; Z_MAKS {Z_MAKS}; batas PM 10: dur > {BATAS_PM10_S} dtk")

    rf = RandomForestClassifier(n_estimators=300, min_samples_leaf=2, random_state=SEED)

    # Validasi silang di data latih (gambaran awal, bukan angka yang dilaporkan)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cvp = cross_val_predict(rf, Xl, yl, cv=cv)
    tulis(f"\nValidasi silang 5 lipat (latih): akurasi {(cvp == yl).mean()*100:.1f}%")

    rf.fit(Xl, yl)
    prof = profil(lat)

    # Seberapa ketat ambang di data latih sendiri
    _, _, zl, akhir_l = putuskan(rf, prof, Xl)
    tulis(f"Latih yang tertolak sebagai tidak dikenal: {(akhir_l == TAK_DIKENAL).sum()} dari {len(lat)}")

    # --- Uji: angka yang dilaporkan ---
    Xu, yu = uji[FITUR].values, uji.label.values
    pred, proba, z, akhir = putuskan(rf, prof, Xu)
    uji = uji.assign(prediksi_rf=pred, keyakinan=proba.round(3), z_maks=z.round(2), prediksi=akhir,
                     langgar_pm10=uji.dur > BATAS_PM10_S, benar=akhir == yu)
    uji.to_csv("data/ciri/prediksi_uji.csv", index=False)

    dikenal = yu != TAK_DIKENAL
    tulis("\n=== HASIL DATA UJI ===")
    tulis(f"Akurasi keseluruhan (6 kondisi, termasuk tidak dikenal): {(akhir == yu).mean()*100:.1f}% "
          f"({(akhir == yu).sum()}/{len(yu)})")
    if dikenal.any():
        tulis(f"Kondisi dikenal: {(akhir[dikenal] == yu[dikenal]).mean()*100:.1f}% benar; "
              f"{(akhir[dikenal] == TAK_DIKENAL).sum()} salah tertolak sebagai tidak dikenal")
    if (~dikenal).any():
        tulis(f"Pola tidak dikenal: {(akhir[~dikenal] == TAK_DIKENAL).sum()}/{(~dikenal).sum()} "
              f"tertangkap sebagai tidak dikenal (agen harus eskalasi)")
    pm_benar = (uji.dur > BATAS_PM10_S) == uji.label.isin(["lambat", "macet", "slip"])
    tulis(f"Aturan PM 10 (dur > 5 dtk) cocok dengan kondisi lambat/macet/slip: "
          f"{pm_benar.mean()*100:.1f}%")

    lab = sorted(set(yu) | set(akhir))
    tulis("\nMatriks kebingungan (baris = sebenarnya, kolom = prediksi):")
    cm = pd.DataFrame(confusion_matrix(yu, akhir, labels=lab), index=lab, columns=lab)
    tulis(cm.to_string())
    tulis("\n" + classification_report(yu, akhir, labels=lab, zero_division=0))

    salah = uji[~uji.benar]
    if len(salah):
        tulis("Siklus uji yang salah:")
        for _, r in salah.iterrows():
            tulis(f"  #{r.siklus} {r.label} -> {r.prediksi} (rf: {r.prediksi_rf}, z {r.z_maks}, "
                  f"dur {r.dur}, nseg {r.nseg}, aktif {r.aktif}, kurt {r.kurt})")

    imp = sorted(zip(FITUR, rf.feature_importances_), key=lambda t: -t[1])
    tulis("\nPentingnya fitur: " + ", ".join(f"{f} {v:.2f}" for f, v in imp))

    joblib.dump({"model": rf, "fitur": FITUR}, os.path.join(OUT_MODEL, "model_rig.joblib"))
    json.dump({"sumber": "rig", "fitur": FITUR, "z_maks": Z_MAKS, "std_min": STD_MIN,
               "batas_pm10_detik": BATAS_PM10_S, "profil_normal": prof.get("normal"),
               "profil_kelas": prof, "catatan": "Label kondisi hanya untuk melatih; tidak dikirim ke agen."},
              open(os.path.join(OUT_MODEL, "profil_rig.json"), "w"), indent=2, ensure_ascii=False)
    open(os.path.join(OUT_MODEL, "laporan_rig.txt"), "w").write("\n".join(lap) + "\n")
    print(f"\nTersimpan: {OUT_MODEL}/model_rig.joblib, {OUT_MODEL}/profil_rig.json, "
          f"{OUT_MODEL}/laporan_rig.txt, data/ciri/prediksi_uji.csv")


if __name__ == "__main__":
    main()
