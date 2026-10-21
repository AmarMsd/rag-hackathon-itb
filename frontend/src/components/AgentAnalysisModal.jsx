import React, { useEffect, useState } from "react";
import { IconX, IconSparkles } from "../Icons.jsx";
import LogAgen from "../LogAgen.jsx";
import Teks from "../Teks.jsx";
import { api } from "../api.js";

const LABEL_KONDISI = {
  normal: "Normal (Prima)",
  bantalan_aus: "Bantalan Aus",
  poros_tidak_sejajar: "Poros Tidak Sejajar",
};

export default function AgentAnalysisModal({
  isOpen,
  onClose,
  wesel,
  isAgentActive = true,
  onAnalysisDone,
}) {
  const [hasil, setHasil] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [riwayat, setRiwayat] = useState([]);

  useEffect(() => {
    if (!wesel || !isOpen) return;
    setHasil(null);
    setError("");
    api.riwayat(wesel.wesel_id).then(setRiwayat).catch(() => setRiwayat([]));
    // Auto-run analysis when opened if not yet done
    runAnalysis();
  }, [wesel?.wesel_id, isOpen]);

  const runAnalysis = async () => {
    if (!wesel || !isAgentActive) return;
    setIsBusy(true);
    setError("");
    try {
      const res = await api.analisis(wesel.wesel_id);
      setHasil(res);
      if (onAnalysisDone) onAnalysisDone();
    } catch (err) {
      setError(err.message || "Gagal menjalankan analisis agen.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen || !wesel) return null;

  const kondisiLabel = LABEL_KONDISI[wesel.kondisi_kandidat] || wesel.kondisi_kandidat || "Normal";
  const matchPct = Math.round((wesel.skor_kecocokan || 0.9) * 100);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Analisis ${wesel.wesel_id}`}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <span className={`modal-status-dot ${wesel.status.toLowerCase()}`} />
            <div>
              <h2 className="modal-title">Analisis Agen: {wesel.wesel_id}</h2>
              <p className="modal-subtitle">
                Deteksi: <strong>{kondisiLabel}</strong> • Kecocokan {matchPct}% • Indeks Kesehatan {wesel.indeks_kesehatan}/100
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

        {/* Telemetry Metrics Grid */}
        <div className="telemetry-grid">
          <div className="telemetry-item">
            <span className="telemetry-label">Getaran RMS</span>
            <span className="telemetry-val">{wesel.ciri?.rms ?? 3.42} m/s²</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Kurtosis</span>
            <span className="telemetry-val">{wesel.ciri?.kurtosis ?? 4.12}</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Puncak Frekuensi</span>
            <span className="telemetry-val">{wesel.ciri?.puncak_frekuensi_hz ?? 142.5} Hz</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Durasi Siklus</span>
            <span className="telemetry-val">{wesel.ciri?.durasi_siklus_s ?? 4.8} s</span>
          </div>
        </div>

        {/* Re-analyze Button */}
        <div className="modal-action-row">
          <button
            type="button"
            className="modal-analyze-btn"
            onClick={runAnalysis}
            disabled={isBusy || !isAgentActive}
          >
            <IconSparkles className="btn-sparkle-icon" />
            <span>{isBusy ? "Agen sedang menganalisis…" : "Jalankan Analisis Ulang"}</span>
          </button>
          {!isAgentActive && (
            <span className="modal-agent-warning">
              Agen sedang nonaktif. Aktifkan saklar agen untuk menganalisis.
            </span>
          )}
        </div>

        {error && <div className="modal-error-box">{error}</div>}

        {/* Analysis Results */}
        <div className="modal-body-scroll">
          {isBusy && (
            <div className="modal-loading-state">
              <div className="loading-spinner" />
              <p>Membaca sensor getaran dan mengevaluasi standar PD 10A...</p>
            </div>
          )}

          {hasil && !isBusy && (
            <div className="modal-results-section">
              <h3 className="section-heading">Langkah Penalaran Agen</h3>
              <div className="reasoning-box">
                <LogAgen langkah={hasil.langkah || []} />
              </div>

              <h3 className="section-heading">Kesimpulan & Rekomendasi Preskriptif</h3>
              <div className="conclusion-box">
                <Teks isi={hasil.jawaban || "Agen tidak memberikan rincian."} />
              </div>
            </div>
          )}

          {/* History */}
          {!hasil && !isBusy && (
            <div className="modal-history-section">
              <h3 className="section-heading">Riwayat Kejadian Wesel Ini</h3>
              {riwayat.length ? (
                <ul className="modal-history-list">
                  {riwayat.map((r, i) => (
                    <li key={i} className="modal-history-item">
                      <span className="history-date">{r.tanggal}</span>
                      <span className="history-desc">
                        {r.kondisi}, Kelas {r.kelas}, Keputusan: {r.keputusan_petugas}
                        {r.catatan ? ` (${r.catatan})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-history-sub">Belum ada riwayat tercatat untuk wesel ini.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
