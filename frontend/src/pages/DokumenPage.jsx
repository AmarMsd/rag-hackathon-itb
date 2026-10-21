import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const KATEGORI = {
  regulasi: "Regulasi",
  manual: "Manual",
  sop: "SOP",
  riwayat_kerusakan: "Riwayat kerusakan",
  lainnya: "Lainnya",
};
const STATUS_DOK = { draf: "Draf, belum dipakai agen", aktif: "Aktif, dipakai agen", nonaktif: "Nonaktif", gagal: "Gagal dibaca" };
const LAMPU_DOK = { draf: "kuning", aktif: "hijau", nonaktif: "mati", gagal: "merah" };

function Periksa({ dok, onTutup }) {
  const [potongan, setPotongan] = useState(null);
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    api.detailDokumen(dok.id, 0, 15).then((d) => setPotongan(d.potongan || [])).catch((e) => setGalat(e.message));
  }, [dok.id]);

  async function uji(e) {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      setHasil((await api.ujiDokumen(dok.id, q.trim())).hasil || []);
    } catch (err) {
      setGalat(err.message);
    }
  }

  return (
    <section className="wg-panel" aria-label={`Periksa ${dok.judul}`}>
      <header>
        <h2>{dok.judul}</h2>
        <p>{dok.jumlah_halaman} halaman, {dok.jumlah_potongan} potongan</p>
        <button type="button" className="wg-tombol kecil wg-kanan" onClick={onTutup}>Tutup</button>
      </header>
      <div className="wg-panel-isi">
        <form className="wg-baris-aksi" onSubmit={uji}>
          <input className="wg-input" style={{ flex: 1 }} placeholder="Uji pencarian, misalnya: batas waktu pembalikan wesel" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="wg-tombol" type="submit">Cari di dokumen ini</button>
        </form>
        {galat && <p className="wg-galat">{galat}</p>}
        {hasil && (
          <ol className="wg-potongan">
            {hasil.length === 0 && <li>Tidak ada potongan yang cocok. Agen juga tidak akan menemukannya dengan kata kunci ini.</li>}
            {hasil.map((h, i) => <li key={i}><b>Halaman {h.halaman}</b>{h.isi}</li>)}
          </ol>
        )}
        <h3 className="wg-subjudul">Potongan pertama</h3>
        {!potongan ? <p className="wg-sedang">Memuat</p> : (
          <ol className="wg-potongan">
            {potongan.map((p) => <li key={p.urutan}><b>Halaman {p.halaman}</b>{p.isi}</li>)}
          </ol>
        )}
      </div>
    </section>
  );
}

