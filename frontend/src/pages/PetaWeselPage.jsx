import React, { useEffect, useMemo, useRef, useState } from "react";
import { muatPeta, teksLokasi } from "../peta.js";
import { Lampu, Status } from "../components/Unsur.jsx";
import { lampu, urutkanWesel } from "../kondisi.js";

const TINGGI = 560;

function batasTitik(daftar, tepi = 2500) {
  const xs = daftar.map((t) => t.x), ys = daftar.map((t) => t.y);
  const x0 = Math.min(...xs) - tepi, x1 = Math.max(...xs) + tepi;
  const y0 = Math.min(...ys) - tepi, y1 = Math.max(...ys) + tepi;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

export default function PetaWeselPage({ wesel, onNavigate }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState("");
  const [lebarPx, setLebarPx] = useState(900);
  const [view, setView] = useState(null);
  const [sorot, setSorot] = useState(null);
  const kotak = useRef(null);
  const seret = useRef(null);

  useEffect(() => { muatPeta().then(setData).catch((e) => setGalat(e.message)); }, []);

  useEffect(() => {
    if (!kotak.current) return;
    const ro = new ResizeObserver(([e]) => setLebarPx(e.contentRect.width || 900));
    ro.observe(kotak.current);
    return () => ro.disconnect();
  }, [data, !!view]);

  const dipantau = useMemo(() => {
    if (!data) return [];
    return urutkanWesel(wesel).map((w) => ({ ...w, lokasi: data.titik[w.wesel_id] })).filter((w) => w.lokasi);
  }, [data, wesel]);

  function pasKe(b) {
    const w = Math.max(b.w, (b.h * lebarPx) / TINGGI);
    setView({ cx: b.cx, cy: b.cy, w });
  }
  const viewDipantau = () => dipantau.length ? pasKe(batasTitik(dipantau.map((d) => d.lokasi))) : semua();
  const semua = () => data && pasKe(batasTitik(data.peta.stasiun, 3000));

  // Pas ke wesel dipantau saat data siap, lalu sekali lagi setelah lebar bingkai terukur.
  const sudahUkur = useRef(false);
  useEffect(() => { if (data && !view) viewDipantau(); }, [data, dipantau.length]);
  useEffect(() => {
    if (view && kotak.current && !sudahUkur.current) { sudahUkur.current = true; viewDipantau(); }
  }, [lebarPx]);

  const jalur = useMemo(() => {
    if (!data) return { utama: "", layanan: "", cepat: "" };
    const d = { utama: [], layanan: [], cepat: [] };
    for (const r of data.peta.rel) {
      const p = r.p;
      let s = `M${p[0]} ${p[1]}`;
      for (let i = 2; i < p.length; i += 2) s += `L${p[i]} ${p[i + 1]}`;
      d[r.k].push(s);
    }
    return { utama: d.utama.join(""), layanan: d.layanan.join(""), cepat: d.cepat.join("") };
  }, [data]);

  if (galat) return <section className="wg-panel wg-kosong"><b>Peta tidak bisa dimuat.</b>{galat}</section>;
  if (!data || !view) return <p className="wg-sedang">Memuat peta</p>;

  const mpp = view.w / lebarPx; // meter per piksel
  const h = TINGGI * mpp;
  const vb = `${view.cx - view.w / 2} ${view.cy - h / 2} ${view.w} ${h}`;
  const px = (n) => n * mpp;

  function zoom(faktor, fx = 0.5, fy = 0.5) {
    setView((v) => {
      const w2 = Math.min(Math.max(v.w * faktor, 300), 260000);
      const ax = v.cx - v.w / 2 + fx * v.w, ay = v.cy - (TINGGI * v.w / lebarPx) / 2 + fy * (TINGGI * v.w / lebarPx);
      const h2 = TINGGI * w2 / lebarPx;
      return { w: w2, cx: ax - fx * w2 + w2 / 2, cy: ay - fy * h2 + h2 / 2 };
    });
  }
  function roda(e) {
    const r = e.currentTarget.getBoundingClientRect();
    zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  function mulai(e) { seret.current = { x: e.clientX, y: e.clientY, v: view }; e.currentTarget.setPointerCapture(e.pointerId); }
  function gerak(e) {
    if (!seret.current) return;
    const { x, y, v } = seret.current;
    setView({ ...v, cx: v.cx - (e.clientX - x) * mpp, cy: v.cy - (e.clientY - y) * mpp });
  }
  const selesai = () => { seret.current = null; };
  const fokus = (w) => { setSorot(w.wesel_id); setView({ cx: w.lokasi.x, cy: w.lokasi.y, w: 1800 }); };

  const tampilStasiun = mpp < 80;
  const stasiunDipantau = new Set(dipantau.map((w) => w.lokasi.stasiun));
  return (
    <div className="wg-dua">
      <section className="wg-panel wg-peta" aria-label="Peta wesel">
        <header>
          <h2>Peta wesel</h2>
          <p>{data.peta.wesel.length} wesel tercatat di OpenStreetMap untuk wilayah ini. {dipantau.length} dipantau WeselGuard, semuanya di lokasi ilustrasi.</p>
        </header>
        <div className="wg-peta-bingkai" ref={kotak}>
          <svg
            viewBox={vb}
            style={{ height: TINGGI }}
            onWheel={roda}
            onPointerDown={mulai}
            onPointerMove={gerak}
            onPointerUp={selesai}
            onPointerLeave={selesai}
            role="img"
            aria-label="Peta jalur rel dan wesel di sekitar Bandung"
          >
            <path className="rel-layanan" d={jalur.layanan} />
            <path className="rel-cepat" d={jalur.cepat} />
            <path className="rel-utama" d={jalur.utama} />
            {data.peta.wesel.map((s) => (
              <circle key={s.id} className="wesel-osm" cx={s.x} cy={s.y} r={px(mpp < 8 ? 3 : 1.8)}>
                <title>{s.ref ? `Wesel ${s.ref}` : "Wesel"} (OSM {s.id})</title>
              </circle>
            ))}
            {tampilStasiun && data.peta.stasiun.map((s) => (
              <g key={s.nama} className="stasiun">
                <rect x={s.x - px(4)} y={s.y - px(4)} width={px(8)} height={px(8)} rx={px(2)} />
                {!(stasiunDipantau.has(s.nama) && mpp > 12) && (
                  <text x={s.x + px(8)} y={s.y + px(4)} style={{ fontSize: px(12) }}>{s.nama}</text>
                )}
              </g>
            ))}
            {dipantau.map((w) => (
              <g
                key={w.wesel_id}
                className={`dipantau ${sorot === w.wesel_id ? "sorot" : ""}`}
                onClick={() => onNavigate("detail", { weselId: w.wesel_id })}
                onPointerDown={(e) => e.stopPropagation()}
                role="button"
                tabIndex={0}
                aria-label={`${w.wesel_id}, ${w.status}`}
                onKeyDown={(e) => e.key === "Enter" && onNavigate("detail", { weselId: w.wesel_id })}
              >
                <circle className={`halo lmp-${lampu(w.status)}`} cx={w.lokasi.x} cy={w.lokasi.y} r={px(15)} />
                <circle className={`inti lmp-${lampu(w.status)}`} cx={w.lokasi.x} cy={w.lokasi.y} r={px(7)} strokeWidth={px(2.5)} />
                <text x={w.lokasi.x + px(12)} y={w.lokasi.y - px(10)} style={{ fontSize: px(14) }}>{w.wesel_id}</text>
              </g>
            ))}
          </svg>
          <div className="wg-peta-kendali">
            <button type="button" aria-label="Perbesar" onClick={() => zoom(1 / 1.6)}>+</button>
            <button type="button" aria-label="Perkecil" onClick={() => zoom(1.6)}>−</button>
          </div>
          <div className="wg-peta-tampilan">
            <button type="button" className="wg-tombol kecil" onClick={viewDipantau}>Wesel dipantau</button>
            <button type="button" className="wg-tombol kecil" onClick={semua}>Seluruh wilayah</button>
          </div>
          <span className="wg-peta-skala">{mpp * 100 >= 1000 ? `${(mpp * 100 / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${Math.round(mpp * 100)} m`}<i /></span>
        </div>
        <footer className="wg-peta-kaki">
          <span><i className="g utama" />Jalur utama</span>
          <span><i className="g layanan" />Sepur simpang dan emplasemen</span>
          <span><i className="g cepat" />Kereta cepat</span>
          <span><i className="t" />Wesel di OpenStreetMap</span>
          <em>Seret untuk menggeser, gulir untuk memperbesar. Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL.</em>
        </footer>
      </section>

      <section className="wg-panel" aria-label="Wesel yang dipantau">
        <header>
          <h2>Wesel dipantau</h2>
          <p>Lokasi ilustrasi: PM-01 adalah rig peniru dan W-xx adalah data simulasi. Penempatan diatur di peta/lokasi_wesel.json.</p>
        </header>
        <ul className="wg-antrean">
          {dipantau.map((w) => (
            <li key={w.wesel_id}>
              <div className="baris1">
                <Lampu status={w.status} />
                <span className="wg-id">{w.wesel_id}</span>
                <Status status={w.status} lampu={false} />
              </div>
              <p>{teksLokasi(w.lokasi)}</p>
              <div className="wg-baris-aksi" style={{ marginTop: 8 }}>
                <button type="button" className="wg-tombol kecil" onClick={() => fokus(w)}>Tunjukkan di peta</button>
                <button type="button" className="wg-tombol kecil" onClick={() => onNavigate("detail", { weselId: w.wesel_id })}>Buka detail</button>
              </div>
            </li>
          ))}
          {wesel.filter((w) => !data.titik[w.wesel_id]).map((w) => (
            <li key={w.wesel_id}><div className="baris1"><span className="wg-id">{w.wesel_id}</span><small>belum punya lokasi</small></div></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
