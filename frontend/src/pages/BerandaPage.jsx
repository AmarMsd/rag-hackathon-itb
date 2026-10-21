import React from "react";
import { Status, Indeks, Kelas } from "../components/Unsur.jsx";
import { labelKondisi, labelSumber, lampu, urutkanWesel, waktuRelatif, STATUS } from "../kondisi.js";

const JARAK = 170;

// Papan mimik: setiap wesel digambar sebagai percabangan jalur dengan lampu status.
function DiagramEmplasemen({ wesel, onPilih }) {
  const urut = [...wesel].sort((a, b) => a.wesel_id.localeCompare(b.wesel_id, "id", { numeric: true }));
  const lebar = Math.max(880, 80 + urut.length * JARAK);
  const yUtama = 112;
  const yCabang = 52;
  const bantalan = [];
  for (let x = 24; x < lebar - 24; x += 16) bantalan.push(x);

  return (
    <svg viewBox={`0 0 ${lebar} 184`} role="group" aria-label="Diagram emplasemen">
      {bantalan.map((x) => <line key={x} className="bantalan" x1={x} y1={yUtama - 6} x2={x} y2={yUtama + 6} />)}
      <path className="rel" d={`M24 ${yUtama} H${lebar - 24}`} />
      <path className="rel" d={`M24 ${yUtama - 12} V${yUtama + 12} M${lebar - 24} ${yUtama - 12} V${yUtama + 12}`} />
      {urut.map((w, i) => {
        const x = 78 + i * JARAK;
        const lmp = lampu(w.status);
        const buka = () => onPilih(w.wesel_id);
        return (
          <g
            key={w.wesel_id}
            className="wesel"
            tabIndex={0}
            role="button"
            aria-label={`${w.wesel_id}, ${w.status}, indeks ${w.indeks_kesehatan}`}
            onClick={buka}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), buka())}
          >
            <rect className="bingkai" x={x - 44} y={10} width={JARAK - 14} height={166} rx="4" />
            <path className="rel-cabang" d={`M${x} ${yUtama} L${x + 46} ${yCabang} H${x + 104}`} />
            <path className="rel-cabang" d={`M${x + 104} ${yCabang - 9} V${yCabang + 9}`} />
            <line className="tiang" x1={x - 22} y1={yUtama - 4} x2={x - 22} y2={yCabang + 14} />
            <rect className="kepala" x={x - 31} y={yCabang - 14} width="18" height="28" rx="3" />
            <circle className={`lmp-${lmp}`} cx={x - 22} cy={yCabang} r="6" />
            <text className="id" x={x - 34} y={yUtama + 32}>{w.wesel_id}</text>
            <text className="ket" x={x - 34} y={yUtama + 52}>{w.status}, {w.indeks_kesehatan}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Hitungan({ wesel }) {
  const jumlah = Object.keys(STATUS).map((s) => [s, wesel.filter((w) => w.status === s).length]);
  return (
    <footer>
      {jumlah.map(([s, n]) => (
        <span key={s}>
          <span className={`wg-lampu ${STATUS[s].lampu}`} aria-hidden="true" />
          {s} <b>{n}</b>
        </span>
      ))}
      <em>Urutan di diagram mengikuti ID wesel, bukan tata letak emplasemen sebenarnya.</em>
    </footer>
  );
}

export function KondisiSel({ w }) {
  if (w.status === "Tidak dikenal" && w.kondisi_kandidat !== "tidak_dikenal") {
    return <span>Tidak cocok <span className="wg-redup">(terdekat: {labelKondisi(w.kondisi_kandidat).toLowerCase()}, skor {Number(w.skor_kecocokan).toLocaleString("id-ID", { minimumFractionDigits: 2 })})</span></span>;
  }
  return labelKondisi(w.kondisi_kandidat);
}

export default function BerandaPage({ wesel, workOrders, sudahMuat, onNavigate }) {
  const buka = (id) => onNavigate("detail", { weselId: id });
  const menunggu = workOrders.filter((w) => w.status?.startsWith("MENUNGGU"));

  if (sudahMuat && wesel.length === 0) {
    return (
      <section className="wg-panel wg-kosong">
        <b>Belum ada siklus yang masuk.</b>
        Jalankan penerima LoRa di gateway, atau isi data uji dengan simulasi.py. Wesel muncul di sini setelah siklus pertamanya diproses lapis 1.
      </section>
    );
  }

  return (
    <>
      <section className="wg-panel wg-diagram" aria-labelledby="judul-diagram">
        <header>
          <h2 id="judul-diagram">Diagram emplasemen</h2>
          <p>Lampu menunjukkan status lapis 1 tiap wesel. Pilih wesel untuk melihat ciri, tren, dan analisis agen.</p>
        </header>
        <div className="wg-diagram-gulir"><DiagramEmplasemen wesel={wesel} onPilih={buka} /></div>
        <Hitungan wesel={wesel} />
      </section>

      <div className="wg-dua">
        <section className="wg-panel" aria-labelledby="judul-tabel">
          <header>
            <h2 id="judul-tabel">Semua wesel</h2>
            <p>Diurutkan dari yang paling mendesak. Diperbarui tiap 5 detik.</p>
          </header>
          <div className="wg-tabel-bungkus">
            <table className="wg-tabel">
              <thead>
                <tr>
                  <th>Wesel</th>
                  <th>Status</th>
                  <th>Kondisi</th>
                  <th>Indeks</th>
                  <th>Sumber</th>
                  <th>Siklus terakhir</th>
                </tr>
              </thead>
              <tbody>
                {urutkanWesel(wesel).map((w) => (
                  <tr key={w.wesel_id} className="bisa-klik" onClick={() => buka(w.wesel_id)}>
                    <td>
                      <button type="button" className="wg-tautan wg-id" style={{ textDecoration: "none", color: "var(--ink)" }} onClick={(e) => { e.stopPropagation(); buka(w.wesel_id); }}>
                        {w.wesel_id}
                      </button>
                    </td>
                    <td><Status status={w.status} /></td>
                    <td><KondisiSel w={w} /></td>
                    <td><Indeks nilai={w.indeks_kesehatan} /></td>
                    <td className="wg-redup">{labelSumber(w.sumber)}</td>
                    <td className={w.menit_sejak_siklus_terakhir > 120 ? "wg-lewat" : "wg-redup"}>
                      {waktuRelatif(w.menit_sejak_siklus_terakhir)}
                      {w.menit_sejak_siklus_terakhir > 120 && ", sensor senyap"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="wg-panel" aria-labelledby="judul-antrean">
          <header>
            <h2 id="judul-antrean">Menunggu keputusan</h2>
            <p>{menunggu.length ? `${menunggu.length} usulan dari agen` : "Tidak ada usulan terbuka"}</p>
          </header>
          {menunggu.length === 0 ? (
            <p className="wg-kosong">Usulan work order dan eskalasi dari agen muncul di sini sampai petugas memutuskannya.</p>
          ) : (
            <ul className="wg-antrean">
              {menunggu.slice(0, 5).map((wo) => (
                <li key={wo.id}>
                  <div className="baris1">
                    {wo.jenis === "ESKALASI" ? <span className="wg-label eskalasi">Eskalasi</span> : <Kelas kelas={wo.kelas} />}
                    <span className="wg-id">{wo.wesel_id}</span>
                    <small>{wo.id}</small>
                  </div>
                  <p>{wo.ringkasan || wo.alasan}</p>
                </li>
              ))}
            </ul>
          )}
          <footer className="wg-antrean">
            <button type="button" className="wg-tombol kecil" onClick={() => onNavigate("workorders")}>Buka halaman keputusan</button>
          </footer>
        </section>
      </div>
    </>
  );
}
