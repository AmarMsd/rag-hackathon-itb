import React, { useState } from "react";
import {
  IconKey,
  IconShield,
  IconCheck,
  IconAlertTriangle,
} from "../Icons.jsx";
import { api } from "../api.js";

const ROLE_DESCRIPTIONS = {
  admin: "Administrator memiliki akses penuh ke seluruh sistem: pemantauan sinyal, analisis agen, pengambilan keputusan work order, pengawasan audit, dan pengelolaan akun pengguna.",
  petugas: "Petugas Sintelis bertugas memantau telemetri wesel, menjalankan analisis getaran dengan agen AI, serta menyetujui atau menolak draf Work Order di lapangan.",
  pengelola: "Pengelola bertanggung jawab atas basis pengetahuan sistem: mengunggah dokumen regulasi/manual, memverifikasi draf potongan teks, dan menguji pencarian semantik.",
  pengamat: "Pengamat memiliki hak akses baca (read-only) untuk memantau data telemetri, grafik tren degradasi, dan laporan stasiun tanpa izin pengubahan data.",
};

export default function ProfilPage({ user, onLogout }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg("Semua kolom kata sandi wajib diisi.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.gantiSandi(oldPassword, newPassword);
      setSuccessMsg(res.pesan || "Kata sandi berhasil diganti. Sesi di perangkat lain telah dikeluarkan.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setErrorMsg(err.message || "Gagal mengganti kata sandi. Periksa kembali kata sandi lama Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const peran = user?.peran || "pengamat";

  return (
    <div className="page-view profil-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Profil Pengguna &amp; Keamanan Akun</h1>
          <p className="page-desc">
            Informasi akun dinas Anda, hak akses operasional, serta pengaturan kata sandi akun.
          </p>
        </div>
      </div>

      <div className="detail-grid-two-col">
        {/* Kolom 1: Kartu Informasi Akun & Peran */}
        <div className="card profile-info-card">
          <div className="profile-big-avatar-row">
            <div className="profile-big-avatar">
              {(user?.nama || "Petugas")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h2 className="profile-big-name">{user?.nama || "Petugas Sintelis"}</h2>
              <span className="profile-username-tag">@{user?.username || "petugas"}</span>
              <span className={`role-badge role-${peran}`}>
                {peran.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="profile-divider" />

          <div className="profile-role-details">
            <h3 className="section-small-title">
              <IconShield className="icon-tiny" />
              <span>Deskripsi Kewenangan Peran ({peran.toUpperCase()}):</span>
            </h3>
            <p className="profile-role-desc-text">
              {ROLE_DESCRIPTIONS[peran] || ROLE_DESCRIPTIONS.petugas}
            </p>
          </div>

          <div className="profile-divider" />

          <div className="profile-session-safety">
            <span className="safety-title">Keamanan Sesi:</span>
            <p className="safety-desc">
              Sesi login diamankan dengan token HTTP-only (Lax) yang berlaku selama 12 jam (1 sif kerja dinas). Mengganti kata sandi akan otomatis membatalkan seluruh sesi aktif di perangkat lain.
            </p>
          </div>
        </div>

        {/* Kolom 2: Form Ganti Kata Sandi */}
        <div className="card change-password-card">
          <div className="card-header-bar">
            <div className="header-with-badge">
              <IconKey className="icon-small" />
              <h2 className="card-heading">Ganti Kata Sandi</h2>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="change-password-form">
            {errorMsg && (
              <div className="modal-error-alert">
                <IconAlertTriangle className="icon-tiny" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="modal-success-alert">
                <IconCheck className="icon-tiny" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="old-pass">
                Kata Sandi Lama <span className="req-star">*</span>
              </label>
              <input
                id="old-pass"
                type="password"
                className="field-input"
                placeholder="Masukkan kata sandi saat ini"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="new-pass">
                Kata Sandi Baru <span className="req-star">* (min. 8 karakter)</span>
              </label>
              <input
                id="new-pass"
                type="password"
                className="field-input"
                placeholder="Masukkan kata sandi baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="confirm-pass">
                Konfirmasi Kata Sandi Baru <span className="req-star">*</span>
              </label>
              <input
                id="confirm-pass"
                type="password"
                className="field-input"
                placeholder="Ketik ulang kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-submit-row">
              <button
                type="submit"
                className="btn-primary-action"
                disabled={isSubmitting || !oldPassword || !newPassword || !confirmPassword}
              >
                {isSubmitting ? "Menyimpan Kata Sandi…" : "Perbarui Kata Sandi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}