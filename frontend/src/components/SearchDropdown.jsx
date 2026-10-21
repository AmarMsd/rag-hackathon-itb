import React, { useState, useEffect } from "react";
import { IconSearch, IconX } from "../Icons.jsx";
import { api } from "../api.js";

export default function SearchDropdown({
  query,
  isOpen,
  onClose,
  onSelectWesel,
  onNavigate,
}) {
  const [selectedType, setSelectedType] = useState("semua");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.cari(query.trim(), selectedType, 5);
        setSearchResults(res);
      } catch (err) {
        console.error("Gagal melakukan pencarian:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, selectedType]);

  if (!isOpen || !query || query.trim().length < 2) return null;

  const totalHasil = searchResults?.jumlah || 0;
  const hasil = searchResults?.hasil || {};

  return (
    <div className="search-dropdown-menu" onClick={(e) => e.stopPropagation()}>
      {/* Search Filter Header */}
      <div className="search-dropdown-header">
        <span className="search-count-label">
          {isSearching
            ? "Mencari data…"
            : `${totalHasil} hasil ditemukan untuk "${query}"`}
        </span>

        <div className="search-type-filters">
          {[
            { id: "semua", label: "Semua" },
            { id: "wesel", label: "Wesel" },
            { id: "work_order", label: "Work Order" },
            { id: "regulasi", label: "Regulasi KAI" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`search-type-pill ${selectedType === tab.id ? "active" : ""}`}
              onClick={() => setSelectedType(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Content */}
      <div className="search-results-container">
        {totalHasil === 0 && !isSearching && (
          <div className="search-empty-state">
            Tidak ada data yang cocok dengan "{query}". Coba kata kunci ID wesel (W-01A), nomor WO, atau pasal PD 10A.
          </div>
        )}

        {/* 1. Kategori Wesel */}
        {hasil.wesel && hasil.wesel.length > 0 && (
          <div className="search-category-group">
            <h4 className="category-title">Wesel</h4>
            <div className="category-items">
              {hasil.wesel.map((w) => (
                <div
                  key={w.wesel_id}
                  className="search-item-row"
                  onClick={() => {
                    onSelectWesel && onSelectWesel(w.wesel_id);
                    if (onNavigate) onNavigate("detail", { weselId: w.wesel_id });
                    onClose();
                  }}
                >
                  <div className="item-main-col">
                    <strong className="item-title">{w.wesel_id}</strong>
                    <span className="item-sub">
                      Kondisi: {w.kondisi_kandidat?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="item-right-col">
                    <span className={`item-status-pill ${w.status?.toLowerCase()}`}>
                      {w.status}
                    </span>
                    <span className="item-score">{w.indeks_kesehatan}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Kategori Work Order */}
        {hasil.work_order && hasil.work_order.length > 0 && (
          <div className="search-category-group">
            <h4 className="category-title">Work Orders</h4>
            <div className="category-items">
              {hasil.work_order.map((wo) => (
                <div
                  key={wo.id}
                  className="search-item-row"
                  onClick={() => {
                    if (onNavigate) onNavigate("workorders");
                    onClose();
                  }}
                >
                  <div className="item-main-col">
                    <div className="wo-title-line">
                      <strong className="item-title">{wo.id}</strong>
                      <span className="item-sub-tag">{wo.wesel_id}</span>
                      <span className="wo-class-tag">Kelas {wo.kelas}</span>
                    </div>
                    <p className="item-desc">{wo.ringkasan || wo.alasan}</p>
                  </div>
                  <div className="item-right-col">
                    <span className="item-status-pill warning">{wo.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Kategori Dokumen / Regulasi */}
        {hasil.dokumen && hasil.dokumen.length > 0 && (
          <div className="search-category-group">
            <h4 className="category-title">Dokumen Pengetahuan</h4>
            <div className="category-items">
              {hasil.dokumen.map((d) => (
                <div
                  key={d.id}
                  className="search-item-row"
                  onClick={() => {
                    if (onNavigate) onNavigate("dokumen");
                    onClose();
                  }}
                >
                  <div className="item-main-col">
                    <strong className="item-title">{d.judul}</strong>
                    <span className="item-sub">Kategori: {d.kategori} • {d.nama_file}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Kategori Regulasi PD 10A */}
        {hasil.regulasi && hasil.regulasi.length > 0 && (
          <div className="search-category-group">
            <h4 className="category-title">Regulasi Teknis KAI (PD 10A)</h4>
            <div className="category-items">
              {hasil.regulasi.map((r, i) => (
                <div
                  key={i}
                  className="search-item-row law-row"
                  onClick={() => {
                    if (onNavigate) onNavigate("dokumen");
                    onClose();
                  }}
                >
                  <div className="item-main-col">
                    <strong className="item-title">{r.sumber} (Hal. {r.halaman})</strong>
                    <p className="item-desc quote">"{r.cuplikan}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
