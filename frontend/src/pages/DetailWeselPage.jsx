import React, { useEffect, useState } from "react";
import {
  IconSparkles,
  IconArrowUpRight,
  IconAlertTriangle,
  IconCheck,
} from "../Icons.jsx";
import Teks from "../Teks.jsx";
import LogAgen from "../LogAgen.jsx";
import { api } from "../api.js";

export default function DetailWeselPage({
  weselList = [],
  selectedWeselId,
  onSelectWesel,
  onNavigate,
  isAgentActive = true,
  user,
}) {
  const currentId = selectedWeselId || weselList[0]?.wesel_id || "WESEL-02A";
  const currentWesel = weselList.find((w) => w.wesel_id === currentId) || weselList[0] || {};

  const [trenData, setTrenData] = useState(null);
  const [riwayatData, setRiwayatData] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Analisis Agen Inline States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");

  // Load trend & history whenever currentId changes
  useEffect(() => {
    if (!currentId) return;
    setAnalysisResult(null);
    setAnalysisError("");

    api.tren(currentId, 14)
      .then(setTrenData)
      .catch((err) => {
        console.error("Gagal memuat tren:", err);
        setTrenData(null);
      });

    api.riwayat(currentId)
      .then(setRiwayatData)
      .catch((err) => {
        console.error("Gagal memuat riwayat:", err);
        setRiwayatData([]);
      });
  }, [currentId]);

  // Run Agent Analysis
  const handleRunAnalysis = async () => {
    if (user?.peran === "pengamat" || user?.peran === "pengelola" || !isAgentActive || isAnalyzing) {
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await api.analisis(currentId);
      setAnalysisResult(res);
    } catch (err) {
      setAnalysisError(err.message || "Gagal menghubungi agen analitik.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const ciri = currentWesel.ciri || {
    rms: 3.42,
    kurtosis: 4.12,
    puncak_frekuensi_hz: 142.5,
    durasi_siklus_s: 4.8,
  };

  const harian = trenData?.harian || [];
  const laju = trenData?.laju_per_hari ?? -1.8;
  const perkiraanHari = trenData?.perkiraan_hari_ke_batas_B ?? 5;

  // Chart dimension calculations for SVG
  const chartWidth = 640;
  const chartHeight = 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const points = harian.map((h, i) => {
    const x = padding.left + (i / Math.max(harian.length - 1, 1)) * graphWidth;
    const yVal = h.indeks_rata ?? h.indeks ?? 80;
    // Y-scale 0 to 100
    const y = padding.top + (1 - Math.min(Math.max(yVal, 0), 100) / 100) * graphHeight;
    return { x, y, data: h, yVal };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "")
    : "";

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
    : "";

  const yThreshold70 = padding.top + (1 - 70 / 100) * graphHeight;
  const yThreshold40 = padding.top + (1 - 40 / 100) * graphHeight;

  return (
    <div className="page-view detail-wesel-page">
      {/* Switch Selector Tabs */}
      <div className="detail-switch-selector-bar">
        <span className="selector-bar-label">Pilih Wesel:</span>
        <div className="selector-tabs-list">
          {weselList.map((w) => {
            const isSel = w.wesel_id === currentId;
            const statusClass = (w.status || "normal").toLowerCase();
            return (
              <button
                key={w.wesel_id}
                type="button"
                className={`switch-selector-chip ${isSel ? "active" : ""}`}
                onClick={() => onSelectWesel(w.wesel_id)}
              >
                <span className={`status-dot-mini ${statusClass}`} />
                <span className="switch-id-text">{w.wesel_id}</span>
                <span className="switch-score-text">({w.indeks_kesehatan})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Detail Header Card */}
      <div className="card detail-overview-header-card">
        <div className="detail-header-left">
          <div className="detail-title-row">
            <h1 className="detail-switch-heading">{currentWesel.wesel_id}</h1>
            <span className={`status-pill ${currentWesel.status?.toLowerCase() || "normal"}`}>
              {currentWesel.status || "Normal"}
            </span>
            <span className="detail-health-badge">
              Indeks Kesehatan: <strong>{currentWesel.indeks_kesehatan || 80}/100</strong>
            </span>
          </div>
          <p className="detail-meta-line">
            Lokasi: <strong>{currentWesel.lokasi || "Jalur Utama"}</strong> • Tipe: <strong>{currentWesel.tipe || "Siemens R-54"}</strong> • Terakhir Diperiksa: {currentWesel.terakhir_diperiksa || "Hari ini"}
          </p>
        </div>

        {/* Action Button: Analisis dengan Agen */}
        <div className="detail-header-actions">
          {user?.peran !== "pengamat" && user?.peran !== "pengelola" ? (
            <button
              type="button"
              className="btn-primary-action"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !isAgentActive}
              title="Jalankan evaluasi preskriptif menggunakan agen LLM Sintelis"
            >
              <IconSparkles className="btn-icon-left" />
              <span>{isAnalyzing ? "Menganalisis Sinyal…" : "Analisis dengan Agen"}</span>
            </button>
          ) : (
            <span className="read-only-badge">Hanya Baca</span>
          )}
        </div>
      </div>

      {/* Grid: Ciri Sinyal + Grafik Tren 14 Hari */}
      <div className="detail-grid-two-col">
        {/* Kolom 1: Ciri Sinyal Getaran */}
        <div className="card signal-features-card">
          <h2 className="card-heading">Ciri Sinyal Sensor Getaran</h2>
          <p className="card-subheading">Karakteristik fisik diekstraksi dari akselerometer lidah rel.</p>

          <div className="signal-metrics-grid">
            <div className="signal-metric-box">
              <span className="metric-title">Getaran RMS</span>
              <span className="metric-num">{ciri.rms} <small>m/s²</small></span>
              <span className="metric-threshold">Ambang normal: &lt; 2.5 m/s²</span>
            </div>

            <div className="signal-metric-box">
              <span className="metric-title">Nilai Kurtosis</span>
              <span className="metric-num">{ciri.kurtosis}</span>
              <span className="metric-threshold">Normal: 2.8 – 3.2 (Gauss)</span>
            </div>

            <div className="signal-metric-box">
              <span className="metric-title">Puncak Frekuensi</span>
              <span className="metric-num">{ciri.puncak_frekuensi_hz} <small>Hz</small></span>
              <span className="metric-threshold">Frekuensi dominan spektral</span>
            </div>

            <div className="signal-metric-box">
              <span className="metric-title">Durasi Siklus</span>
              <span className="metric-num">{ciri.durasi_siklus_s} <small>detik</small></span>
              <span className="metric-threshold">Batas maks PD 10A: 6.0 s</span>
            </div>
          </div>

          <div className="signal-diagnosis-summary">
            <strong>Diagnosis Lapisan 1:</strong>{" "}
            <span>
              {currentWesel.kondisi_kandidat === "poros_tidak_sejajar"
                ? "Terdeteksi beban impak mekanis tinggi akibat defleksi poros penarik lidah rel."
                : currentWesel.kondisi_kandidat === "bantalan_aus"
                ? "Peningkatan getaran harmonik frekuensi sedang menandakan keausan bantalan pelat gelincir."
                : "Sensor berada dalam batas getaran aman dan toleransi dinas operasi normal."}
            </span>
          </div>
        </div>

        {/* Kolom 2: Grafik Tren 14 Hari */}
        <div className="card trend-chart-card">
          <div className="trend-card-header">
            <div>
              <h2 className="card-heading">Grafik Tren 14 Hari</h2>
              <p className="card-subheading">Pemantauan degradasi harian dengan garis batas 70 (B) &amp; 40 (A).</p>
            </div>
            <div className="trend-stats-pill">
              <span className="trend-rate-text">
                Laju: <strong>{laju > 0 ? `+${laju}` : laju} poin/hari</strong>
              </span>
              <span className="trend-forecast-text">
                Batas B: <strong>{perkiraanHari > 0 ? `${perkiraanHari} hari lagi` : "Sudah terlampaui"}</strong>
                <small> (perkiraan kasar)</small>
              </span>
            </div>
          </div>

          {/* SVG Line Chart with explicit 70 & 40 threshold lines */}
          <div className="svg-chart-wrapper">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="trend-svg"
            >
              {/* Y Axis Grid lines and labels */}
              {[100, 70, 40, 0].map((val) => {
                const y = padding.top + (1 - val / 100) * graphHeight;
                return (
                  <g key={val} className="y-axis-group">
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      className={val === 70 ? "threshold-line warning" : val === 40 ? "threshold-line danger" : "grid-line"}
                      strokeDasharray={val === 70 || val === 40 ? "4 4" : "none"}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      className={`axis-label ${val === 70 ? "warning-txt" : val === 40 ? "danger-txt" : ""}`}
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Threshold Labels */}
              <text
                x={chartWidth - padding.right}
                y={yThreshold70 - 6}
                textAnchor="end"
                className="threshold-annotation warning"
              >
                Batas Waspada (70)
              </text>
              <text
                x={chartWidth - padding.right}
                y={yThreshold40 - 6}
                textAnchor="end"
                className="threshold-annotation danger"
              >
                Batas Kritis Bahaya (40)
              </text>

              {/* Gradient Area Fill */}
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d3a2d" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0d3a2d" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {areaD && <path d={areaD} fill="url(#trendGradient)" />}

              {/* Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#0d3a2d"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint === i ? "6" : "4"}
                    className={`chart-data-circle ${pt.yVal <= 40 ? "danger" : pt.yVal <= 70 ? "warning" : "good"}`}
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* X Axis Date labels for selected intervals */}
                  {(i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1) && (
                    <text
                      x={pt.x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className="axis-label x-axis"
                    >
                      {pt.data.tanggal || pt.data.dateFull?.slice(5)}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint != null && points[hoveredPoint] && (
              <div
                className="chart-hover-tooltip"
                style={{
                  left: `${(points[hoveredPoint].x / chartWidth) * 100}%`,
                  top: `${(points[hoveredPoint].y / chartHeight) * 100}%`,
                }}
              >
                <strong>{points[hoveredPoint].data.tanggal || points[hoveredPoint].data.dateFull}</strong>
                <div>Indeks Rata: <span>{points[hoveredPoint].data.indeks_rata}</span></div>
                <div>Indeks Min: <span>{points[hoveredPoint].data.indeks_min}</span></div>
                <div>Siklus Anomali: <span>{points[hoveredPoint].data.jumlah_anomali}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analisis Agen Inline Panel (jika dipicu) */}
      {(isAnalyzing || analysisResult || analysisError) && (
        <div className="card agent-analysis-inline-card">
          <div className="card-header-bar">
            <div className="header-with-badge">
              <IconSparkles className="sparkle-icon-green" />
              <h2 className="card-heading">Hasil Analisis Agen Sintelis: {currentId}</h2>
            </div>
            {analysisResult?.session_id && (
              <button
                type="button"
                className="btn-primary-action btn-sm"
                onClick={() => {
                  onNavigate("chat", {
                    sessionId: analysisResult.session_id,
                    prompt: `Lanjutkan analisis teknis mengenai wesel ${currentId}.`,
                    history: [
                      { dari: "petugas", teks: `Periksa wesel ${currentId}` },
                      { dari: "agen", teks: analysisResult.jawaban, langkah: analysisResult.langkah },
                    ],
                  });
                }}
                title="Buka obrolan penuh dan ajukan pertanyaan lanjutan"
              >
                <span>Tanya Lanjut 💬</span>
              </button>
            )}
          </div>

          {isAnalyzing && (
            <div className="analyzing-state-box">
              <div className="loading-spinner" />
              <p>Agen sedang membaca sinyal akselerometer, riwayat, dan regulasi PD 10A…</p>
            </div>
          )}

          {analysisError && (
            <div className="analysis-error-banner">
              <IconAlertTriangle className="icon-warn-small" />
              <span>{analysisError}</span>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="analysis-result-content">
              {/* Reasoning steps log with translated tool names */}
              {analysisResult.langkah && analysisResult.langkah.length > 0 && (
                <div className="analysis-steps-section">
                  <h3 className="section-small-title">Alur Penalaran &amp; Pemeriksaan Regulasi:</h3>
                  <LogAgen langkah={analysisResult.langkah} />
                </div>
              )}

              {/* Agent Conclusion */}
              <div className="analysis-conclusion-section">
                <h3 className="section-small-title">Kesimpulan &amp; Rekomendasi Preskriptif:</h3>
                <div className="conclusion-markdown-box">
                  <Teks isi={analysisResult.jawaban || "Tidak ada rincian jawaban."} />
                </div>
              </div>

              {/* Quick Prompt Button to continue in Chat */}
              <div className="analysis-footer-action-bar">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => {
                    onNavigate("chat", {
                      sessionId: analysisResult.session_id,
                      prompt: `Bagaimana SOP dan estimasi durasi perbaikan untuk ${currentId}?`,
                      history: [
                        { dari: "petugas", teks: `Periksa wesel ${currentId}` },
                        { dari: "agen", teks: analysisResult.jawaban, langkah: analysisResult.langkah },
                      ],
                    });
                  }}
                >
                  <span>Tanya Prosedur SOP &amp; Regulasi ↗</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Riwayat Kejadian Wesel */}
      <div className="card incident-history-card">
        <div className="card-header-bar">
          <div>
            <h2 className="card-heading">Riwayat Kejadian &amp; Pemeliharaan</h2>
            <p className="card-subheading">Catatan riwayat perbaikan dan keputusan petugas masa lampau.</p>
          </div>
          <span className="history-count-badge">{riwayatData.length} Catatan</span>
        </div>

        {riwayatData.length > 0 ? (
          <div className="table-responsive-wrapper">
            <table className="custom-table riwayat-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kondisi Terdeteksi</th>
                  <th>Kelas Urgensi</th>
                  <th>Keputusan</th>
                  <th>Catatan Petugas</th>
                </tr>
              </thead>
              <tbody>
                {riwayatData.map((r, idx) => (
                  <tr key={idx}>
                    <td><strong>{r.tanggal}</strong></td>
                    <td>
                      <span className="condition-tag">{r.kondisi}</span>
                    </td>
                    <td>
                      <span className={`class-badge ${r.kelas?.toLowerCase()}`}>
                        Kelas {r.kelas}
                      </span>
                    </td>
                    <td>
                      <span className="decision-status-pill">
                        <IconCheck className="check-mini-icon" />
                        {r.keputusan_petugas || "Disetujui"}
                      </span>
                    </td>
                    <td>{r.catatan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-history-box">
            <p>Belum ada riwayat anomali atau pemeliharaan tercatat untuk wesel ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}