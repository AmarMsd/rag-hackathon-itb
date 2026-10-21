import React, { useState, useEffect } from "react";
import { IconBell, IconX } from "../Icons.jsx";
import { api } from "../api.js";

const LEVEL_LABELS = {
  kritis: { label: "Kritis", color: "kritis" },
  peringatan: { label: "Peringatan", color: "peringatan" },
  info: { label: "Info", color: "info" },
};

export default function NotificationPopover({
  isOpen,
  onClose,
  onSelectWesel,
  onNavigate,
  onNotificationUpdated,
}) {
  const [filterUnread, setFilterUnread] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await api.notifikasi(filterUnread, 30);
      setNotifications(res.notifikasi || []);
      setUnreadCount(res.belum_dibaca || 0);
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filterUnread]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.notifikasiBaca(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      onNotificationUpdated && onNotificationUpdated();
    } catch (err) {
      console.error("Gagal menandai notifikasi:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifikasiBacaSemua();
      setNotifications((prev) => prev.map((n) => ({ ...n, dibaca: true })));
      setUnreadCount(0);
      onNotificationUpdated && onNotificationUpdated();
    } catch (err) {
      console.error("Gagal menandai semua dibaca:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notification-popover" onClick={(e) => e.stopPropagation()}>
      {/* Popover Header */}
      <div className="notif-popover-header">
        <div className="notif-header-title-row">
          <IconBell className="notif-header-icon" />
          <h3 className="notif-title">Notifikasi Tersimpan</h3>
          {unreadCount > 0 && (
            <span className="notif-unread-count-pill">{unreadCount} baru</span>
          )}
        </div>
        <button
          type="button"
          className="notif-close-btn"
          onClick={onClose}
          aria-label="Tutup notifikasi"
        >
          <IconX className="close-icon" />
        </button>
      </div>

      {/* Filter Tabs & Mark All Read */}
      <div className="notif-filter-bar">
        <div className="notif-tabs">
          <button
            type="button"
            className={`notif-tab ${!filterUnread ? "active" : ""}`}
            onClick={() => setFilterUnread(false)}
          >
            Semua
          </button>
          <button
            type="button"
            className={`notif-tab ${filterUnread ? "active" : ""}`}
            onClick={() => setFilterUnread(true)}
          >
            Belum Dibaca
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-mark-all-btn"
            onClick={handleMarkAllRead}
          >
            Tandai Semua Dibaca
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="notif-items-list">
        {isLoading ? (
          <div className="notif-loading">Memuat notifikasi…</div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <p>Tidak ada notifikasi {filterUnread ? "yang belum dibaca" : ""}.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const levelInfo = LEVEL_LABELS[n.tingkat] || { label: n.tingkat, color: "info" };
            return (
              <div
                key={n.id}
                className={`notif-card ${!n.dibaca ? "unread" : ""} ${levelInfo.color}`}
                onClick={() => {
                  if (n.wesel_id) {
                    onSelectWesel && onSelectWesel(n.wesel_id);
                    if (onNavigate) onNavigate("detail", { weselId: n.wesel_id });
                  } else if (n.jenis === "work_order" || n.jenis === "keputusan") {
                    if (onNavigate) onNavigate("workorders");
                  } else if (n.jenis === "dokumen") {
                    if (onNavigate) onNavigate("dokumen");
                  }
                  if (!n.dibaca) {
                    api.notifikasiBaca(n.id).then(() => {
                      setNotifications((prev) =>
                        prev.map((item) => (item.id === n.id ? { ...item, dibaca: true } : item))
                      );
                      setUnreadCount((c) => Math.max(0, c - 1));
                      onNotificationUpdated && onNotificationUpdated();
                    });
                  }
                  onClose();
                }}
              >
                <div className="notif-card-top">
                  <span className={`notif-level-badge ${levelInfo.color}`}>
                    {levelInfo.label}
                  </span>
                  {n.wesel_id && (
                    <span className="notif-wesel-id">{n.wesel_id}</span>
                  )}
                  <span className="notif-time">
                    {n.ts ? n.ts.replace("T", " ").slice(5, 16) : ""}
                  </span>
                  {!n.dibaca && (
                    <button
                      type="button"
                      className="notif-dot-unread"
                      title="Klik untuk tandai sudah dibaca"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                    />
                  )}
                </div>

                <h4 className="notif-card-title">{n.judul}</h4>
                {n.pesan && <p className="notif-card-message">{n.pesan}</p>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
