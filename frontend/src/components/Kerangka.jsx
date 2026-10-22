import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { IconBell } from "../Icons.jsx";
import { Merek } from "./Unsur.jsx";
import { PERAN } from "../kondisi.js";
import SearchDropdown from "./SearchDropdown.jsx";
import NotificationPopover from "./NotificationPopover.jsx";

export const HALAMAN = [
  { id: "beranda", judul: "Beranda" },
  { id: "peta", judul: "Peta wesel" },
  { id: "detail", judul: "Detail wesel" },
  { id: "workorders", judul: "Keputusan" },
  { id: "chat", judul: "Tanya agen", peran: ["admin", "petugas"] },
  { id: "laporan", judul: "Laporan harian" },
  { id: "dokumen", judul: "Dokumen" },
  { id: "pengguna", judul: "Akun pengguna", peran: ["admin"] },
  { id: "profil", judul: "Profil" },
];

export function Nav({ aktif, onPilih, user, agen, onUbahAgen, menunggu }) {
  const peran = user?.peran || "pengamat";
  const bolehKendali = peran === "admin" || peran === "petugas";
  return (
    <aside className="wg-nav" aria-label="Navigasi">
      <a href="#beranda" onClick={(e) => { e.preventDefault(); onPilih("beranda"); }} style={{ textDecoration: "none" }}>
        <Merek />
      </a>
      <div className="wg-stasiun">Gateway stasiun</div>
      <ul>
        {HALAMAN.filter((h) => !h.peran || h.peran.includes(peran)).map((h) => (
          <li key={h.id}>
            <button type="button" aria-current={aktif === h.id ? "page" : undefined} onClick={() => onPilih(h.id)}>
              {h.judul}
              {h.id === "workorders" && menunggu > 0 && <span className="wg-hitung">{menunggu}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="wg-kendali-agen">
        <p>
          <span className={`wg-lampu ${agen.aktif ? "hijau" : "merah"}`} aria-hidden="true" />
          {agen.aktif ? "Agen berjalan" : "Agen dihentikan"}
        </p>
        <small>
          {agen.aktif
            ? agen.berjalan > 0
              ? `${agen.berjalan} analisis sedang berjalan.`
              : "Agen hanya mengusulkan. Setiap work order menunggu keputusan petugas."
            : "Analisis dan chat ditolak sampai agen dijalankan lagi."}
        </small>
        {bolehKendali && (
          <button type="button" className={`wg-tombol kecil ${agen.aktif ? "bahaya" : "utama"}`} onClick={onUbahAgen}>
            {agen.aktif ? "Hentikan agen" : "Jalankan agen"}
          </button>
        )}
      </div>
    </aside>
  );
}

export function Atas({ judul, user, onNavigate, onSelectWesel }) {
  const [koneksi, setKoneksi] = useState(null);
  const [notif, setNotif] = useState({ belum_dibaca: 0 });
  const [bukaNotif, setBukaNotif] = useState(false);
  const [q, setQ] = useState("");
  const [bukaCari, setBukaCari] = useState(false);
  const notifRef = useRef(null);
  const cariRef = useRef(null);

  async function periksa() {
    const [k, n] = await Promise.all([api.koneksi(false).catch(() => null), api.notifikasiJumlah().catch(() => null)]);
    setKoneksi(k);
    if (n) setNotif(n);
  }

  useEffect(() => {
    periksa();
    const t = setInterval(periksa, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function luar(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setBukaNotif(false);
      if (cariRef.current && !cariRef.current.contains(e.target)) setBukaCari(false);
    }
    document.addEventListener("mousedown", luar);
    return () => document.removeEventListener("mousedown", luar);
  }, []);

  const online = koneksi?.status === "online";
  return (
    <header className="wg-atas">
      <h1>{judul}</h1>
      <div className="wg-cari" ref={cariRef}>
        <input
          className="wg-input"
          type="search"
          placeholder="Cari wesel, work order, manual"
          aria-label="Cari"
          value={q}
          onChange={(e) => { setQ(e.target.value); setBukaCari(e.target.value.trim().length >= 2); }}
          onFocus={() => setBukaCari(q.trim().length >= 2)}
        />
        <SearchDropdown
          query={q}
          isOpen={bukaCari}
          onClose={() => setBukaCari(false)}
          onSelectWesel={onSelectWesel}
          onNavigate={(p, x) => { setBukaCari(false); onNavigate(p, x); }}
        />
      </div>
      <span className="wg-koneksi" title={koneksi?.pesan || ""}>
        <span className={`wg-lampu ${koneksi ? (online ? "hijau" : "kuning") : "mati"}`} aria-hidden="true" />
        {koneksi ? (online ? "Model agen terjangkau" : "Model agen tidak terjangkau") : "Memeriksa koneksi"}
      </span>
      <div className="wg-popover" ref={notifRef}>
        <button type="button" className="wg-ikon-tombol" aria-label={`Notifikasi, ${notif.belum_dibaca || 0} belum dibaca`} onClick={() => setBukaNotif((b) => !b)}>
          <IconBell width={18} height={18} />
          {notif.belum_dibaca > 0 && <span className="wg-hitung">{notif.belum_dibaca}</span>}
        </button>
        <NotificationPopover
          isOpen={bukaNotif}
          onClose={() => setBukaNotif(false)}
          onSelectWesel={onSelectWesel}
          onNavigate={(p, x) => { setBukaNotif(false); onNavigate(p, x); }}
          onNotificationUpdated={periksa}
        />
      </div>
      <button type="button" className="wg-pengguna" onClick={() => onNavigate("profil")}>
        <b>{user?.nama}</b>
        <span>{PERAN[user?.peran] || user?.peran}</span>
      </button>
    </header>
  );
}

