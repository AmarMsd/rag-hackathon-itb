import React, { useState } from "react";
import {
  IconArrowUpDown,
  IconChevronDown,
  IconStar,
  IconFileText,
  IconMoreVertical,
  IconArrowUpRight,
  IconSparkles,
} from "../Icons.jsx";

const STATUS_BADGE_MAP = {
  Normal: { label: "Completed", style: "completed" },
  Aman: { label: "Completed", style: "completed" },
  Waspada: { label: "Waspada", style: "warning" },
  Bahaya: { label: "Bahaya", style: "danger" },
  "Tidak dikenal": { label: "Cancelled", style: "cancelled" },
};

export default function HistoryTableCard({
  weselList = [],
  selectedId,
  onSelectWesel,
  onAnalyze,
  workOrders = [],
  onDecideWorkOrder,
  riwayat = [],
  isReadOnly = false,
}) {
  const [activeTab, setActiveTab] = useState("wesel"); // "wesel" | "prioritas" | "workorders" | "riwayat"
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [notes, setNotes] = useState({});
  const [actionError, setActionError] = useState("");

  const pendingWOs = workOrders.filter((wo) => wo.status.startsWith("MENUNGGU"));
  const decidedWOs = workOrders.filter((wo) => !wo.status.startsWith("MENUNGGU")).slice(0, 5);

  // Fitur 4: Prioritas hari ini diurutkan dari status + indeks kesehatan
  const prioritasWesel = [...weselList].sort((a, b) => {
    const weight = { Bahaya: 3, Waspada: 2, Normal: 1, "Tidak dikenal": 2 };
    const diff = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (diff !== 0) return diff;
    return (a.indeks_kesehatan || 0) - (b.indeks_kesehatan || 0);
  });

  // Filtered & sorted wesel list
  const filteredWesel = weselList.filter((w) => {
    if (filterStatus === "all") return true;
    return w.status.toLowerCase() === filterStatus.toLowerCase();
  });

  filteredWesel.sort((a, b) => {
    return sortOrder === "desc"
      ? (b.indeks_kesehatan || 0) - (a.indeks_kesehatan || 0)
      : (a.indeks_kesehatan || 0) - (b.indeks_kesehatan || 0);
  });

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const handleDecision = async (woId, action) => {
    setActionError("");
    try {
      await onDecideWorkOrder(woId, action, notes[woId] || "");
    } catch (e) {
      setActionError(e.message || "Gagal memproses keputusan work order");
    }
  };

  return (
    <div className="card session-history-card">
      {/* Table Header */}
      <div className="table-card-header">
        <div className="table-tabs-nav">
          <button
            type="button"
            className={`table-nav-tab ${activeTab === "wesel" ? "active" : ""}`}
            onClick={() => setActiveTab("wesel")}
          >
            Session History ({weselList.length})
          </button>

          <button
            type="button"
            className={`table-nav-tab ${activeTab === "prioritas" ? "active" : ""}`}
            onClick={() => setActiveTab("prioritas")}
            title="Fitur 4: Prioritas wesel yang harus segera ditangani hari ini"
          >
            Prioritas Hari Ini
            <span className="tab-priority-pulse" />
          </button>

          <button
            type="button"
            className={`table-nav-tab ${activeTab === "workorders" ? "active" : ""}`}
            onClick={() => setActiveTab("workorders")}
          >
            Antrean Work Order
            {pendingWOs.length > 0 && (
              <span className="tab-pending-badge">{pendingWOs.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`table-nav-tab ${activeTab === "riwayat" ? "active" : ""}`}
            onClick={() => setActiveTab("riwayat")}
          >
            Riwayat {selectedId || "Wesel"}
          </button>
        </div>

        <div className="table-controls">
          <button
            type="button"
            className="control-pill-btn"
            onClick={toggleSort}
            title="Urutkan Indeks Kesehatan"
          >
            <IconArrowUpDown className="btn-icon" />
            <span>Sort {sortOrder === "desc" ? "↓" : "↑"}</span>
          </button>

          <div className="select-pill-wrapper">
            <select
              className="select-pill"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter status"
            >
              <option value="all">Month (Semua)</option>
              <option value="Normal">Status: Normal</option>
              <option value="Waspada">Status: Waspada</option>
              <option value="Bahaya">Status: Bahaya</option>
            </select>
            <IconChevronDown className="select-chevron" />
          </div>
        </div>
      </div>

      {actionError && <div className="table-error-banner">{actionError}</div>}

      {/* Tab 1: Fitur 1: Indeks kesehatan per baris (GET /api/wesel: indeks_kesehatan, status) */}
      {activeTab === "wesel" && (
        <div className="table-responsive-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th className="th-client">Client (Wesel)</th>
                <th className="th-type">Session type (Kondisi)</th>
                <th className="th-date">Last session</th>
                <th className="th-status">Status</th>
                <th className="th-rating">Indeks Kesehatan</th>
                <th className="th-notes">Notes</th>
                <th className="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {filteredWesel.map((w) => {
                const badge = STATUS_BADGE_MAP[w.status] || {
                  label: w.status,
                  style: "warning",
                };
                const isSelected = selectedId === w.wesel_id;
                const starScore = (w.indeks_kesehatan ? (w.indeks_kesehatan / 20).toFixed(1) : "4.8") + "/5";
                const indeksVal = w.indeks_kesehatan ?? 78;

                return (
                  <tr
                    key={w.wesel_id}
                    className={`table-row ${isSelected ? "selected-row" : ""}`}
                    onClick={() => onSelectWesel && onSelectWesel(w.wesel_id)}
                  >
                    {/* Client (Wesel ID & Coach / Lokasi) */}
                    <td className="td-client">
                      <div className="client-cell">
                        <span className="client-name">{w.wesel_id}</span>
                        <span className="client-subtitle">
                          {w.lokasi || "Wesel Sintelis"}
                        </span>
                      </div>
                    </td>

                    {/* Session Type (Deteksi Kondisi) */}
                    <td className="td-type">
                      <span className="type-badge-text">
                        {w.kondisi_kandidat === "bantalan_aus"
                          ? "Interval Training (Bantalan)"
                          : w.kondisi_kandidat === "poros_tidak_sejajar"
                          ? "Tempo Run (Poros)"
                          : "Recovery Flow (Normal)"}
                      </span>
                    </td>

                    {/* Last Session (Tanggal & Jam) */}
                    <td className="td-date">
                      <div className="date-cell">
                        <span className="date-primary">
                          {w.terakhir_diperiksa?.split(",")[0] || "Dec 19th, 2024"}
                        </span>
                        <span className="date-secondary">
                          {w.terakhir_diperiksa?.split(",")[1] || "6:30 – 7:15 am"}
                        </span>
                      </div>
                    </td>

                    {/* Status Pill Badge */}
                    <td className="td-status">
                      <span className={`status-pill ${badge.style}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Fitur 1: Indeks kesehatan per baris */}
                    <td className="td-rating">
                      <div className="indeks-bar-cell">
                        <div className="rating-top-row">
                          <span className="indeks-score-val"><strong>{indeksVal}</strong>/100</span>
                          <span className="rating-sub-star">★ {starScore}</span>
                        </div>
                        <div className="mini-indeks-track" title="Ambang: Hijau >70, Kuning 40-70, Merah <40">
                          <div
                            className={`mini-indeks-fill ${indeksVal >= 70 ? "green" : indeksVal >= 40 ? "amber" : "red"}`}
                            style={{ width: `${Math.min(100, Math.max(8, indeksVal))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Notes link with PDF icon */}
                    <td className="td-notes">
                      <button
                        type="button"
                        className="notes-link-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWesel(w.wesel_id);
                          onAnalyze(w.wesel_id);
                        }}
                        title="Buka laporan analisis agen"
                      >
                        <IconFileText className="pdf-icon" />
                        <span>Session notes.pdf</span>
                      </button>
                    </td>

                    {/* Action 3-dots */}
                    <td className="td-actions">
                      <button
                        type="button"
                        className="icon-ghost-btn row-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWesel(w.wesel_id);
                          onAnalyze(w.wesel_id);
                        }}
                        title="Opsi wesel"
                      >
                        <IconMoreVertical className="ghost-btn-icon" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Fitur 4: Prioritas hari ini (Susun dari status + tren) */}
      {activeTab === "prioritas" && (
        <div className="priority-tab-container">
          <div className="priority-tab-header">
            <div>
              <h3 className="priority-tab-title">Matriks Prioritas Pemeliharaan Wesel Hari Ini</h3>
              <p className="priority-tab-subtitle">
                Diurutkan otomatis dari wesel dengan status paling kritis, laju degradasi getaran tertinggi, dan rekomendasi agen sintelis.
              </p>
            </div>
          </div>

          <div className="priority-cards-grid">
            {prioritasWesel.map((w, idx) => {
              const isUrgent = w.status === "Bahaya" || w.status === "Waspada";
              return (
                <div
                  key={w.wesel_id}
                  className={`priority-item-card ${w.status.toLowerCase()} ${selectedId === w.wesel_id ? "active-focus" : ""}`}
                  onClick={() => onSelectWesel(w.wesel_id)}
                >
                  <div className="priority-card-top">
                    <div className="priority-rank-badge">#{idx + 1}</div>
                    <div className="priority-id-block">
                      <span className="priority-name">{w.wesel_id}</span>
                      <span className="priority-loc">{w.lokasi}</span>
                    </div>
                    <span className={`priority-tag ${w.status.toLowerCase()}`}>{w.status}</span>
                  </div>

                  <div className="priority-metrics-row">
                    <div className="metric-chip">
                      <span className="m-label">Indeks Kesehatan:</span>
                      <strong className={`m-val ${w.indeks_kesehatan < 40 ? "red" : w.indeks_kesehatan < 70 ? "amber" : "green"}`}>
                        {w.indeks_kesehatan}/100
                      </strong>
                    </div>
                    <div className="metric-chip">
                      <span className="m-label">Deteksi:</span>
                      <strong className="m-val">{w.kondisi_kandidat.replaceAll("_", " ")}</strong>
                    </div>
                    <div className="metric-chip">
                      <span className="m-label">RMS Getaran:</span>
                      <strong className="m-val">{w.ciri?.rms} m/s²</strong>
                    </div>
                  </div>

                  <div className="priority-action-row">
                    <span className="urgency-note">
                      {isUrgent ? "⚠️ Memerlukan penanganan atau inspeksi preventif segera" : "✅ Operasional dalam toleransi normal"}
                    </span>
                    <button
                      type="button"
                      className="priority-analyze-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWesel(w.wesel_id);
                        onAnalyze(w.wesel_id);
                      }}
                    >
                      <span>Analisis Agen ↗</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Fitur 5: Antrean persetujuan (kelas, ringkasan, langkah, rujukan, diputuskan_oleh) */}
      {activeTab === "workorders" && (
        <div className="work-orders-container">
          {!pendingWOs.length ? (
            <div className="empty-state-card">
              <p className="empty-title">Tidak ada work order yang menunggu persetujuan.</p>
              <p className="empty-sub">Usulan baru akan otomatis dibuat oleh agen saat mendeteksi anomali getaran.</p>
            </div>
          ) : (
            <div className="wo-list">
              {pendingWOs.map((wo) => (
                <div key={wo.id} className={`wo-card kelas-${wo.kelas || "B"}`}>
                  <div className="wo-header">
                    <div className="wo-id-group">
                      <strong className="wo-id">{wo.id} • {wo.wesel_id}</strong>
                      <span className="wo-class-badge">
                        {wo.jenis === "ESKALASI" ? "ESKALASI DARURAT" : `KELAS ${wo.kelas}`}
                      </span>
                    </div>
                    <span className="wo-time">{wo.tanggal || "Terkini"}</span>
                  </div>

                  <p className="wo-summary">{wo.ringkasan || wo.alasan}</p>

                  {/* Fitur 5: langkah & rujukan */}
                  {wo.langkah && (
                    <details className="wo-details" open>
                      <summary>Rincian Prosedur & Langkah Pemeriksaan ({wo.rujukan || "PD 10A"})</summary>
                      <div className="wo-steps-body">{wo.langkah}</div>
                    </details>
                  )}

                  <div className="wo-actions-bar">
                    <input
                      type="text"
                      className="wo-notes-input"
                      placeholder={isReadOnly ? "Akun pengamat tidak dapat mengubah keputusan" : "Catatan petugas (wajib diisi bila menolak)..."}
                      value={notes[wo.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [wo.id]: e.target.value })}
                      disabled={isReadOnly}
                    />
                    <div className="wo-btn-group">
                      <button
                        type="button"
                        className="wo-approve-btn"
                        onClick={() => handleDecision(wo.id, "setujui")}
                        disabled={isReadOnly}
                        title={isReadOnly ? "Akun pengamat hanya memiliki akses baca" : ""}
                      >
                        Setujui Work Order
                      </button>
                      <button
                        type="button"
                        className="wo-reject-btn"
                        disabled={isReadOnly || !(notes[wo.id] || "").trim()}
                        onClick={() => handleDecision(wo.id, "tolak")}
                        title={isReadOnly ? "Akun pengamat hanya memiliki akses baca" : !(notes[wo.id] || "").trim() ? "Isi catatan terlebih dahulu untuk menolak" : ""}
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fitur 5: Menampilkan diputuskan_oleh pada work order yang sudah diputuskan */}
          {decidedWOs.length > 0 && (
            <div className="decided-section">
              <h4 className="decided-title">Baru Saja Diputuskan</h4>
              <div className="decided-cards-list">
                {decidedWOs.map((wo) => (
                  <div key={wo.id} className="decided-wo-row">
                    <div className="decided-left">
                      <strong className="decided-id">{wo.id} ({wo.wesel_id}):</strong>
                      <span className={`decided-status ${wo.status.toLowerCase()}`}>
                        {wo.status.replaceAll("_", " ")}
                      </span>
                      {wo.diputuskan_oleh && (
                        <span className="decided-by-tag">
                          oleh: <strong>{wo.diputuskan_oleh}</strong>
                        </span>
                      )}
                    </div>
                    {wo.catatan_petugas && (
                      <span className="decided-note-snippet">"{wo.catatan_petugas}"</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: History of selected switch */}
      {activeTab === "riwayat" && (
        <div className="switch-history-container">
          {!riwayat.length ? (
            <div className="empty-state-card">
              <p className="empty-title">Belum ada riwayat tercatat untuk {selectedId}.</p>
            </div>
          ) : (
            <div className="history-timeline">
              {riwayat.map((r, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-date">{r.tanggal}</span>
                      <span className="timeline-badge">Kelas {r.kelas}</span>
                      <span className="timeline-decision">{r.keputusan_petugas}</span>
                    </div>
                    <div className="timeline-condition">
                      Kondisi: <strong>{r.kondisi}</strong>
                    </div>
                    {r.catatan && <p className="timeline-notes">"{r.catatan}"</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
