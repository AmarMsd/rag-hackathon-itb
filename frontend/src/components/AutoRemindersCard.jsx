import React, { useState } from "react";
import {
  IconVolume2,
  IconArrowUpRight,
  IconSparkles,
} from "../Icons.jsx";
import { api } from "../api.js";

export default function AutoRemindersCard({
  weselList = [],
  onOpenChat,
  onAnalyze,
  onSelectWesel,
  isAgentActive = true,
  pendingCount = 0,
}) {
  const [isAskingPriority, setIsAskingPriority] = useState(false);
  const [aiPriorityAnswer, setAiPriorityAnswer] = useState(null);

  // Fitur 4: Menyusun prioritas hari ini dari status + indeks kesehatan
  const sortedPriority = [...weselList].sort((a, b) => {
    // Bahaya first, Waspada second, Normal last
    const weight = { Bahaya: 3, Waspada: 2, Normal: 1, "Tidak dikenal": 2 };
    const diff = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (diff !== 0) return diff;
    return (a.indeks_kesehatan || 0) - (b.indeks_kesehatan || 0);
  });

  const topPriority = sortedPriority[0] || null;

  // Fitur 4: POST /api/chat dengan pesan "Wesel mana yang harus segera diperbaiki?"
  const askAiPriority = async () => {
    if (!isAgentActive || isAskingPriority) return;
    setIsAskingPriority(true);
    try {
      const res = await api.chat("Wesel mana yang harus segera diperbaiki?");
      setAiPriorityAnswer(res.jawaban);
    } catch (err) {
      setAiPriorityAnswer("Gagal memuat rekomendasi prioritas: " + (err.message || "Koneksi gateway bermasalah"));
    } finally {
      setIsAskingPriority(false);
    }
  };

  return (
    <div className="card auto-reminders-card priority-suggesting-card">
      {/* Top Badge & External Link */}
      <div className="reminders-top-row">
        <div className="reminders-badge-pill" title="Fitur Prioritas Hari Ini & Prescriptive Suggestion">
          <span>Prioritas Hari Ini</span>
          <IconVolume2 className="reminders-speaker-icon" />
        </div>

        <button
          type="button"
          className="reminders-external-btn"
          onClick={() => {
            onSelectWesel && topPriority && onSelectWesel(topPriority.wesel_id);
            onOpenChat && onOpenChat();
          }}
          title="Buka obrolan prioritas dengan agen"
          aria-label="Buka obrolan prioritas dengan agen"
        >
          <IconArrowUpRight className="external-link-icon" />
        </button>
      </div>

      {/* Main Priority Suggesting Section */}
      <div className="reminders-content">
        {topPriority ? (
          <div className="priority-focus-box">
            <div className="priority-header-tag">
              <span className={`priority-status-pill ${topPriority.status.toLowerCase()}`}>
                {topPriority.status.toUpperCase()}
              </span>
              <span className="priority-id-label">{topPriority.wesel_id}</span>
              <span className="priority-score-label">Indeks: {topPriority.indeks_kesehatan}/100</span>
            </div>

            <h3 className="reminders-heading">
              {topPriority.status === "Bahaya"
                ? `Perhatian: ${topPriority.wesel_id} Butuh Penanganan Segera!`
                : `Jadwal Pantauan: ${topPriority.wesel_id}`}
            </h3>

            <p className="reminders-description">
              {topPriority.kondisi_kandidat === "poros_tidak_sejajar"
                ? "Poros penggerak tidak sejajar. Beban getaran RMS tinggi dan durasi pembalikan melambat kritis."
                : topPriority.kondisi_kandidat === "bantalan_aus"
                ? "Keausan bantalan gesek terdeteksi meningkat dalam evaluasi mingguan. Disarankan pelumasan & inspeksi celah."
                : "Seluruh wesel beroperasi dalam batas toleransi normal. Lanjutkan inspeksi visual berkala."}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="reminders-heading">Pencegahan Dini Gangguan Wesel</h3>
            <p className="reminders-description">
              Dapatkan rekomendasi preskriptif dan urutan prioritas wesel sebelum terjadi gangguan operasi.
            </p>
          </div>
        )}

        {/* AI Prescriptive Inline Answer (if triggered) */}
        {aiPriorityAnswer && (
          <div className="ai-priority-response-box">
            <div className="response-title">Rekomendasi Agen AI:</div>
            <div className="response-text">{aiPriorityAnswer}</div>
          </div>
        )}
      </div>

      {/* Action Buttons inside Card */}
      <div className="reminders-actions">
        <div className="action-buttons-group">
          {/* Button: Fitur 4 POST /api/chat */}
          <button
            type="button"
            className="reminders-primary-action"
            onClick={askAiPriority}
            disabled={!isAgentActive || isAskingPriority}
            title='Kirim pesan "Wesel mana yang harus segera diperbaiki?" ke agen'
          >
            <IconSparkles className="action-btn-icon" />
            <span>{isAskingPriority ? "Menghitung prioritas…" : "Tanya Prioritas Agen"}</span>
          </button>

          {topPriority && (
            <button
              type="button"
              className="reminders-secondary-action"
              onClick={() => {
                onSelectWesel(topPriority.wesel_id);
                onAnalyze(topPriority.wesel_id);
              }}
              title="Jalankan analisis mendalam untuk wesel prioritas utama"
            >
              <span>Analisis {topPriority.wesel_id} ↗</span>
            </button>
          )}
        </div>

        {pendingCount > 0 ? (
          <div className="reminders-alert-pill">
            <span className="alert-pulse" />
            <span>{pendingCount} WO Menunggu</span>
          </div>
        ) : (
          <div className="agent-status-tag">
            <span className={`status-dot ${isAgentActive ? "active" : "offline"}`} />
            <span>{isAgentActive ? "Monitoring Aktif" : "Agen Nonaktif"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
