import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Status, Kelas } from "../components/Unsur.jsx";

const hariIni = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD waktu lokal

function angka(v, d = 1) {
  return v === null || v === undefined ? "–" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: d });
}

export default function LaporanHarianPage() {
  const [tanggal, setTanggal] = useState(hariIni());
  const [lap, setLap] = useState(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    setLap(null);
    setGalat("");
    api.laporan(tanggal).then(setLap).catch((e) => setGalat(e.message));
  }, [tanggal]);

  const r = lap?.ringkasan || {};
  const perWesel = lap?.per_wesel || [];

  return (
    <>
      <section className="wg-panel">
        <header>
          <h2>Ringkasan {lap ? new Date(lap.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}</h2>
          <p>{lap ? `Status diambil dari ${lap.status_dari}.` : ""}</p>
          <div className="wg-kanan wg-baris-aksi">
            <input className="wg-input" type="date" value={tanggal} max={hariIni()} onChange={(e) => setTanggal(e.target.value)} aria-label="Tanggal laporan" />
            <a className="wg-tombol" href={api.unduhLaporanUrl(tanggal, "md")}>Unduh Markdown</a>
            <a className="wg-tombol" href={api.unduhLaporanUrl(tanggal, "csv")}>Unduh CSV</a>
          </div>
        </header>
        {galat && <p className="wg-galat wg-panel-isi" role="alert">{galat}</p>}
        {!lap && !galat && <p className="wg-sedang wg-panel-isi">Menyusun laporan</p>}
        {lap && (
          <dl className="wg-angka-ringkas">
            <div><dt>Wesel dipantau</dt><dd>{r.wesel_dipantau ?? 0}</dd></div>
            <div><dt>Siklus tercatat</dt><dd>{r.total_siklus ?? 0}</dd></div>
            <div><dt>Siklus tidak normal</dt><dd>{r.siklus_anomali ?? 0}</dd></div>
            <div><dt>Usulan baru</dt><dd>{(r.work_order_baru || 0) + (r.eskalasi_baru || 0)}</dd><small>{r.work_order_baru || 0} work order, {r.eskalasi_baru || 0} eskalasi</small></div>
            <div><dt>Keputusan petugas</dt><dd>{(r.disetujui || 0) + (r.ditolak || 0)}</dd><small>{r.disetujui || 0} disetujui, {r.ditolak || 0} ditolak</small></div>
          </dl>
        )}
      </section>

      {lap && (
        <section className="wg-panel">
          <header><h2>Per wesel</h2></header>
          {perWesel.length === 0 ? (
            <p className="wg-kosong">Tidak ada siklus tercatat pada tanggal ini.</p>
          ) : (
            <div className="wg-tabel-bungkus">
              <table className="wg-tabel">
                <thead>
                  <tr><th>Wesel</th><th>Status</th><th className="wg-angka">Indeks rata-rata</th><th className="wg-angka">Terendah</th><th className="wg-angka">Siklus</th><th className="wg-angka">Tidak normal</th><th className="wg-angka">Laju per hari</th></tr>
                </thead>
                <tbody>
                  {perWesel.map((w) => (
                    <tr key={w.wesel_id}>
                      <td className="wg-id">{w.wesel_id}</td>
                      <td><Status status={w.status} /></td>
                      <td className="wg-angka">{angka(w.indeks_rata)}</td>
                      <td className="wg-angka">{angka(w.indeks_min)}</td>
                      <td className="wg-angka">{w.jumlah_siklus}</td>
                      <td className="wg-angka">{w.siklus_anomali ?? 0}</td>
                      <td className="wg-angka">{w.laju_per_hari === null || w.laju_per_hari === undefined ? "–" : angka(w.laju_per_hari, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {lap && (
        <div className="wg-dua" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <section className="wg-panel">
            <header><h2>Usulan agen hari itu</h2></header>
            {lap.work_order_baru.length === 0 ? <p className="wg-kosong">Tidak ada usulan.</p> : (
              <ul className="wg-antrean">
                {lap.work_order_baru.map((w) => (
                  <li key={w.id}>
                    <div className="baris1">
                      {w.jenis === "ESKALASI" ? <span className="wg-label eskalasi">Eskalasi</span> : <Kelas kelas={w.kelas} />}
                      <span className="wg-id">{w.wesel_id}</span><small>{w.id}</small>
                    </div>
                    <p>{w.ringkasan || w.alasan}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="wg-panel">
            <header><h2>Keputusan petugas hari itu</h2></header>
            {lap.keputusan_petugas.length === 0 ? <p className="wg-kosong">Belum ada keputusan.</p> : (
              <ul className="wg-antrean">
                {lap.keputusan_petugas.map((k) => (
                  <li key={k.id}>
                    <div className="baris1"><b>{k.status === "DISETUJUI" ? "Disetujui" : "Ditolak"}</b><span className="wg-id">{k.wesel_id}</span><small>{k.id}, oleh {k.diputuskan_oleh || "–"}</small></div>
                    {k.catatan_petugas && <p>{k.catatan_petugas}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
