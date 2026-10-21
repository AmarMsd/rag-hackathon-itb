"""Server dashboard WeselGuard: API untuk dashboard React + menjalankan agen ADK.

Jalankan dari folder ini:
  uvicorn server:app --host 0.0.0.0 --port 8080
"""
import asyncio
import uuid
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

AKAR = Path(__file__).parent
load_dotenv(AKAR / "weselguard" / ".env")  # harus sebelum agen diimpor

import asyncio as _asyncio  # noqa: E402

from fastapi import FastAPI, HTTPException, Request, Response  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from google.adk.runners import InMemoryRunner  # noqa: E402
from google.genai import types  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from weselguard import database as db  # noqa: E402
from weselguard import lapis1  # noqa: E402
from weselguard.agent import root_agent  # noqa: E402

APP_NAME = "weselguard"
COOKIE = "wg_sesi"
PUBLIK = {"/api/login"}

app = FastAPI(title="WeselGuard")
runner = InMemoryRunner(agent=root_agent, app_name=APP_NAME)
status_agen = {"aktif": True}
sedang_berjalan: set[asyncio.Event] = set()


# ---------- Login dan sesi ----------

@app.middleware("http")
async def wajib_login(request: Request, call_next):
    """Semua /api kecuali /api/login butuh sesi yang masih berlaku.
    Pengamat hanya boleh membaca (GET) dan keluar."""
    path = request.url.path
    if path.startswith("/api") and path not in PUBLIK:
        pengguna = db.pengguna_dari_token(request.cookies.get(COOKIE))
        if pengguna is None:
            return JSONResponse({"detail": "Sesi habis atau belum masuk. Silakan masuk lagi."}, status_code=401)
        if pengguna["peran"] == "pengamat" and request.method != "GET" and path != "/api/logout":
            return JSONResponse({"detail": "Akun pengamat hanya bisa melihat, tidak bisa mengubah."},
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


async def jalankan_agen(pesan: str, user_id: str, session_id: str | None = None) -> dict:
    """Menjalankan agen dan mengumpulkan setiap langkahnya untuk log di dashboard."""
    if not status_agen["aktif"]:
        raise HTTPException(409, "Agen sedang dihentikan petugas. Aktifkan lagi untuk melanjutkan.")
    if session_id is None:
        sesi = await runner.session_service.create_session(app_name=APP_NAME, user_id=user_id)
        session_id = sesi.id
    elif await runner.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id) is None:
        await runner.session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id)

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
    finally:
        sedang_berjalan.discard(batal)
    if batal.is_set():
        jawaban = jawaban or "Analisis dihentikan petugas sebelum selesai."
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
    return await jalankan_agen(f"Periksa wesel {wesel_id}", request.state.pengguna["username"])


class Chat(BaseModel):
    pesan: str
    session_id: str | None = None


@app.post("/api/chat")
async def chat(isi: Chat, request: Request):
    # Percakapan terikat ke akun yang login, jadi tiap petugas punya obrolannya sendiri.
    return await jalankan_agen(isi.pesan, request.state.pengguna["username"],
                               isi.session_id or str(uuid.uuid4()))


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
    return wo


@app.get("/api/riwayat/{wesel_id}")
def riwayat(wesel_id: str):
    return list(reversed(db.riwayat(wesel_id)))


# Dashboard React hasil build (frontend/dist) disajikan di alamat utama
DIST = AKAR / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="dashboard")
