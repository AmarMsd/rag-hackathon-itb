import {
  MOCK_WESEL,
  MOCK_WORK_ORDERS,
  MOCK_RIWAYAT,
  MOCK_TREN,
  MOCK_KONEKSI,
  MOCK_NOTIFIKASI,
  MOCK_LAPORAN_HARIAN,
  MOCK_PERCAKAPAN,
  MOCK_DOKUMEN,
  MOCK_PENGGUNA,
  MOCK_AUDIT,
} from "./mockData.js";

let simulatedWorkOrders = [...MOCK_WORK_ORDERS];
let simulatedAgentState = { aktif: true, berjalan: 0 };
let simulatedNotifikasi = [...MOCK_NOTIFIKASI];
let simulatedPercakapan = [...MOCK_PERCAKAPAN];
let simulatedDokumen = [...MOCK_DOKUMEN];
let simulatedPengguna = [...MOCK_PENGGUNA];
let simulatedAudit = [...MOCK_AUDIT];

// Akun simulasi untuk pengujian offline / dev
const SIMULATED_ACCOUNTS = {
  admin: { username: "admin", nama: "Maya Reyes", peran: "admin", sandi: "admin123" },
  petugas: { username: "petugas", nama: "Budi Santoso", peran: "petugas", sandi: "petugas123" },
  pengelola: { username: "pengelola", nama: "Eko Prasetyo", peran: "pengelola", sandi: "pengelola123" },
  pengamat: { username: "pengamat", nama: "Siti Pengamat", peran: "pengamat", sandi: "pengamat123" },
};

async function minta(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { "Content-Type": "application/json", ...(options.headers || {}) };

  try {
    const res = await fetch(`/api${path}`, {
      credentials: "include", // Kirim dan terima cookie sesi (wg_sesi)
      ...options,
      headers,
    });
    const isi = await res.json().catch(() => ({}));
    if (!res.ok) {
      let pesan = isi.detail || `Server membalas ${res.status}`;
      if (res.status === 403 && !isi.detail) {
        pesan = "Anda tidak memiliki izin untuk melakukan tindakan ini.";
      } else if (res.status === 503 && !isi.detail) {
        pesan = "Agen tidak bisa menghubungi model.";
      }
      const err = new Error(pesan);
      err.status = res.status;
      err.detail = isi.detail || pesan;
      throw err;
    }
    api.isOffline = false;
    return isi;
  } catch (err) {
    // Jika server membalas dengan status HTTP error (401, 403, 404, 409, 410, 503), teruskan error
    if (err.status) {
      throw err;
    }

    // Jika koneksi gateway benar-benar putus (NetworkError / FetchError), jalankan mode simulasi
    api.isOffline = true;
    return fallbackHandler(path, options);
  }
}

