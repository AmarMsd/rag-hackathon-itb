import React, { useEffect, useState } from "react";
import {
  IconCalendar,
  IconDownload,
  IconFileText,
  IconCheck,
} from "../Icons.jsx";
import { api } from "../api.js";

export default function LaporanHarianPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [laporan, setLaporan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const muatLaporan = async (tgl) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.laporan(tgl);
      setLaporan(res);
    } catch (err) {
      setError(err.message || "Gagal memuat laporan harian untuk tanggal ini.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    muatLaporan(selectedDate);
  }, [selectedDate]);

  const ringkasan = laporan?.ringkasan || {};
  const perWesel = laporan?.per_wesel || [];
  const woBaru = laporan?.work_order_baru || [];
  const keputusan = laporan?.keputusan_petugas || [];

  return (
    <div className="page-view laporan-harian-page">
      {/* Top Header & Date Picker */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Laporan Harian Stasiun</h1>
          <p className="page-desc">
            Rekapitulasi operasional kondisi wesel, deteksi anomali, serta audit keputusan petugas per tanggal dinas.
          </p>
        </div>

        {/* Date Selector & Download Buttons */}
        <div className="laporan-header-controls">
          <div className="date-picker-wrapper">
            <IconCalendar className="date-picker-icon" />
            <input
              type="date"
              className="laporan-date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={todayStr}
            />
          </div>

          <a
            href={api.unduhLaporanUrl(selectedDate, "md")}
            download
            className="btn-secondary-custom"
            title="Unduh laporan lengkap dalam format Markdown"
          >
            <IconDownload className="icon-tiny" />
            <span>Unduh .MD</span>
          </a>

          <a
            href={api.unduhLaporanUrl(selectedDate, "csv")}
            download
            className="btn-primary-action"
            title="Unduh tabel telemetri dalam format CSV"
          >
            <IconDownload className="icon-tiny" />
            <span>Unduh .CSV</span>
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="card loading-card-center">
          <div className="loading-spinner" />
          <p>Menyusun rekaman data laporan harian {selectedDate}…</p>
        </div>
      ) : error ? (
        <div className="card error-card-center">
          <p>{error}</p>
          <button
            type="button"
            className="btn-secondary-custom"
            onClick={() => muatLaporan(selectedDate)}
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="laporan-sections-flow">
          {/* 1. Ringkasan Statistik Kartu */}
          <div className="laporan-stats-grid">
            <div className="laporan-stat-box">
              <span className="stat-label">Wesel Dipantau</span>
              <span className="stat-number">{ringkasan.wesel_dipantau ?? perWesel.length}</span>
            </div>
            <div className="laporan-stat-box">
              <span className="stat-label">Total Siklus Pembalikan</span>
              <span className="stat-number">{ringkasan.total_siklus ?? 0}</span>
            </div>
            <div className="laporan-stat-box warning">
              <span className="stat-label">Siklus Anomali</span>
              <span className="stat-number">{ringkasan.siklus_anomali ?? 0}</span>
            </div>
            <div className="laporan-stat-box">
              <span className="stat-label">Usulan WO / Eskalasi</span>
              <span className="stat-number">
                {(ringkasan.work_order_baru || 0) + (ringkasan.eskalasi_baru || 0)}
              </span>
            </div>
            <div className="laporan-stat-box success">
              <span className="stat-label">Keputusan Disetujui</span>
              <span className="stat-number">{ringkasan.disetujui ?? 0}</span>
            </div>
          </div>

          {/* 2. Tabel Kondisi Per Wesel */}
          <div className="card laporan-card">
            <h2 className="card-heading">Kondisi &amp; Statistik Per Wesel</h2>
            <div className="table-responsive-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Wesel</th>
                    <th>Status</th>
                    <th>Indeks Rata-rata</th>
                    <th>Indeks Terendah</th>
                    <th>Total Siklus</th>
                    <th>Siklus Anomali</th>
                    <th>Laju Degradasi</th>
                  </tr>
                </thead>
                <tbody>
                  {perWesel.map((pw) => (
                    <tr key={pw.wesel_id}>
                      <td><strong>{pw.wesel_id}</strong></td>
                      <td>
                        <span className={`status-pill ${pw.status?.toLowerCase() || "normal"}`}>
                          {pw.status}
                        </span>
                      </td>
                      <td><strong>{pw.indeks_rata ?? pw.indeks ?? "-"}</strong> / 100</td>
                      <td>{pw.indeks_min ?? "-"}</td>
                      <td>{pw.jumlah_siklus ?? 0}</td>
                      <td>
                        <span className={pw.siklus_anomali > 0 ? "anomali-count-tag" : ""}>
                          {pw.siklus_anomali ?? 0}
                        </span>
                      </td>
                      <td>{pw.laju_per_hari != null ? `${pw.laju_per_hari} / hari` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Grid Dua Kolom: Usulan Agen & Keputusan Petugas */}
          <div className="detail-grid-two-col">
            {/* Usulan Agen */}
            <div className="card laporan-card">
              <h2 className="card-heading">Usulan Pemeliharaan Agen</h2>
              {woBaru.length > 0 ? (
                <div className="laporan-wo-list">
                  {woBaru.map((wo) => (
                    <div key={wo.id} className="laporan-wo-item">
                      <div className="wo-item-top">
                        <span className={`wo-urgency-badge ${wo.jenis === "ESKALASI" ? "eskalasi" : "kelas-" + (wo.kelas || "b").toLowerCase()}`}>
                          {wo.id} ({wo.kelas || wo.jenis})
                        </span>
                        <strong className="wo-item-wesel">{wo.wesel_id}</strong>
                      </div>
                      <p className="wo-item-summary">{wo.ringkasan}</p>
                      {wo.alasan && <p className="wo-item-reason">Alasan: {wo.alasan}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="laporan-empty-note">Tidak ada draf usulan baru yang diajukan agen hari ini.</p>
              )}
            </div>

            {/* Keputusan Petugas */}
            <div className="card laporan-card">
              <h2 className="card-heading">Keputusan Petugas Dinas</h2>
              {keputusan.length > 0 ? (
                <div className="laporan-decision-list">
                  {keputusan.map((k) => (
                    <div key={k.id} className="laporan-decision-item">
                      <div className="decision-item-top">
                        <strong>{k.id} ({k.wesel_id})</strong>
                        <span className={`status-pill ${k.status === "DISETUJUI" ? "normal" : "bahaya"}`}>
                          {k.status}
                        </span>
                      </div>
                      <p className="decision-item-note">"{k.catatan_petugas || "Tanpa catatan"}"</p>
                      <span className="decision-item-by">
                        Oleh: <strong>{k.diputuskan_oleh || "Petugas"}</strong>
                        {k.diputuskan_pada && ` • ${k.diputuskan_pada.slice(11, 19)}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="laporan-empty-note">Belum ada keputusan work order yang dicatat pada tanggal ini.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}