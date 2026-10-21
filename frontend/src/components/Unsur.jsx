import React from "react";
import { lampu } from "../kondisi.js";

// Simbol wesel: jalur lurus dan jalur belok dari satu titik.
export function SimbolWesel({ ukuran = 28 }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M2 20 H26" stroke="var(--ink)" strokeWidth="3" fill="none" />
      <path d="M8 20 L20 8 H26" stroke="var(--biru)" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <circle cx="8" cy="20" r="3.2" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

export function Merek({ besar = false }) {
  return (
    <span className="wg-merek">
      <SimbolWesel ukuran={besar ? 34 : 28} />
      <b>WeselGuard</b>
    </span>
  );
}

export function Lampu({ status, besar = false }) {
  return <span className={`wg-lampu ${lampu(status)} ${besar ? "besar" : ""}`} aria-hidden="true" />;
}

export function Status({ status, lampu = true }) {
  return (
    <span className="wg-status">
      {lampu && <Lampu status={status} />}
      {status || "–"}
    </span>
  );
}

export function Indeks({ nilai }) {
  const n = Math.max(0, Math.min(100, Number(nilai) || 0));
  const warna = n < 40 ? "var(--merah)" : n < 70 ? "var(--kuning)" : "var(--hijau)";
  return (
    <span className="wg-indeks" title="Garis tipis menandai batas Klasifikasi A (40) dan B (70)">
      <b>{nilai ?? "–"}</b>
      <span className="wg-indeks-batang">
        <i style={{ width: `${n}%`, background: warna }} />
      </span>
    </span>
  );
}

export function Kelas({ kelas }) {
  if (!kelas) return null;
  return (
    <span className={`wg-kelas ${kelas}`} title={`Klasifikasi ${kelas}`}>
      {kelas}
    </span>
  );
}
