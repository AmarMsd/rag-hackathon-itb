import React, { useState } from "react";
import { IconX, IconSend, IconSparkles } from "../Icons.jsx";
import LogAgen from "../LogAgen.jsx";
import Teks from "../Teks.jsx";
import { api } from "../api.js";

export default function AgentChatDrawer({
  isOpen,
  onClose,
  isAgentActive = true,
  onActivityComplete,
}) {
  const [messages, setMessages] = useState([
    {
      dari: "agen",
      teks: "Halo! Saya Tesi. Tanyakan kondisi wesel, interpretasi getaran sensor, atau ketentuan regulasi PD 10A.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  if (!isOpen) return null;

  const quickPrompts = [
    "Berapa batas waktu pembalikan lidah wesel?",
    "Bagaimana prosedur darurat bila wesel berstatus Bahaya?",
    "Jelaskan arti kenaikan nilai Kurtosis dan RMS getaran",
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
              <h3 className="drawer-title">Tesi Asisten</h3>
              <p className="drawer-subtitle">
                {isAgentActive ? "Siaga • Berbasis PD 10A & Manual KAI" : "Agen dinonaktifkan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <IconX className="close-icon" />
          </button>
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
