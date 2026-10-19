"""Konu Kartları sunucusu.

Ana klasörden çalıştır (sunucu klasörünün içinden değil):

    uvicorn sunucu.main:app --reload

Sonra tarayıcıda http://127.0.0.1:8000/docs adresinden bütün adresleri dene.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .rotalar import auth, bolumler, oneriler, profil
app = FastAPI(
    title="Konu Kartları API",
    description="Öğrencilerin ilgi alanlarına göre proje konusu öneren sistemin sunucusu.",
    version="0.1.0",
)

# CORS: Tarayıcı, başka adresteki bir sayfanın bu sunucuya istek atmasını
# varsayılan olarak engeller. Yunus'un React arayüzü 5173 portunda çalışacağı
# için o adrese izin veriyoruz.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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