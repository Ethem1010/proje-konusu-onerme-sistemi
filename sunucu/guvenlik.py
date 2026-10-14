"""Şifre özetleme ve giriş jetonu (JWT).

Şifreler veritabanına asla açık yazılmaz; bcrypt ile özetlenir. Özetten şifre
geri çıkarılamaz, sadece "bu şifre o özete uyuyor mu?" diye kontrol edilir.

Giriş yapan kullanıcıya bir jeton verilir. Arayüz sonraki her istekte bu jetonu
gönderir, sunucu da jetona bakarak isteğin kimden geldiğini anlar.
"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

GIZLI_ANAHTAR = os.getenv("JWT_GIZLI_ANAHTAR")
if not GIZLI_ANAHTAR:
    raise RuntimeError(
        "JWT_GIZLI_ANAHTAR bulunamadı. .env dosyasına ekle (.env.example'a bak)."
    )

ALGORITMA = "HS256"
JETON_SURESI = timedelta(hours=24)


def sifre_ozetle(sifre: str) -> str:
    """Şifreyi bcrypt ile özetler. Veritabanına bu özet yazılır."""
    return bcrypt.hashpw(sifre.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def sifre_dogru_mu(sifre: str, ozet: str) -> bool:
    """Girilen şifre kayıtlı özete uyuyor mu?"""
    return bcrypt.checkpw(sifre.encode("utf-8"), ozet.encode("utf-8"))


def jeton_uret(kullanici_id: int) -> str:
    """24 saat geçerli bir giriş jetonu üretir."""
    bitis = datetime.now(timezone.utc) + JETON_SURESI
    return jwt.encode({"sub": str(kullanici_id), "exp": bitis}, GIZLI_ANAHTAR, algorithm=ALGORITMA)


_bearer = HTTPBearer(auto_error=False)


def aktif_kullanici_id(
    kimlik: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    """Giriş gerektiren adreslerde kullanılır. Jetonu çözer, kullanıcı numarasını verir.

    Kullanımı:
        def profilim(kullanici_id: int = Depends(aktif_kullanici_id)): ...
    """
    if kimlik is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Giriş yapman gerekiyor.")
    try:
        icerik = jwt.decode(kimlik.credentials, GIZLI_ANAHTAR, algorithms=[ALGORITMA])
        return int(icerik["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Oturumun süresi doldu, tekrar giriş yap.")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Geçersiz jeton.")