import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
// import TrainingLoadCard from "./components/TrainingLoadCard.jsx";
import WeeklyConsistencyCard from "./components/WeeklyConsistencyCard.jsx";
import SpotlightCard from "./components/SpotlightCard.jsx";
import HistoryTableCard from "./components/HistoryTableCard.jsx";
import AutoRemindersCard from "./components/AutoRemindersCard.jsx";
import AgentChatDrawer from "./components/AgentChatDrawer.jsx";
import AgentAnalysisModal from "./components/AgentAnalysisModal.jsx";
import Login from "./components/Login.jsx";
import { IconSliders, IconArrowUpRight, IconLogo } from "./Icons.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [wesel, setWesel] = useState([]);
  const [pilihan, setPilihan] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [agen, setAgen] = useState({ aktif: true });
  const [riwayat, setRiwayat] = useState([]);
  const [putus, setPutus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard");

  // Interactive Modals
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // 1. Initial auth verification on page load
  useEffect(() => {
    async function verifikasiSesi() {
      try {
        const u = await api.saya();
        setUser(u);
      } catch (err) {
        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    }
    verifikasiSesi();
  }, []);

  const muat = useCallback(async () => {
    try {
      const [w, wo, a] = await Promise.all([api.wesel(), api.workOrders(), api.agen()]);
      setWesel(w || []);
      setWorkOrders(wo || []);
      setAgen(a || { aktif: true });
      setPutus("");

      // Default selection to the first non-normal switch or first in list
      setPilihan((p) => p ?? w.find((x) => x.status !== "Normal")?.wesel_id ?? w[0]?.wesel_id);
    } catch (err) {
      if (err.status === 401) {
        // Session expired
        setUser(null);
        return;
      }
      setPutus("Tidak tersambung ke gateway. Pastikan server di Raspberry Pi berjalan.");
    }
  }, []);

  // 2. Poll data periodically once authenticated
  useEffect(() => {
    if (!user) return;
    muat();
    const t = setInterval(muat, 5000); // Polling data deteksi berkala
    return () => clearInterval(t);
  }, [user, muat]);

  // Load history whenever selected switch changes
  useEffect(() => {
    if (user && pilihan) {
      api.riwayat(pilihan).then(setRiwayat).catch(() => setRiwayat([]));
    }
  }, [user, pilihan]);

  async function handleToggleAgent() {
    if (user?.peran === "pengamat") return;
    try {
      const updated = await api.ubahAgen(agen.aktif ? "hentikan" : "aktifkan");
      setAgen(updated);
    } catch (err) {
      console.error("Gagal mengubah status agen:", err);
    }
  }

  async function handleDecideWorkOrder(id, aksi, catatan) {
    if (user?.peran === "pengamat") {
      throw new Error("Akun pengamat hanya bisa melihat, tidak bisa mengubah keputusan.");
    }
    await api.putuskan(id, aksi, catatan);
    await muat();
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("Gagal logout:", err);
    } finally {
      setUser(null);
    }
  }

  // 3. Loading state while checking active session cookie
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

  // 4. If not logged in, render the clean Login view
  if (!user) {
    return (
      <Login
        onLoginSuccess={(userData) => {
          setUser(userData);
          muat();
        }}
      />
    );
  }

  const currentWesel = wesel.find((x) => x.wesel_id === pilihan) || wesel[0];
  const pendingCount = workOrders.filter((wo) => wo.status?.startsWith("MENUNGGU")).length;

  // Filter wesel by search query if any
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
      {/* Left Sidebar Rail */}
      <Sidebar
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        onOpenChat={() => setIsChatOpen(true)}
        isAgentActive={agen.aktif}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-viewport">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          pendingCount={pendingCount}
          isAgentActive={agen.aktif}
          onToggleAgent={handleToggleAgent}
          onOpenNotifications={() => setIsChatOpen(true)}
          user={user}
          onLogout={handleLogout}
        />

        {/* Read-Only Banner for Pengamat Account */}
        {user.peran === "pengamat" && (
          <div className="read-only-banner">
            <span className="read-only-tag">Mode Pengamat</span>
            <span>Anda masuk dengan hak akses baca (*read-only*). Anda dapat melihat seluruh telemetri dan log agen, namun tidak dapat mengubah status atau memutuskan work order.</span>
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

        {/* Page Title & Subheader */}
        <div className="page-subheader">
          <div className="subheader-titles">
            <h1 className="page-main-title">Performance Dashboard</h1>
            <p className="page-main-subtitle">
              A weekly snapshot of your clients' training load, recovery, and progress.
            </p>
          </div>

        </div>

        {/* Dashboard Grid Layout */}
        <main className="dashboard-grid">
          {/* Top Row: 3 Cards */}

          {/* Bottom Row: 2 Cards */}
          <div className="grid-bottom-row">
            <HistoryTableCard
              weselList={displayedWesel}
              selectedId={pilihan}
              onSelectWesel={setPilihan}
              onAnalyze={(id) => {
                setPilihan(id);
                setIsAnalysisModalOpen(true);
              }}
              workOrders={workOrders}
              onDecideWorkOrder={handleDecideWorkOrder}
              riwayat={riwayat}
              isReadOnly={user.peran === "pengamat"}
            />

            <AutoRemindersCard
              weselList={displayedWesel}
              onOpenChat={() => setIsChatOpen(true)}
              onAnalyze={(id) => {
                if (id) setPilihan(id);
                setIsAnalysisModalOpen(true);
              }}
              onSelectWesel={setPilihan}
              selectedWeselId={pilihan}
              isAgentActive={agen.aktif}
              pendingCount={pendingCount}
            />
          </div>
        </main>
      </div>

      {/* AI Chat Drawer */}
      <AgentChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAgentActive={agen.aktif}
        onActivityComplete={muat}
      />

      {/* Deep Telemetry & Agent Analysis Modal */}
      <AgentAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        wesel={currentWesel}
        isAgentActive={agen.aktif}
        onAnalysisDone={muat}
      />
    </div>
  );
}
