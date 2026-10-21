import React, { useState } from "react";
import { IconChevronDown } from "./Icons.jsx";

const TOOL_NAMES = {
  prioritas_wesel: "Menentukan Prioritas Wesel",
  deteksi_anomali: "Membaca Sinyal & Sensor Getaran",
  tren_wesel: "Menganalisis Tren Degradasi 14 Hari",
  cari_manual: "Mencari Prosedur Manual Sintelis",
  cari_dokumen: "Memeriksa Dokumen Pengetahuan",
  cari_regulasi: "Memeriksa Ketentuan Regulasi PD 10A",
  cek_riwayat: "Membaca Riwayat Perawatan Wesel",
  nilai_urgensi: "Mengevaluasi Tingkat Urgensi Keselamatan",
  buat_work_order: "Menyusun Draf Usulan Work Order",
  eskalasi: "Mengajukan Eskalasi ke Teknisi Ahli",
};

function formatParamSummary(params) {
  if (!params) return null;
  if (typeof params === "string") return params;
  return Object.entries(params)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" • ");
}

export default function LogAgen({ langkah }) {
  const [isOpen, setIsOpen] = useState(false);
  // Default to showing JSON view for detailed technical inspection
  const [viewModes, setViewModes] = useState({});

  if (!langkah || !langkah.length) return null;

  // Combine pair "panggil" + "hasil"
  const gabung = [];
  for (const l of langkah) {
    if (l.jenis === "hasil") {
      const cocok = [...gabung].reverse().find((g) => g.tool === l.tool && !g.hasil);
      if (cocok) {
        cocok.hasil = l.data;
        continue;
      }
    }
    gabung.push({
      tool: l.tool,
      jenis: l.jenis,
      masukan: l.jenis === "panggil" ? l.data : null,
      hasil: l.jenis === "hasil" ? l.data : null,
      catatan: l.jenis === "catatan" ? l.data : null,
    });
  }

  const toggleViewMode = (idx) => {
    setViewModes((prev) => ({
      ...prev,
      [idx]: prev[idx] === "summary" ? "json" : "summary",
    }));
  };

  return (
    <div className="agent-steps-accordion">
      {/* Accordion Toggle Bar - No icon */}
      <button
        type="button"
        className={`steps-toggle-btn ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Klik untuk melihat alur penalaran agen"
      >
        <div className="steps-toggle-left">
          <span className="steps-toggle-title">
            Proses Penalaran Agen ({gabung.length} langkah)
          </span>
        </div>
        <div className="steps-toggle-right">
          <span className="steps-hint-text">{isOpen ? "Sembunyikan" : "Lihat alur"}</span>
          <IconChevronDown className={`steps-chevron ${isOpen ? "rotated" : ""}`} />
        </div>
      </button>

      {/* Expanded Steps List - Clean Numbering, No Emojis, Robust overflow-x */}
      {isOpen && (
        <div className="steps-body-timeline">
          {gabung.map((g, i) => {
            const toolTitle = TOOL_NAMES[g.tool] || (g.tool ? g.tool.replaceAll("_", " ") : "Langkah agen");
            const mode = viewModes[i] || "json"; // Default to JSON view with proper overflow_x

            return (
              <div key={i} className="step-timeline-node">
                <div className="step-content-card">
                  {g.catatan ? (
                    <div className="step-note-row">
                      <span className="step-number">{i + 1}.</span>
                      <span className="step-note-text">"{g.catatan}"</span>
                    </div>
                  ) : (
                    <>
                      <div className="step-card-header">
                        <div className="step-title-group">
                          <span className="step-number">{i + 1}.</span>
                          <span className="step-title-name">{toolTitle}</span>
                          <code className="step-code-badge">{g.tool}</code>
                        </div>

                        {g.hasil && (
                          <button
                            type="button"
                            className="step-json-toggle"
                            onClick={() => toggleViewMode(i)}
                          >
                            {mode === "json" ? "Teks Ringkas" : "Format JSON"}
                          </button>
                        )}
                      </div>

                      {/* Input parameters */}
                      {g.masukan && (
                        <div className="step-param-row">
                          <span className="param-label">Masukan:</span>
                          <span className="param-value">{formatParamSummary(g.masukan)}</span>
                        </div>
                      )}

                      {/* Output result with guaranteed overflow-x */}
                      {g.hasil && (
                        <div className="step-result-area">
                          {mode === "json" ? (
                            <pre className="step-raw-json">
                              <code>{JSON.stringify(g.hasil, null, 2)}</code>
                            </pre>
                          ) : (
                            <div className="step-summary-badge">
                              {typeof g.hasil === "string"
                                ? g.hasil
                                : g.hasil.pesan || g.hasil.status || "Data berhasil diproses."}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