export default function DokumenPage({ user }) {
  const [daftar, setDaftar] = useState(null);
  const [status, setStatus] = useState("semua");
  const [kategori, setKategori] = useState("semua");
  const [galat, setGalat] = useState("");
  const [periksa, setPeriksa] = useState(null);
  const [unggah, setUnggah] = useState({ buka: false, judul: "", kategori: "manual", file: null, kirim: false, galat: "" });
  const bolehKelola = user?.peran === "pengelola" || user?.peran === "admin";

  const muat = () => api.dokumen(status, kategori).then(setDaftar).catch((e) => setGalat(e.message));
  useEffect(() => { muat(); }, [status, kategori]);

  async function kirimUnggah(e) {
    e.preventDefault();
    if (!unggah.file || !unggah.judul.trim()) return setUnggah((u) => ({ ...u, galat: "Pilih file dan isi judul." }));
    setUnggah((u) => ({ ...u, kirim: true, galat: "" }));
    try {
      const fd = new FormData();
      fd.append("file", unggah.file);
      fd.append("judul", unggah.judul.trim());
      fd.append("kategori", unggah.kategori);
      await api.unggahDokumen(fd);
      setUnggah({ buka: false, judul: "", kategori: "manual", file: null, kirim: false, galat: "" });
      muat();
    } catch (err) {
      setUnggah((u) => ({ ...u, kirim: false, galat: err.message }));
    }
  }

  async function aksi(fn, pesanGagal) {
    try { await fn(); muat(); } catch (err) { setGalat(`${pesanGagal}: ${err.message}`); }
  }

  return (
    <>
      {bolehKelola && unggah.buka && (
        <section className="wg-panel">
          <header><h2>Unggah dokumen</h2><p>PDF, TXT, atau MD sampai 20 MB. Dokumen masuk sebagai draf dan baru dipakai agen setelah diaktifkan.</p></header>
          <form className="wg-panel-isi wg-form" onSubmit={kirimUnggah}>
            <label>Judul<input className="wg-input" value={unggah.judul} onChange={(e) => setUnggah({ ...unggah, judul: e.target.value })} placeholder="Contoh: Manual pemeriksaan penggerak wesel" /></label>
            <label>Kategori
              <select className="wg-input" value={unggah.kategori} onChange={(e) => setUnggah({ ...unggah, kategori: e.target.value })}>
                {Object.entries(KATEGORI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>File<input className="wg-input" type="file" accept=".pdf,.txt,.md" onChange={(e) => setUnggah({ ...unggah, file: e.target.files?.[0] || null })} /></label>
            {unggah.galat && <p className="wg-galat">{unggah.galat}</p>}
            <div className="wg-baris-aksi">
              <button className="wg-tombol utama" type="submit" disabled={unggah.kirim}>{unggah.kirim ? "Mengunggah" : "Unggah"}</button>
              <button className="wg-tombol" type="button" onClick={() => setUnggah({ ...unggah, buka: false })}>Batal</button>
            </div>
          </form>
        </section>
      )}

      {periksa && <Periksa dok={periksa} onTutup={() => setPeriksa(null)} />}

      <section className="wg-panel">
        <header>
          <h2>Dokumen pengetahuan</h2>
          <p>Dokumen aktif dicari agen lewat cari_dokumen. Manual contoh dicari terpisah lewat cari_manual.</p>
          <div className="wg-kanan wg-baris-aksi">
            <select className="wg-input" value={kategori} onChange={(e) => setKategori(e.target.value)} aria-label="Kategori">
              <option value="semua">Semua kategori</option>
              {Object.entries(KATEGORI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="wg-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="semua">Semua status</option>
              {Object.keys(STATUS_DOK).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
            {bolehKelola && !unggah.buka && <button className="wg-tombol utama" type="button" onClick={() => setUnggah({ ...unggah, buka: true })}>Unggah dokumen</button>}
          </div>
        </header>
        {galat && <p className="wg-galat wg-panel-isi" role="alert">{galat}</p>}
        {!daftar ? <p className="wg-sedang wg-panel-isi">Memuat</p> : daftar.length === 0 ? (
          <p className="wg-kosong">Belum ada dokumen dengan filter ini.</p>
        ) : (
          <div className="wg-tabel-bungkus">
            <table className="wg-tabel">
              <thead><tr><th>Dokumen</th><th>Kategori</th><th>Status</th><th className="wg-angka">Halaman</th><th>Diunggah</th><th /></tr></thead>
              <tbody>
                {daftar.map((d) => (
                  <tr key={d.id}>
                    <td style={{ maxWidth: 420 }}><b>{d.judul}</b>{d.status === "gagal" && <div className="wg-galat">{d.pesan}</div>}</td>
                    <td>{KATEGORI[d.kategori] || d.kategori}</td>
                    <td><span className="wg-status" style={{ fontWeight: 500 }}><span className={`wg-lampu ${LAMPU_DOK[d.status]}`} />{STATUS_DOK[d.status] || d.status}</span></td>
                    <td className="wg-angka">{d.jumlah_halaman ?? "–"}</td>
                    <td className="wg-redup">{d.diunggah_oleh}, {new Date(d.diunggah_pada).toLocaleDateString("id-ID")}</td>
                    <td>
                      <div className="wg-baris-aksi" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <button className="wg-tombol kecil" type="button" onClick={() => setPeriksa(d)}>Periksa</button>
                        {d.bisa_diunduh && <a className="wg-tombol kecil" href={api.unduhDokumenUrl(d.id)}>Unduh</a>}
                        {bolehKelola && d.status !== "aktif" && d.status !== "gagal" && (
                          <button className="wg-tombol kecil utama" type="button" onClick={() => aksi(() => api.aktifkanDokumen(d.id), "Gagal mengaktifkan")}>Aktifkan</button>
                        )}
                        {bolehKelola && d.status === "aktif" && (
                          <button className="wg-tombol kecil" type="button" onClick={() => aksi(() => api.nonaktifkanDokumen(d.id), "Gagal menonaktifkan")}>Nonaktifkan</button>
                        )}
                        {bolehKelola && d.diunggah_oleh !== "sistem" && (
                          <button className="wg-tombol kecil bahaya" type="button" onClick={() => window.confirm(`Hapus "${d.judul}" beserta semua potongannya?`) && aksi(() => api.hapusDokumen(d.id), "Gagal menghapus")}>Hapus</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
