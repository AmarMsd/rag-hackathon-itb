import React, { useEffect, useRef, useState } from "react";
import { IconX, IconSend, IconSparkles } from "../Icons.jsx";
import LogAgen from "../LogAgen.jsx";
import Teks from "../Teks.jsx";
import { api } from "../api.js";

const DEFAULT_GREETING = [
  {
    dari: "agen",
    teks: "Halo! Saya Tesi Asisten Sintelis. Tanyakan kondisi wesel, interpretasi getaran sensor, atau ketentuan regulasi PD 10A.",
  },
];

export default function AgentChatDrawer({
  isOpen,
  onClose,
  isAgentActive = true,
  onActivityComplete,
  messages: externalMessages,
  setMessages: externalSetMessages,
  sessionId: externalSessionId,
  setSessionId: externalSetSessionId,
  pendingPrompt,
  onClearPendingPrompt,
}) {
  const [internalMessages, setInternalMessages] = useState(DEFAULT_GREETING);
  const [internalSessionId, setInternalSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const messagesEndRef = useRef(null);

  const messages = externalMessages ?? internalMessages;
  const setMessages = externalSetMessages ?? setInternalMessages;
  const sessionId = externalSessionId ?? internalSessionId;
  const setSessionId = externalSetSessionId ?? setInternalSessionId;

  // Auto-scroll to bottom of chat when new messages or busy state appears
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isBusy, isOpen]);

  const quickPrompts = [
    "Berapa batas waktu pembalikan lidah wesel?",
    "Bagaimana prosedur darurat bila wesel berstatus Bahaya?",
    "Jelaskan arti kenaikan nilai Kurtosis dan RMS getaran",
    "Wesel mana yang harus segera diperbaiki?",
  ];

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isBusy) return;

    setInput("");
    setIsBusy(true);
    setMessages((prev) => [...prev, { dari: "petugas", teks: text }]);

    try {
      const res = await api.chat(text, sessionId);
      if (res.session_id) setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          dari: "agen",
          teks: res.jawaban,
          langkah: res.langkah,
        },
      ]);
      if (onActivityComplete) onActivityComplete();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { dari: "galat", teks: err.message || "Gagal menghubungi agen." },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  // Auto-send pending prompt queued from AutoRemindersCard or other components
  useEffect(() => {
    if (isOpen && pendingPrompt) {
      const promptToRun = pendingPrompt;
      if (onClearPendingPrompt) onClearPendingPrompt();
      handleSend(promptToRun);
    }
  }, [isOpen, pendingPrompt]);

  const handleResetChat = () => {
    setMessages(DEFAULT_GREETING);
    setSessionId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tanya Agen AI Sintelis"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-avatar-badge">
              <IconSparkles className="drawer-avatar-icon" />
            </div>
            <div>
              <div className="drawer-title-row">
                <h3 className="drawer-title">Tesi Asisten</h3>
                {sessionId && (
                  <span className="drawer-session-tag" title={`ID Sesi: ${sessionId}`}>
                    Sesi Aktif
                  </span>
                )}
              </div>
              <p className="drawer-subtitle">
                {isAgentActive ? "Siaga • Berbasis PD 10A & Manual KAI" : "Agen dinonaktifkan"}
              </p>
            </div>
          </div>

          <div className="drawer-header-actions">
            {messages.length > 1 && (
              <button
                type="button"
                className="drawer-reset-btn"
                onClick={handleResetChat}
                title="Mulai percakapan baru dan bersihkan sesi"
              >
                Percakapan Baru
              </button>
            )}

            <button
              type="button"
              className="drawer-close-btn"
              onClick={onClose}
              aria-label="Tutup"
            >
              <IconX className="close-icon" />
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="quick-prompts-bar">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-prompt-chip"
              onClick={() => handleSend(q)}
              disabled={isBusy || !isAgentActive}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="drawer-messages-list">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble-row ${m.dari}`}>
              <div className={`chat-bubble ${m.dari}`}>
                {m.dari === "agen" ? (
                  <>
                    <Teks isi={m.teks || "(tanpa jawaban)"} />
                    {m.langkah && <LogAgen langkah={m.langkah} />}
                  </>
                ) : (
                  <span>{m.teks}</span>
                )}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="chat-bubble-row agen">
              <div className="chat-bubble agen thinking-bubble">
                <span className="dot-flashing" />
                <span>Agen sedang menelaah sensor & regulasi…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="drawer-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="drawer-text-input"
            placeholder={
              isAgentActive ? "Ketik pertanyaan teknis atau wesel..." : "Agen sedang nonaktif"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isAgentActive || isBusy}
          />
          <button
            type="submit"
            className="drawer-send-btn"
            disabled={!isAgentActive || isBusy || !input.trim()}
            title="Kirim pesan"
          >
            <IconSend className="send-icon" />
          </button>
        </form>
      </div>
    </div>
  );
}
