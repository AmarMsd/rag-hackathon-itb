import React from "react";
import { IconMoreVertical, IconArrowUpRight } from "../Icons.jsx";

export default function WeeklyConsistencyCard({ onMenuClick }) {
  const bars = [
    { day: "M", height: "65%", status: "green", tooltip: "Senin: 4 siklus normal" },
    { day: "T", height: "85%", status: "green", tooltip: "Selasa: 6 siklus normal" },
    { day: "W", height: "50%", status: "green", tooltip: "Rabu: 3 siklus normal" },
    { day: "T", height: "95%", status: "orange", tooltip: "Kamis: Anomali getaran terdeteksi!" },
    { day: "F", height: "78%", status: "green", tooltip: "Jumat: 5 siklus normal" },
    { day: "S", height: "20%", status: "gray", tooltip: "Sabtu: Terjadwal malam" },
    { day: "S", height: "20%", status: "gray", tooltip: "Minggu: Terjadwal inspeksi" },
  ];

  return (
    <div className="card weekly-consistency-card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Weekly Consistency</h2>
          <p className="card-subtitle">Sessions completed on schedule this week.</p>
        </div>
        <button
          type="button"
          className="icon-ghost-btn"
          onClick={onMenuClick}
          aria-label="Opsi tambahan"
        >
          <IconMoreVertical className="ghost-btn-icon" />
        </button>
      </div>

      {/* Bar Chart Area */}
      <div className="consistency-bar-chart">
        <div className="bar-columns-wrapper">
          {bars.map((b, i) => (
            <div key={i} className="bar-column" title={b.tooltip}>
              <div className="bar-track">
                <div
                  className={`bar-fill ${b.status}`}
                  style={{ height: b.height }}
                />
              </div>
              <span className="bar-day-label">{b.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="card-footer consistency-footer">
        <div className="consistency-stat">
          <div className="consistency-fraction">
            <strong>5/7</strong> days
          </div>
          <div className="consistency-note">on track this week</div>
        </div>

        <div className="trend-badge-positive" title="Kenaikan konsistensi dibanding minggu lalu">
          <IconArrowUpRight className="trend-arrow" />
          <span>+12%</span>
        </div>
      </div>
    </div>
  );
}
