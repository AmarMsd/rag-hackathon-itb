// Penampil markdown sederhana untuk jawaban agen: paragraf, daftar, dan **tebal**.
function Baris({ teks }) {
  return teks.split(/(\*\*[^*]+\*\*)/g).map((b, i) =>
    b.startsWith("**") && b.endsWith("**") ? <strong key={i}>{b.slice(2, -2)}</strong> : b
  );
}

export default function Teks({ isi }) {
  const blok = [];
  for (const baris of isi.split("\n")) {
    const t = baris.trim();
    if (!t) continue;
    const butir = t.match(/^([-*•]|\d+[.)])\s+(.*)/);
    const hasil = t.replace(/^#+\s*/, "");
    if (butir) {
      const akhir = blok[blok.length - 1];
      if (akhir?.jenis === "daftar") akhir.isi.push(butir[2]);
      else blok.push({ jenis: "daftar", isi: [butir[2]] });
    } else blok.push({ jenis: "p", isi: hasil });
  }
  return (
    <div className="teks">
      {blok.map((b, i) =>
        b.jenis === "daftar" ? (
          <ul key={i}>{b.isi.map((x, j) => <li key={j}><Baris teks={x} /></li>)}</ul>
        ) : (
          <p key={i}><Baris teks={b.isi} /></p>
        )
      )}
    </div>
  );
}
