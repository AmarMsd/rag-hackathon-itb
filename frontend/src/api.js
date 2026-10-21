// Klien API gateway WeselGuard. Semua data berasal dari server di Raspberry Pi.
// Tidak ada data cadangan: kalau gateway tidak terjangkau, halaman menampilkan pesan
// putus koneksi, bukan data contoh.

async function minta(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { "Content-Type": "application/json", ...(options.headers || {}) };

  let res;
  try {
    res = await fetch(`/api${path}`, { credentials: "include", ...options, headers });
  } catch {
    const err = new Error("Gateway tidak terjangkau. Periksa jaringan ke Raspberry Pi.");
    err.status = 0;
    throw err;
  }
  const isi = await res.json().catch(() => ({}));
  if (!res.ok) {
    let pesan = isi.detail || `Server membalas ${res.status}`;
    if (res.status === 403 && !isi.detail) pesan = "Akun ini tidak punya izin untuk tindakan tersebut.";
    if (res.status === 503 && !isi.detail) pesan = "Agen tidak bisa menghubungi model.";
    const err = new Error(pesan);
    err.status = res.status;
    err.detail = isi.detail || pesan;
    throw err;
  }
  return isi;
}

export const api = {
  // 1. Otentikasi & Akun Saya
  login: (username, password) =>
    minta("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => minta("/logout", { method: "POST" }),
  saya: () => minta("/saya"),
  gantiSandi: (password_lama, password_baru) =>
    minta("/saya/ganti-sandi", {
      method: "POST",
      body: JSON.stringify({ password_lama, password_baru }),
    }),

  // 2. Pemantauan Wesel & Telemetri
  wesel: () => minta("/wesel"),
  tren: (id, hari = 14) => minta(`/wesel/${id}/tren?hari=${hari}`),
  analisis: (id) => minta(`/wesel/${id}/analisis`, { method: "POST" }),
  riwayat: (id) => minta(`/riwayat/${id}`),

  // 3. Agen AI & Obrolan
  chat: (pesan, session_id) =>
    minta("/chat", { method: "POST", body: JSON.stringify({ pesan, session_id }) }),
  agen: () => minta("/agen"),
  ubahAgen: (aksi) => minta(`/agen/${aksi}`, { method: "POST" }),

  // 4. Riwayat Percakapan
  percakapan: (jenis = null, batas = 30, sebelum = null) =>
    minta(
      `/percakapan?${jenis ? `jenis=${jenis}&` : ""}batas=${batas}${
        sebelum ? `&sebelum=${encodeURIComponent(sebelum)}` : ""
      }`
    ),
  isiPercakapan: (session_id) => minta(`/percakapan/${session_id}`),
  ubahJudulPercakapan: (session_id, judul) =>
    minta(`/percakapan/${session_id}`, { method: "PATCH", body: JSON.stringify({ judul }) }),
  hapusPercakapan: (session_id) => minta(`/percakapan/${session_id}`, { method: "DELETE" }),
  hapusSemuaPercakapan: () => minta("/percakapan", { method: "DELETE" }),

  // 5. Antrean Keputusan (Work Orders)
  workOrders: () => minta("/work-orders"),
  putuskan: (id, aksi, catatan) =>
    minta(`/work-orders/${id}/${aksi}`, { method: "POST", body: JSON.stringify({ catatan }) }),

  // 6. Pencarian Gabungan
  cari: (q, jenis = "semua", batas = 5) =>
    minta(`/cari?q=${encodeURIComponent(q)}&jenis=${jenis}&batas=${batas}`),

  // 7. Indikator Koneksi
  koneksi: (paksa = false) => minta(`/koneksi?paksa=${paksa}`),

  // 8. Laporan Harian & Unduh
  laporan: (tanggal = null) =>
    minta(`/laporan${tanggal ? `?tanggal=${encodeURIComponent(tanggal)}` : ""}`),
  unduhLaporanUrl: (tanggal = null, format = "md") =>
    `/api/laporan/unduh?format=${format}${tanggal ? `&tanggal=${encodeURIComponent(tanggal)}` : ""}`,

  // 9. Notifikasi
  notifikasi: (belum_dibaca = false, batas = 30, sebelum_id = null) =>
    minta(
      `/notifikasi?belum_dibaca=${belum_dibaca}&batas=${batas}${
        sebelum_id ? `&sebelum_id=${sebelum_id}` : ""
      }`
    ),
  notifikasiJumlah: () => minta("/notifikasi/jumlah"),
  notifikasiBacaSemua: () => minta("/notifikasi/baca-semua", { method: "POST" }),
  notifikasiBaca: (id) => minta(`/notifikasi/${id}/baca`, { method: "POST" }),

  // 10. Dokumen Pengetahuan (Pengelola & Admin)
  dokumen: (status = null, kategori = null) => {
    const params = new URLSearchParams();
    if (status && status !== "semua") params.set("status", status);
    if (kategori && kategori !== "semua") params.set("kategori", kategori);
    const qs = params.toString();
    return minta(`/dokumen${qs ? `?${qs}` : ""}`);
  },
  detailDokumen: (id, mulai = 0, jumlah = 10) =>
    minta(`/dokumen/${id}?mulai=${mulai}&jumlah=${jumlah}`),
  ujiDokumen: (id, q) => minta(`/dokumen/${id}/uji?q=${encodeURIComponent(q)}`),
  unggahDokumen: (formData) =>
    minta("/dokumen", {
      method: "POST",
      body: formData,
    }),
  aktifkanDokumen: (id) => minta(`/dokumen/${id}/aktifkan`, { method: "POST" }),
  nonaktifkanDokumen: (id) => minta(`/dokumen/${id}/nonaktifkan`, { method: "POST" }),
  hapusDokumen: (id) => minta(`/dokumen/${id}`, { method: "DELETE" }),
  unduhDokumenUrl: (id) => `/api/dokumen/${id}/unduh`,

  // 11. Kelola Akun & Audit (Admin)
  pengguna: () => minta("/pengguna"),
  auditPengguna: (batas = 50) => minta(`/pengguna/audit?batas=${batas}`),
  tambahPengguna: (data) =>
    minta("/pengguna", { method: "POST", body: JSON.stringify(data) }),
  ubahPengguna: (username, data) =>
    minta(`/pengguna/${username}`, { method: "PATCH", body: JSON.stringify(data) }),
  aturPengguna: (username, aksi, data = null) =>
    minta(`/pengguna/${username}/${aksi}`, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
};
