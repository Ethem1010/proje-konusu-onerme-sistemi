"""Kayıt ve giriş adresleri: POST /auth/kayit, POST /auth/giris, GET /auth/ben."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from veritabani.baglanti import oturum_al
from veritabani.modeller import Kullanici

from ..guvenlik import aktif_kullanici_id, jeton_uret, sifre_dogru_mu, sifre_ozetle

router = APIRouter(prefix="/auth", tags=["Giriş"])

EPOSTA_KALIBI = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class KayitIstegi(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)  # baştaki/sondaki boşlukları sil

    ad: str = Field(min_length=2, max_length=100, examples=["Ayşe Yılmaz"])
    eposta: str = Field(max_length=255, pattern=EPOSTA_KALIBI, examples=["ayse@ornek.com"])
    sifre: str = Field(min_length=6, max_length=72, examples=["gizli123"])


class GirisIstegi(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    eposta: str = Field(examples=["ayse@ornek.com"])
    sifre: str = Field(examples=["gizli123"])


class JetonCevabi(BaseModel):
    erisim_jetonu: str
    jeton_turu: str = "bearer"
    kullanici_id: int
    ad: str


class KullaniciCevabi(BaseModel):
    id: int
    ad: str
    eposta: str
    rol: str


def _eposta_duzelt(eposta: str) -> str:
    """Büyük/küçük harf ve boşluk farkı aynı hesabı iki kere açtırmasın."""
    return eposta.strip().lower()


@router.post("/kayit", response_model=JetonCevabi, status_code=status.HTTP_201_CREATED)
def kayit(istek: KayitIstegi, oturum: Session = Depends(oturum_al)):
    """Yeni hesap açar ve hemen giriş jetonu verir."""
    eposta = _eposta_duzelt(istek.eposta)
    if len(istek.sifre.encode("utf-8")) > 72:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Şifre çok uzun.")
    if oturum.scalar(select(Kullanici).where(Kullanici.eposta == eposta)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu e-posta ile zaten bir hesap var.")

    kullanici = Kullanici(ad=istek.ad, eposta=eposta, sifre_ozeti=sifre_ozetle(istek.sifre))
    oturum.add(kullanici)
    try:
        oturum.commit()
    except IntegrityError:  # aynı anda iki kayıt gelirse
        oturum.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu e-posta ile zaten bir hesap var.")

    return JetonCevabi(erisim_jetonu=jeton_uret(kullanici.id), kullanici_id=kullanici.id, ad=kullanici.ad)


@router.post("/giris", response_model=JetonCevabi)
def giris(istek: GirisIstegi, oturum: Session = Depends(oturum_al)):
    """E-posta ve şifre doğruysa giriş jetonu verir."""
    kullanici = oturum.scalar(select(Kullanici).where(Kullanici.eposta == _eposta_duzelt(istek.eposta)))
    # Hangisinin yanlış olduğunu söylemiyoruz; yoksa kötü niyetli biri
    # hangi e-postaların kayıtlı olduğunu öğrenebilir.
    if kullanici is None or not sifre_dogru_mu(istek.sifre, kullanici.sifre_ozeti):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-posta veya şifre hatalı.")

    return JetonCevabi(erisim_jetonu=jeton_uret(kullanici.id), kullanici_id=kullanici.id, ad=kullanici.ad)


@router.get("/ben", response_model=KullaniciCevabi)
def ben(kullanici_id: int = Depends(aktif_kullanici_id), oturum: Session = Depends(oturum_al)):
    """Jetonu gönderen kullanıcının bilgileri. Jetonun çalıştığını denemek için."""
    kullanici = oturum.get(Kullanici, kullanici_id)
    if kullanici is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kullanıcı bulunamadı.")
    return KullaniciCevabi(id=kullanici.id, ad=kullanici.ad, eposta=kullanici.eposta, rol=kullanici.rol)