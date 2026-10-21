import React, { useState, useRef, useEffect } from "react";
import {
  IconSearch,
  IconCalendar,
  IconBell,
  IconChevronDown,
  IconLogOut,
  IconKey,
} from "../Icons.jsx";
import SearchDropdown from "./SearchDropdown.jsx";
import NotificationPopover from "./NotificationPopover.jsx";
import { api } from "../api.js";

const ROLE_LABELS = {
  admin: "Administrator Sintelis",
  petugas: "Petugas Sintelis",
  pengelola: "Pengelola Dokumen",
  pengamat: "Pengamat (Hanya Lihat)",
};

export default function Header({
  searchQuery,
  onSearchChange,
  isAgentActive = true,
  onToggleAgent,
  user,
  onLogout,
  onSelectWesel,
  onNavigate,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConnDetailsOpen, setIsConnDetailsOpen] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [hasCriticalUnread, setHasCriticalUnread] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const connRef = useRef(null);

  // Poll connection status & unread notification count
  const checkStatusAndNotifs = async () => {
    try {
      const [k, n] = await Promise.all([
        api.koneksi(false).catch(() => null),
        api.notifikasiJumlah().catch(() => ({ belum_dibaca: 0, per_tingkat: {} })),
      ]);
      if (k) setConnectionStatus(k);
      if (n) {
        setUnreadNotifCount(n.belum_dibaca || 0);
        setHasCriticalUnread(Boolean(n.per_tingkat?.kritis && n.per_tingkat.kritis > 0));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkStatusAndNotifs();
    const t = setInterval(checkStatusAndNotifs, 15000);
    return () => clearInterval(t);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
      if (connRef.current && !connRef.current.contains(event.target)) {
        setIsConnDetailsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleForceCheckConnection = async () => {
    try {
      const res = await api.koneksi(true);
      setConnectionStatus(res);
    } catch (e) {
      console.error("Gagal memeriksa koneksi:", e);
    }
  };

  const userName = user?.nama || "Petugas Sintelis";
  const userRole = ROLE_LABELS[user?.peran] || user?.peran || "Petugas Sintelis";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const connState = connectionStatus?.status || "online";
  const latency = connectionStatus?.latensi_ms;

  return (
    <header className="top-header">
      {/* 1. Search Input Bar with Real-Time Combined Search Dropdown */}
      <div className="search-wrapper-container" ref={searchRef}>
        <div className="search-wrapper">
          <IconSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari wesel, work order, riwayat, regulasi KAI..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange && onSearchChange(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
          />
          <div className="search-shortcut" title="Tekan untuk mencari">
            <span>Cari</span>
          </div>
        </div>

        {/* Real-Time Dropdown Popover */}
        <SearchDropdown
          query={searchQuery}
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectWesel={(id) => {
            onSelectWesel && onSelectWesel(id);
            if (onNavigate) onNavigate("detail", { weselId: id });
            setIsSearchOpen(false);
          }}
          onNavigate={onNavigate}
        />
      </div>

      {/* Right Action Items */}
      <div className="header-actions">
        {/* 2. Indikator Koneksi Online / Offline Gateway */}
        <div className="conn-indicator-wrapper" ref={connRef}>
          <button
            type="button"
            className={`conn-status-badge ${connState}`}
            onClick={() => setIsConnDetailsOpen(!isConnDetailsOpen)}
            title={`Status Koneksi: ${connState.toUpperCase()}${latency ? ` (${latency}ms)` : ""}. Klik untuk detail.`}
          >
            <span className={`conn-dot ${connState}`} />
            <span className="conn-label">
              {connState === "online"
                ? `Online ${latency ? `• ${latency}ms` : ""}`
                : connState === "terbatas"
                ? "Terbatas"
                : "Offline"}
            </span>
          </button>

          {isConnDetailsOpen && (
            <div className="conn-popover-card">
              <div className="conn-popover-top">
                <span className={`conn-popover-status-badge ${connState}`}>
                  {connState.toUpperCase()}
                </span>
                <span className="conn-popover-host">{connectionStatus?.host || "Gateway"}</span>
              </div>
              <p className="conn-popover-msg">
                {connectionStatus?.pesan || "Pemeriksaan konektivitas gateway ke model cloud."}
              </p>
              {latency != null && (
                <div className="conn-latency-row">
                  <span>Latensi Jaringan:</span>
                  <strong>{latency} ms</strong>
                </div>
              )}
              <div className="conn-footer-row">
                <span className="conn-check-time">
                  Diperiksa: {connectionStatus?.diperiksa?.slice(11, 19) || "baru saja"}
                </span>
                <button
                  type="button"
                  className="conn-recheck-btn"
                  onClick={handleForceCheckConnection}
                >
                  Periksa Ulang
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Laporan Harian Shortcut Button (Kalender) */}
        <button
          type="button"
          className="icon-square-btn"
          onClick={() => onNavigate && onNavigate("laporan")}
          title="Buka Laporan Harian Stasiun (Unduh .MD / .CSV)"
          aria-label="Laporan Harian Stasiun"
        >
          <IconCalendar className="header-btn-icon" />
        </button>

        {/* 4. Notifikasi Tersimpan Button (Lonceng) */}
        <div className="notif-wrapper" ref={notifRef}>
          <button
            type="button"
            className="icon-square-btn notif-trigger-btn"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            title={`${unreadNotifCount} notifikasi belum dibaca`}
            aria-label="Buka Notifikasi Tersimpan"
          >
            <IconBell className="header-btn-icon" />
            {unreadNotifCount > 0 && (
              <span className={`notif-badge ${hasCriticalUnread ? "kritis" : ""}`}>
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Popover Notifikasi Tersimpan */}
          <NotificationPopover
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            onSelectWesel={onSelectWesel}
            onNavigate={onNavigate}
            onNotificationUpdated={checkStatusAndNotifs}
          />
        </div>

        {/* 5. Agent Switch Toggle (Admin & Petugas Only) */}
        <button
          type="button"
          className={`agent-toggle-pill ${isAgentActive ? "active" : "inactive"}`}
          onClick={onToggleAgent}
          title={isAgentActive ? "Agen AI aktif (Klik untuk matikan)" : "Agen AI nonaktif (Klik untuk aktifkan)"}
          disabled={user?.peran === "pengamat" || user?.peran === "pengelola"}
        >
          <span className="agent-indicator-light" />
          <span className="agent-toggle-label">
            {isAgentActive ? "Agen Aktif" : "Agen Mati"}
          </span>
        </button>

        {/* 6. User Profile Pill with Dropdown */}
        <div className="profile-dropdown-wrapper" ref={dropdownRef}>
          <div
            className="profile-chip"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            role="button"
            tabIndex={0}
            title="Klik untuk melihat profil atau keluar"
          >
            <div className="profile-avatar-fallback">
              {initials || "WG"}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            <IconChevronDown className={`profile-chevron ${isDropdownOpen ? "rotated" : ""}`} />
          </div>

          {isDropdownOpen && (
            <div className="profile-menu-popover">
              <div className="profile-popover-header">
                <strong>{userName}</strong>
                <span className="popover-username">@{user?.username || "petugas"}</span>
                <span className={`popover-role-badge ${user?.peran || "petugas"}`}>
                  {userRole}
                </span>
              </div>
              <div className="profile-popover-divider" />
              <button
                type="button"
                className="profile-popover-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onNavigate && onNavigate("profil");
                }}
              >
                <IconKey className="popover-menu-icon" />
                <span>Ganti Sandi &amp; Profil</span>
              </button>
              <button
                type="button"
                className="profile-popover-logout"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onLogout && onLogout();
                }}
              >
                <IconLogOut className="popover-logout-icon" />
                <span>Keluar dari Sistem</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
