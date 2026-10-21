import React, { useState } from "react";
import {
  IconVolume2,
  IconArrowUpRight,
  IconSparkles,
  IconSend,
  IconX,
} from "../Icons.jsx";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";
import { api } from "../api.js";

function extractTargetWesel(text, list = [], top = null) {
  if (text) {
    for (const item of list) {
      if (item.wesel_id && text.toLowerCase().includes(item.wesel_id.toLowerCase())) {
        return item.wesel_id;
      }
    }
    // Check for patterns like W-12, W12, WESEL-03B, etc.
    const match = text.match(/\b([Ww](?:esel)?[-_]?[0-9]+[A-Za-z]?)\b/);
    if (match) return match[1].toUpperCase();
  }
  return top ? top.wesel_id : null;
}

export default function AutoRemindersCard({
  weselList = [],
  onOpenChat,
  onOpenChatWithSession,
  onAnalyze,
  onSelectWesel,
  isAgentActive = true,
  pendingCount = 0,
}) {
  const [isAskingPriority, setIsAskingPriority] = useState(false);
  const [aiPriorityAnswer, setAiPriorityAnswer] = useState(null);
  const [aiSessionId, setAiSessionId] = useState(null);
  const [aiLangkah, setAiLangkah] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [isSendingInline, setIsSendingInline] = useState(false);

  // Fitur 4: Menyusun prioritas hari ini dari status + indeks kesehatan
  const sortedPriority = [...weselList].sort((a, b) => {
    // Bahaya first, Waspada second, Normal last
    const weight = { Bahaya: 3, Waspada: 2, Normal: 1, "Tidak dikenal": 2 };
    const diff = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (diff !== 0) return diff;
    return (a.indeks_kesehatan || 0) - (b.indeks_kesehatan || 0);
  });

  const topPriority = sortedPriority[0] || null;
  const targetWesel = extractTargetWesel(aiPriorityAnswer, weselList, topPriority);

  // Fitur 4: POST /api/chat dengan pesan "Wesel mana yang harus segera diperbaiki?"
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

  // Follow-up: Lanjut analisis lebih rinci
  const handleDetailedFollowUp = () => {
    const prompt = targetWesel
      ? `Ya, tolong analisis wesel ${targetWesel} secara lebih rinci.`
      : "Ya, tolong berikan analisis lebih rinci mengenai prioritas wesel ini.";

    if (targetWesel && onSelectWesel) {
      onSelectWesel(targetWesel);
    }

    if (onOpenChatWithSession) {
      onOpenChatWithSession({
        prompt,
        sessionId: aiSessionId,
        history: conversationHistory,
        autoSend: true,
      });
    } else if (onOpenChat) {
      onOpenChat();
    }
  };

  // Follow-up: SOP & Regulasi
  const handleSopFollowUp = () => {
    const prompt = `Bagaimana SOP dan langkah perbaikan sesuai regulasi PD 10A untuk ${targetWesel || "wesel ini"}?`;

    if (onOpenChatWithSession) {
      onOpenChatWithSession({
        prompt,
        sessionId: aiSessionId,
        history: conversationHistory,
        autoSend: true,
      });
    } else if (onOpenChat) {
      onOpenChat();
    }
  };

  // Buka chat lengkap dengan riwayat saat ini
  const handleOpenFullChat = () => {
    if (onOpenChatWithSession) {
      onOpenChatWithSession({
        sessionId: aiSessionId,
        history: conversationHistory,
        autoSend: false,
      });
    } else if (onOpenChat) {
      onOpenChat();
    }
  };

  // Kirim balasan inline langsung dari kartu
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

  const handleCloseAnswer = () => {
    setAiPriorityAnswer(null);
    setAiSessionId(null);
    setAiLangkah([]);
    setConversationHistory([]);
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
            if (aiPriorityAnswer && onOpenChatWithSession) {
              onOpenChatWithSession({
                sessionId: aiSessionId,
                history: conversationHistory,
                autoSend: false,
              });
            } else {
              if (onSelectWesel && topPriority) onSelectWesel(topPriority.wesel_id);
              if (onOpenChat) onOpenChat();
            }
          }}
          title={aiPriorityAnswer ? "Lanjutkan percakapan ini di Chat" : "Buka obrolan dengan agen"}
          aria-label="Buka obrolan dengan agen"
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

        {/* AI Prescriptive Inline Answer & Interactive Chat Continuation */}
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
                onClick={handleCloseAnswer}
                title="Tutup jawaban ini"
              >
                <IconX className="close-mini-icon" />
                <span>Tutup</span>
              </button>
            </div>

            <div className="response-text">
              <Teks isi={aiPriorityAnswer} />
            </div>

            {/* Expandable Reasoning Steps */}
            {aiLangkah && aiLangkah.length > 0 && (
              <div className="response-reasoning-wrap">
                <LogAgen langkah={aiLangkah} />
              </div>
            )}

            {/* Follow-up Quick Action Buttons to continue chat / analysis */}
            <div className="priority-followup-toolbar">
              <span className="toolbar-label">Lanjutkan:</span>

              <button
                type="button"
                className="priority-action-chip primary"
                onClick={handleDetailedFollowUp}
                disabled={!isAgentActive}
                title={`Buka chat dan minta analisis mendalam untuk ${targetWesel || "wesel"}`}
              >
                <span>⚡ Ya, Analisis {targetWesel || "Wesel"} Lebih Rinci</span>
              </button>

              <button
                type="button"
                className="priority-action-chip secondary"
                onClick={handleSopFollowUp}
                disabled={!isAgentActive}
                title="Tanyakan SOP langkah perbaikan & regulasi PD 10A"
              >
                <span>📋 SOP Perbaikan</span>
              </button>

              <button
                type="button"
                className="priority-action-chip chat-link"
                onClick={handleOpenFullChat}
                title="Buka percakapan ini secara lengkap di panel chat"
              >
                <span>💬 Lanjutkan di Chat ({conversationHistory.length} pesan)</span>
              </button>

              {targetWesel && (
                <button
                  type="button"
                  className="priority-action-chip telemetry"
                  onClick={() => {
                    if (onSelectWesel) onSelectWesel(targetWesel);
                    if (onAnalyze) onAnalyze(targetWesel);
                  }}
                  title={`Buka modal telemetri dan analisis sensor untuk ${targetWesel}`}
                >
                  <span>🔬 Buka Telemetri {targetWesel} ↗</span>
                </button>
              )}
            </div>

            {/* Inline Quick Reply Input Form */}
            <form className="priority-inline-chat-form" onSubmit={handleSendInlineReply}>
              <input
                type="text"
                className="priority-inline-chat-input"
                placeholder={
                  isAgentActive
                    ? `Ketik balasan (misal: "Ya, analisis ${targetWesel || 'wesel ini'}")`
                    : "Agen sedang dinonaktifkan"
                }
                value={inlineReplyText}
                onChange={(e) => setInlineReplyText(e.target.value)}
                disabled={!isAgentActive || isSendingInline}
              />
              <button
                type="submit"
                className="priority-inline-chat-send-btn"
                disabled={!inlineReplyText.trim() || isSendingInline || !isAgentActive}
                title="Kirim balasan langsung ke agen"
              >
                {isSendingInline ? (
                  <span>Mengirim…</span>
                ) : (
                  <>
                    <span>Kirim</span>
                    <IconSend className="send-icon-mini" />
                  </>
                )}
              </button>
            </form>
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
