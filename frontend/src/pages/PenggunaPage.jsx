import React, { useEffect, useState } from "react";
import {
  IconUsers,
  IconShield,
  IconPlus,
  IconEdit,
  IconKey,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from "../Icons.jsx";
import { api } from "../api.js";

const ROLE_OPTIONS = [
  { id: "admin", label: "Admin (Kelola Akun & Semua Fitur)" },
  { id: "petugas", label: "Petugas Sintelis (Operasional & Analisis)" },
  { id: "pengelola", label: "Pengelola (Kelola Dokumen Pengetahuan)" },
  { id: "pengamat", label: "Pengamat (Hanya Melihat / Read-Only)" },
];

export default function PenggunaPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [audits, setAudits] = useState([]);
  const [activeTab, setActiveTab] = useState("akun"); // 'akun' | 'audit'
  const [isLoading, setIsLoading] = useState(true);

  // Form Tambah Akun Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newPeran, setNewPeran] = useState("petugas");
  const [newPassword, setNewPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Modal Edit Akun
  const [editingUser, setEditingUser] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [editPeran, setEditPeran] = useState("petugas");
  const [editError, setEditError] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Modal Reset Sandi
  const [resettingUser, setResettingUser] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, aList] = await Promise.all([
        api.pengguna(),
        api.auditPengguna(50).catch(() => []),
      ]);
      setUsers(uList || []);
      setAudits(aList || []);
    } catch (err) {
      console.error("Gagal memuat pengguna:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Submit Tambah Akun
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newNama.trim() || !newPassword) {
      setAddError("Semua field wajib diisi.");
      return;
    }
    if (newPassword.length < 8) {
      setAddError("Kata sandi minimal 8 karakter.");
      return;
    }

    setIsSubmittingAdd(true);
    setAddError("");
    try {
      await api.tambahPengguna({
        username: newUsername.trim().toLowerCase(),
        nama: newNama.trim(),
        peran: newPeran,
        password: newPassword,
      });
      setIsAddOpen(false);
      setNewUsername("");
      setNewNama("");
      setNewPassword("");
      loadData();
    } catch (err) {
      setAddError(err.message || "Gagal menambahkan akun.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Submit Edit Akun (Nama / Peran)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmittingEdit(true);
    setEditError("");
    try {
      await api.ubahPengguna(editingUser.username, {
        nama: editNama.trim(),
        peran: editPeran,
      });
      setEditingUser(null);
      loadData();
    } catch (err) {
      setEditError(err.message || "Gagal mengubah akun.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Toggle Aktif / Nonaktif
  const handleToggleAktif = async (user) => {
    // Sembunyikan/cegah nonaktifkan akun sendiri
    if (user.username === currentUser?.username) {
      alert("Anda tidak bisa menonaktifkan akun sendiri.");
      return;
    }

    const nextAction = user.aktif ? "nonaktifkan" : "aktifkan";
    if (!confirm(`Yakin ingin ${nextAction} akun ${user.username}?`)) return;

    try {
      await api.aturPengguna(user.username, nextAction);
      loadData();
    } catch (err) {
      alert(`Gagal ${nextAction} akun: ${err.message}`);
    }
  };

  // Reset Sandi
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (newResetPassword.length < 8) {
      setResetError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    setIsSubmittingReset(true);
    setResetError("");
    setResetSuccess("");
    try {
      const res = await api.aturPengguna(resettingUser.username, "reset-sandi", {
        password_baru: newResetPassword,
      });
      setResetSuccess(res.pesan || "Kata sandi berhasil diatur ulang.");
      setTimeout(() => {
        setResettingUser(null);
        setNewResetPassword("");
        setResetSuccess("");
      }, 1500);
      loadData();
    } catch (err) {
      setResetError(err.message || "Gagal mereset kata sandi.");
    } finally {
      setIsSubmittingReset(false);
    }
  };

  return (
    <div className="page-view pengguna-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Kelola Akun &amp; Hak Akses</h1>
          <p className="page-desc">
            Manajemen pengguna sistem WeselGuard, penetapan peran (RBAC), audit keamanan, dan reset kata sandi.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary-action"
          onClick={() => setIsAddOpen(true)}
          title="Tambah akun pengguna baru"
        >
          <IconPlus className="btn-icon-left" />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="pengguna-tabs-bar">
        <button
          type="button"
          className={`pengguna-tab-btn ${activeTab === "akun" ? "active" : ""}`}
          onClick={() => setActiveTab("akun")}
        >
          <IconUsers className="icon-tiny" />
          <span>Daftar Pengguna ({users.length})</span>
        </button>
        <button
          type="button"
          className={`pengguna-tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <IconShield className="icon-tiny" />
          <span>Riwayat Audit Perubahan ({audits.length})</span>
        </button>
      </div>

      {/* Main Content View */}
      {activeTab === "akun" ? (
        <div className="card pengguna-table-card">
          <div className="table-responsive-wrapper">
            <table className="custom-table pengguna-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Nama Lengkap</th>
                  <th>Peran</th>
                  <th>Status Akun</th>
                  <th>Terdaftar</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.username === currentUser?.username;

                  return (
                    <tr key={u.username} className={isSelf ? "self-row" : ""}>
                      <td>
                        <div className="user-id-block">
                          <strong>@{u.username}</strong>
                          {isSelf && <span className="self-tag">Akun Anda</span>}
                        </div>
                      </td>
                      <td>{u.nama}</td>
                      <td>
                        <span className={`role-badge role-${u.peran}`}>
                          {u.peran?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${u.aktif ? "normal" : "bahaya"}`}>
                          {u.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>{u.dibuat ? u.dibuat.slice(0, 10) : "-"}</td>
                      <td>
                        <div className="user-actions-row">
                          {/* Sembunyikan tombol ubah peran pada baris akun admin itu sendiri */}
                          {!isSelf && (
                            <button
                              type="button"
                              className="user-action-btn edit"
                              onClick={() => {
                                setEditingUser(u);
                                setEditNama(u.nama);
                                setEditPeran(u.peran);
                                setEditError("");
                              }}
                              title="Ubah nama atau peran"
                            >
                              <IconEdit className="icon-tiny" />
                              <span>Ubah</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="user-action-btn reset"
                            onClick={() => {
                              setResettingUser(u);
                              setNewResetPassword("");
                              setResetError("");
                              setResetSuccess("");
                            }}
                            title="Reset kata sandi akun ini"
                          >
                            <IconKey className="icon-tiny" />
                            <span>Reset Sandi</span>
                          </button>

                          {/* Sembunyikan tombol nonaktifkan pada baris akun admin itu sendiri */}
                          {!isSelf && (
                            <button
                              type="button"
                              className={`user-action-btn toggle ${u.aktif ? "deactivate" : "activate"}`}
                              onClick={() => handleToggleAktif(u)}
                              title={u.aktif ? "Nonaktifkan akun" : "Aktifkan akun"}
                            >
                              {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab Audit History */
        <div className="card audit-table-card">
          <div className="card-header-bar">
            <div>
              <h2 className="card-heading">Riwayat Audit Perubahan Akun</h2>
              <p className="card-subheading">Rekaman log keamanan setiap kali ada pembuatan akun, perubahan peran, atau reset kata sandi.</p>
            </div>
            <span className="table-row-count-tag">{audits.length} Catatan</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="custom-table audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pelaku (Siapa)</th>
                  <th>Target (Ke Siapa)</th>
                  <th>Aksi</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a, i) => (
                  <tr key={i}>
                    <td><strong>{a.ts ? a.ts.replace("T", " ").slice(0, 19) : "-"}</strong></td>
                    <td>
                      <span className="audit-actor-tag">@{a.siapa}</span>
                    </td>
                    <td>
                      <strong>@{a.ke_siapa}</strong>
                    </td>
                    <td>
                      <span className={`audit-action-tag action-${a.aksi}`}>
                        {a.aksi}
                      </span>
                    </td>
                    <td>{a.keterangan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Tambah Akun Baru */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}>
          <div
            className="modal-card user-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Tambah Akun Baru"
          >
            <div className="modal-header">
              <h2 className="modal-title">Tambah Akun Pengguna Baru</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddOpen(false)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="modal-body">
              {addError && (
                <div className="modal-error-alert">
                  <IconAlertTriangle className="icon-tiny" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="new-username">
                  Nama Pengguna (Username) <span className="req-star">*</span>
                </label>
                <input
                  id="new-username"
                  type="text"
                  className="field-input"
                  placeholder="Contoh: budi_sintelis"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-nama">
                  Nama Lengkap <span className="req-star">*</span>
                </label>
                <input
                  id="new-nama"
                  type="text"
                  className="field-input"
                  placeholder="Contoh: Budi Santoso, S.T."
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-peran">
                  Peran / Hak Akses <span className="req-star">*</span>
                </label>
                <select
                  id="new-peran"
                  className="field-select"
                  value={newPeran}
                  onChange={(e) => setNewPeran(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-password">
                  Kata Sandi Awal <span className="req-star">* (min. 8 karakter)</span>
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="field-input"
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmittingAdd}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingAdd}
                >
                  {isSubmittingAdd ? "Menyimpan…" : "Buat Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Ubah Nama & Peran */}
      {editingUser && (
        <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
          <div
            className="modal-card user-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Ubah Akun"
          >
            <div className="modal-header">
              <h2 className="modal-title">Ubah Akun: @{editingUser.username}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingUser(null)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-body">
              {editError && (
                <div className="modal-error-alert">
                  <IconAlertTriangle className="icon-tiny" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="edit-nama">
                  Nama Lengkap
                </label>
                <input
                  id="edit-nama"
                  type="text"
                  className="field-input"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-peran">
                  Peran / Hak Akses
                </label>
                <select
                  id="edit-peran"
                  className="field-select"
                  value={editPeran}
                  onChange={(e) => setEditPeran(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setEditingUser(null)}
                  disabled={isSubmittingEdit}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Kata Sandi */}
      {resettingUser && (
        <div className="modal-backdrop" onClick={() => setResettingUser(null)}>
          <div
            className="modal-card user-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Reset Sandi"
          >
            <div className="modal-header">
              <h2 className="modal-title">Reset Sandi: @{resettingUser.username}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setResettingUser(null)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <form onSubmit={handleResetSubmit} className="modal-body">
              {resetError && (
                <div className="modal-error-alert">
                  <IconAlertTriangle className="icon-tiny" />
                  <span>{resetError}</span>
                </div>
              )}
              {resetSuccess && (
                <div className="modal-success-alert">
                  <IconCheck className="icon-tiny" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <p className="field-hint">
                Mereset kata sandi akan otomatis mengeluarkan (invalidate) seluruh sesi login aktif milik pengguna ini di perangkat lain.
              </p>

              <div className="field-group">
                <label className="field-label" htmlFor="reset-pass">
                  Kata Sandi Baru <span className="req-star">* (min. 8 karakter)</span>
                </label>
                <input
                  id="reset-pass"
                  type="password"
                  className="field-input"
                  placeholder="Masukkan kata sandi baru"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setResettingUser(null)}
                  disabled={isSubmittingReset}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmittingReset || newResetPassword.length < 8}
                >
                  {isSubmittingReset ? "Mereset…" : "Atur Ulang Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}