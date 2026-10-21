import React from "react";

// Nama langkah dalam bahasa petugas. Nama tool aslinya tetap ditampilkan kecil.
const NAMA_TOOL = {
  prioritas_wesel: "Menyusun prioritas semua wesel",
  deteksi_anomali: "Membaca hasil lapis 1",
  tren_wesel: "Melihat tren indeks harian",
  cari_manual: "Mencari subbab manual contoh",
  cari_dokumen: "Mencari di dokumen pengetahuan",
  cari_regulasi: "Mencari ketentuan PM 10/2011 dan PM 32/2011",
  cek_riwayat: "Membaca riwayat keputusan petugas",
  nilai_urgensi: "Menentukan klasifikasi urgensi (Bab 4)",
  buat_work_order: "Menyusun usulan work order",
  eskalasi: "Meminta teknisi ahli",
};

function ringkasMasukan(d) {
  if (!d || typeof d !== "object") return null;
  const isi = Object.entries(d).map(([k, v]) => `${k.replaceAll("_", " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  return isi.length ? isi.join("; ") : null;
}

function ringkasHasil(tool, h) {
  if (!h || typeof h !== "object") return String(h ?? "");
  if (h.status === "error" || h.status === "kosong") return h.pesan || h.status;
  if (tool === "deteksi_anomali") return `${h.status_wesel}, kandidat ${String(h.kondisi_kandidat || "").replaceAll("_", " ")}, indeks ${h.indeks_kesehatan}, skor ${h.skor_kecocokan}`;
  if (tool === "cari_manual" || tool === "cari_dokumen") return (h.hasil || []).map((s) => `${s.id || s.halaman || ""} ${s.judul}`.trim()).join("; ");
  if (tool === "nilai_urgensi") return `Klasifikasi ${h.kelas}, tenggat ${h.tenggat}. ${h.alasan || ""}`;
  if (tool === "buat_work_order") return `${h.work_order?.id} dibuat, menunggu persetujuan petugas`;
  if (tool === "eskalasi") return `${h.eskalasi?.id} dibuat, menunggu teknisi ahli`;
  if (tool === "cek_riwayat") return `${h.jumlah} kejadian sebelumnya`;
  if (tool === "prioritas_wesel") return `${h.jumlah} wesel diurutkan`;
  return h.pesan || h.status || "";
}

export default function LogAgen({ langkah }) {
  if (!langkah?.length) return null;
  const gabung = [];
  for (const l of langkah) {
    if (l.jenis === "hasil") {
      const cocok = [...gabung].reverse().find((g) => g.tool === l.tool && g.hasil === undefined);
      if (cocok) { cocok.hasil = l.data; continue; }
    }
    gabung.push({ tool: l.tool, masukan: l.jenis === "panggil" ? l.data : null, hasil: l.jenis === "hasil" ? l.data : undefined, catatan: l.jenis === "catatan" ? l.data : null });
  }
  return (
    <ol className="wg-langkah" aria-label="Langkah agen">
      {gabung.map((g, i) =>
        g.catatan ? (
          <li key={i}><span className="judul">Catatan agen</span><span className="hasil">{g.catatan}</span></li>
        ) : (
          <li key={i}>
            <span className="judul">{NAMA_TOOL[g.tool] || g.tool}<code>{g.tool}</code></span>
            {ringkasMasukan(g.masukan) && <span className="masukan">Masukan: {ringkasMasukan(g.masukan)}</span>}
            {g.hasil !== undefined && (
              <details>
                <summary>{ringkasHasil(g.tool, g.hasil) || "Lihat hasil"}</summary>
                <pre>{JSON.stringify(g.hasil, null, 2)}</pre>
              </details>
            )}
          </li>
        )
      )}
    </ol>
  );
}
