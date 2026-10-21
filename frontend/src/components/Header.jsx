import React, { useState, useRef, useEffect } from "react";
import {
  IconSearch,
  IconCalendar,
  IconBell,
  IconChevronDown,
  IconLogOut,
} from "../Icons.jsx";

const ROLE_LABELS = {
  admin: "Administrator Sintelis",
  petugas: "Petugas Sintelis",
  pengamat: "Pengamat (Hanya Lihat)",
};

export default function Header({
  searchQuery,
  onSearchChange,
  pendingCount = 0,
  isAgentActive = true,
  onToggleAgent,
  onOpenNotifications,
  user,
  onLogout,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = user?.nama || "Petugas Sintelis";
  const userRole = ROLE_LABELS[user?.peran] || user?.peran || "Petugas Sintelis";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="top-header">
      {/* Search Input Bar */}
      <div className="search-wrapper">
        <IconSearch className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Cari wesel, work order, riwayat, regulasi KAI..."
          value={searchQuery}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
        />
        <div className="search-shortcut" title="Tekan / atau Ctrl+K untuk mencari">
          <span>+ Space</span>
        </div>
      </div>

      {/* Right Action Items */}
      <div className="header-actions">
        {/* Calendar / Schedule button */}
        <button
          type="button"
          className="icon-square-btn"
          title="Jadwal Inspeksi Sintelis"
          aria-label="Jadwal Inspeksi Sintelis"
        >
          <IconCalendar className="header-btn-icon" />
        </button>

        {/* Notifications / Work Order pending count */}
        <button
          type="button"
          className="icon-square-btn"
          onClick={onOpenNotifications}
          title={`${pendingCount} Work Order menunggu persetujuan`}
          aria-label="Notifikasi Work Order"
        >
          <IconBell className="header-btn-icon" />
          {pendingCount > 0 && <span className="notif-badge">{pendingCount}</span>}
        </button>

        {/* Agent Switch Toggle */}
        <button
          type="button"
          className={`agent-toggle-pill ${isAgentActive ? "active" : "inactive"}`}
          onClick={onToggleAgent}
          title={isAgentActive ? "Agen AI aktif (Klik untuk matikan)" : "Agen AI nonaktif (Klik untuk aktifkan)"}
          disabled={user?.peran === "pengamat"}
        >
          <span className="agent-indicator-light" />
          <span className="agent-toggle-label">
            {isAgentActive ? "Agen Aktif" : "Agen Mati"}
          </span>
        </button>

        {/* User Profile Pill with Dropdown */}
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
