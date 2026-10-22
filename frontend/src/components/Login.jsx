import React, { useState } from "react";
import { api } from "../api.js";
import { Merek } from "./Unsur.jsx";

export default function Login({ onLoginSuccess, initialMessage = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [galat, setGalat] = useState(initialMessage);
  const [kirim, setKirim] = useState(false);

  async function masuk(e) {
    e.preventDefault();
    setKirim(true);
    setGalat("");
    try {
      onLoginSuccess(await api.login(username.trim(), password));
    } catch (err) {
      setGalat(err.status === 401 ? "Nama pengguna atau kata sandi salah." : err.message);
    } finally {
      setKirim(false);
    }
  }

  return (
    <div className="wg-masuk">
      <form className="wg-panel" onSubmit={masuk}>
        <Merek besar />
        <p>Pemantauan point machine di gateway stasiun. Masuk dengan akun yang dibuat admin.</p>
	<div style={{ backgroundColor: '#eef2f5', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
  <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#333' }}>Kredensial Login:</p>
  <ul style={{ margin: '0', paddingLeft: '20px', color: '#444' }}>
    <li>Admin &rarr; Username: <strong>admin</strong> | Password: <strong>asdqwe123</strong></li>
    <li>Pengelola &rarr; Username: <strong>pengelola</strong> | Password: <strong>asdqwe123</strong></li>
  </ul>
</div>
        <label>
          Nama pengguna
          <input className="wg-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="masukkan username" required />
        </label>
        <label>
          Kata sandi
          <input className="wg-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="masukkan password" required />
        </label>
        {galat && <p className="wg-galat" role="alert">{galat}</p>}
        <button className="wg-tombol utama" type="submit" disabled={kirim}>{kirim ? "Memeriksa" : "Masuk"}</button>
      </form>

    </div>
  );
}
