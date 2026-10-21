import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";

const CONTOH = [
  "Wesel mana yang harus segera ditangani hari ini?",
  "Berapa batas waktu perpindahan wesel menurut PM 10/2011?",
  "Apa langkah pemeriksaan bila wesel macet?",
];

function tgl(t) {
  return t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

export default function TanyaAgenPage({ initialSessionId = null, initialPrompt = null, initialHistory = null, isAgentActive = true }) {
  const [jenis, setJenis] = useState("chat");
  const [daftar, setDaftar] = useState([]);
  const [permanen, setPermanen] = useState(true);
  const [sesi, setSesi] = useState(initialSessionId);
  const [pesan, setPesan] = useState(initialHistory || []);
  const [isian, setIsian] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [ubahJudul, setUbahJudul] = useState(null);
  const akhir = useRef(null);

  const muatDaftar = () => api.percakapan(jenis).then((r) => { setDaftar(r.percakapan || []); setPermanen(r.permanen !== false); }).catch(() => {});
  useEffect(() => { muatDaftar(); }, [jenis]);
  useEffect(() => { if (initialPrompt) kirim(initialPrompt); }, [initialPrompt]);
  useEffect(() => { akhir.current?.scrollIntoView({ block: "end" }); }, [pesan, sibuk]);

  async function buka(id) {
    if (sibuk || id === sesi) return;
    setSesi(id);
    setSibuk(true);
    try {
      const d = await api.isiPercakapan(id);
      setPesan(d.pesan?.length ? d.pesan : [{ dari: "agen", teks: d.cuplikan || "" }]);
    } catch (err) {
      setPesan([{ dari: "galat", teks: err.message }]);
    } finally {
      setSibuk(false);
    }
  }

  function baru() {
    setSesi(null);
    setPesan([]);
  }

  async function kirim(teks) {
    const t = (teks ?? isian).trim();
    if (!t || sibuk || !isAgentActive) return;
    setIsian("");
    setSibuk(true);
    setPesan((p) => [...p, { dari: "petugas", teks: t }]);
    try {
      const r = await api.chat(t, sesi || undefined);
      if (r.session_id) setSesi(r.session_id);
      setPesan((p) => [...p, { dari: "agen", teks: r.jawaban, langkah: r.langkah }]);
      muatDaftar();
    } catch (err) {
      setPesan((p) => [...p, { dari: "galat", teks: err.message }]);
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(id) {
    if (!window.confirm("Hapus percakapan ini?")) return;
    await api.hapusPercakapan(id).catch(() => {});
    if (id === sesi) baru();
    muatDaftar();
  }

  async function simpanJudul(e) {
    e.preventDefault();
    if (!ubahJudul?.judul.trim()) return;
    await api.ubahJudulPercakapan(ubahJudul.id, ubahJudul.judul.trim()).catch(() => {});
    setUbahJudul(null);
    muatDaftar();
  }

  return (
    <div className="wg-chat">
      <section className="wg-panel wg-chat-daftar" aria-label="Riwayat percakapan">
        <header>
          <h2>Percakapan</h2>
          <button type="button" className="wg-tombol kecil wg-kanan" onClick={baru}>Percakapan baru</button>
        </header>
        <div className="wg-tab" role="tablist" style={{ padding: "0 12px" }}>
          <button role="tab" aria-selected={jenis === "chat"} onClick={() => setJenis("chat")}>Tanya jawab</button>
          <button role="tab" aria-selected={jenis === "analisis"} onClick={() => setJenis("analisis")}>Analisis wesel</button>
        </div>
        {!permanen && <p className="wg-catatan">Percakapan hanya disimpan di memori server dan hilang saat server dijalankan ulang.</p>}
        {daftar.length === 0 ? <p className="wg-kosong">Belum ada percakapan.</p> : (
          <ul>
            {daftar.map((c) => (
              <li key={c.id} aria-current={c.id === sesi ? "true" : undefined}>
                {ubahJudul?.id === c.id ? (
                  <form onSubmit={simpanJudul} className="wg-baris-aksi">
                    <input className="wg-input" autoFocus value={ubahJudul.judul} onChange={(e) => setUbahJudul({ ...ubahJudul, judul: e.target.value })} style={{ flex: 1 }} aria-label="Judul percakapan" />
                    <button className="wg-tombol kecil" type="submit">Simpan</button>
                  </form>
                ) : (
                  <>
                    <button type="button" className="judul" onClick={() => buka(c.id)}>
                      <b>{c.judul}</b>
                      <span>{tgl(c.diperbarui)}, {c.jumlah_pesan} pesan</span>
                    </button>
                    <span className="aksi">
                      <button type="button" className="wg-tautan" onClick={() => setUbahJudul({ id: c.id, judul: c.judul })}>Ubah judul</button>
                      <button type="button" className="wg-tautan" style={{ color: "var(--merah)" }} onClick={() => hapus(c.id)}>Hapus</button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wg-panel wg-chat-utas" aria-label="Percakapan dengan agen">
        <div className="wg-chat-pesan" aria-live="polite">
          {pesan.length === 0 && (
            <div className="wg-chat-awal">
              <p>Agen menjawab dari hasil lapis 1, manual contoh, dokumen aktif, dan riwayat keputusan. Agen tidak bisa mengubah work order tanpa petugas.</p>
              <div className="wg-baris-aksi">
                {CONTOH.map((c) => <button key={c} type="button" className="wg-tombol kecil" disabled={!isAgentActive} onClick={() => kirim(c)}>{c}</button>)}
              </div>
            </div>
          )}
          {pesan.map((m, i) => (
            <div key={i} className={`wg-gelembung ${m.dari}`}>
              {m.dari === "agen" ? (
                <>
                  <Teks isi={m.teks || "Agen tidak memberi jawaban akhir."} />
                  <LogAgen langkah={m.langkah} />
                </>
              ) : m.teks}
            </div>
          ))}
          {sibuk && <p className="wg-sedang">Agen sedang bekerja</p>}
          <div ref={akhir} />
        </div>
        <form className="wg-chat-isian" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
          <textarea
            className="wg-input"
            rows={2}
            placeholder={isAgentActive ? "Tulis pertanyaan untuk agen" : "Agen sedang dihentikan petugas"}
            value={isian}
            disabled={!isAgentActive}
            onChange={(e) => setIsian(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); kirim(); } }}
            aria-label="Pertanyaan"
          />
          <button className="wg-tombol utama" type="submit" disabled={sibuk || !isAgentActive || !isian.trim()}>Kirim</button>
        </form>
      </section>
    </div>
  );
}
