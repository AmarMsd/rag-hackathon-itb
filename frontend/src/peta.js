// Memuat data peta (OpenStreetMap, sudah diringkas) dan penempatan wesel yang dipantau.
// Keduanya berkas statis di /peta/, dimuat sekali lalu disimpan.

let janji = null;

export function muatPeta() {
  if (!janji) {
    janji = Promise.all([
      fetch("/peta/peta_osm.json").then((r) => { if (!r.ok) throw new Error("Data peta tidak ditemukan."); return r.json(); }),
      fetch("/peta/lokasi_wesel.json").then((r) => (r.ok ? r.json() : { wesel: {} })),
    ]).then(([peta, lokasi]) => {
      const byId = new Map(peta.wesel.map((w) => [w.id, w]));
      const titik = {};
      for (const [id, l] of Object.entries(lokasi.wesel || {})) {
        const s = byId.get(l.osm_id);
        if (s) titik[id] = { ...l, x: s.x, y: s.y, ref: s.ref };
      }
      return { peta, lokasi, titik };
    }).catch((e) => { janji = null; throw e; });
  }
  return janji;
}

export function teksLokasi(l) {
  if (!l) return null;
  const ref = l.ref ? `wesel ${l.ref}` : `wesel OSM ${l.osm_id}`;
  return `Stasiun ${l.stasiun}, ${ref}${l.ilustrasi ? " (lokasi ilustrasi)" : ""}`;
}