function fallbackHandler(path, options = {}) {
  const method = options.method || "GET";

  // Login endpoint
  if (path === "/login" && method === "POST") {
    const body = options.body ? JSON.parse(options.body) : {};
    const u = (body.username || "").trim().toLowerCase();
    const p = body.password || "";
    const akun = SIMULATED_ACCOUNTS[u];

    if (!akun || akun.sandi !== p) {
      const err = new Error("Nama pengguna atau kata sandi salah.");
      err.status = 401;
      throw err;
    }

    const userData = { username: akun.username, nama: akun.nama, peran: akun.peran };
    sessionStorage.setItem("wg_sim_user", JSON.stringify(userData));
    return userData;
  }

  // Get current user from session
  if (path === "/saya" && method === "GET") {
    const sim = sessionStorage.getItem("wg_sim_user");
    if (!sim) {
      const err = new Error("Sesi habis atau belum masuk. Silakan masuk lagi.");
      err.status = 401;
      throw err;
    }
    return JSON.parse(sim);
  }

  // Logout endpoint
  if (path === "/logout" && method === "POST") {
    sessionStorage.removeItem("wg_sim_user");
    return { ok: true };
  }

  // Ganti sandi sendiri
  if (path === "/saya/ganti-sandi" && method === "POST") {
    const body = options.body ? JSON.parse(options.body) : {};
    if (!body.password_lama) {
      const err = new Error("Kata sandi lama salah.");
      err.status = 400;
      throw err;
    }
    if ((body.password_baru || "").length < 8) {
      const err = new Error("Kata sandi baru minimal 8 karakter.");
      err.status = 400;
      throw err;
    }
    return { ok: true, pesan: "Kata sandi diganti. Sesi di perangkat lain telah dikeluarkan." };
  }

  // Fitur: GET /api/cari?q=...&jenis=...&batas=...
  if (path.startsWith("/cari") && method === "GET") {
    const url = new URL(`http://dummy${path}`);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const batas = parseInt(url.searchParams.get("batas") || "5", 10);

    const hasilWesel = MOCK_WESEL.filter(
      (w) => w.wesel_id.toLowerCase().includes(q) || (w.lokasi && w.lokasi.toLowerCase().includes(q))
    ).slice(0, batas);

    const hasilWO = simulatedWorkOrders.filter(
      (wo) =>
        wo.id.toLowerCase().includes(q) ||
        wo.wesel_id.toLowerCase().includes(q) ||
        (wo.ringkasan && wo.ringkasan.toLowerCase().includes(q))
    ).slice(0, batas);

    const hasilDokumen = simulatedDokumen.filter(
      (d) => d.judul.toLowerCase().includes(q) || d.kategori.toLowerCase().includes(q)
    ).slice(0, batas);

    const hasilRegulasi = [
      { sumber: "PD 10A Bab IV", halaman: 12, cuplikan: "Toleransi celah lidah rel pada posisi merapat adalah 0 mm dan celah bebas minimal 55-65 mm." },
      { sumber: "Manual Perawatan Wesel Elektrik", halaman: 34, cuplikan: "Pemeriksaan berkala pelat bantalan luncur dan nilai getaran akselerometer RMS." },
    ].filter((r) => r.sumber.toLowerCase().includes(q) || r.cuplikan.toLowerCase().includes(q));

    const hasil = {
      wesel: hasilWesel,
      work_order: hasilWO,
      regulasi: hasilRegulasi,
      manual: [],
      riwayat: [],
      dokumen: hasilDokumen,
    };

    return {
      q,
      jumlah: hasilWesel.length + hasilWO.length + hasilRegulasi.length + hasilDokumen.length,
      hasil,
    };
  }

  // Fitur: GET /api/koneksi?paksa=...
  if (path.startsWith("/koneksi") && method === "GET") {
    return MOCK_KONEKSI;
  }

  // Fitur: GET /api/laporan?tanggal=...
  if (path.startsWith("/laporan") && !path.includes("/unduh") && method === "GET") {
    const url = new URL(`http://dummy${path}`);
    const tanggal = url.searchParams.get("tanggal") || "2026-10-22";
    return { ...MOCK_LAPORAN_HARIAN, tanggal };
  }

  // Fitur: Notifikasi
  if (path === "/notifikasi/jumlah" && method === "GET") {
    const belum = simulatedNotifikasi.filter((n) => !n.dibaca);
    const per_tingkat = {};
    for (const n of belum) {
      per_tingkat[n.tingkat] = (per_tingkat[n.tingkat] || 0) + 1;
    }
    return { belum_dibaca: belum.length, per_tingkat };
  }

  if (path.startsWith("/notifikasi/baca-semua") && method === "POST") {
    simulatedNotifikasi = simulatedNotifikasi.map((n) => ({ ...n, dibaca: true }));
    return { belum_dibaca: 0, per_tingkat: {} };
  }

  if (path.startsWith("/notifikasi/") && path.endsWith("/baca") && method === "POST") {
    const id = parseInt(path.split("/")[2], 10);
    simulatedNotifikasi = simulatedNotifikasi.map((n) => (n.id === id ? { ...n, dibaca: true } : n));
    const belum = simulatedNotifikasi.filter((n) => !n.dibaca);
    return { belum_dibaca: belum.length };
  }

  if (path.startsWith("/notifikasi") && method === "GET") {
    const url = new URL(`http://dummy${path}`);
    const hanyaBelum = url.searchParams.get("belum_dibaca") === "true";
    const filtered = hanyaBelum ? simulatedNotifikasi.filter((n) => !n.dibaca) : simulatedNotifikasi;
    const belum = simulatedNotifikasi.filter((n) => !n.dibaca);
    const per_tingkat = {};
    for (const n of belum) {
      per_tingkat[n.tingkat] = (per_tingkat[n.tingkat] || 0) + 1;
    }
    return {
      belum_dibaca: belum.length,
      per_tingkat,
      notifikasi: filtered,
    };
  }

  // Fitur: GET /api/wesel
  if (path === "/wesel" && method === "GET") {
    return MOCK_WESEL;
  }

  // Fitur: GET /api/wesel/{id}/tren?hari=14
  if (path.startsWith("/wesel/") && path.includes("/tren")) {
    const id = path.split("/")[2];
    return MOCK_TREN[id] || MOCK_TREN["WESEL-02A"];
  }

  // Fitur: POST /api/wesel/{id}/analisis
  if (path.startsWith("/wesel/") && path.endsWith("/analisis")) {
    const id = path.split("/")[2];
    const w = MOCK_WESEL.find((item) => item.wesel_id === id) || MOCK_WESEL[0];
    const sid = "sesi-analisis-" + id.toLowerCase() + "-" + Date.now();
    const hasilAnalisis = {
      session_id: sid,
      langkah: [
        { jenis: "catatan", data: `Memulai analisis getaran real-time untuk ${id}` },
        { tool: "deteksi_anomali", jenis: "panggil", data: { id, sensor: "akselerometer_lidah" } },
        { tool: "deteksi_anomali", jenis: "hasil", data: { rms: w.ciri.rms, kurtosis: w.ciri.kurtosis, kondisi: w.kondisi_kandidat } },
        { tool: "cari_regulasi", jenis: "panggil", data: { query: "toleransi keausan bantalan dan batas getaran PD 10A" } },
        { tool: "cari_regulasi", jenis: "hasil", data: { pasal: "PD 10A Bab IV", batas_rms: 2.5, rekomendasi: "Periksa bantalan gelincir bila RMS > 2.5 m/s²" } },
        { tool: "nilai_urgensi", jenis: "panggil", data: { kondisi: w.kondisi_kandidat, indeks: w.indeks_kesehatan } },
        { tool: "nilai_urgensi", jenis: "hasil", data: { kelas: w.status === "Bahaya" ? "A" : "B", perlu_tindakan: true } },
      ],
      jawaban: `**Analisis Agen Sintelis untuk ${w.wesel_id}:**\n\nBerdasarkan data akselerometer terkini, wesel mengalami indikasi **${w.kondisi_kandidat === "bantalan_aus" ? "Bantalan Aus" : w.kondisi_kandidat === "poros_tidak_sejajar" ? "Poros Tidak Sejajar" : "Kondisi Normal"}** dengan tingkat keyakinan **${Math.round(w.skor_kecocokan * 100)}%**.\n\n- Nilai RMS: **${w.ciri.rms} m/s²**\n- Nilai Kurtosis: **${w.ciri.kurtosis}**\n- Indeks Kesehatan: **${w.indeks_kesehatan}/100**\n\n**Rekomendasi Tindakan:**\n- Segera lakukan pemeriksaan visual pada pelat bantalan gelincir nomor 2 hingga 4.\n- Lakukan pelumasan dan uji pembalikan lidah wesel sesuai prosedur PD 10A.\n- Draf Work Order telah diajukan ke antrean persetujuan.`,
    };

    // Catat ke percakapan analisis
    simulatedPercakapan.unshift({
      id: sid,
      username: "admin",
      jenis: "analisis",
      judul: `Analisis ${id}`,
      cuplikan: hasilAnalisis.jawaban.slice(0, 100),
      jumlah_pesan: 2,
      dibuat: new Date().toISOString(),
      diperbarui: new Date().toISOString(),
      pesan: [
        { dari: "petugas", teks: `Periksa wesel ${id}` },
        { dari: "agen", teks: hasilAnalisis.jawaban, langkah: hasilAnalisis.langkah },
      ],
    });

    return hasilAnalisis;
  }

  if (path.startsWith("/riwayat/")) {
    const id = path.split("/")[2];
    return MOCK_RIWAYAT[id] || MOCK_RIWAYAT["WESEL-02A"] || [];
  }

  // Fitur: POST /api/chat
  if (path === "/chat") {
    const body = options.body ? JSON.parse(options.body) : {};
    const pesan = (body.pesan || "").toLowerCase();
    const sid = body.session_id || "sesi-chat-" + Date.now();

    let balasan = {
      session_id: sid,
      langkah: [
        { tool: "cari_regulasi", jenis: "panggil", data: { kata_kunci: (body.pesan || "").slice(0, 30) } },
        { tool: "cari_regulasi", jenis: "hasil", data: { status: "ditemukan", dokumen: "PD 10A & Manual Sintelis" } },
      ],
      jawaban: `Berdasarkan regulasi teknis perkeretaapian (PD 10A) dan data operasional:\n\n- Batas waktu pembalikan lidah wesel elektrik standar adalah maksimal **6.0 detik**.\n- Apabila durasi pembalikan melampaui toleransi, motor wesel mengalami beban mekanis berlebih akibat pelat kotor, bantalan aus, atau pengunci terganjal ballast.\n- Disarankan memeriksa celah lidah (flangeway clearance) dengan batas toleransi 55–65 mm.`,
    };

    if (pesan.includes("prioritas") || pesan.includes("segera") || pesan.includes("mana yang harus")) {
      balasan = {
        session_id: sid,
        langkah: [
          { tool: "deteksi_anomali", jenis: "panggil", data: { lingkup: "semua_wesel_stasiun" } },
          { tool: "deteksi_anomali", jenis: "hasil", data: { bahaya: ["WESEL-03B"], waspada: ["WESEL-02A"], normal: ["WESEL-01A", "WESEL-04A"] } },
          { tool: "nilai_urgensi", jenis: "panggil", data: { urutkan_berdasarkan: "indeks_terendah_dan_laju_degradasi" } },
          { tool: "nilai_urgensi", jenis: "hasil", data: { urutan_prioritas: ["WESEL-03B", "WESEL-02A", "WESEL-04A", "WESEL-01A"] } },
        ],
        jawaban: `**Prioritas Penanganan Wesel Hari Ini (Rekomendasi Agen):**\n\n1. **PRIORITAS UTAMA: WESEL-03B (Status: Bahaya / Skor 36)**\n   - **Masalah:** Poros tidak sejajar, durasi pembalikan melambat kritis hingga 7.4 detik, dan getaran RMS 6.84 m/s².\n   - **Rekomendasi:** Segera eskalasi ke Teknisi Ahli Sintelis Daop sebelum jam operasional padat berikutnya.\n\n2. **PRIORITAS KEDUA: WESEL-02A (Status: Waspada / Skor 78)**\n   - **Masalah:** Indikasi keausan bantalan gesek dengan laju degradasi -1.8 poin/hari (perkiraan 5 hari menuju batas kritis Kelas B).\n   - **Rekomendasi:** Lakukan pelumasan darurat dan jadwalkan penggantian bantalan nomor 3–4.\n\n3. **KONDISI AMAN: WESEL-01A (94) & WESEL-04A (88)**\n   - Dalam rentang toleransi prima, cukup lakukan inspeksi visual terjadwal.\n\nApakah Anda ingin saya menganalisis wesel WESEL-03B secara lebih rinci?`,
      };
    } else if (
      pesan.includes("rinci") ||
      pesan.includes("detail") ||
      pesan.includes("mendalam") ||
      pesan.includes("w-12") ||
      pesan.includes("wesel-03b") ||
      (pesan.includes("ya") && (pesan.includes("analisis") || pesan.includes("tolong") || pesan.includes("boleh")))
    ) {
      const weselTarget = pesan.includes("w-12") ? "W-12" : pesan.includes("wesel-02a") ? "WESEL-02A" : "WESEL-03B";
      balasan = {
        session_id: sid,
        langkah: [
          { tool: "deteksi_anomali", jenis: "panggil", data: { wesel_id: weselTarget, parameter: ["rms", "kurtosis", "durasi_pembalikan", "arus_motor"] } },
          { tool: "deteksi_anomali", jenis: "hasil", data: { wesel_id: weselTarget, rms: 6.84, kurtosis: 5.92, durasi_s: 7.4, batas_durasi: 6.0, anomali: "poros_tidak_sejajar" } },
          { tool: "cari_regulasi", jenis: "panggil", data: { aturan: "PD 10A Bab IV Pasal 18", topik: "waktu pembalikan dan celah lidah" } },
          { tool: "cari_regulasi", jenis: "hasil", data: { dokumen: "PD 10A", toleransi_maksimal: "6.0 detik", flangeway_clearance: "55-65 mm", tindakan: "Pemeriksaan darurat pengunci mekanis & pelat gesek" } },
          { tool: "nilai_urgensi", jenis: "panggil", data: { status: "Bahaya", deviasi: "+1.4 detik di atas batas PD 10A" } },
          { tool: "nilai_urgensi", jenis: "hasil", data: { level: "Kritis", kelas: "Kelas A", butuh_wo: true } },
        ],
        jawaban: `**Analisis Mendalam Telemetri & Regulasi untuk ${weselTarget}:**\n\n1. **Kondisi Sensor Terkini:**\n   - **Durasi Pembalikan:** **7.4 detik** (Melampaui batas toleransi PD 10A maks **6.0 detik**).\n   - **Getaran RMS Akselerometer:** **6.84 m/s²** (Batas normal < 2.5 m/s²).\n   - **Kurtosis:** **5.92**, terindikasi benturan impulsif berulang saat lidah merapat ke rel lantak (*stock rail*).\n   - **Arus Motor Puncak:** **5.8 A** (Ambang normal 4.5 A), menunjukkan motor menahan beban gesekan berlebih.\n\n2. **Diagnosis Akar Masalah (Root Cause):**\n   - Defleksi poros penggerak dan ketidaksejajaran engsel lidah (*misalignment*). Hal ini menimbulkan friksi abnormal pada pelat bantalan gelincir nomor 1 hingga 3.\n\n3. **Rekomendasi Tindakan Segera (SOP):**\n   - Turunkan teknisi pemeliharaan untuk mengukur celah bebas lidah rel (*flangeway*) dengan batas toleransi 55–65 mm.\n   - Lakukan pelumasan darurat pada pelat gelincir dengan pelumas tahan tekanan tinggi.\n   - Draf Work Order darurat telah disiapkan di antrean persetujuan.`,
      };
    }

    // Catat ke riwayat percakapan simulasi
    const existingIdx = simulatedPercakapan.findIndex((p) => p.id === sid);
    if (existingIdx >= 0) {
      simulatedPercakapan[existingIdx].pesan.push(
        { dari: "petugas", teks: body.pesan || "" },
        { dari: "agen", teks: balasan.jawaban, langkah: balasan.langkah }
      );
      simulatedPercakapan[existingIdx].diperbarui = new Date().toISOString();
      simulatedPercakapan[existingIdx].jumlah_pesan += 2;
    } else {
      simulatedPercakapan.unshift({
        id: sid,
        username: "admin",
        jenis: "chat",
        judul: (body.pesan || "Percakapan Baru").slice(0, 40),
        cuplikan: balasan.jawaban.slice(0, 100),
        jumlah_pesan: 2,
        dibuat: new Date().toISOString(),
        diperbarui: new Date().toISOString(),
        pesan: [
          { dari: "petugas", teks: body.pesan || "" },
          { dari: "agen", teks: balasan.jawaban, langkah: balasan.langkah },
        ],
      });
    }

    return balasan;
  }

  // Fitur: Percakapan (/api/percakapan)
  if (path.startsWith("/percakapan") && method === "GET") {
    if (path === "/percakapan" || path.startsWith("/percakapan?")) {
      const url = new URL(`http://dummy${path}`);
      const jenis = url.searchParams.get("jenis");
      const list = jenis ? simulatedPercakapan.filter((p) => p.jenis === jenis) : simulatedPercakapan;
      return {
        permanen: true,
        disimpan_hari: 30,
        percakapan: list,
      };
    }
    const sid = path.split("/")[2];
    const match = simulatedPercakapan.find((p) => p.id === sid);
    if (!match) {
      const err = new Error("Percakapan tidak ditemukan.");
      err.status = 404;
      throw err;
    }
    return match;
  }

  if (path.startsWith("/percakapan/") && method === "PATCH") {
    const sid = path.split("/")[2];
    const body = options.body ? JSON.parse(options.body) : {};
    simulatedPercakapan = simulatedPercakapan.map((p) => (p.id === sid ? { ...p, judul: body.judul || p.judul } : p));
    const updated = simulatedPercakapan.find((p) => p.id === sid);
    return updated || { ok: true };
  }

  if (path.startsWith("/percakapan/") && method === "DELETE") {
    const sid = path.split("/")[2];
    simulatedPercakapan = simulatedPercakapan.filter((p) => p.id !== sid);
    return { ok: true };
  }

  if (path === "/percakapan" && method === "DELETE") {
    const count = simulatedPercakapan.length;
    simulatedPercakapan = [];
    return { ok: true, dihapus: count };
  }

  // Fitur: Dokumen Pengetahuan (/api/dokumen)
  if (path.startsWith("/dokumen") && method === "GET") {
    if (path === "/dokumen" || path.startsWith("/dokumen?")) {
      const url = new URL(`http://dummy${path}`);
      const status = url.searchParams.get("status");
      const kategori = url.searchParams.get("kategori");
      let res = [...simulatedDokumen];
      if (status && status !== "semua") res = res.filter((d) => d.status === status);
      if (kategori && kategori !== "semua") res = res.filter((d) => d.kategori === kategori);
      return res;
    }

    if (path.includes("/uji")) {
      const id = parseInt(path.split("/")[2], 10);
      const url = new URL(`http://dummy${path}`);
      const q = url.searchParams.get("q") || "";
      const doc = simulatedDokumen.find((d) => d.id === id);
      const chunks = doc ? doc.potongan || [] : [];
      const filtered = chunks.filter((c) => c.isi.toLowerCase().includes(q.toLowerCase()));
      return { q, hasil: filtered.length ? filtered : chunks.slice(0, 3) };
    }

    const id = parseInt(path.split("/")[2], 10);
    const doc = simulatedDokumen.find((d) => d.id === id);
    if (!doc) {
      const err = new Error("Dokumen tidak ditemukan.");
      err.status = 404;
      throw err;
    }
    return doc;
  }

  if (path === "/dokumen" && method === "POST") {
    // Form upload
    const id = simulatedDokumen.length + 1;
    const newDoc = {
      id,
      judul: "Dokumen Baru #" + id,
      kategori: "manual",
      nama_file: "dokumen_" + id + ".pdf",
      ukuran: 1500000,
      jumlah_halaman: 10,
      jumlah_potongan: 16,
      status: "draf",
      pesan: null,
      diunggah_oleh: "pengelola",
      diunggah_pada: new Date().toISOString(),
      diubah_oleh: null,
      diubah_pada: null,
      potongan: [
        { halaman: 1, urutan: 1, isi: "Ekstrak teks draf halaman 1 dokumen baru." },
        { halaman: 2, urutan: 2, isi: "Instruksi perawatan dan batas keselamatan teknis wesel." },
      ],
    };
    simulatedDokumen.unshift(newDoc);
    return newDoc;
  }

  if (path.startsWith("/dokumen/") && path.endsWith("/aktifkan") && method === "POST") {
    const id = parseInt(path.split("/")[2], 10);
    simulatedDokumen = simulatedDokumen.map((d) => (d.id === id ? { ...d, status: "aktif" } : d));
    return simulatedDokumen.find((d) => d.id === id);
  }

  if (path.startsWith("/dokumen/") && path.endsWith("/nonaktifkan") && method === "POST") {
    const id = parseInt(path.split("/")[2], 10);
    simulatedDokumen = simulatedDokumen.map((d) => (d.id === id ? { ...d, status: "nonaktif" } : d));
    return simulatedDokumen.find((d) => d.id === id);
  }

  if (path.startsWith("/dokumen/") && method === "DELETE") {
    const id = parseInt(path.split("/")[2], 10);
    simulatedDokumen = simulatedDokumen.filter((d) => d.id !== id);
    return { ok: true };
  }

  // Fitur: Pengguna (/api/pengguna)
  if (path.startsWith("/pengguna") && method === "GET") {
    if (path.startsWith("/pengguna/audit")) {
      return simulatedAudit;
    }
    return simulatedPengguna;
  }

  if (path === "/pengguna" && method === "POST") {
    const body = options.body ? JSON.parse(options.body) : {};
    const newUser = {
      username: (body.username || "").trim().toLowerCase(),
      nama: body.nama || "",
      peran: body.peran || "petugas",
      aktif: true,
      dibuat: new Date().toISOString(),
      masuk_terakhir: "-",
    };
    simulatedPengguna.push(newUser);
    simulatedAudit.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      siapa: "admin",
      ke_siapa: newUser.username,
      aksi: "buat",
      keterangan: `peran ${newUser.peran}`,
    });
    return newUser;
  }

  if (path.startsWith("/pengguna/") && method === "PATCH") {
    const u = path.split("/")[2];
    const body = options.body ? JSON.parse(options.body) : {};
    simulatedPengguna = simulatedPengguna.map((user) =>
      user.username === u ? { ...user, nama: body.nama || user.nama, peran: body.peran || user.peran } : user
    );
    simulatedAudit.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      siapa: "admin",
      ke_siapa: u,
      aksi: "ubah",
      keterangan: `nama: ${body.nama || ""}, peran: ${body.peran || ""}`,
    });
    return simulatedPengguna.find((user) => user.username === u);
  }

  if (path.startsWith("/pengguna/") && method === "POST") {
    const parts = path.split("/");
    const u = parts[2];
    const aksi = parts[3];
    if (aksi === "aktifkan" || aksi === "nonaktifkan") {
      simulatedPengguna = simulatedPengguna.map((user) =>
        user.username === u ? { ...user, aktif: aksi === "aktifkan" } : user
      );
      simulatedAudit.unshift({
        id: Date.now(),
        ts: new Date().toISOString(),
        siapa: "admin",
        ke_siapa: u,
        aksi,
        keterangan: `status akun diubah ke ${aksi}`,
      });
      return simulatedPengguna.find((user) => user.username === u);
    }
    if (aksi === "reset-sandi") {
      simulatedAudit.unshift({
        id: Date.now(),
        ts: new Date().toISOString(),
        siapa: "admin",
        ke_siapa: u,
        aksi: "reset-sandi",
        keterangan: "kata sandi direset oleh admin",
      });
      return { ok: true, pesan: `Kata sandi ${u} diatur ulang. Semua sesinya dikeluarkan.` };
    }
  }

  // Fitur: GET /api/agen
  if (path === "/agen" && method === "GET") {
    return simulatedAgentState;
  }
  if (path.startsWith("/agen/")) {
    const aksi = path.split("/")[2];
    simulatedAgentState = { ...simulatedAgentState, aktif: aksi === "aktifkan" };
    return simulatedAgentState;
  }

  // Fitur: GET /api/work-orders
  if (path === "/work-orders" && method === "GET") {
    return simulatedWorkOrders;
  }
  if (path.startsWith("/work-orders/") && (path.endsWith("/setujui") || path.endsWith("/tolak"))) {
    const parts = path.split("/");
    const id = parts[2];
    const aksi = parts[3];
    const body = options.body ? JSON.parse(options.body) : {};
    const currentUser = JSON.parse(sessionStorage.getItem("wg_sim_user") || "{}");
    const namaPenentu = currentUser.nama || currentUser.username || "Petugas";

    if (aksi === "tolak" && !body.catatan?.trim()) {
      const err = new Error("Catatan wajib diisi saat menolak work order.");
      err.status = 400;
      throw err;
    }

    simulatedWorkOrders = simulatedWorkOrders.map((wo) => {
      if (wo.id === id) {
        return {
          ...wo,
          status: aksi === "setujui" ? "DISETUJUI" : "DITOLAK",
          catatan_petugas: body.catatan || "",
          diputuskan_oleh: `${currentUser.peran || "petugas"} (${namaPenentu})`,
          diputuskan_pada: new Date().toISOString(),
        };
      }
      return wo;
    });

    // Otomatis buat notifikasi keputusan
    simulatedNotifikasi.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      jenis: "keputusan",
      tingkat: "info",
      wesel_id: id,
      judul: `${id} ${aksi === "setujui" ? "disetujui" : "ditolak"} oleh ${namaPenentu}`,
      pesan: body.catatan || "",
      ref_id: id,
      dibaca: false,
    });

    return { status: "ok", id, keputusan: aksi };
  }

  throw new Error(`Endpoint ${path} tidak dikenal dalam mode simulasi.`);
}

export const api = {
  isOffline: false,

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
