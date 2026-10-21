import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";
import { Lampu, Status, Indeks, Kelas } from "../components/Unsur.jsx";
import { KondisiSel } from "./BerandaPage.jsx";
import { barisCiri, labelKondisi, labelSumber, lampu, waktuRelatif } from "../kondisi.js";

function angka(v, d = 1) {
  return v === null || v === undefined ? "–" : Number(v).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Kalimat penjelasan dari hasil lapis 1. Hanya merangkai angka yang dikirim server.
function alasanLapis1(w) {
  const dur = w.ciri?.durasi_siklus_s;
  if (w.status === "Tidak dikenal") {
    const kandidat = w.kondisi_kandidat && w.kondisi_kandidat !== "tidak_dikenal"
      ? ` Kandidat terdekat, ${labelKondisi(w.kondisi_kandidat).toLowerCase()}, hanya cocok ${angka(w.skor_kecocokan, 2)} (ambang 0,6).`
      : "";
    return `Bentuk siklus tidak cocok dengan pola yang dikenal lapis 1.${kandidat} Sesuai manual subbab 3.3, agen tidak menebak penyebab dan meminta teknisi ahli.`;
  }
  if (w.status === "Normal") return "Ciri siklus terakhir sesuai profil normal wesel ini.";
  if (w.status === "Waspada tren") {
    return `Indeks masih di atas batas B (70), tetapi turun ${angka(Math.abs(w.tren?.laju_per_hari), 2)} poin per hari dari ${angka(w.tren?.indeks_tertinggi)}.`;
  }
  const bagian = [`Kandidat kondisi ${labelKondisi(w.kondisi_kandidat).toLowerCase()}, skor kecocokan ${angka(w.skor_kecocokan, 2)}.`];
  if (dur > 5) bagian.push(`Durasi ${angka(dur, 2)} dtk melewati batas 5 dtk PM 10/2011.`);
  bagian.push(w.indeks_kesehatan < 40 ? "Indeks di bawah batas A (40)." : "Indeks di bawah batas B (70).");
  return bagian.join(" ");
}

function GrafikTren({ tren }) {
  if (!tren) return <p className="wg-sedang">Memuat tren</p>;
  const data = tren.harian || [];
  if (data.length < 2) {
    return (
      <p className="wg-kosong" style={{ padding: 0 }}>
        <b>Belum cukup data harian.</b>
        Tren dihitung dari rata-rata indeks per hari dan butuh minimal 3 hari. Wesel ini baru punya {data.length} hari data.
      </p>
    );
  }
  const L = 900, T = 240, kiri = 34, bawah = 26, atas = 10;
  const x = (i) => kiri + (i * (L - kiri - 10)) / (data.length - 1);
  const y = (v) => atas + ((100 - v) * (T - atas - bawah)) / 100;
  const titik = data.map((d, i) => `${x(i)},${y(d.indeks_rata)}`).join(" ");
  const label = (t) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return (
    <>
      <div className="tren-ringkas">
        <span>Laju <b>{tren.laju_per_hari === null ? "–" : `${angka(tren.laju_per_hari, 2)} poin/hari`}</b></span>
        <span>Tertinggi <b>{angka(tren.indeks_tertinggi)}</b></span>
        <span>Hari ini <b>{angka(tren.indeks_hari_ini)}</b></span>
        {tren.perkiraan_hari_ke_batas_B && (
          <span>Menyentuh batas B dalam <b>{tren.perkiraan_hari_ke_batas_B} hari</b> bila laju tetap (perkiraan kasar)</span>
        )}
      </div>
      <svg viewBox={`0 0 ${L} ${T}`} role="img" aria-label={`Indeks harian dari ${data[0].indeks_rata} ke ${data[data.length - 1].indeks_rata}`}>
        {[0, 40, 70, 100].map((v) => (
          <g key={v}>
            <line className={v === 70 ? "batas-B" : v === 40 ? "batas-A" : "sumbu"} x1={kiri} x2={L - 10} y1={y(v)} y2={y(v)} />
            <text x={kiri - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <polyline className="garis" points={titik} />
        {data.map((d, i) => <circle key={d.tanggal} className="titik" cx={x(i)} cy={y(d.indeks_rata)} r="3.5"><title>{`${d.tanggal}: ${d.indeks_rata}`}</title></circle>)}
        {data.map((d, i) => (i === 0 || i === data.length - 1 || i % 3 === 0) && (
          <text key={`l${d.tanggal}`} x={x(i)} y={T - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>{label(d.tanggal)}</text>
        ))}
      </svg>
    </>
  );
}

export default function DetailWeselPage({ wesel, pilihan, onPilih, agen, user, onSelesaiAnalisis }) {
  const w = wesel.find((x) => x.wesel_id === pilihan) || wesel[0];
  const id = w?.wesel_id;
  const [tren, setTren] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [analisis, setAnalisis] = useState({});
  const [sedang, setSedang] = useState(null);

  useEffect(() => {
    if (!id) return;
    setTren(null);
    api.tren(id, 14).then(setTren).catch(() => setTren({ harian: [] }));
    api.riwayat(id).then(setRiwayat).catch(() => setRiwayat([]));
  }, [id]);

  if (!w) return <section className="wg-panel wg-kosong"><b>Belum ada wesel.</b>Wesel muncul setelah siklus pertamanya masuk.</section>;

  const bolehAnalisis = (user?.peran === "admin" || user?.peran === "petugas") && agen.aktif;
  const hasil = analisis[id];

  async function jalankan() {
    setSedang(id);
    setAnalisis((a) => ({ ...a, [id]: null }));
    try {
      const r = await api.analisis(id);
      setAnalisis((a) => ({ ...a, [id]: r }));
      onSelesaiAnalisis?.();
    } catch (err) {
      setAnalisis((a) => ({ ...a, [id]: { galat: err.message } }));
    } finally {
      setSedang(null);
    }
  }

  const jam = w.siklus_terakhir ? new Date(w.siklus_terakhir).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <>
      <nav className="wg-pilih-wesel" aria-label="Pilih wesel">
        {wesel.map((x) => (
          <button key={x.wesel_id} type="button" aria-pressed={x.wesel_id === id} onClick={() => onPilih(x.wesel_id)}>
            <Lampu status={x.status} />
            {x.wesel_id}
          </button>
        ))}
      </nav>

      <section className="wg-panel wg-kepala-wesel" aria-label={`Ringkasan ${id}`}>
        <Lampu status={w.status} besar />
        <h2>{id}</h2>
        <div className="ringkas">
          <Status status={w.status} lampu={false} />
          <span>
            {labelSumber(w.sumber)}. Siklus terakhir {waktuRelatif(w.menit_sejak_siklus_terakhir)}{jam ? ` (${jam})` : ""}.
          </span>
        </div>
        <button type="button" className="wg-tombol utama" onClick={jalankan} disabled={!bolehAnalisis || sedang === id}
          title={!agen.aktif ? "Agen sedang dihentikan" : !bolehAnalisis ? "Hanya admin dan petugas" : undefined}>
          {sedang === id ? "Agen sedang menganalisis" : "Analisis dengan agen"}
        </button>
      </section>

      <div className="wg-dua" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <section className="wg-panel" aria-labelledby="judul-l1">
          <header><h2 id="judul-l1">Hasil lapis 1</h2><p>Dihitung kode, bukan LLM</p></header>
          <div className="wg-panel-isi">
            <dl className="wg-dl">
              <dt>Kondisi</dt><dd><KondisiSel w={w} /></dd>
              <dt>Indeks kesehatan</dt><dd><Indeks nilai={w.indeks_kesehatan} /></dd>
              <dt>Skor kecocokan</dt><dd>{angka(w.skor_kecocokan, 2)}</dd>
            </dl>
            <p className={`wg-alasan ${lampu(w.status)}`}>{alasanLapis1(w)}</p>
          </div>
        </section>

        <section className="wg-panel" aria-labelledby="judul-ciri">
          <header><h2 id="judul-ciri">Ciri siklus terakhir</h2></header>
          <table className="wg-tabel">
            <thead><tr><th>Ciri</th><th>Nilai</th><th>Acuan</th></tr></thead>
            <tbody>
              {barisCiri(w).map((b) => (
                <tr key={b.nama}>
                  <td>{b.nama}</td>
                  <td className={b.lewat ? "wg-lewat" : ""}><b>{b.nilai}</b></td>
                  <td className="wg-redup">{b.acuan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="wg-panel" aria-labelledby="judul-agen">
        <header>
          <h2 id="judul-agen">Analisis agen</h2>
          <p>Agen membaca hasil lapis 1, manual, dan riwayat. Usulannya baru berlaku setelah disetujui petugas.</p>
        </header>
        <div className="wg-panel-isi">
          {sedang === id && <p className="wg-sedang">Agen sedang bekerja. Langkahnya tampil setelah selesai.</p>}
          {!sedang && !hasil && (
            <p className="wg-redup" style={{ margin: 0 }}>
              {bolehAnalisis ? "Belum ada analisis untuk wesel ini di sesi ini." : !agen.aktif ? "Agen sedang dihentikan petugas." : "Akun ini tidak bisa menjalankan analisis."}
            </p>
          )}
          {hasil?.galat && <p className="wg-galat" role="alert">{hasil.galat}</p>}
          {hasil?.jawaban !== undefined && (
            <div className="wg-jawaban">
              <Teks isi={hasil.jawaban || "Agen tidak memberi jawaban akhir."} />
              <LogAgen langkah={hasil.langkah} />
            </div>
          )}
        </div>
      </section>

      <section className="wg-panel wg-grafik" aria-labelledby="judul-tren">
        <header><h2 id="judul-tren">Tren indeks harian</h2><p>Garis putus: batas B (70) dan A (40)</p></header>
        <div className="wg-panel-isi"><GrafikTren tren={tren} /></div>
      </section>

      <section className="wg-panel" aria-labelledby="judul-riwayat">
        <header><h2 id="judul-riwayat">Riwayat keputusan</h2><p>Dibaca agen lewat cek_riwayat</p></header>
        {riwayat.length === 0 ? (
          <p className="wg-kosong">Belum ada work order yang diputuskan untuk {id}.</p>
        ) : (
          <div className="wg-tabel-bungkus">
            <table className="wg-tabel">
              <thead><tr><th>Tanggal</th><th>Kondisi</th><th>Kelas</th><th>Keputusan</th><th>Catatan</th></tr></thead>
              <tbody>
                {riwayat.map((r, i) => (
                  <tr key={i}>
                    <td>{r.tanggal}</td>
                    <td>{labelKondisi(r.kondisi)}</td>
                    <td><Kelas kelas={r.kelas} /></td>
                    <td>{r.keputusan_petugas}</td>
                    <td className="wg-redup">{r.catatan}</td>
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
