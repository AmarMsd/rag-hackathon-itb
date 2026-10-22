import React, { useState } from "react";
import { api } from "../api.js";
import { Kelas } from "../components/Unsur.jsx";
import { labelKondisi } from "../kondisi.js";

function tanggal(t) {
  return t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

function Usulan({ wo, bolehPutus, onPutus, onBukaWesel }) {
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const [kirim, setKirim] = useState(null);
  const eskalasi = wo.jenis === "ESKALASI";
  const terbuka = wo.status?.startsWith("MENUNGGU");

  async function putus(aksi) {
    if (aksi === "tolak" && !catatan.trim()) {
      setGalat("Tulis alasan penolakan. Alasan ini dibaca agen pada analisis berikutnya.");
      return;
    }
    setKirim(aksi);
    setGalat("");
    try {
      await api.putuskan(wo.id, aksi, catatan.trim());
      onPutus();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setKirim(null);
    }
  }

  return (
    <article className="wg-wo">
      <div className="kepala">
        {eskalasi ? <span className="wg-label eskalasi">Eskalasi</span> : <Kelas kelas={wo.kelas} />}
        <button type="button" className="wg-tautan wg-id" style={{ color: "var(--ink)", textDecoration: "none" }} onClick={() => onBukaWesel(wo.wesel_id)}>
          {wo.wesel_id}
        </button>
        {!eskalasi && <span>{labelKondisi(wo.kondisi)}</span>}
        <small>{wo.id}, dibuat {tanggal(wo.dibuat)}</small>
      </div>
      <h3>{eskalasi ? wo.alasan : wo.ringkasan}</h3>
      {wo.langkah && (
        <div className="langkah">
          <b>Langkah pemeriksaan ({wo.rujukan})</b>
          {wo.langkah}
        </div>
      )}
      {terbuka ? (
        bolehPutus ? (
          <>
            <div className="aksi">
              <textarea className="wg-input" placeholder={eskalasi ? "Catatan untuk teknisi ahli" : "Catatan petugas, wajib bila menolak"} value={catatan} onChange={(e) => setCatatan(e.target.value)} aria-label={`Catatan untuk ${wo.id}`} />
              <button type="button" className="wg-tombol setuju" disabled={!!kirim} onClick={() => putus("setujui")}>
                {kirim === "setujui" ? "Menyimpan" : eskalasi ? "Terima eskalasi" : "Setujui"}
              </button>
              <button type="button" className="wg-tombol bahaya" disabled={!!kirim} onClick={() => putus("tolak")}>
                {kirim === "tolak" ? "Menyimpan" : "Tolak"}
              </button>
            </div>
            {galat && <p className="wg-galat" role="alert">{galat}</p>}
          </>
        ) : (
          <p className="putusan">Menunggu keputusan petugas.</p>
        )
      ) : (
        <p className="putusan">
          <b>{wo.status === "DISETUJUI" ? "Disetujui" : wo.status === "DITOLAK" ? "Ditolak" : wo.status}</b>
          {wo.diputuskan_oleh ? ` oleh ${wo.diputuskan_oleh}` : ""}
          {wo.catatan_petugas ? `: ${wo.catatan_petugas}` : "."}
        </p>
      )}
    </article>
  );
}

export default function WorkOrdersPage({ workOrders = [], onRefresh, user, onNavigate }) {
  const [tab, setTab] = useState("menunggu");
  const bolehPutus = user?.peran === "admin" || user?.peran === "petugas";
  const menunggu = workOrders.filter((w) => w.status?.startsWith("MENUNGGU"));
  const selesai = workOrders.filter((w) => !w.status?.startsWith("MENUNGGU"));
  const daftar = tab === "menunggu" ? menunggu : selesai;

  return (
    <section className="wg-panel" aria-label="Keputusan work order">
      <header>
        <h2>Usulan dari agen</h2>
        <p>Agen hanya mengusulkan. Work order berlaku setelah petugas menyetujuinya, dan keputusan masuk riwayat wesel.</p>
      </header>
      <div className="wg-tab" role="tablist" style={{ padding: "0 20px" }}>
        <button role="tab" aria-selected={tab === "menunggu"} onClick={() => setTab("menunggu")}>Menunggu ({menunggu.length})</button>
        <button role="tab" aria-selected={tab === "selesai"} onClick={() => setTab("selesai")}>Sudah diputuskan ({selesai.length})</button>
      </div>
      {daftar.length === 0 ? (
        <p className="wg-kosong">
          {tab === "menunggu"
            ? "Tidak ada usulan yang menunggu. Usulan baru muncul setelah agen menganalisis wesel yang tidak normal."
            : "Belum ada keputusan yang tercatat."}
        </p>
      ) : (
        daftar.map((wo) => (
          <Usulan key={wo.id} wo={wo} bolehPutus={bolehPutus} onPutus={onRefresh} onBukaWesel={(id) => onNavigate("detail", { weselId: id })} />
        ))
      )}
    </section>
  );
}
