import { MOCK_WESEL, MOCK_WORK_ORDERS, MOCK_RIWAYAT, MOCK_TREN } from "./mockData.js";

let simulatedWorkOrders = [...MOCK_WORK_ORDERS];
let simulatedAgentState = { aktif: true, berjalan: 0 };

// Default simulation accounts for offline dev/testing
const SIMULATED_ACCOUNTS = {
  admin: { username: "admin", nama: "Maya Reyes", peran: "admin", sandi: "admin123" },
  petugas: { username: "petugas", nama: "Budi Santoso", peran: "petugas", sandi: "petugas123" },
  pengamat: { username: "pengamat", nama: "Siti Pengamat", peran: "pengamat", sandi: "pengamat123" },
};

async function minta(path, options = {}) {
  try {
    const res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Kirim dan terima cookie sesi (wg_sesi)
      ...options,
    });
    const isi = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(isi.detail || `Server membalas ${res.status}`);
      err.status = res.status;
      throw err;
    }
    api.isOffline = false;
    return isi;
  } catch (err) {
    // If backend replied with 401 (Unauthorized) or 403 (Forbidden), rethrow so UI can handle login/permission
    if (err.status === 401 || err.status === 403) {
      throw err;
    }

    // Gateway server unreachable / offline fallback
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

  // Fitur 1: GET /api/wesel (indeks_kesehatan, status)
  if (path === "/wesel" && method === "GET") {
    return MOCK_WESEL;
  }

  // Fitur 2: GET /api/wesel/{id}/tren?hari=14 (harian, laju_per_hari, perkiraan_hari_ke_batas_B)
  if (path.startsWith("/wesel/") && path.includes("/tren")) {
    const id = path.split("/")[2];
    return MOCK_TREN[id] || MOCK_TREN["WESEL-02A"];
  }

  // Fitur 3: POST /api/wesel/{id}/analisis (langkah, jawaban)
  if (path.startsWith("/wesel/") && path.endsWith("/analisis")) {
    const id = path.split("/")[2];
    const w = MOCK_WESEL.find((item) => item.wesel_id === id) || MOCK_WESEL[0];
    return {
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
  }

  if (path.startsWith("/riwayat/")) {
    const id = path.split("/")[2];
    return MOCK_RIWAYAT[id] || MOCK_RIWAYAT["WESEL-02A"] || [];
  }

  // Fitur 4: POST /api/chat (Prioritas hari ini / konsultasi teknis)
  if (path === "/chat") {
    const body = options.body ? JSON.parse(options.body) : {};
    const pesan = (body.pesan || "").toLowerCase();

    // Khusus pertanyaan prioritas: "Wesel mana yang harus segera diperbaiki?"
    if (pesan.includes("prioritas") || pesan.includes("segera") || pesan.includes("mana yang harus")) {
      return {
        session_id: body.session_id || "sesi-prioritas-" + Date.now(),
        langkah: [
          { tool: "deteksi_anomali", jenis: "panggil", data: { lingkup: "semua_wesel_stasiun" } },
          { tool: "deteksi_anomali", jenis: "hasil", data: { bahaya: ["WESEL-03B"], waspada: ["WESEL-02A"], normal: ["WESEL-01A", "WESEL-04A"] } },
          { tool: "nilai_urgensi", jenis: "panggil", data: { urutkan_berdasarkan: "indeks_terendah_dan_laju_degradasi" } },
          { tool: "nilai_urgensi", jenis: "hasil", data: { urutan_prioritas: ["WESEL-03B", "WESEL-02A", "WESEL-04A", "WESEL-01A"] } },
        ],
        jawaban: `**Prioritas Penanganan Wesel Hari Ini (Rekomendasi Agen):**\n\n1. **PRIORITAS UTAMA: WESEL-03B (Status: Bahaya / Skor 36)**\n   - **Masalah:** Poros tidak sejajar, durasi pembalikan melambat kritis hingga 7.4 detik, dan getaran RMS 6.84 m/s².\n   - **Rekomendasi:** Segera eskalasi ke Teknisi Ahli Sintelis Daop sebelum jam operasional padat berikutnya.\n\n2. **PRIORITAS KEDUA: WESEL-02A (Status: Waspada / Skor 78)**\n   - **Masalah:** Indikasi keausan bantalan gesek dengan laju degradasi -1.8 poin/hari (perkiraan 5 hari menuju batas kritis Kelas B).\n   - **Rekomendasi:** Lakukan pelumasan darurat dan jadwalkan penggantian bantalan nomor 3–4.\n\n3. **KONDISI AMAN: WESEL-01A (94) & WESEL-04A (88)**\n   - Dalam rentang toleransi prima, cukup lakukan inspeksi visual terjadwal.`,
      };
    }

    return {
      session_id: body.session_id || "sesi-" + Date.now(),
      langkah: [
        { tool: "cari_regulasi", jenis: "panggil", data: { kata_kunci: (body.pesan || "").slice(0, 30) } },
        { tool: "cari_regulasi", jenis: "hasil", data: { status: "ditemukan", dokumen: "PD 10A & Manual Sintelis" } },
      ],
      jawaban: `Berdasarkan regulasi teknis perkeretaapian (PD 10A) dan data operasional:\n\n- Batas waktu pembalikan lidah wesel elektrik standar adalah maksimal **6.0 detik**.\n- Apabila durasi pembalikan melampaui toleransi, motor wesel mengalami beban mekanis berlebih akibat pelat kotor, bantalan aus, atau pengunci terganjal ballast.\n- Disarankan memeriksa celah lidah (flangeway clearance) dengan batas toleransi 55–65 mm.`,
    };
  }

  // Fitur 6: GET /api/agen (aktif, berjalan)
  if (path === "/agen" && method === "GET") {
    return simulatedAgentState;
  }
  if (path.startsWith("/agen/")) {
    const aksi = path.split("/")[2];
    simulatedAgentState = { ...simulatedAgentState, aktif: aksi === "aktifkan" };
    return simulatedAgentState;
  }

  // Fitur 5: GET /api/work-orders, POST /api/work-orders/{id}/setujui atau /tolak
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

    simulatedWorkOrders = simulatedWorkOrders.map((wo) => {
      if (wo.id === id) {
        return {
          ...wo,
          status: aksi === "setujui" ? "DISETUJUI" : "DITOLAK",
          catatan_petugas: body.catatan || "",
          diputuskan_oleh: `${currentUser.peran || "petugas"} (${namaPenentu})`,
        };
      }
      return wo;
    });
    return { status: "ok", id, keputusan: aksi };
  }

  throw new Error(`Endpoint ${path} tidak dikenal dalam mode simulasi.`);
}

export const api = {
  isOffline: false,
  login: (username, password) =>
    minta("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => minta("/logout", { method: "POST" }),
  saya: () => minta("/saya"),
  wesel: () => minta("/wesel"),
  tren: (id, hari = 14) => minta(`/wesel/${id}/tren?hari=${hari}`),
  analisis: (id) => minta(`/wesel/${id}/analisis`, { method: "POST" }),
  riwayat: (id) => minta(`/riwayat/${id}`),
  chat: (pesan, session_id) =>
    minta("/chat", { method: "POST", body: JSON.stringify({ pesan, session_id }) }),
  agen: () => minta("/agen"),
  ubahAgen: (aksi) => minta(`/agen/${aksi}`, { method: "POST" }),
  workOrders: () => minta("/work-orders"),
  putuskan: (id, aksi, catatan) =>
    minta(`/work-orders/${id}/${aksi}`, { method: "POST", body: JSON.stringify({ catatan }) }),
};
