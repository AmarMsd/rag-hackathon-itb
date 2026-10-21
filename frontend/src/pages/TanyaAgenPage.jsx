import React, { useEffect, useRef, useState } from "react";
import {
  IconHeadset,
  IconSparkles,
  IconSend,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
} from "../Icons.jsx";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";
import { api } from "../api.js";

export default function TanyaAgenPage({
  initialSessionId = null,
  initialPrompt = null,
  initialHistory = null,
  isAgentActive = true,
  user,
}) {
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'analisis'
  const [conversations, setConversations] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState(
    initialHistory && initialHistory.length
      ? initialHistory
      : [
          {
            dari: "agen",
            teks: "Halo! Saya Tesi Asisten Sintelis. Anda dapat menanyakan kondisi wesel, interpretasi getaran sensor akselerometer, atau kepatuhan regulasi PD 10A.",
          },
        ]
  );
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isPermanen, setIsPermanen] = useState(true);

  // Edit Title State
  const [editingId, setEditingId] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  const messagesEndRef = useRef(null);

  // Load conversation list
  const loadConversations = async () => {
    try {
      const res = await api.percakapan(activeTab);
      setConversations(res.percakapan || []);
      if (res.permanen !== undefined) {
        setIsPermanen(res.permanen);
      }
    } catch (err) {
      console.error("Gagal memuat percakapan:", err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [activeTab]);

  // If initialPrompt is passed, auto-send it
  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  // Select existing conversation
  const handleSelectConversation = async (sid) => {
    if (isBusy || sid === currentSessionId) return;
    setCurrentSessionId(sid);
    setIsBusy(true);
    try {
      const detail = await api.isiPercakapan(sid);
      if (detail?.pesan && detail.pesan.length) {
        setMessages(detail.pesan);
      } else {
        setMessages([
          {
            dari: "agen",
            teks: detail.cuplikan || "Percakapan dimuat.",
          },
        ]);
      }
    } catch (err) {
      setMessages([
        {
          dari: "galat",
          teks: err.message || "Gagal memuat isi percakapan ini.",
        },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  // Start fresh conversation (POST /api/chat tanpa session_id)
  const handleStartNewChat = () => {
    setCurrentSessionId(null);
    setMessages([
      {
        dari: "agen",
        teks: "Percakapan baru dimulai. Silakan ajukan pertanyaan atau konsultasi teknis.",
      },
    ]);
  };

  // Send message
  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isBusy || !isAgentActive) return;

    setInput("");
    setIsBusy(true);
    setMessages((prev) => [...prev, { dari: "petugas", teks: text }]);

    try {
      // POST /api/chat dengan session_id (jika melanjutkan) atau tanpa session_id
      const res = await api.chat(text, currentSessionId || undefined);
      if (res.session_id) {
        setCurrentSessionId(res.session_id);
      }
      setMessages((prev) => [
        ...prev,
        {
          dari: "agen",
          teks: res.jawaban,
          langkah: res.langkah,
        },
      ]);
      loadConversations();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { dari: "galat", teks: err.message || "Gagal menghubungi agen." },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  // Rename conversation
  const handleSaveTitle = async (sid) => {
    if (!editTitleInput.trim()) return;
    try {
      await api.ubahJudulPercakapan(sid, editTitleInput.trim());
      setEditingId(null);
      loadConversations();
    } catch (err) {
      alert("Gagal mengubah judul: " + err.message);
    }
  };

  // Delete single conversation
  const handleDeleteConversation = async (sid, e) => {
    e.stopPropagation();
    if (!confirm("Hapus percakapan ini dari daftar?")) return;
    try {
      await api.hapusPercakapan(sid);
      if (currentSessionId === sid) {
        handleStartNewChat();
      }
      loadConversations();
    } catch (err) {
      alert("Gagal menghapus percakapan: " + err.message);
    }
  };

  // Delete all conversations
  const handleDeleteAll = async () => {
    if (!confirm("Yakin ingin menghapus seluruh riwayat percakapan Anda?")) return;
    try {
      await api.hapusSemuaPercakapan();
      handleStartNewChat();
      loadConversations();
    } catch (err) {
      alert("Gagal menghapus semua percakapan: " + err.message);
    }
  };

  const quickPrompts = [
    "Berapa batas waktu pembalikan lidah wesel sesuai PD 10A?",
    "Bagaimana prosedur darurat bila wesel berstatus Bahaya?",
    "Jelaskan arti kenaikan nilai Kurtosis dan RMS getaran",
    "Wesel mana yang harus segera diperbaiki hari ini?",
  ];

  return (
    <div className="page-view tanya-agen-page">
      <div className="chat-layout-container">
        {/* Left Sidebar: Riwayat Percakapan */}
        <aside className="chat-history-sidebar">
          <div className="chat-sidebar-header">
            <button
              type="button"
              className="btn-new-chat"
              onClick={handleStartNewChat}
              disabled={isBusy}
            >
              <IconPlus className="icon-tiny" />
              <span>Percakapan Baru</span>
            </button>
          </div>

          {/* Filter Tab: Chat vs Analisis */}
          <div className="chat-type-tabs">
            <button
              type="button"
              className={`chat-tab-btn ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Obrolan
            </button>
            <button
              type="button"
              className={`chat-tab-btn ${activeTab === "analisis" ? "active" : ""}`}
              onClick={() => setActiveTab("analisis")}
            >
              Sesi Analisis
            </button>
          </div>

          {/* Non-permanent Warning Banner */}
          {!isPermanen && (
            <div className="non-permanent-warning-box">
              <IconAlertTriangle className="icon-warn-tiny" />
              <span>
                Percakapan disimpan sementara di memori server dan akan hilang bila server di-restart.
              </span>
            </div>
          )}

          {/* List of past conversations */}
          <div className="conversations-scroll-list">
            {conversations.length > 0 ? (
              conversations.map((c) => {
                const isSelected = c.id === currentSessionId;
                const isEditing = editingId === c.id;

                return (
                  <div
                    key={c.id}
                    className={`conversation-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectConversation(c.id)}
                  >
                    {isEditing ? (
                      <div className="edit-title-form" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="edit-title-input"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-save-title"
                          onClick={() => handleSaveTitle(c.id)}
                        >
                          Simpan
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="conv-title-row">
                          <strong className="conv-title-text">{c.judul || "Tanpa Judul"}</strong>
                          <div className="conv-actions-hover">
                            <button
                              type="button"
                              className="conv-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(c.id);
                                setEditTitleInput(c.judul || "");
                              }}
                              title="Ganti judul percakapan"
                            >
                              <IconEdit className="icon-mini" />
                            </button>
                            <button
                              type="button"
                              className="conv-action-btn delete"
                              onClick={(e) => handleDeleteConversation(c.id, e)}
                              title="Hapus percakapan ini"
                            >
                              <IconTrash className="icon-mini" />
                            </button>
                          </div>
                        </div>
                        <p className="conv-snippet-text">{c.cuplikan || "..."}</p>
                        <div className="conv-meta-row">
                          <span className="conv-time-text">
                            {c.diperbarui ? c.diperbarui.slice(0, 10) : "Hari ini"}
                          </span>
                          <span className="conv-badge-msg">{c.jumlah_pesan || 2} pesan</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="conversations-empty-note">
                Belum ada riwayat percakapan {activeTab === "analisis" ? "analisis" : "obrolan"}.
              </div>
            )}
          </div>

          {/* Bottom Clear All Button */}
          {conversations.length > 0 && (
            <div className="chat-sidebar-footer">
              <button
                type="button"
                className="btn-clear-all-chat"
                onClick={handleDeleteAll}
              >
                <IconTrash className="icon-tiny" />
                <span>Hapus Semua Percakapan</span>
              </button>
            </div>
          )}
        </aside>

        {/* Right Main Container: Area Obrolan */}
        <main className="chat-main-viewport">
          {/* Header Area Obrolan */}
          <div className="chat-main-header">
            <div className="chat-title-group">
              <div className="chat-avatar-pill">
                <IconHeadset className="chat-avatar-icon" />
              </div>
              <div>
                <h2 className="chat-room-title">
                  {currentSessionId
                    ? conversations.find((c) => c.id === currentSessionId)?.judul || "Sesi Obrolan Aktif"
                    : "Percakapan Baru dengan Agen Sintelis"}
                </h2>
                <p className="chat-room-sub">
                  {isAgentActive
                    ? "Asisten Siaga • Berbasis Regulasi PD 10A & Manual Pemeliharaan KAI"
                    : "Agen AI dinonaktifkan oleh petugas"}
                </p>
              </div>
            </div>

            {currentSessionId && (
              <span className="session-id-pill" title={`Session ID: ${currentSessionId}`}>
                ID Sesi: {currentSessionId.slice(0, 14)}…
              </span>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="chat-quick-prompts-bar">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-prompt-btn"
                onClick={() => handleSend(q)}
                disabled={isBusy || !isAgentActive}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="chat-messages-stream">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message-row ${m.dari}`}>
                <div className={`chat-speech-bubble ${m.dari}`}>
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
              <div className="chat-message-row agen">
                <div className="chat-speech-bubble agen thinking-state">
                  <span className="dot-flashing" />
                  <span>Agen sedang membaca data sensor, regulasi PD 10A, dan manual…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar Form */}
          <form
            className="chat-input-bar-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              className="chat-prompt-input"
              placeholder={
                isAgentActive
                  ? "Ketik pertanyaan teknis, nama wesel, atau konsultasi SOP..."
                  : "Agen AI sedang nonaktif"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!isAgentActive || isBusy}
            />
            <button
              type="submit"
              className="chat-send-submit-btn"
              disabled={!isAgentActive || isBusy || !input.trim()}
              title="Kirim pesan ke agen"
            >
              <IconSend className="send-icon-btn" />
              <span>Kirim</span>
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}