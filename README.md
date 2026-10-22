# WeselGuard: Sistem Pemantauan Telemetri & Agen Cerdas Preskriptif Wesel Kereta Api

> Solusi pemeliharaan prediktif dan preskriptif berbasis IoT Edge dan Agen AI untuk keandalan wesel persinyalan kereta api (*Sintelis*) sesuai standar regulasi KAI **PD 10A**.

---

## 1. Masalah dan Pengguna

### 1.1 Latar Belakang Masalah
Wesel merupakan komponen paling kritis pada prasarana jalan rel kereta api yang berfungsi memindahkan jalur perjalanan kereta. Kegagalan fungsi mekanik pada wesel—seperti poros tidak sejajar, bantalan pelat gelincir aus, atau motor penggerak macet:
* **Risiko Fatalitas:** Berpotensi menyebabkan anjlokan kereta api (*derailment*).
* **Keterlambatan Dinas:** Menyebabkan gangguan perjalanan kereta api yang berdampak masif pada jadwal lintas.
* **Metode Konvensional yang Reaktif:** Pemeriksaan manual berkala sering kali terlambat mendeteksi degradasi mekanis yang terjadi di antara siklus inspeksi terjadwal.
* **Kesenjangan Pengetahuan Petugas:** Membutuhkan waktu lama bagi teknisi lapangan untuk mencocokkan anomali sinyal dengan pasal rujukan pemeliharaan teknis **Peraturan Dinas 10A (PD 10A)**.

### 1.2 Sasaran Pengguna (*Target Personas*)
Sistem ini dirancang dengan kontrol akses berbasis peran (*Role-Based Access Control / RBAC*):
1. **Petugas Sintelis (Teknisi Lapangan):** Memantau sinyal real-time, menganalisis degradasi wesel bersama Agen AI, dan mengesahkan (*Setujui/Tolak*) draf Work Order (WO) perbaikan.
2. **Pengelola (Knowledge Manager):** Mengunggah, memverifikasi draf potongan (*chunk*), dan menguji pencarian semantik pada basis pengetahuan regulasi teknis (PD 10A, manual pabrikan, SOP).
3. **Administrator:** Mengelola hak akses akun pengguna, mengawasi log audit aktivitas, serta memiliki kontrol sakelar agen AI.
4. **Pengamat (*Auditor / Kepala Stasiun*):** Memiliki hak akses pantau baca (*read-only*) untuk melihat grafik tren kesehatan wesel dan mengunduh laporan harian.

---

## 2. Arsitektur Sistem & Agen AI

Sistem menerapkan arsitektur terdistribusi dua lapis (*Two-Tier Intelligence*):
1. **Lapisan 1 (Edge Computing di Raspberry Pi):** Ekstraksi fitur fisik getaran dari sensor akselerometer lidah wesel dan deteksi anomali berbasis aturan (*rule-based*).
2. **Lapisan 2 (Agen AI Preskriptif):** Agen otonom (*LLM Agent*) yang mengevaluasi tren, melakukan RAG terhadap regulasi PD 10A, menilai kelas urgensi, dan merumuskan draf perintah kerja (*Work Order*).

```mermaid
flowchart TD
    subgraph EdgeDevice["Raspberry Pi 4 (Edge Gateway)"]
        S[Sensor Akselerometer Rel] -->|Sampling Sinyal Getaran| EXT[Ekstraksi Ciri Fisik: RMS, Kurtosis, Frekuensi, Durasi]
        EXT --> L1[Lapisan 1: Deteksi Anomali & Batas Ambang 40 / 70]
        L1 --> DB[(SQLite / Penyimpanan Lokal)]
        L1 --> API[FastAPI Standalone Service]
    end

    subgraph AgentSystem["Lapisan 2: Agen Cerdas Sintelis"]
        API <-->|Panggilan Alat / Tool Calling| AGT[Agen AI Preskriptif]
        AGT --> T1[prioritas_wesel]
        AGT --> T2[deteksi_anomali]
        AGT --> T3[tren_wesel]
        AGT --> T4[cari_manual & cari_dokumen]
        AGT --> T5[cek_riwayat]
        AGT --> T6[nilai_urgensi]
        AGT --> T7[buat_work_order & eskalasi]
        T4 <--> RAG[(Basis Pengetahuan Regulasi PD 10A)]
    end

    subgraph UserInterface["Frontend Dashboard (Operator Stasiun)"]
        API <-->|REST API / Polling 5s| DASH[Dashboard Web React + Vite]
        DASH --> U1[Pemantauan Real-Time & Batas 40/70]
        DASH --> U2[Grafik Tren Degradasi 14 Hari]
        DASH --> U3[Tanya Agen & Log Investigasi]
        DASH --> U4[Antrean Keputusan Work Order: Setujui / Tolak]
        DASH --> U5[Laporan Harian .MD / .CSV]
    end
