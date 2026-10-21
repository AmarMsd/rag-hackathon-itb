import React, { useEffect, useState } from "react";
import { IconChevronDown, IconArrowUpRight } from "../Icons.jsx";
import { api } from "../api.js";

export default function TrainingLoadCard({
  selectedWesel,
  weselList = [],
  onSelectWesel,
}) {
  const [metric, setMetric] = useState("Indeks");
  const [hari, setHari] = useState(14);
  const [trenData, setTrenData] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const weselId = selectedWesel?.wesel_id || "WESEL-02A";

  // Fitur 2: GET /api/wesel/{id}/tren?hari=14
  useEffect(() => {
    let aktif = true;
    api.tren(weselId, hari)
      .then((res) => {
        if (aktif) setTrenData(res);
      })
      .catch(() => {
        if (aktif) setTrenData(null);
      });
    return () => {
      aktif = false;
    };
  }, [weselId, hari]);

  const harian = trenData?.harian || [
    { tanggal: "08 Okt", indeks_rata: 90, indeks_min: 86, jumlah_siklus: 18, jumlah_anomali: 0 },
    { tanggal: "11 Okt", indeks_rata: 88, indeks_min: 84, jumlah_siklus: 20, jumlah_anomali: 1 },
    { tanggal: "14 Okt", indeks_rata: 84, indeks_min: 78, jumlah_siklus: 22, jumlah_anomali: 2 },
    { tanggal: "17 Okt", indeks_rata: 80, indeks_min: 74, jumlah_siklus: 21, jumlah_anomali: 3 },
    { tanggal: "21 Okt", indeks_rata: 78, indeks_min: 70, jumlah_siklus: 24, jumlah_anomali: 5 },
  ];

  const lajuPerHari = trenData?.laju_per_hari ?? -1.8;
  const perkiraanBatasB = trenData?.perkiraan_hari_ke_batas_B ?? 5;

  // Calculate coordinates for SVG (viewBox: 0 0 540 160)
  const minVal = 20;
  const maxVal = 100;
  const chartHeight = 110;
  const topPadding = 25;
  const startX = 35;
  const endX = 505;
  const stepX = (endX - startX) / Math.max(1, harian.length - 1);

  const points = harian.map((item, idx) => {
    const val = item.indeks_rata ?? item.value ?? 75;
    const x = startX + idx * stepX;
    const normalized = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    const y = topPadding + (1 - normalized) * chartHeight;
    return { ...item, val, x, y };
  });

  // Make smooth spline path
  const makeSmoothPath = (pts) => {
    if (!pts.length) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX},${curr.y} ${cpX},${next.y} ${next.x},${next.y}`;
    }
    return d;
  };

  const linePath = makeSmoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x},150 L ${points[0].x},150 Z`
    : "";

  // Threshold at 70 (Batas Kelas B / Waspada)
  const targetThresholdY = topPadding + (1 - (70 - minVal) / (maxVal - minVal)) * chartHeight;
  // Threshold at 40 (Batas Kelas A / Bahaya)
  const dangerThresholdY = topPadding + (1 - (40 - minVal) / (maxVal - minVal)) * chartHeight;

  const activeIdx = hoverIndex !== null ? hoverIndex : Math.max(0, points.length - 1);
  const activePoint = points[activeIdx] || points[0];

  const avgValue = points.length
    ? Math.round(points.reduce((acc, cur) => acc + cur.val, 0) / points.length)
    : 78;

  return (
    <div className="card training-load-card">
      {/* Card Header */}
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Training Load (Tren Kesehatan)</h2>
          <span className="card-subtitle-subtle">
            {weselId} • Laju: <strong>{lajuPerHari > 0 ? `+${lajuPerHari}` : lajuPerHari} poin/hari</strong>
          </span>
        </div>

        <div className="card-header-controls">
          {/* Laju Degradasi Badge */}
          <div
            className={`trend-stat-chip ${lajuPerHari < -1.5 ? "danger" : lajuPerHari < 0 ? "warning" : "good"}`}
            title="Laju perubahan indeks kesehatan per hari"
          >
            <span>{lajuPerHari > 0 ? `+${lajuPerHari}` : `${lajuPerHari}`}/hari</span>
          </div>

          {/* Estimasi Hari ke Batas B Badge */}
          <div
            className={`trend-stat-chip ${perkiraanBatasB <= 0 ? "danger" : perkiraanBatasB <= 7 ? "warning" : "good"}`}
            title="Perkiraan hari tersisa sebelum menembus batas klasifikasi B (70)"
          >
            <span>
              {perkiraanBatasB <= 0 ? "Zona Kritis (≤ B)" : `${perkiraanBatasB} hari ke Batas B`}
            </span>
          </div>

          <div className="select-pill-wrapper">
            <select
              className="select-pill"
              value={hari}
              onChange={(e) => setHari(Number(e.target.value))}
              aria-label="Pilih Rentang Hari"
            >
              <option value={7}>7 Hari</option>
              <option value={14}>14 Hari</option>
              <option value={30}>30 Hari</option>
            </select>
            <IconChevronDown className="select-chevron" />
          </div>
        </div>
      </div>

      {/* Interactive Chart Container */}
      <div className="chart-wrapper">
        <svg
          viewBox="0 0 540 160"
          className="training-chart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trainingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#125740" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#125740" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#125740" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Batas Aman (70) guideline */}
          <line
            x1="20"
            y1={targetThresholdY}
            x2="520"
            y2={targetThresholdY}
            stroke="#c8d6ce"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Batas Kritis (40) guideline */}
          <line
            x1="20"
            y1={dangerThresholdY}
            x2="520"
            y2={dangerThresholdY}
            stroke="#fca5a5"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Area under curve */}
          <path d={areaPath} fill="url(#trainingGradient)" />

          {/* Main curved line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0e4b37"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Data points */}
          {points.map((pt, idx) => (
            <g
              key={idx}
              className="chart-point-group"
              onMouseEnter={() => setHoverIndex(idx)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
              {idx === activeIdx ? (
                <>
                  <circle cx={pt.x} cy={pt.y} r="6" fill="#083226" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#ffffff" />
                </>
              ) : (
                <circle cx={pt.x} cy={pt.y} r="3.5" fill="#0e4b37" opacity="0.75" />
              )}
            </g>
          ))}
        </svg>

        {/* Floating Tooltip Pill */}
        {activePoint && (
          <div
            className="chart-tooltip-bubble"
            style={{
              left: `${(activePoint.x / 540) * 100}%`,
              top: `${(activePoint.y / 160) * 100 - 24}%`,
            }}
          >
            <div className="tooltip-title">
              <span>{activePoint.tanggal || activePoint.dateFull}</span>
              <IconArrowUpRight className="tooltip-icon" />
            </div>
            <div className="tooltip-val">
              {Math.round(activePoint.val)} Poin (Min: {activePoint.indeks_min ?? Math.round(activePoint.val - 4)})
            </div>
          </div>
        )}

        {/* X Axis Labels */}
        <div className="chart-x-axis">
          {points.map((pt, idx) => (
            <span
              key={idx}
              className={`x-axis-label ${idx === activeIdx ? "active" : ""}`}
              onClick={() => setHoverIndex(idx)}
            >
              {pt.tanggal}
            </span>
          ))}
        </div>
      </div>

      {/* Card Footer */}
      <div className="card-footer">
        <div className="footer-stat">
          <span className="stat-label">Rata-rata {hari} Hari:</span>
          <span className="stat-value">{avgValue} Poin</span>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color-box actual" />
            <span>Indeks Harian</span>
          </div>
          <div className="legend-item">
            <span className="legend-line-box target" />
            <span>Batas Aman (70)</span>
          </div>
          <div className="legend-item">
            <span className="legend-line-box danger-line" />
            <span>Batas Kritis (40)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
