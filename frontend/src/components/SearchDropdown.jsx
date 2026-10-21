import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Lampu } from "./Unsur.jsx";
import { labelKondisi } from "../kondisi.js";

const JENIS = [
  ["semua", "Semua"],
  ["wesel", "Wesel"],
  ["work_order", "Work order"],
  ["riwayat", "Riwayat"],
  ["manual", "Manual contoh"],
  ["dokumen", "Dokumen"],
];

// Hasil pencarian gabungan dari /api/cari. Kunci hasil mengikuti backend (pencarian.py).
export default function SearchDropdown({ query, isOpen, onClose, onSelectWesel, onNavigate }) {
  const [jenis, setJenis] = useState("semua");
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) return;
    const t = setTimeout(() => {
      api.cari(query.trim(), jenis, 5).then((r) => { setHasil(r); setGalat(""); }).catch((e) => setGalat(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [query, jenis, isOpen]);

  if (!isOpen) return null;
  const h = hasil?.hasil || {};
  const kosong = hasil && hasil.jumlah === 0;

  return (
    <div className="wg-hasil-cari" role="dialog" aria-label="Hasil pencarian">
      <div className="wg-tab" role="tablist">
        {JENIS.map(([id, nama]) => (
          <button key={id} role="tab" aria-selected={jenis === id} onClick={() => setJenis(id)}>{nama}</button>
        ))}
      </div>
      {galat && <p className="wg-galat" style={{ padding: "8px 14px" }}>{galat}</p>}
      {!hasil && !galat && <p className="wg-sedang" style={{ padding: "10px 14px" }}>Mencari</p>}
      {kosong && <p className="wg-kosong" style={{ padding: "10px 14px" }}>Tidak ada yang cocok dengan “{query}”. Coba ID wesel seperti PM-01, nomor work order, atau gejala seperti “macet”.</p>}
      <div className="wg-hasil-isi">
        {h.wesel?.length > 0 && (
          <section><h4>Wesel</h4>{h.wesel.map((w) => (
            <button key={w.wesel_id} type="button" onClick={() => { onSelectWesel?.(w.wesel_id); onClose(); }}>
              <Lampu status={w.status} /><b>{w.wesel_id}</b><span>{w.status}, {labelKondisi(w.kondisi_kandidat).toLowerCase()}, indeks {w.indeks_kesehatan}</span>
            </button>
          ))}</section>
        )}
        {h.work_order?.length > 0 && (
          <section><h4>Work order</h4>{h.work_order.map((w) => (
            <button key={w.id} type="button" onClick={() => onNavigate("workorders")}>
              <b>{w.id}</b><span>{w.wesel_id}, {w.status.toLowerCase().replaceAll("_", " ")}. {w.ringkasan || w.alasan}</span>
            </button>
          ))}</section>
        )}
        {h.riwayat?.length > 0 && (
          <section><h4>Riwayat</h4>{h.riwayat.map((r, i) => (
            <button key={i} type="button" onClick={() => onNavigate("detail", { weselId: r.wesel_id })}>
              <b>{r.wesel_id}</b><span>{r.tanggal}, {labelKondisi(r.kondisi).toLowerCase()}, {r.keputusan_petugas}</span>
            </button>
          ))}</section>
        )}
        {h.manual?.length > 0 && (
          <section><h4>Manual contoh</h4>{h.manual.map((m) => (
            <div key={m.id} className="baris"><b>{m.id} {m.judul}</b><span>{m.cuplikan}</span></div>
          ))}</section>
        )}
        {h.dokumen?.length > 0 && (
          <section><h4>Dokumen</h4>{h.dokumen.map((d, i) => (
            <button key={i} type="button" onClick={() => onNavigate("dokumen")}>
              <b>{d.judul}, hlm. {d.halaman}</b><span>{d.cuplikan}</span>
            </button>
          ))}</section>
        )}
      </div>
    </div>
  );
}
