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
        <label>
          Nama pengguna
          <input className="wg-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Kata sandi
          <input className="wg-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {galat && <p className="wg-galat" role="alert">{galat}</p>}
        <button className="wg-tombol utama" type="submit" disabled={kirim}>{kirim ? "Memeriksa" : "Masuk"}</button>
      </form>
    </div>
  );
}
