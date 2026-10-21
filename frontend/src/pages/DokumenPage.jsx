import React, { useEffect, useState } from "react";
import {
  IconBookOpen,
  IconUpload,
  IconSearch,
  IconDownload,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconEye,
} from "../Icons.jsx";
import { api } from "../api.js";

const KATEGORI_OPTIONS = [
  { id: "semua", label: "Semua Kategori" },
  { id: "regulasi", label: "Regulasi (PD 10A dll)" },
  { id: "manual", label: "Manual Perawatan" },
  { id: "sop", label: "SOP & Instruksi Kerja" },
  { id: "riwayat_kerusakan", label: "Riwayat Kerusakan" },
  { id: "lainnya", label: "Lainnya" },
];

const STATUS_OPTIONS = [
  { id: "semua", label: "Semua Status" },
  { id: "aktif", label: "Aktif" },
  { id: "draf", label: "Draf" },
  { id: "nonaktif", label: "Nonaktif" },
  { id: "gagal", label: "Gagal" },
];

export default function DokumenPage({ user }) {
  const [dokumenList, setDokumenList] = useState([]);
  const [filterStatus, setFilterStatus] = useState("semua");
  const [filterKategori, setFilterKategori] = useState("semua");
  const [isLoading, setIsLoading] = useState(true);

  // Upload Form Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("regulasi");
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Inspect Draft / Chunks Modal
  const [inspectingDoc, setInspectingDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [isInspecting, setIsInspecting] = useState(false);

  // Test Search Tool Modal
  const [testingDoc, setTestingDoc] = useState(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const canManage = user?.peran === "pengelola" || user?.peran === "admin";

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.dokumen(
        filterStatus !== "semua" ? filterStatus : null,
        filterKategori !== "semua" ? filterKategori : null
      );
      setDokumenList(res || []);
    } catch (err) {
      console.error("Gagal memuat dokumen:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [filterStatus, filterKategori]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadError("Pilih file dan lengkapi judul dokumen.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("judul", uploadTitle.trim());
      formData.append("kategori", uploadCategory);

      await api.unggahDokumen(formData);
      setIsUploadOpen(false);
      setUploadTitle("");
      setUploadFile(null);
      loadDocuments();
    } catch (err) {
      setUploadError(err.message || "Gagal mengunggah dokumen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleStatus = async (doc, newStatus) => {
    try {
      if (newStatus === "aktif") {
        await api.aktifkanDokumen(doc.id);
      } else {
        await api.nonaktifkanDokumen(doc.id);
      }
      loadDocuments();
    } catch (err) {
      alert("Gagal mengubah status: " + err.message);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm("Hapus dokumen ini dan seluruh potongannya?")) return;
    try {
      await api.hapusDokumen(docId);
      loadDocuments();
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const handleOpenInspect = async (doc) => {
    setInspectingDoc(doc);
    setIsInspecting(true);
    try {
      const detail = await api.detailDokumen(doc.id, 0, 15);
      setChunks(detail?.potongan || []);
    } catch (err) {
      console.error("Gagal memuat potongan draf:", err);
      setChunks([]);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRunSearchTest = async (e) => {
    if (e) e.preventDefault();
    if (!testQuery.trim() || !testingDoc) return;

    setIsTesting(true);
    try {
      const res = await api.ujiDokumen(testingDoc.id, testQuery.trim());
      setTestResults(res?.hasil || []);
    } catch (err) {
      alert("Gagal menguji pencarian: " + err.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="page-view dokumen-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Dokumen Pengetahuan</h1>
          <p className="page-desc">
            Basis pengetahuan regulasi PD 10A, manual pemeliharaan elektrik, dan SOP yang dirujuk oleh agen AI Sintelis.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setIsUploadOpen(true)}
            title="Unggah dokumen PDF, TXT, atau Markdown baru"
          >
            <IconUpload className="btn-icon-left" />
            <span>Unggah Dokumen</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Status Bar */}
      <div className="dokumen-filter-bar">
        <div className="filter-group">
          <label className="filter-label">Kategori:</label>
          <select
            className="filter-select"
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
          >
            {KATEGORI_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Status:</label>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-stats-info">
          <span>Menampilkan <strong>{dokumenList.length}</strong> dokumen</span>
        </div>
      </div>

      {/* Dokumen Cards Grid */}
      <div className="dokumen-cards-grid">
        {isLoading ? (
          <div className="card loading-card-center">
            <div className="loading-spinner" />
            <p>Memuat daftar dokumen pengetahuan…</p>
          </div>
        ) : dokumenList.length > 0 ? (
          dokumenList.map((doc) => {
            const isFailed = doc.status === "gagal";
            const isActive = doc.status === "aktif";
            const isDraft = doc.status === "draf";

            return (
              <div key={doc.id} className={`dokumen-card status-${doc.status}`}>
                <div className="doc-card-header">
                  <div className="doc-category-badge">
                    <span>{doc.kategori?.toUpperCase()}</span>
                  </div>
                  <span className={`status-pill ${doc.status}`}>
                    {doc.status?.toUpperCase()}
                  </span>
                </div>

                <div className="doc-card-body">
                  <h3 className="doc-title">{doc.judul}</h3>
                  <div className="doc-file-info">
                    <span className="file-name">{doc.nama_file || "File berkas"}</span>
                    <span className="file-meta">
                      {doc.jumlah_halaman != null && `${doc.jumlah_halaman} hlm • `}
                      {doc.jumlah_potongan != null && `${doc.jumlah_potongan} potongan • `}
                      {doc.ukuran ? `${Math.round(doc.ukuran / 1024)} KB` : ""}
                    </span>
                  </div>

                  {/* Failed document reason */}
                  {isFailed && doc.pesan && (
                    <div className="doc-failed-banner">
                      <IconAlertTriangle className="icon-tiny" />
                      <span>{doc.pesan}</span>
                    </div>
                  )}

                  <div className="doc-uploader-meta">
                    Diunggah oleh <strong>{doc.diunggah_oleh || "pengelola"}</strong> •{" "}
                    {doc.diunggah_pada ? doc.diunggah_pada.slice(0, 10) : "Tersimpan"}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="doc-card-footer">
                  <div className="doc-actions-left">
                    {/* Unduh file asli */}
                    <a
                      href={api.unduhDokumenUrl(doc.id)}
                      download
                      className="doc-action-btn download"
                      title="Unduh berkas asli dokumen ini"
                    >
                      <IconDownload className="icon-tiny" />
                      <span>Unduh</span>
                    </a>

                    {/* Periksa draf cuplikan potongan */}
                    {!isFailed && (
                      <button
                        type="button"
                        className="doc-action-btn inspect"
                        onClick={() => handleOpenInspect(doc)}
                        title="Lihat cuplikan potongan teks dokumen"
                      >
                        <IconEye className="icon-tiny" />
                        <span>Periksa Draf</span>
                      </button>
                    )}

                    {/* Uji pencarian */}
                    {!isFailed && (
                      <button
                        type="button"
                        className="doc-action-btn test"
                        onClick={() => {
                          setTestingDoc(doc);
                          setTestResults(null);
                          setTestQuery("");
                        }}
                        title="Uji pencarian semantik pada dokumen ini sebelum aktif"
                      >
                        <IconSearch className="icon-tiny" />
                        <span>Uji Cari</span>
                      </button>
                    )}
                  </div>

                  {/* Management buttons for pengelola & admin */}
                  {canManage && (
                    <div className="doc-actions-right">
                      {!isFailed && (
                        isActive ? (
                          <button
                            type="button"
                            className="doc-status-btn deactivate"
                            onClick={() => handleToggleStatus(doc, "nonaktif")}
                            title="Nonaktifkan dokumen dari pemakaian agen"
                          >
                            Nonaktifkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="doc-status-btn activate"
                            onClick={() => handleToggleStatus(doc, "aktif")}
                            title="Aktifkan dokumen untuk dirujuk agen AI"
                          >
                            Aktifkan
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        className="doc-status-btn delete"
                        onClick={() => handleDelete(doc.id)}
                        title="Hapus dokumen ini secara permanen"
                      >
                        <IconTrash className="icon-tiny" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card empty-doc-card">
            <IconBookOpen className="empty-icon" />
            <h3>Tidak Ada Dokumen</h3>
            <p>Belum ada dokumen yang sesuai dengan filter kategori atau status yang dipilih.</p>
          </div>
        )}
      </div>

      {/* Modal 1: Form Unggah Dokumen */}
      {isUploadOpen && (
        <div className="modal-backdrop" onClick={() => setIsUploadOpen(false)}>
          <div
            className="modal-card upload-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Unggah Dokumen Pengetahuan"
          >
            <div className="modal-header">
              <h2 className="modal-title">Unggah Dokumen Pengetahuan Baru</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsUploadOpen(false)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="modal-body">
              {uploadError && (
                <div className="modal-error-alert">
                  <IconAlertTriangle className="icon-tiny" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="doc-title">
                  Judul Dokumen <span className="req-star">*</span>
                </label>
                <input
                  id="doc-title"
                  type="text"
                  className="field-input"
                  placeholder="Contoh: Manual Pemeliharaan Wesel Elektrik Alstom 2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="doc-cat">
                  Kategori Dokumen <span className="req-star">*</span>
                </label>
                <select
                  id="doc-cat"
                  className="field-select"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                >
                  <option value="regulasi">Regulasi (PD 10A, UU Perkeretaapian)</option>
                  <option value="manual">Manual Pemeliharaan Pabrikan</option>
                  <option value="sop">SOP &amp; Instruksi Kerja (IK)</option>
                  <option value="riwayat_kerusakan">Riwayat Kerusakan &amp; Investigasi</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="doc-file">
                  Pilih Berkas Dokumen (PDF, TXT, MD maks 20 MB) <span className="req-star">*</span>
                </label>
                <input
                  id="doc-file"
                  type="file"
                  className="field-file-input"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  required
                />
                <span className="field-hint">
                  Sistem akan mengekstrak teks per halaman dan memotongnya secara otomatis ke status <strong>DRAF</strong>.
                </span>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isUploading || !uploadFile || !uploadTitle.trim()}
                >
                  {isUploading ? "Mengunggah & Memproses…" : "Unggah & Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Periksa Draf (Cuplikan Potongan) */}
      {inspectingDoc && (
        <div className="modal-backdrop" onClick={() => setInspectingDoc(null)}>
          <div
            className="modal-card inspect-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Periksa Draf Dokumen"
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Periksa Draf: {inspectingDoc.judul}</h2>
                <p className="modal-subheading">
                  Menampilkan 10 potongan teks awal yang diekstrak untuk verifikasi konten.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectingDoc(null)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <div className="modal-body inspect-scroll-body">
              {isInspecting ? (
                <div className="loading-spinner-box">
                  <div className="loading-spinner" />
                  <p>Memuat potongan draf…</p>
                </div>
              ) : chunks.length > 0 ? (
                <div className="chunks-list">
                  {chunks.map((c, idx) => (
                    <div key={idx} className="chunk-item-card">
                      <div className="chunk-header">
                        <span className="chunk-number">Potongan #{c.urutan ?? idx + 1}</span>
                        {c.halaman != null && (
                          <span className="chunk-page">Halaman {c.halaman}</span>
                        )}
                      </div>
                      <p className="chunk-body-text">{c.isi}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-chunks-note">Belum ada potongan teks yang terekstrak dari berkas ini.</p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => setInspectingDoc(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Uji Pencarian Sebelum Aktif */}
      {testingDoc && (
        <div className="modal-backdrop" onClick={() => setTestingDoc(null)}>
          <div
            className="modal-card test-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Uji Pencarian Dokumen"
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Uji Pencarian: {testingDoc.judul}</h2>
                <p className="modal-subheading">
                  Coba cari kata kunci untuk memverifikasi potongan yang akan ditemukan agen sebelum dokumen diaktifkan.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setTestingDoc(null)}
              >
                <IconX className="close-icon" />
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleRunSearchTest} className="test-search-form">
                <input
                  type="text"
                  className="test-search-input"
                  placeholder="Ketik kata kunci (misal: 'batas pembalikan', 'toleransi celah', 'akselerometer')..."
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isTesting || !testQuery.trim()}
                >
                  {isTesting ? "Mencari…" : "Uji Cari"}
                </button>
              </form>

              {testResults && (
                <div className="test-results-container">
                  <h3 className="results-heading">
                    Hasil Uji Pencarian ({testResults.length} potongan ditemukan):
                  </h3>
                  {testResults.length > 0 ? (
                    <div className="test-results-list">
                      {testResults.map((r, i) => (
                        <div key={i} className="test-match-card">
                          <span className="match-page-tag">
                            Halaman {r.halaman ?? "?"}
                          </span>
                          <p className="match-snippet">{r.isi}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-match-note">
                      Tidak ditemukan potongan teks yang cocok dengan kata kunci "{testQuery}".
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => setTestingDoc(null)}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}