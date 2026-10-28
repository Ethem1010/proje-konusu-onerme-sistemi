"""Konu Kartları sunucusu.

Ana klasörden çalıştır (sunucu klasörünün içinden değil):

    uvicorn sunucu.main:app --reload

Sonra tarayıcıda http://127.0.0.1:8000/docs adresinden bütün adresleri dene.
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .rotalar import auth, bolumler, duello, oneriler, profil, projeler, secim
app = FastAPI(
    title="Konu Kartları API",
    description="Öğrencilerin ilgi alanlarına göre proje konusu öneren sistemin sunucusu.",
    version="0.1.0",
)

# CORS: Tarayıcı, başka adresteki bir sayfanın bu sunucuya istek atmasını
# varsayılan olarak engeller. Yunus'un React arayüzü 5173 portunda çalışacağı
# için o adrese izin veriyoruz.
# Demoda telefondan açmak için .env'e TELEFON_DEMO=1 yazılır: o zaman aynı yerel ağdaki
# (ev/hotspot ağı: 192.168.x.x, 10.x.x.x, 172.16-31.x.x) 5173 adreslerine de izin verilir.
# Yazılmazsa sadece bu bilgisayardan erişilir.
load_dotenv()
TELEFON_DEMO = os.getenv("TELEFON_DEMO", "").strip().lower() in ("1", "evet", "true")
YEREL_AG = (
    r"http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=YEREL_AG if TELEFON_DEMO else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Durum"])
def durum():
    """Sunucu ayakta mı? Tarayıcıda açınca cevap geliyorsa çalışıyor demektir."""
    return {"durum": "çalışıyor"}


app.include_router(auth.router)
app.include_router(bolumler.router)
app.include_router(profil.router)
app.include_router(oneriler.router)
app.include_router(projeler.router)
app.include_router(duello.router)
app.include_router(secim.router)
