import React from "react";
import {
  IconLogo,
  IconHome,
  IconGrid,
  IconBarChart,
  IconUsers,
  IconCalendar,
  IconSettings,
  IconHeadset,
  IconHelp,
  IconLogOut,
} from "../Icons.jsx";

export default function Sidebar({
  activeNav = "dashboard",
  onSelectNav,
  onOpenChat,
  isAgentActive = true,
  onLogout,
}) {
  const navItems = [
    { id: "dashboard", icon: IconHome, label: "Dashboard" },
    { id: "wesel", icon: IconGrid, label: "Daftar Wesel" },
    { id: "analitik", icon: IconBarChart, label: "Analitik Sinyal" },
    { id: "workorders", icon: IconUsers, label: "Work Orders" },
    { id: "jadwal", icon: IconCalendar, label: "Jadwal Pemeriksaan" },
    { id: "pengaturan", icon: IconSettings, label: "Pengaturan" },
  ];

  return (
    <aside className="sidebar-rail" aria-label="Navigasi Utama">
      <div className="sidebar-top">
        {/* Brand Logo in Orange */}
        <div className="brand-badge" title="WeselGuard - Gateway Stasiun">
          <IconLogo className="brand-logo-icon" />
        </div>

        {/* Navigation list */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-btn ${isActive ? "active" : ""}`}
                onClick={() => onSelectNav && onSelectNav(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="sidebar-icon" />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-btn agent-btn"
          onClick={onOpenChat}
          title="Tanya Agen AI Sintelis (Klik untuk buka obrolan)"
          aria-label="Tanya Agen AI Sintelis"
        >
          <IconHeadset className="sidebar-icon" />
          {isAgentActive && <span className="agent-online-dot" title="Agen Aktif" />}
        </button>

        <button
          type="button"
          className="sidebar-btn"
          title="Bantuan & SOP Sintelis"
          aria-label="Bantuan"
        >
          <IconHelp className="sidebar-icon" />
        </button>

        <button
          type="button"
          className="sidebar-btn"
          onClick={onLogout}
          title="Keluar dari Sistem"
          aria-label="Keluar dari Sistem"
        >
          <IconLogOut className="sidebar-icon" />
        </button>
      </div>
    </aside>
  );
}
