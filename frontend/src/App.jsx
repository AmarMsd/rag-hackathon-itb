import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import { Nav, Atas, HALAMAN } from "./components/Kerangka.jsx";
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
  const [cekSesi, setCekSesi] = useState(true);
  const [pesanMasuk, setPesanMasuk] = useState("");

  const [wesel, setWesel] = useState([]);
  const [pilihan, setPilihan] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [agen, setAgen] = useState({ aktif: true, berjalan: 0 });
  const [putus, setPutus] = useState("");
  const [sudahMuat, setSudahMuat] = useState(false);
  const [halaman, setHalaman] = useState("beranda");
  const [chatAwal, setChatAwal] = useState(null);

  useEffect(() => {
    api.saya()
      .then(setUser)
      .catch((err) => {
        setUser(null);
        if (err.status !== 401) setPesanMasuk(err.message);
      })
      .finally(() => setCekSesi(false));
  }, []);

  const muat = useCallback(async () => {
    try {
      const [w, wo, a] = await Promise.all([api.wesel(), api.workOrders(), api.agen()]);
      setWesel(w || []);
      setWorkOrders(wo || []);
      setAgen(a || { aktif: true, berjalan: 0 });
      setPutus("");
      setPilihan((p) => p ?? (w || []).find((x) => x.status !== "Normal")?.wesel_id ?? w?.[0]?.wesel_id ?? null);
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        setPesanMasuk("Sesi berakhir. Masuk lagi untuk melanjutkan.");
        return;
      }
      setPutus(err.status === 0
        ? "Gateway tidak terjangkau. Angka di layar adalah data terakhir yang berhasil dimuat."
        : err.message);
    } finally {
      setSudahMuat(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    muat();
    const t = setInterval(muat, 5000);
    return () => clearInterval(t);
  }, [user, muat]);

  async function ubahAgen() {
    try {
      setAgen(await api.ubahAgen(agen.aktif ? "hentikan" : "aktifkan"));
    } catch (err) {
      setPutus(`Status agen tidak berubah: ${err.message}`);
    }
  }

  async function keluar() {
    await api.logout().catch(() => {});
    setUser(null);
    setPesanMasuk("");
  }

  function pindah(id, param = {}) {
    if (param.weselId) setPilihan(param.weselId);
    if (param.prompt || param.sessionId || param.history) {
      setChatAwal({ prompt: param.prompt || null, sessionId: param.sessionId || null, history: param.history || null });
    }
    setHalaman(id);
    window.scrollTo({ top: 0 });
  }

  if (cekSesi) return <div className="wg-masuk"><p className="wg-sedang">Memeriksa sesi</p></div>;

  if (!user) {
    return <Login initialMessage={pesanMasuk} onLoginSuccess={(u) => { setUser(u); setPesanMasuk(""); }} />;
  }

  const menunggu = workOrders.filter((w) => w.status?.startsWith("MENUNGGU")).length;
  const judul = halaman === "detail" ? "Detail wesel" : HALAMAN.find((h) => h.id === halaman)?.judul;

  return (
    <div className="wg-app">
      <Nav aktif={halaman} onPilih={(id) => pindah(id)} user={user} agen={agen} onUbahAgen={ubahAgen} menunggu={menunggu} />
      <div className="wg-utama">
        <Atas judul={judul} user={user} onNavigate={pindah} onSelectWesel={(id) => pindah("detail", { weselId: id })} />
        {putus && (
          <div className="wg-pita putus" role="alert">
            <span className="wg-lampu merah" aria-hidden="true" />
            {putus}
            <button type="button" className="wg-tombol kecil" onClick={muat}>Coba lagi</button>
          </div>
        )}
        {user.peran === "pengamat" && (
          <div className="wg-pita pengamat">
            Akun pengamat hanya bisa melihat. Keputusan work order dan kendali agen tidak tersedia.
          </div>
        )}
        <main className="wg-isi">
          {halaman === "beranda" && (
            <BerandaPage wesel={wesel} workOrders={workOrders} sudahMuat={sudahMuat} onNavigate={pindah} />
          )}
          {halaman === "detail" && (
            <DetailWeselPage wesel={wesel} pilihan={pilihan} onPilih={setPilihan} agen={agen} user={user} onNavigate={pindah} onSelesaiAnalisis={muat} />
          )}
          {halaman === "chat" && (
            <TanyaAgenPage
              initialSessionId={chatAwal?.sessionId}
              initialPrompt={chatAwal?.prompt}
              initialHistory={chatAwal?.history}
              isAgentActive={agen.aktif}
              user={user}
            />
          )}
          {halaman === "workorders" && <WorkOrdersPage workOrders={workOrders} onRefresh={muat} user={user} onNavigate={pindah} />}
          {halaman === "laporan" && <LaporanHarianPage />}
          {halaman === "dokumen" && <DokumenPage user={user} />}
          {halaman === "pengguna" && <PenggunaPage currentUser={user} />}
          {halaman === "profil" && <ProfilPage user={user} onLogout={keluar} />}
        </main>
      </div>
    </div>
  );
}
