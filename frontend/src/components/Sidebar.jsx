import React from "react";
import {
  IconLogo,
  IconHome,
  IconBarChart,
  IconHeadset,
  IconUsers,
  IconCalendar,
  IconBookOpen,
  IconShield,
  IconKey,
  IconLogOut,
} from "../Icons.jsx";

export default function Sidebar({
  activeNav = "beranda",
  onSelectNav,
  user,
  onLogout,
}) {
  const peran = user?.peran || "pengamat";

  // Menu list with Role-Based Access Control (RBAC)
  const allNavItems = [
    { id: "beranda", icon: IconHome, label: "Beranda & Pemantauan Wesel" },
    { id: "detail", icon: IconBarChart, label: "Detail Wesel & Tren 14 Hari" },
    {
      id: "chat",
      icon: IconHeadset,
      label: "Tanya Agen & Riwayat Percakapan",
      roles: ["admin", "petugas"],
    },
    { id: "workorders", icon: IconUsers, label: "Antrean Keputusan (Work Order)" },
    { id: "laporan", icon: IconCalendar, label: "Laporan Harian Stasiun" },
    { id: "dokumen", icon: IconBookOpen, label: "Dokumen Pengetahuan" },
    {
      id: "pengguna",
      icon: IconShield,
      label: "Kelola Akun (Admin)",
      roles: ["admin"],
    },
    { id: "profil", icon: IconKey, label: "Profil & Ganti Kata Sandi" },
  ];

  const visibleNavItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(peran)
  );

  return (
    <aside className="sidebar-rail" aria-label="Navigasi Utama">
      <div className="sidebar-top">
        {/* Brand Logo in Orange */}
        <div
          className="brand-badge"
          title="WeselGuard - Gateway Stasiun (Klik untuk ke Beranda)"
          onClick={() => onSelectNav && onSelectNav("beranda")}
        >
          <IconLogo className="brand-logo-icon" />
        </div>

        {/* Navigation list */}
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
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
