import React from "react";
import {
  IconMoreVertical,
  IconHeart,
  IconMoon,
  IconArrowUpRight,
  IconChevronDown,
} from "../Icons.jsx";

const LABEL_KONDISI = {
  normal: "Normal (Prima)",
  bantalan_aus: "Bantalan Aus",
  poros_tidak_sejajar: "Poros Tidak Sejajar",
};

export default function SpotlightCard({
  wesel,
  weselList = [],
  onSelectWesel,
  onAnalyze,
  isAnalyzing,
  onMenuClick,
}) {
  const w = wesel || weselList[0] || {};
  const kondisiLabel = LABEL_KONDISI[w.kondisi_kandidat] || w.kondisi_kandidat || "Normal";
  const isWarning = w.status === "Waspada" || w.status === "Bahaya";

  return (
    <div className="card client-spotlight-card">
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">Client Spotlight</h2>
        <button
          type="button"
          className="icon-ghost-btn"
          onClick={onMenuClick}
          aria-label="Opsi wesel"
        >
          <IconMoreVertical className="ghost-btn-icon" />
        </button>
      </div>

      {/* Profile Row */}
      <div className="spotlight-profile-section">
        <div className="spotlight-avatar-wrapper">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            alt={w.wesel_id || "Wesel"}
            className="spotlight-avatar"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextSibling.style.display = "flex";
            }}
          />
          <div className="spotlight-avatar-fallback" style={{ display: "none" }}>
            {w.wesel_id?.slice(-3) || "WSL"}
          </div>
        </div>

        <div className="spotlight-info">
          <span className="spotlight-meta">
            {w.tipe || "Wesel Elektrik R-54"}
          </span>

          <div className="spotlight-name-selector">
            <select
              className="spotlight-select"
              value={w.wesel_id || ""}
              onChange={(e) => onSelectWesel && onSelectWesel(e.target.value)}
              title="Pilih wesel untuk disorot"
            >
              {weselList.map((item) => (
                <option key={item.wesel_id} value={item.wesel_id}>
                  {item.wesel_id} ({item.status})
                </option>
              ))}
            </select>
            <IconChevronDown className="spotlight-chevron" />
          </div>

          <div className="spotlight-goal">
            <span className="goal-label">Kondisi: </span>
            <span className={`goal-value ${isWarning ? "warning" : "normal"}`}>
              {kondisiLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row 1: Resting HR -> Indeks Kesehatan */}
      <div className="spotlight-metrics-list">
        <div
          className="spotlight-metric-pill"
          onClick={() => onAnalyze && onAnalyze(w.wesel_id)}
          title="Klik untuk analisis kesehatan mendalam"
          style={{ cursor: "pointer" }}
        >
          <div className="metric-left">
            <IconHeart className="metric-icon heart" />
            <span className="metric-name">Resting HR (Kesehatan)</span>
          </div>
          <div className="metric-right">
            <span className="metric-value">{w.indeks_kesehatan ?? 78} bpm</span>
            <IconArrowUpRight className="metric-arrow" />
          </div>
        </div>

        {/* Metrics Row 2: Sleep Score -> Getaran RMS */}
        <div
          className="spotlight-metric-pill"
          onClick={() => onAnalyze && onAnalyze(w.wesel_id)}
          title="Klik untuk analisis getaran"
          style={{ cursor: "pointer" }}
        >
          <div className="metric-left">
            <IconMoon className="metric-icon moon" />
            <span className="metric-name">Sleep Score (RMS Getaran)</span>
          </div>
          <div className="metric-right">
            <span className="metric-value">
              {w.ciri?.rms ? `${w.ciri.rms} m/s²` : "3.42 m/s²"}
            </span>
            <IconArrowUpRight className="metric-arrow" />
          </div>
        </div>
      </div>
    </div>
  );
}
