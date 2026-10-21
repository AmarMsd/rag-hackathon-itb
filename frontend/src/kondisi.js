// Satu tempat untuk nama kondisi, status, dan sumber data.
// Kondisi yang belum terdaftar di sini tetap ditampilkan apa adanya, tidak pernah diganti "Normal".

export const LABEL_KONDISI = {
  normal: "Normal",
  bantalan_aus: "Bantalan aus",
  poros_tidak_sejajar: "Poros tidak sejajar",
  perpindahan_melambat: "Perpindahan melambat",
  perpindahan_lambat: "Perpindahan lambat",
  macet: "Macet",
  slip: "Slip lalu kembali",
  penguncian_tidak_sempurna: "Penguncian tidak sempurna",
  tidak_dikenal: "Pola tidak dikenal",
};

export function labelKondisi(k) {
  if (!k) return "–";
  return LABEL_KONDISI[k] || k.replaceAll("_", " ");
}

// Urutan dari yang paling mendesak. Kelas CSS menentukan warna lampu.
export const STATUS = {
  Bahaya: { urut: 0, lampu: "merah" },
  "Tidak dikenal": { urut: 1, lampu: "lunar" },
  Waspada: { urut: 2, lampu: "kuning" },
  "Waspada tren": { urut: 3, lampu: "kuning-cincin" },
  Normal: { urut: 4, lampu: "hijau" },
};

export function lampu(status) {
  return STATUS[status]?.lampu || "mati";
}

export function urutkanWesel(list) {
  return [...list].sort(
    (a, b) =>
      (STATUS[a.status]?.urut ?? 9) - (STATUS[b.status]?.urut ?? 9) ||
      (a.indeks_kesehatan ?? 100) - (b.indeks_kesehatan ?? 100)
  );
}

export const LABEL_SUMBER = {
  rig: "Rig (LoRa)",
  simulasi: "Simulasi",
  kaist: "Replay KAIST",
};

export function labelSumber(s) {
  return LABEL_SUMBER[s] || s || "–";
}

// Ciri yang ditampilkan per sumber. Satuan RMS berbeda per sensor, jadi tidak ada ambang tetap.
export function barisCiri(w) {
  const c = w?.ciri || {};
  const rig = w?.sumber === "rig";
  const angka = (v, d = 2) =>
    v === null || v === undefined ? "–" : Number(v).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
  const baris = [
    {
      nama: "Durasi siklus",
      nilai: c.durasi_siklus_s === undefined ? "–" : `${angka(c.durasi_siklus_s)} dtk`,
      acuan: "Batas PM 10/2011: 5 dtk",
      lewat: c.durasi_siklus_s > 5,
    },
  ];
  if (rig) {
    baris.push(
      { nama: "Jumlah semburan", nilai: c.nseg ?? "–", acuan: "Normal 1, slip 2, penguncian 4" },
      { nama: "Fraksi aktif", nilai: angka(c.aktif), acuan: "1,00 berarti bergetar tanpa jeda" }
    );
  }
  baris.push(
    { nama: "Kurtosis", nilai: angka(c.kurtosis), acuan: rig ? "Getaran motor bersih sekitar 1,6" : "Dibandingkan profil normal wesel ini" },
    { nama: "RMS", nilai: `${angka(c.rms, 3)} ${rig ? "g" : ""}`.trim(), acuan: "Dibandingkan profil normal wesel ini" },
    { nama: "Puncak frekuensi", nilai: c.puncak_frekuensi_hz === undefined ? "–" : `${angka(c.puncak_frekuensi_hz, 0)} Hz`, acuan: rig ? "Tidak dipakai model rig" : "Pembeda gejala di manual Bab 3" }
  );
  return baris;
}

export function waktuRelatif(menit) {
  if (menit === null || menit === undefined) return "–";
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

export const PERAN = {
  admin: "Admin",
  petugas: "Petugas",
  pengelola: "Pengelola dokumen",
  pengamat: "Pengamat",
};
