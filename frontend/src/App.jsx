import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Login from "./components/Login.jsx";
import { IconLogo } from "./Icons.jsx";

// Page Views (Navigasi Terarah & Tanpa Card Absolute)
import BerandaPage from "./pages/BerandaPage.jsx";
import DetailWeselPage from "./pages/DetailWeselPage.jsx";
import TanyaAgenPage from "./pages/TanyaAgenPage.jsx";
import WorkOrdersPage from "./pages/WorkOrdersPage.jsx";
import LaporanHarianPage from "./pages/LaporanHarianPage.jsx";
import DokumenPage from "./pages/DokumenPage.jsx";
import PenggunaPage from "./pages/PenggunaPage.jsx";
import ProfilPage from "./pages/ProfilPage.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginMessage, setLoginMessage] = useState("");

  const [wesel, setWesel] = useState([]);
  const [pilihan, setPilihan] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [agen, setAgen] = useState({ aktif: true });
  const [putus, setPutus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Navigasi Halaman Utama (Default: 'beranda')
  const [activeNav, setActiveNav] = useState("beranda");

  // State parameter untuk navigasi antar halaman (misal: buka chat dengan prompt/sesi tertentu)
  const [chatInitData, setChatInitData] = useState(null);

  // 1. Initial auth verification on page load (GET /api/saya)
  useEffect(() => {
    async function verifikasiSesi() {
      try {
        const u = await api.saya();
        setUser(u);
      } catch (err) {
        setUser(null);
        if (err.status === 401) {
          setLoginMessage("Sesi habis atau belum masuk. Silakan masuk lagi.");
        }
      } finally {
        setCheckingAuth(false);
      }
    }
    verifikasiSesi();
  }, []);

  const muat = useCallback(async () => {
    try {
      const [w, wo, a] = await Promise.all([
        api.wesel(),
        api.workOrders(),
        api.agen(),
      ]);
      setWesel(w || []);
      setWorkOrders(wo || []);
      setAgen(a || { aktif: true });
      setPutus("");

      // Default switch selection
      setPilihan((p) => p ?? w.find((x) => x.status !== "Normal")?.wesel_id ?? w[0]?.wesel_id);
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        setLoginMessage("Sesi berakhir. Silakan masuk lagi.");
        return;
      }
      setPutus("Tidak tersambung ke gateway. Pastikan server di Raspberry Pi berjalan.");
    }
  }, []);

  // 2. Poll data periodically once authenticated
  useEffect(() => {
    if (!user) return;
    muat();
    const t = setInterval(muat, 5000); // Polling data deteksi tiap 5 detik
    return () => clearInterval(t);
  }, [user, muat]);

  async function handleToggleAgent() {
    if (user?.peran === "pengamat" || user?.peran === "pengelola") return;
    try {
      const updated = await api.ubahAgen(agen.aktif ? "hentikan" : "aktifkan");
      setAgen(updated);
    } catch (err) {
      alert("Gagal mengubah status agen: " + (err.message || ""));
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("Gagal logout:", err);
    } finally {
      setUser(null);
      setLoginMessage("");
    }
  }

  // Navigasi Terarah antar halaman
  const handleNavigate = (pageId, params = {}) => {
    if (params.weselId) {
      setPilihan(params.weselId);
    }
    if (params.prompt || params.sessionId || params.history) {
      setChatInitData({
        prompt: params.prompt || null,
        sessionId: params.sessionId || null,
        history: params.history || null,
      });
    }
    setActiveNav(pageId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 3. Loading state saat memeriksa sesi login awal
  if (checkingAuth) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <div className="login-logo-badge">
            <IconLogo className="login-logo-icon" />
          </div>
          <div className="login-spinner" />
          <span className="auth-loading-text">Memeriksa sesi login…</span>
        </div>
      </div>
    );
  }

  // 4. Jika belum masuk, tampilkan halaman Login
  if (!user) {
    return (
      <Login
        initialMessage={loginMessage}
        onLoginSuccess={(userData) => {
          setUser(userData);
          setLoginMessage("");
          muat();
        }}
      />
    );
  }

  // Filter wesel jika ada search query
  const displayedWesel = wesel.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.wesel_id?.toLowerCase().includes(q) ||
      w.status?.toLowerCase().includes(q) ||
      w.kondisi_kandidat?.toLowerCase().includes(q) ||
      w.lokasi?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="dashboard-container">
      {/* Left Sidebar Rail (Navigasi Berdasarkan Peran) */}
      <Sidebar
        activeNav={activeNav}
        onSelectNav={(id) => handleNavigate(id)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Viewport */}
      <div className="main-viewport">
        {/* Top Header (Pencarian, Koneksi, Kalender, Notifikasi, Sakelar Agen, Profil) */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isAgentActive={agen.aktif}
          onToggleAgent={handleToggleAgent}
          user={user}
          onLogout={handleLogout}
          onSelectWesel={(id) => handleNavigate("detail", { weselId: id })}
          onNavigate={handleNavigate}
        />

        {/* Read-Only Banner for Pengamat Account */}
        {user.peran === "pengamat" && (
          <div className="read-only-banner">
            <span className="read-only-tag">Mode Pengamat</span>
            <span>
              Anda masuk dengan hak akses baca (<em>read-only</em>). Anda dapat memantau telemetri, grafik tren, dan laporan, namun tidak dapat mengubah status atau memutuskan work order.
            </span>
          </div>
        )}

        {/* Connection Offline Banner (if any) */}
        {putus && (
          <div className="connection-banner">
            <span className="banner-dot" />
            <span>{putus}</span>
            <button type="button" className="banner-retry-btn" onClick={muat}>
              Coba lagi
            </button>
          </div>
        )}

        {/* Dynamic Page Views: Berpindah halaman bersih tanpa modal/card absolute */}
        {activeNav === "beranda" && (
          <BerandaPage
            weselList={displayedWesel}
            onSelectWesel={(id) => setPilihan(id)}
            onNavigate={handleNavigate}
            isAgentActive={agen.aktif}
            user={user}
          />
        )}

        {activeNav === "detail" && (
          <DetailWeselPage
            weselList={displayedWesel}
            selectedWeselId={pilihan}
            onSelectWesel={(id) => setPilihan(id)}
            onNavigate={handleNavigate}
            isAgentActive={agen.aktif}
            user={user}
          />
        )}

        {activeNav === "chat" && (
          <TanyaAgenPage
            initialSessionId={chatInitData?.sessionId}
            initialPrompt={chatInitData?.prompt}
            initialHistory={chatInitData?.history}
            isAgentActive={agen.aktif}
            user={user}
          />
        )}

        {activeNav === "workorders" && (
          <WorkOrdersPage
            workOrders={workOrders}
            onRefresh={muat}
            user={user}
          />
        )}

        {activeNav === "laporan" && (
          <LaporanHarianPage />
        )}

        {activeNav === "dokumen" && (
          <DokumenPage user={user} />
        )}

        {activeNav === "pengguna" && (
          <PenggunaPage currentUser={user} />
        )}

        {activeNav === "profil" && (
          <ProfilPage user={user} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
}