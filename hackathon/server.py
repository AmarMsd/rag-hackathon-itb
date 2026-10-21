"""Server dashboard WeselGuard: API untuk dashboard React + menjalankan agen ADK.

Jalankan dari folder ini:
  uvicorn server:app --host 0.0.0.0 --port 8080
"""
import asyncio
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

AKAR = Path(__file__).parent
load_dotenv(AKAR / "weselguard" / ".env")  # harus sebelum agen diimpor

import asyncio as _asyncio  # noqa: E402

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from fastapi.responses import FileResponse, JSONResponse, Response as Berkas  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from google.adk.runners import Runner  # noqa: E402
from google.adk.sessions import InMemorySessionService  # noqa: E402
from google.genai import types  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from weselguard import database as db  # noqa: E402
from weselguard import dokumen, koneksi, lapis1, laporan, notifikasi, pencarian, percakapan  # noqa: E402
from weselguard.agent import root_agent  # noqa: E402

APP_NAME = "weselguard"
COOKIE = "wg_sesi"
PUBLIK = {"/api/login"}
# Tindakan non-GET yang boleh dilakukan semua peran
BOLEH_SEMUA = ("/api/logout", "/api/notifikasi/", "/api/saya/ganti-sandi")
PERIKSA_BERKALA_DETIK = 60


async def pemeriksa_berkala():
    """Berjalan di latar belakang: sensor senyap dan perubahan koneksi online/offline."""
    status_lama = None
    while True:
        try:
            await asyncio.to_thread(notifikasi.cek_sensor_senyap)
            k = await asyncio.to_thread(koneksi.cek, True)
            if status_lama is not None and k["status"] != status_lama:
                if k["status"] == "online":
                    notifikasi.buat("koneksi", "info", "Gateway kembali online", k["pesan"])
                else:
                    notifikasi.buat("koneksi", "peringatan", f"Gateway {k['status']}", k["pesan"])
            status_lama = k["status"]
            for username, sid in percakapan.kedaluwarsa():  # hapus percakapan lama
                await _hapus_percakapan(username, sid)
        except Exception as e:  # pemeriksa tidak boleh menghentikan server
            print("Pemeriksa berkala gagal:", e)
        await asyncio.sleep(PERIKSA_BERKALA_DETIK)


@asynccontextmanager
async def lifespan(_app):
    tugas = asyncio.create_task(pemeriksa_berkala())
    yield
    tugas.cancel()

app = FastAPI(title="WeselGuard", lifespan=lifespan)


def _layanan_sesi():
    """Percakapan disimpan permanen di SQLite (butuh: pip install sqlalchemy).
    Tanpa sqlalchemy, server tetap jalan tetapi percakapan hilang saat server di-restart."""
    try:
        from google.adk.sessions import DatabaseSessionService
        return DatabaseSessionService(db_url=f"sqlite+aiosqlite:///{AKAR / 'weselguard' / 'data' / 'percakapan.db'}"), True
    except ImportError:
        print("PERINGATAN: sqlalchemy belum terpasang; riwayat percakapan tidak permanen. "
              "Jalankan: pip install sqlalchemy")
        return InMemorySessionService(), False


layanan_sesi, SESI_PERMANEN = _layanan_sesi()
runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=layanan_sesi)
status_agen = {"aktif": True}
sedang_berjalan: set[asyncio.Event] = set()


# ---------- Login dan sesi ----------

@app.middleware("http")
async def wajib_login(request: Request, call_next):
    """Semua /api kecuali /api/login butuh sesi yang masih berlaku. Hak ubah (non-GET):
    - /api/pengguna... (semua method) hanya admin
    - /api/dokumen...           hanya pengelola
    - tindakan operasional lain hanya admin dan petugas
    - pengamat dan pengelola selain itu hanya bisa melihat"""
    path = request.url.path
    if path.startswith("/api") and path not in PUBLIK:
        pengguna = db.pengguna_dari_token(request.cookies.get(COOKIE))
        if pengguna is None:
            return JSONResponse({"detail": "Sesi habis atau belum masuk. Silakan masuk lagi."}, status_code=401)
        if path.startswith("/api/pengguna") and pengguna["peran"] != "admin":
            return JSONResponse({"detail": "Hanya admin yang bisa mengelola akun."}, status_code=403)
        if request.method != "GET" and not path.startswith(BOLEH_SEMUA):
            peran = pengguna["peran"]
            if path.startswith("/api/dokumen"):
                if peran != "pengelola":
                    return JSONResponse({"detail": "Hanya akun pengelola yang bisa mengelola dokumen pengetahuan."},
                                        status_code=403)
            elif peran not in ("admin", "petugas"):
                return JSONResponse({"detail": f"Akun {peran} hanya bisa melihat, tidak bisa mengubah."},
                                    status_code=403)
        request.state.pengguna = pengguna
    return await call_next(request)


