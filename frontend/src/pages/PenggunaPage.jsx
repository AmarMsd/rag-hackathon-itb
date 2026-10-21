import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PERAN } from "../kondisi.js";

const URAIAN_PERAN = {
  admin: "Admin: semua tindakan, termasuk akun",
  petugas: "Petugas: analisis agen dan keputusan work order",
  pengelola: "Pengelola: dokumen pengetahuan",
  pengamat: "Pengamat: hanya melihat",
};

function PilihPeran({ value, onChange }) {
  return (
    <select className="wg-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(URAIAN_PERAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

function tgl(t) {
  return t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";
}

export default function PenggunaPage({ currentUser }) {
  const [akun, setAkun] = useState(null);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState("akun");
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [baru, setBaru] = useState(null);
  const [ubah, setUbah] = useState(null);
  const [reset, setReset] = useState(null);

  const muat = () => Promise.all([api.pengguna(), api.auditPengguna(50).catch(() => [])])
    .then(([a, b]) => { setAkun(a); setAudit(b); })
    .catch((e) => setGalat(e.message));
  useEffect(() => { muat(); }, []);

  async function jalankan(fn, sukses) {
    setGalat(""); setInfo("");
    try { const r = await fn(); setInfo(r?.pesan || sukses); await muat(); return true; }
    catch (err) { setGalat(err.message); return false; }
  }

  return (
    <section className="wg-panel">
      <header>
        <h2>Akun pengguna</h2>
        <p>Hanya admin yang melihat halaman ini. Setiap perubahan tercatat di riwayat.</p>
        {!baru && <button className="wg-tombol utama wg-kanan" type="button" onClick={() => setBaru({ username: "", nama: "", peran: "petugas", password: "" })}>Tambah akun</button>}
      </header>

      {baru && (
        <form className="wg-panel-isi wg-form wg-form-baris" onSubmit={async (e) => {
          e.preventDefault();
          if (await jalankan(() => api.tambahPengguna({ ...baru, username: baru.username.trim().toLowerCase(), nama: baru.nama.trim() }), `Akun ${baru.username} dibuat.`)) setBaru(null);
        }}>
          <label>Nama pengguna<input className="wg-input" value={baru.username} onChange={(e) => setBaru({ ...baru, username: e.target.value })} required /></label>
          <label>Nama lengkap<input className="wg-input" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} required /></label>
          <label>Peran<PilihPeran value={baru.peran} onChange={(v) => setBaru({ ...baru, peran: v })} /></label>
          <label>Kata sandi awal<input className="wg-input" type="password" autoComplete="new-password" value={baru.password} onChange={(e) => setBaru({ ...baru, password: e.target.value })} required minLength={8} /></label>
          <div className="wg-baris-aksi"><button className="wg-tombol utama" type="submit">Buat akun</button><button className="wg-tombol" type="button" onClick={() => setBaru(null)}>Batal</button></div>
        </form>
      )}

      <div className="wg-tab" role="tablist" style={{ padding: "0 20px" }}>
        <button role="tab" aria-selected={tab === "akun"} onClick={() => setTab("akun")}>Akun ({akun?.length ?? 0})</button>
        <button role="tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Riwayat perubahan ({audit.length})</button>
      </div>
      {(galat || info) && <p className={`wg-panel-isi ${galat ? "wg-galat" : "wg-berhasil"}`} role="status" style={{ paddingBottom: 0 }}>{galat || info}</p>}

      {tab === "akun" && (
        !akun ? <p className="wg-sedang wg-panel-isi">Memuat</p> : (
          <div className="wg-tabel-bungkus">
            <table className="wg-tabel">
              <thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Masuk terakhir</th><th /></tr></thead>
              <tbody>
                {akun.map((u) => {
                  const diri = u.username === currentUser?.username;
                  if (ubah?.username === u.username) {
                    return (
                      <tr key={u.username}>
                        <td><input className="wg-input" value={ubah.nama} onChange={(e) => setUbah({ ...ubah, nama: e.target.value })} aria-label="Nama lengkap" /><div className="wg-redup">{u.username}</div></td>
                        <td colSpan={3}><PilihPeran value={ubah.peran} onChange={(v) => setUbah({ ...ubah, peran: v })} /></td>
                        <td><div className="wg-baris-aksi" style={{ justifyContent: "flex-end" }}>
                          <button className="wg-tombol kecil utama" type="button" onClick={async () => (await jalankan(() => api.ubahPengguna(u.username, { nama: ubah.nama.trim(), peran: ubah.peran }), "Akun diperbarui.")) && setUbah(null)}>Simpan</button>
                          <button className="wg-tombol kecil" type="button" onClick={() => setUbah(null)}>Batal</button>
                        </div></td>
                      </tr>
                    );
                  }
                  return (
                    <React.Fragment key={u.username}>
                      <tr>
                        <td><b>{u.nama}</b><div className="wg-redup">{u.username}{diri ? ", akun Anda" : ""}</div></td>
                        <td>{PERAN[u.peran] || u.peran}</td>
                        <td><span className="wg-status" style={{ fontWeight: 500 }}><span className={`wg-lampu ${u.aktif ? "hijau" : "mati"}`} />{u.aktif ? "Aktif" : "Diblokir"}</span></td>
                        <td className="wg-redup">{tgl(u.masuk_terakhir)}</td>
                        <td><div className="wg-baris-aksi" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button className="wg-tombol kecil" type="button" onClick={() => setUbah({ username: u.username, nama: u.nama, peran: u.peran })}>Ubah</button>
                          <button className="wg-tombol kecil" type="button" onClick={() => setReset({ username: u.username, password_baru: "" })}>Atur ulang sandi</button>
                          {!diri && (
                            <button className={`wg-tombol kecil ${u.aktif ? "bahaya" : ""}`} type="button"
                              onClick={() => window.confirm(`${u.aktif ? "Blokir" : "Aktifkan lagi"} akun ${u.username}?`) && jalankan(() => api.aturPengguna(u.username, u.aktif ? "nonaktifkan" : "aktifkan"), "Status akun diubah.")}>
                              {u.aktif ? "Blokir" : "Aktifkan"}
                            </button>
                          )}
                        </div></td>
                      </tr>
                      {reset?.username === u.username && (
                        <tr><td colSpan={5}>
                          <form className="wg-baris-aksi" onSubmit={async (e) => { e.preventDefault(); (await jalankan(() => api.aturPengguna(u.username, "reset-sandi", { password_baru: reset.password_baru }), "Kata sandi diatur ulang.")) && setReset(null); }}>
                            <input className="wg-input" type="password" autoComplete="new-password" placeholder={`Kata sandi baru untuk ${u.username}, minimal 8 karakter`} style={{ flex: 1 }} value={reset.password_baru} onChange={(e) => setReset({ ...reset, password_baru: e.target.value })} required minLength={8} />
                            <button className="wg-tombol kecil utama" type="submit">Simpan sandi baru</button>
                            <button className="wg-tombol kecil" type="button" onClick={() => setReset(null)}>Batal</button>
                          </form>
                          <small className="wg-redup">Semua sesi akun ini akan dikeluarkan.</small>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "audit" && (
        audit.length === 0 ? <p className="wg-kosong">Belum ada perubahan akun yang tercatat.</p> : (
          <div className="wg-tabel-bungkus">
            <table className="wg-tabel">
              <thead><tr><th>Waktu</th><th>Oleh</th><th>Akun</th><th>Tindakan</th><th>Rincian</th></tr></thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}><td className="wg-redup">{tgl(a.ts)}</td><td>{a.oleh}</td><td>{a.target}</td><td>{a.aksi.replaceAll("_", " ")}</td><td className="wg-redup">{a.detail}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
