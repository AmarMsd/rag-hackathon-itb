import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const LAMPU_TINGKAT = { kritis: "merah", peringatan: "kuning", info: "mati" };

function waktu(t) {
  return t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

export default function NotificationPopover({ isOpen, onClose, onSelectWesel, onNavigate, onNotificationUpdated }) {
  const [daftar, setDaftar] = useState(null);
  const [belum, setBelum] = useState(false);
  const [galat, setGalat] = useState("");

  const muat = () => api.notifikasi(belum, 30).then((r) => { setDaftar(r.notifikasi || []); setGalat(""); }).catch((e) => setGalat(e.message));
  useEffect(() => { if (isOpen) muat(); }, [isOpen, belum]);

  if (!isOpen) return null;

  async function bacaSemua() {
    await api.notifikasiBacaSemua().catch(() => {});
    muat();
    onNotificationUpdated?.();
  }

  function buka(n) {
    if (!n.dibaca) api.notifikasiBaca(n.id).then(() => onNotificationUpdated?.()).catch(() => {});
    if (n.jenis === "keputusan" || (n.ref_id && /^(WO|ESK)-/.test(n.ref_id))) onNavigate("workorders");
    else if (n.wesel_id) { onSelectWesel?.(n.wesel_id); }
    else if (n.jenis === "dokumen") onNavigate("dokumen");
    onClose();
  }

  return (
    <div className="wg-notif" role="dialog" aria-label="Notifikasi">
      <header>
        <h3>Notifikasi</h3>
        <label><input type="checkbox" checked={belum} onChange={(e) => setBelum(e.target.checked)} /> Belum dibaca saja</label>
        <button type="button" className="wg-tautan" onClick={bacaSemua}>Tandai semua dibaca</button>
      </header>
      {galat && <p className="wg-galat" style={{ padding: "8px 14px" }}>{galat}</p>}
      {!daftar && !galat && <p className="wg-sedang" style={{ padding: "10px 14px" }}>Memuat</p>}
      {daftar?.length === 0 && <p className="wg-kosong" style={{ padding: "10px 14px" }}>Tidak ada notifikasi.</p>}
      <ul>
        {daftar?.map((n) => (
          <li key={n.id} className={n.dibaca ? "" : "baru"}>
            <button type="button" onClick={() => buka(n)}>
              <span className={`wg-lampu ${LAMPU_TINGKAT[n.tingkat] || "mati"}`} aria-hidden="true" />
              <span className="isi">
                <b>{n.judul}</b>
                {n.pesan && <span>{n.pesan}</span>}
                <small>{waktu(n.ts)}{n.dibaca ? "" : ", belum dibaca"}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