class Masuk(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(isi: Masuk, response: Response):
    hasil = db.masuk(isi.username.strip().lower(), isi.password)
    if hasil is None:
        await _asyncio.sleep(1)  # memperlambat tebakan kata sandi berulang
        raise HTTPException(401, "Nama pengguna atau kata sandi salah.")
    token, pengguna = hasil
    response.set_cookie(COOKIE, token, max_age=db.LAMA_SESI_JAM * 3600, httponly=True, samesite="lax")
    return pengguna


@app.post("/api/logout")
def logout(request: Request, response: Response):
    db.keluar(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/saya")
def saya(request: Request):
    return request.state.pengguna


async def jalankan_agen(pesan: str, user_id: str, session_id: str | None = None,
                        jenis: str = "chat", judul: str | None = None) -> dict:
    """Menjalankan agen, mengumpulkan setiap langkahnya, lalu mencatat percakapan.
    Tanpa session_id: percakapan baru. Dengan session_id: melanjutkan percakapan milik sendiri."""
    if not status_agen["aktif"]:
        raise HTTPException(409, "Agen sedang dihentikan petugas. Aktifkan lagi untuk melanjutkan.")
    if not pesan.strip():
        raise HTTPException(400, "Pesan tidak boleh kosong.")
    if session_id is None:
        sesi = await runner.session_service.create_session(app_name=APP_NAME, user_id=user_id)
        session_id = sesi.id
    else:
        if percakapan.ambil(user_id, session_id) is None:
            raise HTTPException(404, "Percakapan tidak ditemukan. Mulai percakapan baru tanpa session_id.")
        if await runner.session_service.get_session(
                app_name=APP_NAME, user_id=user_id, session_id=session_id) is None:
            raise HTTPException(410, "Isi percakapan ini sudah tidak tersedia (server di-restart tanpa "
                                     "penyimpanan permanen). Mulai percakapan baru.")

    batal = asyncio.Event()
    sedang_berjalan.add(batal)
    langkah, jawaban = [], ""
    try:
        async for ev in runner.run_async(
                user_id=user_id, session_id=session_id, abort_signal=batal,
                new_message=types.Content(role="user", parts=[types.Part(text=pesan)])):
            for fc in ev.get_function_calls():
                langkah.append({"jenis": "panggil", "tool": fc.name, "data": dict(fc.args or {})})
            for fr in ev.get_function_responses():
                langkah.append({"jenis": "hasil", "tool": fr.name, "data": fr.response})
            teks = "".join(p.text or "" for p in (ev.content.parts if ev.content and ev.content.parts else [])
                           if not getattr(p, "thought", False))
            if teks and ev.is_final_response():
                jawaban = teks
            elif teks:
                langkah.append({"jenis": "catatan", "tool": None, "data": teks})
    except HTTPException:
        raise
    except Exception as e:  # biasanya koneksi ke model putus atau kredensial habis
        k = await asyncio.to_thread(koneksi.cek, True)
        raise HTTPException(503, f"Agen gagal menghubungi model ({type(e).__name__}). {k['pesan']}")
    finally:
        sedang_berjalan.discard(batal)
    if batal.is_set():
        jawaban = jawaban or "Analisis dihentikan petugas sebelum selesai."
    percakapan.catat(session_id, user_id, jenis, pesan, jawaban, judul)
    return {"session_id": session_id, "langkah": langkah, "jawaban": jawaban}


# ---------- API ----------

@app.get("/api/wesel")
def daftar_wesel():
    return lapis1.status_semua()


@app.get("/api/wesel/{wesel_id}/tren")
def tren(wesel_id: str, hari: int = 14):
    return lapis1.tren(wesel_id, hari)


@app.post("/api/wesel/{wesel_id}/analisis")
async def analisis(wesel_id: str, request: Request):
    if wesel_id not in db.daftar_wesel():
        raise HTTPException(404, f"Wesel {wesel_id} tidak ditemukan.")
    return await jalankan_agen(f"Periksa wesel {wesel_id}", request.state.pengguna["username"],
                               jenis="analisis", judul=f"Analisis {wesel_id}")


class Chat(BaseModel):
    pesan: str
    session_id: str | None = None


@app.post("/api/chat")
async def chat(isi: Chat, request: Request):
    # Percakapan terikat ke akun yang login. Tanpa session_id = percakapan baru.
    return await jalankan_agen(isi.pesan, request.state.pengguna["username"], isi.session_id or None)


@app.get("/api/agen")
def agen():
    return {"aktif": status_agen["aktif"], "berjalan": len(sedang_berjalan)}


@app.post("/api/agen/{aksi}")
def ubah_agen(aksi: str):
    if aksi not in ("hentikan", "aktifkan"):
        raise HTTPException(400, "Aksi harus 'hentikan' atau 'aktifkan'.")
    status_agen["aktif"] = aksi == "aktifkan"
    if aksi == "hentikan":
        for batal in list(sedang_berjalan):
            batal.set()
    return agen()


@app.get("/api/work-orders")
def work_orders():
    return list(reversed(db.work_orders()))


class Keputusan(BaseModel):
    catatan: str = ""


@app.post("/api/work-orders/{wo_id}/{aksi}")
def putuskan(wo_id: str, aksi: str, isi: Keputusan, request: Request):
    if aksi not in ("setujui", "tolak"):
        raise HTTPException(400, "Aksi harus 'setujui' atau 'tolak'.")
    wo = next((w for w in db.work_orders() if w["id"] == wo_id), None)
    if wo is None:
        raise HTTPException(404, f"{wo_id} tidak ditemukan.")
    if not wo["status"].startswith("MENUNGGU"):
        raise HTTPException(409, f"{wo_id} sudah diputuskan: {wo['status']}.")
    p = request.state.pengguna
    wo = db.ubah_status_work_order(wo_id, "DISETUJUI" if aksi == "setujui" else "DITOLAK",
                                   isi.catatan, p["username"])
    if wo["jenis"] == "WORK_ORDER":  # masuk riwayat agar dibaca agen lewat cek_riwayat
        catatan = f"{isi.catatan} (oleh {p['nama']})" if isi.catatan else f"(oleh {p['nama']})"
        db.tambah_riwayat(wo["wesel_id"], date.today().isoformat(), wo["kondisi"], wo["kelas"],
                          "disetujui" if aksi == "setujui" else "ditolak", catatan)
    notifikasi.buat("keputusan", "info", f"{wo_id} {wo['status'].lower()} oleh {p['nama']}",
                    isi.catatan, wo["wesel_id"], wo_id)
    return wo


@app.get("/api/riwayat/{wesel_id}")
def riwayat(wesel_id: str):
    return list(reversed(db.riwayat(wesel_id)))


# ---------- Pencarian, koneksi, laporan, notifikasi ----------

@app.get("/api/cari")
def cari(q: str, jenis: str = "semua", batas: int = 5):
    if len(q.strip()) < 2:
        raise HTTPException(400, "Kata kunci minimal 2 karakter.")
    if jenis != "semua" and jenis not in pencarian.JENIS:
        raise HTTPException(400, f"jenis harus 'semua' atau salah satu dari: {', '.join(pencarian.JENIS)}.")
    return pencarian.cari(q, jenis, min(max(batas, 1), 20))


@app.get("/api/koneksi")
async def status_koneksi(paksa: bool = False):
    return await asyncio.to_thread(koneksi.cek, paksa)


def _tanggal_valid(tanggal: str | None):
    if tanggal is None:
        return None
    try:
        return date.fromisoformat(tanggal).isoformat()
    except ValueError:
        raise HTTPException(400, "Format tanggal harus YYYY-MM-DD.")


@app.get("/api/laporan")
def laporan_harian(tanggal: str | None = None):
    return laporan.buat(_tanggal_valid(tanggal))


@app.get("/api/laporan/unduh")
def unduh_laporan(tanggal: str | None = None, format: str = "md"):
    lap = laporan.buat(_tanggal_valid(tanggal))
    if format == "csv":
        isi, jenis = laporan.ke_csv(lap), "text/csv"
    elif format == "md":
        isi, jenis = laporan.ke_markdown(lap), "text/markdown"
    else:
        raise HTTPException(400, "format harus 'md' atau 'csv'.")
    nama = f"laporan-weselguard-{lap['tanggal']}.{format}"
    return Berkas(isi, media_type=f"{jenis}; charset=utf-8",
                  headers={"Content-Disposition": f'attachment; filename="{nama}"'})


@app.get("/api/notifikasi")
def daftar_notifikasi(request: Request, belum_dibaca: bool = False, batas: int = 30,
                      sebelum_id: int | None = None):
    u = request.state.pengguna["username"]
    return {**notifikasi.jumlah_belum_dibaca(u),
            "notifikasi": notifikasi.daftar(u, belum_dibaca, min(max(batas, 1), 100), sebelum_id)}


@app.get("/api/notifikasi/jumlah")
def jumlah_notifikasi(request: Request):
    return notifikasi.jumlah_belum_dibaca(request.state.pengguna["username"])


@app.post("/api/notifikasi/baca-semua")
def baca_semua(request: Request):
    u = request.state.pengguna["username"]
    notifikasi.tandai_dibaca(u)
    return notifikasi.jumlah_belum_dibaca(u)


@app.post("/api/notifikasi/{notifikasi_id}/baca")
def baca(notifikasi_id: int, request: Request):
    u = request.state.pengguna["username"]
    notifikasi.tandai_dibaca(u, notifikasi_id)
    return notifikasi.jumlah_belum_dibaca(u)


# ---------- Dokumen pengetahuan (unggah hanya oleh pengelola) ----------

@app.post("/api/dokumen")
async def unggah_dokumen(request: Request, file: UploadFile = File(...),
                         judul: str = Form(...), kategori: str = Form(...)):
    data = await file.read(dokumen.UKURAN_MAKS + 1)
    try:
        hasil = await asyncio.to_thread(dokumen.unggah, file.filename or "dokumen", data, judul, kategori,
                                        request.state.pengguna["username"])
    except dokumen.GalatDokumen as e:
        raise HTTPException(400, str(e))
    return hasil


@app.get("/api/dokumen")
def daftar_dokumen(status: str | None = None, kategori: str | None = None):
    return dokumen.daftar(status, kategori)


@app.get("/api/dokumen/{dokumen_id}")
def detail_dokumen(dokumen_id: int, mulai: int = 0, jumlah: int = 10):
    d = dokumen.detail(dokumen_id, max(mulai, 0), min(max(jumlah, 0), 50))
    if d is None:
        raise HTTPException(404, "Dokumen tidak ditemukan.")
    return d


@app.get("/api/dokumen/{dokumen_id}/uji")
def uji_dokumen(dokumen_id: int, q: str):
    """Coba cari di SATU dokumen (termasuk yang masih draf) sebelum diaktifkan."""
    from weselguard.tools import _cari_dokumen
    if dokumen.detail(dokumen_id, jumlah=0) is None:
        raise HTTPException(404, "Dokumen tidak ditemukan.")
    hasil = _cari_dokumen(q, 5, dokumen_id=dokumen_id, termasuk_draf=True)
    return {"q": q, "hasil": [{"halaman": d["halaman"], "isi": d["isi"]} for d in hasil]}


@app.get("/api/dokumen/{dokumen_id}/unduh")
def unduh_dokumen(dokumen_id: int):
    path, nama = dokumen.path_berkas(dokumen_id)
    if path is None:
        raise HTTPException(404, "File asli tidak tersedia untuk dokumen ini.")
    return FileResponse(path, filename=nama)


def _ubah_dokumen(dokumen_id, status, request):
    p = request.state.pengguna
    try:
        d = dokumen.ubah_status(dokumen_id, status, p["username"])
    except dokumen.GalatDokumen as e:
        raise HTTPException(400, str(e))
    kata = "diaktifkan" if status == "aktif" else "dinonaktifkan"
    notifikasi.buat("dokumen", "info", f"Dokumen {kata}: {d['judul']}",
                    f"Kategori {d['kategori']}, {d['jumlah_potongan']} potongan, oleh {p['nama']}.",
                    ref_id=str(dokumen_id))
    return d


@app.post("/api/dokumen/{dokumen_id}/aktifkan")
def aktifkan_dokumen(dokumen_id: int, request: Request):
    return _ubah_dokumen(dokumen_id, "aktif", request)


@app.post("/api/dokumen/{dokumen_id}/nonaktifkan")
def nonaktifkan_dokumen(dokumen_id: int, request: Request):
    return _ubah_dokumen(dokumen_id, "nonaktif", request)


@app.delete("/api/dokumen/{dokumen_id}")
def hapus_dokumen(dokumen_id: int):
    try:
        dokumen.hapus(dokumen_id)
    except dokumen.GalatDokumen as e:
        raise HTTPException(404, str(e))
    return {"ok": True}


# ---------- Riwayat percakapan (milik sendiri) ----------

async def _hapus_percakapan(username: str, session_id: str):
    try:
        await runner.session_service.delete_session(app_name=APP_NAME, user_id=username, session_id=session_id)
    except Exception:
        pass  # sesi sudah tidak ada; data ringkas tetap dihapus
    percakapan.hapus(username, session_id)


def _milik_saya(request: Request, session_id: str) -> dict:
    p = percakapan.ambil(request.state.pengguna["username"], session_id)
    if p is None:
        raise HTTPException(404, "Percakapan tidak ditemukan.")
    return p


@app.get("/api/percakapan")
def daftar_percakapan(request: Request, jenis: str | None = None, batas: int = 30, sebelum: str | None = None):
    if jenis not in (None, "chat", "analisis"):
        raise HTTPException(400, "jenis harus 'chat' atau 'analisis'.")
    return {"permanen": SESI_PERMANEN, "disimpan_hari": percakapan.SIMPAN_HARI,
            "percakapan": percakapan.daftar(request.state.pengguna["username"], jenis,
                                            min(max(batas, 1), 100), sebelum)}


@app.get("/api/percakapan/{session_id}")
async def isi_percakapan(session_id: str, request: Request):
    p = _milik_saya(request, session_id)
    sesi = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=request.state.pengguna["username"], session_id=session_id)
    if sesi is None:
        raise HTTPException(410, "Isi percakapan ini sudah tidak tersedia.")
    return {**p, "pesan": percakapan.ke_pesan(sesi.events)}


class JudulBaru(BaseModel):
    judul: str


@app.patch("/api/percakapan/{session_id}")
def ganti_judul(session_id: str, isi: JudulBaru, request: Request):
    _milik_saya(request, session_id)
    if not isi.judul.strip():
        raise HTTPException(400, "Judul tidak boleh kosong.")
    percakapan.ubah_judul(request.state.pengguna["username"], session_id, isi.judul)
    return _milik_saya(request, session_id)


@app.delete("/api/percakapan/{session_id}")
async def hapus_percakapan(session_id: str, request: Request):
    _milik_saya(request, session_id)
    await _hapus_percakapan(request.state.pengguna["username"], session_id)
    return {"ok": True}


@app.delete("/api/percakapan")
async def hapus_semua_percakapan(request: Request):
    u = request.state.pengguna["username"]
    ids = percakapan.milik(u)
    for sid in ids:
        await _hapus_percakapan(u, sid)
    return {"ok": True, "dihapus": len(ids)}


# ---------- Kelola akun (hanya admin) ----------

class AkunBaru(BaseModel):
    username: str
    nama: str
    peran: str
    password: str


class UbahAkun(BaseModel):
    nama: str | None = None
    peran: str | None = None


class SandiBaru(BaseModel):
    password_baru: str


class GantiSandi(BaseModel):
    password_lama: str
    password_baru: str


def _target(username: str) -> dict:
    t = db.ambil_pengguna(username.lower())
    if t is None:
        raise HTTPException(404, f"Akun {username} tidak ditemukan.")
    return t


def _jaga_admin_terakhir(target: dict):
    if target["peran"] == "admin" and target["aktif"] and db.jumlah_admin_aktif(kecuali=target["username"]) == 0:
        raise HTTPException(409, "Ini admin aktif terakhir. Tambahkan admin lain dulu.")


@app.get("/api/pengguna")
def daftar_akun():
    return db.daftar_pengguna()


@app.get("/api/pengguna/audit")
def audit_akun(batas: int = 50):
    return db.daftar_audit(min(max(batas, 1), 200))


@app.get("/api/pengguna/{username}")
def detail_akun(username: str):
    return _target(username)


@app.post("/api/pengguna", status_code=201)
def buat_akun(isi: AkunBaru, request: Request):
    try:
        db.tambah_pengguna(isi.username, isi.nama, isi.peran, isi.password)
    except ValueError as e:
        raise HTTPException(400, str(e))
    username = isi.username.strip().lower()
    db.catat_audit(request.state.pengguna["username"], username, "buat", f"peran {isi.peran}")
    return db.ambil_pengguna(username)


@app.patch("/api/pengguna/{username}")
def ubah_akun(username: str, isi: UbahAkun, request: Request):
    saya_ = request.state.pengguna
    t = _target(username)
    if isi.peran is not None and isi.peran != t["peran"]:
        if t["username"] == saya_["username"]:
            raise HTTPException(409, "Anda tidak bisa mengubah peran akun sendiri.")
        if t["peran"] == "admin":
            _jaga_admin_terakhir(t)
    try:
        db.ubah_pengguna(t["username"], isi.nama, isi.peran)
    except ValueError as e:
        raise HTTPException(400, str(e))
    perubahan = []
    if isi.nama is not None and isi.nama.strip() != t["nama"]:
        perubahan.append(f"nama: {t['nama']} -> {isi.nama.strip()}")
    if isi.peran is not None and isi.peran != t["peran"]:
        perubahan.append(f"peran: {t['peran']} -> {isi.peran}")
    if perubahan:
        db.catat_audit(saya_["username"], t["username"], "ubah", "; ".join(perubahan))
    return db.ambil_pengguna(t["username"])


@app.post("/api/pengguna/{username}/{aksi}")
def atur_akun(username: str, aksi: str, request: Request, isi: SandiBaru | None = None):
    saya_ = request.state.pengguna
    t = _target(username)
    if aksi in ("nonaktifkan", "aktifkan"):
        if aksi == "nonaktifkan":
            if t["username"] == saya_["username"]:
                raise HTTPException(409, "Anda tidak bisa menonaktifkan akun sendiri.")
            _jaga_admin_terakhir(t)
        db.atur_aktif(t["username"], aksi == "aktifkan")
        db.catat_audit(saya_["username"], t["username"], aksi)
        return db.ambil_pengguna(t["username"])
    if aksi == "reset-sandi":
        if isi is None:
            raise HTTPException(400, "Isi body dengan password_baru.")
        try:
            db.ganti_sandi(t["username"], isi.password_baru)
        except ValueError as e:
            raise HTTPException(400, str(e))
        db.catat_audit(saya_["username"], t["username"], "reset-sandi", "semua sesi dikeluarkan")
        return {"ok": True, "pesan": f"Kata sandi {t['username']} diatur ulang. Semua sesinya dikeluarkan."}
    raise HTTPException(404, "Aksi harus nonaktifkan, aktifkan, atau reset-sandi.")


@app.post("/api/saya/ganti-sandi")
async def ganti_sandi_sendiri(isi: GantiSandi, request: Request):
    u = request.state.pengguna["username"]
    if not db.cocokkan_sandi(u, isi.password_lama):
        await asyncio.sleep(1)
        raise HTTPException(400, "Kata sandi lama salah.")
    try:
        db.ganti_sandi(u, isi.password_baru, pertahankan_token=request.cookies.get(COOKIE))
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.catat_audit(u, u, "ganti-sandi", "sesi di perangkat lain dikeluarkan")
    return {"ok": True, "pesan": "Kata sandi diganti. Sesi di perangkat lain telah dikeluarkan."}


# Dashboard React hasil build (frontend/dist) disajikan di alamat utama
DIST = AKAR / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="dashboard")
