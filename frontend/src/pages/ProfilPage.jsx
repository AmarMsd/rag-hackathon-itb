import React, { useState } from "react";
import { api } from "../api.js";
import { PERAN } from "../kondisi.js";

const HAK = {
  admin: "Semua tindakan operasional, termasuk mengelola akun pengguna.",
  petugas: "Menjalankan analisis agen, bertanya ke agen, serta menyetujui atau menolak usulan work order.",
  pengelola: "Mengunggah, memeriksa, dan mengaktifkan dokumen pengetahuan. Selain itu hanya melihat.",
  pengamat: "Hanya melihat. Cocok untuk juri dan tamu.",
};

export default function ProfilPage({ user, onLogout }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [pesan, setPesan] = useState({ jenis: "", teks: "" });
  const [kirim, setKirim] = useState(false);

  async function ganti(e) {
    e.preventDefault();
    if (baru.length < 8) return setPesan({ jenis: "galat", teks: "Kata sandi baru minimal 8 karakter." });
    if (baru !== ulang) return setPesan({ jenis: "galat", teks: "Ulangan kata sandi baru tidak sama." });
    setKirim(true);
    try {
      const r = await api.gantiSandi(lama, baru);
      setPesan({ jenis: "ok", teks: r.pesan || "Kata sandi diganti." });
      setLama(""); setBaru(""); setUlang("");
    } catch (err) {
      setPesan({ jenis: "galat", teks: err.message });
    } finally {
      setKirim(false);
    }
  }

  return (
    <div className="wg-dua" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
      <section className="wg-panel">
        <header><h2>{user?.nama}</h2><p>{user?.username}</p></header>
        <div className="wg-panel-isi">
          <dl className="wg-dl">
            <dt>Peran</dt><dd>{PERAN[user?.peran] || user?.peran}</dd>
            <dt>Hak akses</dt><dd style={{ fontWeight: 400 }}>{HAK[user?.peran]}</dd>
            <dt>Sesi</dt><dd style={{ fontWeight: 400 }}>Berlaku 12 jam. Mengganti kata sandi mengeluarkan sesi di perangkat lain.</dd>
          </dl>
          <button type="button" className="wg-tombol" style={{ marginTop: 16 }} onClick={onLogout}>Keluar</button>
        </div>
      </section>
      <section className="wg-panel">
        <header><h2>Ganti kata sandi</h2></header>
        <form className="wg-panel-isi wg-form" onSubmit={ganti}>
          <label>Kata sandi lama<input className="wg-input" type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} required /></label>
          <label>Kata sandi baru<input className="wg-input" type="password" autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} required /><small>Minimal 8 karakter.</small></label>
          <label>Ulangi kata sandi baru<input className="wg-input" type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} required /></label>
          {pesan.teks && <p className={pesan.jenis === "galat" ? "wg-galat" : "wg-berhasil"} role="status">{pesan.teks}</p>}
          <div><button className="wg-tombol utama" type="submit" disabled={kirim}>{kirim ? "Menyimpan" : "Ganti kata sandi"}</button></div>
        </form>
      </section>
    </div>
  );
}
