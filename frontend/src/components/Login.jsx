import React, { useState } from "react";
import { IconLogo } from "../Icons.jsx";
import { api } from "../api.js";

export default function Login({ onLoginSuccess, initialMessage = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialMessage);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Silakan isi nama pengguna dan kata sandi.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const user = await api.login(username, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message || "Nama pengguna atau kata sandi salah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickAccount = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-badge">
            <IconLogo className="login-logo-icon" />
          </div>
          <h1 className="login-brand-title">WeselGuard</h1>
          <p className="login-brand-subtitle">
            Sistem Monitoring Kondisi Wesel & Rekomendasi Preskriptif Sintelis
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="login-error-alert" role="alert">
            <span className="error-alert-dot" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field-group">
            <label className="login-label" htmlFor="username">
              Nama Pengguna
            </label>
            <input
              id="username"
              type="text"
              className="login-input"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="login-field-group">
            <div className="login-label-row">
              <label className="login-label" htmlFor="password">
                Kata Sandi
              </label>
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="login-input"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting || !username.trim() || !password}
          >
            {isSubmitting ? (
              <span className="login-submitting-state">
                <span className="login-spinner" />
                <span>Memverifikasi sesi…</span>
              </span>
            ) : (
              <span>Masuk ke Sistem ↗</span>
            )}
          </button>
        </form>

        {/* Quick Test Accounts for Evaluators/Testing */}
        {/* <div className="login-quick-accounts">
          <span className="quick-accounts-title">Akun Uji Coba Cepat:</span>
          <div className="quick-accounts-chips">
            <button
              type="button"
              className="account-chip"
              onClick={() => fillQuickAccount("admin", "admin123")}
              title="Isi akun admin"
            >
              <strong>Admin:</strong> admin / admin123
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => fillQuickAccount("petugas", "petugas123")}
              title="Isi akun petugas"
            >
              <strong>Petugas:</strong> petugas / petugas123
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => fillQuickAccount("pengelola", "pengelola123")}
              title="Isi akun pengelola dokumen"
            >
              <strong>Pengelola:</strong> pengelola / pengelola123
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => fillQuickAccount("pengamat", "pengamat123")}
              title="Isi akun pengamat (Read-Only)"
            >
              <strong>Pengamat:</strong> pengamat / pengamat123
            </button>
          </div>
        </div> */}

        {/* Footer info */}
        {/* <div className="login-card-footer">
          <span>Sesi terenkripsi berlaku 12 jam (1 sif kerja)</span>
        </div> */}
      </div>
    </div>
  );
}
