import React, { useState } from "react";
import {
  IconVolume2,
  IconSparkles,
  IconArrowUpRight,
  IconAlertTriangle,
  IconSend,
  IconX,
} from "../Icons.jsx";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";
import { api } from "../api.js";

export default function BerandaPage({
  weselList = [],
  onSelectWesel,
  onNavigate,
  isAgentActive = true,
  user,
}) {
  const [isAskingPriority, setIsAskingPriority] = useState(false);
  const [aiPriorityAnswer, setAiPriorityAnswer] = useState(null);
  const [aiSessionId, setAiSessionId] = useState(null);
  const [aiLangkah, setAiLangkah] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [isSendingInline, setIsSendingInline] = useState(false);

  // Status counts
  const counts = {
    total: weselList.length,
    normal: weselList.filter((w) => w.status === "Normal").length,
    waspada: weselList.filter((w) => w.status === "Waspada").length,
    bahaya: weselList.filter((w) => w.status === "Bahaya").length,
    tidakDikenal: weselList.filter(
      (w) => w.status !== "Normal" && w.status !== "Waspada" && w.status !== "Bahaya"
    ).length,
  };

  // Prioritas urutan: Bahaya -> Tidak dikenal -> Waspada -> Waspada tren -> Normal
  const sortedPriority = [...weselList].sort((a, b) => {
    const weight = { Bahaya: 4, "Tidak dikenal": 3, Waspada: 2, Normal: 1 };
    const diff = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (diff !== 0) return diff;
    return (a.indeks_kesehatan || 0) - (b.indeks_kesehatan || 0);
  });

  const topPriority = sortedPriority[0] || null;

  const askAiPriority = async () => {
    if (!isAgentActive || isAskingPriority) return;
    setIsAskingPriority(true);
    try {
      const res = await api.chat("Wesel mana yang harus segera diperbaiki?");
      setAiPriorityAnswer(res.jawaban);
      setAiSessionId(res.session_id);
      setAiLangkah(res.langkah || []);
      setConversationHistory([
        { dari: "petugas", teks: "Wesel mana yang harus segera diperbaiki?" },
        { dari: "agen", teks: res.jawaban, langkah: res.langkah },
      ]);
    } catch (err) {
      setAiPriorityAnswer("Gagal memuat rekomendasi prioritas: " + (err.message || "Koneksi gateway bermasalah"));
    } finally {
      setIsAskingPriority(false);
    }
  };

  const handleSendInlineReply = async (e) => {
    if (e) e.preventDefault();
    const text = inlineReplyText.trim();
    if (!text || isSendingInline || !isAgentActive) return;

    setIsSendingInline(true);
    setInlineReplyText("");
    try {
      const res = await api.chat(text, aiSessionId);
      setAiPriorityAnswer(res.jawaban);
      if (res.session_id) setAiSessionId(res.session_id);
      if (res.langkah) setAiLangkah(res.langkah);

      setConversationHistory((prev) => [
        ...prev,
        { dari: "petugas", teks: text },
        { dari: "agen", teks: res.jawaban, langkah: res.langkah },
      ]);
    } catch (err) {
      setAiPriorityAnswer((prev) => `${prev}\n\n⚠️ Gagal mengirim balasan: ${err.message}`);
    } finally {
      setIsSendingInline(false);
    }
  };

  const handleDetailedFollowUp = () => {
    const target = topPriority?.wesel_id || "WESEL-03B";
    if (onSelectWesel) onSelectWesel(target);
    onNavigate("chat", {
      sessionId: aiSessionId,
      prompt: `Ya, tolong analisis wesel ${target} secara lebih rinci.`,
      history: conversationHistory,
    });
  };

  const handleSopFollowUp = () => {
    const target = topPriority?.wesel_id || "WESEL-03B";
    onNavigate("chat", {
      sessionId: aiSessionId,
      prompt: `Bagaimana SOP dan langkah perbaikan sesuai regulasi PD 10A untuk ${target}?`,
      history: conversationHistory,
    });
  };

  return (
    <div className="page-view beranda-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Pemantauan Kondisi Wesel</h1>
          <p className="page-desc">
            Ikhtisar kesehatan operasional wesel stasiun, deteksi anomali real-time, dan rekomendasi preskriptif.
          </p>
        </div>
      </div>

      {/* Ringkasan Status Grid */}
      <div className="summary-status-grid">
        <div className="summary-card total">
          <span className="summary-label">Total Dipantau</span>
          <span className="summary-value">{counts.total}</span>
          <span className="summary-hint">Wesel aktif di stasiun</span>
        </div>
        <div className="summary-card bahaya">
          <span className="summary-label">Bahaya</span>
          <span className="summary-value">{counts.bahaya}</span>
          <span className="summary-hint">Perlu tindakan darurat segera</span>
        </div>
        <div className="summary-card waspada">
          <span className="summary-label">Waspada</span>
          <span className="summary-value">{counts.waspada}</span>
          <span className="summary-hint">Tren degradasi / observasi</span>
        </div>
        <div className="summary-card normal">
          <span className="summary-label">Normal</span>
          <span className="summary-value">{counts.normal}</span>
          <span className="summary-hint">Kondisi operasi prima</span>
        </div>
      </div>

      {/* Main Grid: Tabel Wesel + Panel Prioritas */}
      <div className="beranda-content-grid">
        {/* Kolom Kiri: Tabel Wesel */}
        <div className="card beranda-table-card">
          <div className="card-header-bar">
            <div>
              <h2 className="card-heading">Daftar Wesel Terpantau</h2>
              <p className="card-subheading">Pembaruan otomatis tiap 5 detik dari sensor akselerometer.</p>
            </div>
            <span className="table-row-count-tag">{weselList.length} Wesel</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="custom-table wesel-table">
              <thead>
                <tr>
                  <th>Wesel</th>
                  <th>Status</th>
                  <th>Indeks Kesehatan</th>
                  <th>Kandidat Kondisi</th>
                  <th>Siklus Terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {weselList.map((w) => {
                  const statusClass = (w.status || "normal").toLowerCase().replace(/\s+/g, "-");
                  const isSilent = (w.menit_sejak_siklus_terakhir || 0) > 120;
                  const score = w.indeks_kesehatan || 0;

                  return (
                    <tr
                      key={w.wesel_id}
                      className="clickable-row"
                      onClick={() => {
                        onSelectWesel(w.wesel_id);
                        onNavigate("detail", { weselId: w.wesel_id });
                      }}
                      title="Klik untuk melihat detail & tren wesel ini"
                    >
                      <td>
                        <div className="wesel-id-group">
                          <strong className="wesel-id-text">{w.wesel_id}</strong>
                          <span className="wesel-location-text">{w.lokasi || "Jalur Stasiun"}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`status-pill ${statusClass}`}>
                          {w.status}
                        </span>
                      </td>

                      <td>
                        <div className="health-bar-container">
                          <div className="health-score-header">
                            <span className="health-score-number">{score}/100</span>
                          </div>
                          {/* Progress bar with threshold markers at 40 and 70 */}
                          <div className="health-track">
                            <div
                              className={`health-fill ${
                                score <= 40 ? "danger" : score <= 70 ? "warning" : "good"
                              }`}
                              style={{ width: `${Math.min(Math.max(score, 5), 100)}%` }}
                            />
                            {/* Marker batas 40 (Bahaya) */}
                            <span
                              className="threshold-marker m-40"
                              title="Batas Kritis Bahaya (40)"
                            />
                            {/* Marker batas 70 (Waspada) */}
                            <span
                              className="threshold-marker m-70"
                              title="Batas Waspada (70)"
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="condition-label">
                          {w.kondisi_kandidat === "poros_tidak_sejajar"
                            ? "Poros Tidak Sejajar"
                            : w.kondisi_kandidat === "bantalan_aus"
                            ? "Bantalan Aus"
                            : "Normal (Prima)"}
                        </span>
                      </td>

                      <td>
                        <div className="cycle-time-cell">
                          <span>{w.terakhir_diperiksa || "Hari ini"}</span>
                          {isSilent && (
                            <span
                              className="sensor-silent-pill"
                              title={`Sensor tidak mengirim siklus selama ${w.menit_sejak_siklus_terakhir} menit (>120m)`}
                            >
                              <IconAlertTriangle className="icon-mini-warn" />
                              Sensor Senyap ({w.menit_sejak_siklus_terakhir}m)
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWesel(w.wesel_id);
                            onNavigate("detail", { weselId: w.wesel_id });
                          }}
                        >
                          Detail ↗
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan: Panel Prioritas Hari Ini & Prescriptive AI */}
        <div className="card beranda-priority-card">
          <div className="priority-card-top">
            <div className="priority-pill-badge">
              <IconVolume2 className="priority-speaker-icon" />
              <span>Prioritas Hari Ini</span>
            </div>
            {topPriority && (
              <button
                type="button"
                className="priority-external-link-btn"
                onClick={() => {
                  onSelectWesel(topPriority.wesel_id);
                  onNavigate("detail", { weselId: topPriority.wesel_id });
                }}
                title={`Buka detail wesel ${topPriority.wesel_id}`}
              >
                <IconArrowUpRight className="icon-tiny" />
              </button>
            )}
          </div>

          {topPriority ? (
            <div className="priority-switch-focus">
              <div className="priority-tag-row">
                <span className={`status-pill ${topPriority.status.toLowerCase()}`}>
                  {topPriority.status.toUpperCase()}
                </span>
                <span className="priority-target-name">{topPriority.wesel_id}</span>
                <span className="priority-score-tag">Skor: {topPriority.indeks_kesehatan}/100</span>
              </div>

              <h3 className="priority-title">
                {topPriority.status === "Bahaya"
                  ? `Perhatian: ${topPriority.wesel_id} Butuh Penanganan Segera!`
                  : `Pantau Terjadwal: ${topPriority.wesel_id}`}
              </h3>

              <p className="priority-explanation">
                {topPriority.kondisi_kandidat === "poros_tidak_sejajar"
                  ? "Poros penggerak tidak sejajar. Beban getaran RMS tinggi dan durasi pembalikan melambat kritis."
                  : topPriority.kondisi_kandidat === "bantalan_aus"
                  ? "Keausan bantalan gesek terdeteksi meningkat dalam evaluasi mingguan. Disarankan pelumasan & inspeksi celah."
                  : "Seluruh wesel beroperasi dalam batas toleransi normal. Lanjutkan inspeksi visual berkala."}
              </p>
            </div>
          ) : (
            <div className="priority-empty-state">
              <h3>Pencegahan Dini Gangguan Wesel</h3>
              <p>Dapatkan rekomendasi preskriptif dan urutan prioritas wesel sebelum terjadi gangguan operasi.</p>
            </div>
          )}

          {/* AI Response Box (if triggered) */}
          {aiPriorityAnswer && (
            <div className="ai-priority-response-box">
              <div className="response-header-row">
                <div className="response-title-left">
                  <IconSparkles className="sparkle-tiny" />
                  <span className="response-title">Rekomendasi Agen AI</span>
                  {aiSessionId && (
                    <span className="response-session-pill">Sesi Terhubung</span>
                  )}
                </div>
                <button
                  type="button"
                  className="response-clear-btn"
                  onClick={() => {
                    setAiPriorityAnswer(null);
                    setAiSessionId(null);
                    setAiLangkah([]);
                  }}
                  title="Tutup jawaban ini"
                >
                  <IconX className="close-mini-icon" />
                  <span>Tutup</span>
                </button>
              </div>

              <div className="response-text">
                <Teks isi={aiPriorityAnswer} />
              </div>

              {aiLangkah && aiLangkah.length > 0 && (
                <div className="response-reasoning-wrap">
                  <LogAgen langkah={aiLangkah} />
                </div>
              )}

              {/* Action chips to seamlessly continue */}
              <div className="priority-followup-toolbar">
                <span className="toolbar-label">Lanjutkan:</span>

                <button
                  type="button"
                  className="priority-action-chip primary"
                  onClick={handleDetailedFollowUp}
                  disabled={!isAgentActive || user?.peran === "pengamat" || user?.peran === "pengelola"}
                  title="Buka halaman chat dan lanjutkan analisis mendalam"
                >
                  <span>⚡ Ya, Analisis {topPriority?.wesel_id} Lebih Rinci</span>
                </button>

                <button
                  type="button"
                  className="priority-action-chip secondary"
                  onClick={handleSopFollowUp}
                  disabled={!isAgentActive || user?.peran === "pengamat" || user?.peran === "pengelola"}
                  title="Tanyakan SOP langkah perbaikan sesuai PD 10A"
                >
                  <span>📋 SOP Perbaikan</span>
                </button>

                <button
                  type="button"
                  className="priority-action-chip chat-link"
                  onClick={() => {
                    onNavigate("chat", {
                      sessionId: aiSessionId,
                      history: conversationHistory,
                    });
                  }}
                  title="Buka percakapan lengkap di halaman Tanya Agen"
                >
                  <span>💬 Buka di Halaman Chat ({conversationHistory.length} pesan)</span>
                </button>
              </div>

              {/* Inline quick reply */}
              <form className="priority-inline-chat-form" onSubmit={handleSendInlineReply}>
                <input
                  type="text"
                  className="priority-inline-chat-input"
                  placeholder="Ketik balasan untuk agen..."
                  value={inlineReplyText}
                  onChange={(e) => setInlineReplyText(e.target.value)}
                  disabled={!isAgentActive || isSendingInline || user?.peran === "pengamat"}
                />
                <button
                  type="submit"
                  className="priority-inline-chat-send-btn"
                  disabled={!inlineReplyText.trim() || isSendingInline || !isAgentActive || user?.peran === "pengamat"}
                  title="Kirim tanggapan"
                >
                  {isSendingInline ? "..." : <IconSend className="send-icon-mini" />}
                </button>
              </form>
            </div>
          )}

          {/* Action buttons */}
          <div className="priority-bottom-actions">
            <button
              type="button"
              className="btn-primary-action"
              onClick={askAiPriority}
              disabled={!isAgentActive || isAskingPriority || user?.peran === "pengamat"}
              title='Kirim pesan "Wesel mana yang harus segera diperbaiki?" ke agen'
            >
              <IconSparkles className="btn-icon-left" />
              <span>{isAskingPriority ? "Menghitung Prioritas…" : "Tanya Prioritas Agen"}</span>
            </button>

            {topPriority && (
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => {
                  onSelectWesel(topPriority.wesel_id);
                  onNavigate("detail", { weselId: topPriority.wesel_id });
                }}
                title="Buka halaman Detail Wesel untuk analisis sinyal"
              >
                <span>Detail {topPriority.wesel_id} ↗</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}