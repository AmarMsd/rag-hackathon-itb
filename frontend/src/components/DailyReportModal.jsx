import React, { useState, useEffect } from "react";
import { IconX, IconCalendar, IconFileText } from "../Icons.jsx";
import { api } from "../api.js";

export default function DailyReportModal({ isOpen, onClose }) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async (tgl) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await api.laporan(tgl);
      setReport(data);
    } catch (err) {
      setError(err.message || "Gagal memuat laporan harian");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const r = report?.ringkasan || {};
  const perWesel = report?.per_wesel || [];
  const woBaru = report?.work_order_baru || [];
  const keputusan = report?.keputusan_petugas || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card daily-report-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Laporan Harian WeselGuard"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <IconCalendar className="report-modal-icon" />
            <div>
              <h2 className="modal-title">Laporan Harian WeselGuard</h2>
              <p className="modal-subtitle">
                Ringkasan kondisi kesehatan wesel, anomali sensor, dan keputusan petugas stasiun.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Tutup modal"
          >
            <IconX className="close-icon" />
          </button>
        </div>

        {/* Filter Bar & Export Actions */}
        <div className="report-controls-bar">
          <div className="report-date-selector">
            <label htmlFor="report-date-input" className="date-input-label">
              Tanggal Laporan:
            </label>
            <input
              id="report-date-input"
              type="date"
              className="report-date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="report-export-buttons">
            <a
              href={api.unduhLaporanUrl(selectedDate, "md")}
              download
              className="report-download-btn md"
              title="Unduh laporan lengkap dalam format Markdown"
            >
              <IconFileText className="download-btn-icon" />
              <span>Unduh .MD</span>
            </a>
            <a
              href={api.unduhLaporanUrl(selectedDate, "csv")}
              download
              className="report-download-btn csv"
              title="Unduh data tabel metrik dalam format CSV"
            >
              <IconFileText className="download-btn-icon" />
              <span>Unduh .CSV</span>
            </a>
          </div>
        </div>

        {error && <div className="modal-error-box">{error}</div>}

        {/* Report Content Body */}
        <div className="modal-body-scroll">
          {isLoading ? (
            <div className="modal-loading-state">
              <div className="loading-spinner" />
              <p>Menyusun laporan harian stasiun…</p>
            </div>
          ) : (
            <div className="report-content-wrapper">
              {/* Metric Summary Cards Grid */}
              <div className="report-stats-grid">
                <div className="report-stat-card">
                  <span className="stat-card-label">Wesel Dipantau</span>
                  <strong className="stat-card-val">{r.wesel_dipantau || perWesel.length}</strong>
                </div>

                <div className="report-stat-card">
                  <span className="stat-card-label">Total Siklus</span>
                  <strong className="stat-card-val">{r.total_siklus ?? 0}</strong>
                  <span className="stat-card-sub">({r.siklus_anomali ?? 0} anomali)</span>
                </div>

                <div className="report-stat-card">
                  <span className="stat-card-label">Work Order / Eskalasi</span>
                  <strong className="stat-card-val">{r.work_order_baru ?? 0} / {r.eskalasi_baru ?? 0}</strong>
                </div>

                <div className="report-stat-card">
                  <span className="stat-card-label">Keputusan Petugas</span>
                  <strong className="stat-card-val green">
                    {r.disetujui ?? 0} disetujui
                  </strong>
                  <span className="stat-card-sub">{r.ditolak ?? 0} ditolak</span>
                </div>
              </div>

              {/* Table of Wesel Condition Today */}
              <h3 className="section-heading">Kondisi per Wesel ({selectedDate})</h3>
              <div className="report-table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Wesel</th>
                      <th>Status</th>
                      <th>Indeks Rata-rata</th>
                      <th>Indeks Min</th>
                      <th>Siklus</th>
                      <th>Siklus Anomali</th>
                      <th>Laju/Hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perWesel.map((w) => (
                      <tr key={w.wesel_id}>
                        <td><strong>{w.wesel_id}</strong></td>
                        <td>
                          <span className={`status-pill ${w.status?.toLowerCase()}`}>
                            {w.status}
                          </span>
                        </td>
                        <td>{w.indeks_rata ?? "-"}</td>
                        <td>{w.indeks_min ?? "-"}</td>
                        <td>{w.jumlah_siklus ?? 0}</td>
                        <td>
                          <span className={w.siklus_anomali > 0 ? "anomali-badge" : ""}>
                            {w.siklus_anomali ?? 0}
                          </span>
                        </td>
                        <td>
                          {w.laju_per_hari != null
                            ? `${w.laju_per_hari > 0 ? "+" : ""}${w.laju_per_hari}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Usulan Agen & Keputusan */}
              <div className="report-details-split">
                <div className="report-details-block">
                  <h4 className="report-subheading">Usulan Agen Hari Ini</h4>
                  {woBaru.length === 0 ? (
                    <p className="report-empty-note">Tidak ada usulan baru hari ini.</p>
                  ) : (
                    <ul className="report-list">
                      {woBaru.map((wo) => (
                        <li key={wo.id}>
                          <strong>{wo.id} {wo.wesel_id}</strong> ({wo.jenis}): {wo.ringkasan || wo.alasan}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="report-details-block">
                  <h4 className="report-subheading">Keputusan Petugas Hari Ini</h4>
                  {keputusan.length === 0 ? (
                    <p className="report-empty-note">Belum ada keputusan dicatat hari ini.</p>
                  ) : (
                    <ul className="report-list">
                      {keputusan.map((k, i) => (
                        <li key={i}>
                          <strong>{k.id} ({k.wesel_id})</strong>: {k.status} oleh {k.diputuskan_oleh || "petugas"}
                          {k.catatan_petugas ? ` — "${k.catatan_petugas}"` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
