import React, { useState } from "react";
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconUsers,
} from "../Icons.jsx";
import { api } from "../api.js";

export default function WorkOrdersPage({
  workOrders = [],
  onRefresh,
  user,
}) {
  const [activeTab, setActiveTab] = useState("menunggu"); // 'menunggu' | 'diputuskan'
  const [actingWoId, setActingWoId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'setujui' | 'tolak'
  const [noteText, setNoteText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReadOnly = user?.peran === "pengamat" || user?.peran === "pengelola";

  const pendingWos = workOrders.filter((wo) => wo.status?.startsWith("MENUNGGU"));
  const decidedWos = workOrders.filter((wo) => !wo.status?.startsWith("MENUNGGU"));

  const openDecisionModal = (woId, type) => {
    setActingWoId(woId);
    setActionType(type);
    setNoteText("");
    setErrorMsg("");
  };

  const closeDecisionModal = () => {
    setActingWoId(null);
    setActionType(null);
    setNoteText("");
    setErrorMsg("");
  };

  const handleSubmitDecision = async () => {
    if (actionType === "tolak" && !noteText.trim()) {
      setErrorMsg("Catatan wajib diisi saat menolak usulan work order.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.putuskan(actingWoId, actionType, noteText.trim());
      closeDecisionModal();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || "Gagal menyimpan keputusan work order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedList = activeTab === "menunggu" ? pendingWos : decidedWos;

  return (
    <div className="page-view workorders-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Antrean Keputusan (Work Order)</h1>
          <p className="page-desc">
            Evaluasi draf usulan pemeliharaan otomatis dari agen dan pengesahan perintah kerja teknisi.
          </p>
        </div>
      </div>

      {/* Tabs Filter: Menunggu vs Sudah Diputuskan */}
      <div className="wo-tabs-bar">
        <button
          type="button"
          className={`wo-tab-btn ${activeTab === "menunggu" ? "active" : ""}`}
          onClick={() => setActiveTab("menunggu")}
        >
          <span>Menunggu Keputusan</span>
          <span className={`tab-count-badge ${pendingWos.length > 0 ? "highlight" : ""}`}>
            {pendingWos.length}
          </span>
        </button>

        <button
          type="button"
          className={`wo-tab-btn ${activeTab === "diputuskan" ? "active" : ""}`}
          onClick={() => setActiveTab("diputuskan")}
        >
          <span>Riwayat Keputusan</span>
          <span className="tab-count-badge">{decidedWos.length}</span>
        </button>
      </div>

      {/* Cards List Grid */}
      <div className="wo-cards-grid">
        {displayedList.length > 0 ? (
          displayedList.map((wo) => {
            const isEskalasi = wo.jenis === "ESKALASI";
            const kelas = wo.kelas || "B";
            const urgencyClass = isEskalasi ? "eskalasi" : `kelas-${kelas.toLowerCase()}`;

            return (
              <div key={wo.id} className={`wo-card ${urgencyClass}`}>
                {/* Header Card */}
                <div className="wo-card-header">
                  <div className="wo-card-id-group">
                    <span className={`wo-urgency-badge ${urgencyClass}`}>
                      {isEskalasi ? "ESKALASI DARURAT" : `KELAS ${kelas}`}
                    </span>
                    <strong className="wo-id-title">{wo.id}</strong>
                    <span className="wo-target-switch">Wesel: {wo.wesel_id}</span>
                  </div>

                  <span className="wo-date-badge">
                    {wo.dibuat || wo.tanggal || "Hari ini"}
                  </span>
                </div>

                {/* Ringkasan & Alasan */}
                <div className="wo-card-body">
                  <div className="wo-summary-block">
                    <h3 className="wo-summary-text">{wo.ringkasan}</h3>
                    {wo.alasan && (
                      <p className="wo-reason-text">
                        <strong>Indikasi:</strong> {wo.alasan}
                      </p>
                    )}
                  </div>

                  {/* Langkah Pemeriksaan */}
                  {wo.langkah && (
                    <div className="wo-steps-box">
                      <span className="wo-box-label">Langkah Pemeriksaan Teknis:</span>
                      <p className="wo-box-text">{wo.langkah}</p>
                    </div>
                  )}

                  {/* Rujukan Regulasi / Manual */}
                  {wo.rujukan && (
                    <div className="wo-ref-box">
                      <span className="wo-box-label">Rujukan Regulasi:</span>
                      <span className="wo-ref-text">{wo.rujukan}</span>
                    </div>
                  )}

                  {/* Catatan Petugas (jika sudah diputuskan) */}
                  {wo.catatan_petugas && (
                    <div className="wo-decided-note-box">
                      <span className="wo-box-label">Catatan Keputusan:</span>
                      <p className="wo-note-text">"{wo.catatan_petugas}"</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions / Decision Stamp */}
                <div className="wo-card-footer">
                  {wo.status?.startsWith("MENUNGGU") ? (
                    isReadOnly ? (
                      <span className="read-only-hint">
                        Mode Pengamat / Pengelola (Hanya Melihat)
                      </span>
                    ) : (
                      <div className="wo-action-buttons">
                        <button
                          type="button"
                          className="btn-wo-approve"
                          onClick={() => openDecisionModal(wo.id, "setujui")}
                          title="Setujui dan terbitkan Work Order ini"
                        >
                          <IconCheck className="icon-tiny" />
                          <span>Setujui</span>
                        </button>
                        <button
                          type="button"
                          className="btn-wo-reject"
                          onClick={() => openDecisionModal(wo.id, "tolak")}
                          title="Tolak usulan work order (wajib catatan)"
                        >
                          <IconX className="icon-tiny" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="wo-decided-stamp">
                      <span className={`status-pill ${wo.status === "DISETUJUI" ? "normal" : "bahaya"}`}>
                        {wo.status}
                      </span>
                      <span className="decided-officer-info">
                        Oleh: <strong>{wo.diputuskan_oleh || "Petugas"}</strong>
                        {wo.diputuskan_pada && ` • ${wo.diputuskan_pada.slice(0, 16)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card wo-empty-state">
            <IconUsers className="empty-icon" />
            <h3>Tidak Ada Work Order</h3>
            <p>
              {activeTab === "menunggu"
                ? "Seluruh usulan work order telah diputuskan atau belum ada anomali baru."
                : "Belum ada riwayat keputusan work order tercatat."}
            </p>
          </div>
        )}
      </div>

      {/* Decision Confirmation Modal */}
      {actingWoId && (
        <div className="modal-backdrop" onClick={closeDecisionModal}>
          <div
            className="modal-card modal-decision-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Keputusan Work Order"
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {actionType === "setujui" ? "Setujui Work Order" : "Tolak Usulan Work Order"}: {actingWoId}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeDecisionModal}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc-text">
                {actionType === "setujui"
                  ? "Persetujuan akan menerbitkan SPK pemeliharaan untuk regu teknisi lapangan."
                  : "Menolak usulan agen memerlukan catatan alasan teknis yang jelas."}
              </p>

              {errorMsg && (
                <div className="modal-error-alert">
                  <IconAlertTriangle className="icon-tiny" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="catatan-keputusan">
                  Catatan Petugas {actionType === "tolak" && <span className="req-star">* (Wajib diisi)</span>}:
                </label>
                <textarea
                  id="catatan-keputusan"
                  className="field-textarea"
                  rows="3"
                  placeholder={
                    actionType === "tolak"
                      ? "Contoh: Sinyal anomali akibat getaran getar rel lintas kereta luar biasa, wesel telah diperiksa visual aman."
                      : "Contoh: Prioritaskan penggantian pelat sebelum jam 05:00 WIB (Opsional)."
                  }
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={closeDecisionModal}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="button"
                className={actionType === "setujui" ? "btn-primary-action" : "btn-danger-action"}
                onClick={handleSubmitDecision}
                disabled={isSubmitting || (actionType === "tolak" && !noteText.trim())}
              >
                {isSubmitting
                  ? "Menyimpan…"
                  : actionType === "setujui"
                  ? "Konfirmasi Setujui"
                  : "Konfirmasi Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}