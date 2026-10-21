"""Proje adresleri: GET /projeler/{id} ve GET /surpriz/{profil_id}.

GET /projeler/{id}: öneri kartına tıklayınca açılan sayfanın verisi.
GET /surpriz/{profil_id}: "bunu hiç düşünmemiştin ama bak" projesi.
  Öğrencinin ilk 5 ilgi alanının dışından, ama istemediği alanlardan da olmayan
  bir havuz projesi seçilir ve surpriz = true ile kaydedilir. Aynı profil için
  ikinci kez çağrılırsa aynı sürpriz döner (her yenilemede değişmesin diye).
"""
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from oneri_motoru.siralama import _kaliba_cevir, puanla
from veritabani.baglanti import oturum_al
from veritabani.modeller import Proje

from ..guvenlik import aktif_kullanici_id
from .oneriler import PROJE_SUTUNLARI, ProjeCevabi, _cevap, _havuzu_oku, _profil_sozlugu
from .profil import kullanicinin_profili

router = APIRouter(tags=["Projeler"])

SURPRIZ_ADAY = 15  # en yapılabilir bu kadar aday arasından rastgele biri seçilir


def kullanicinin_projesi(proje_id: int, kullanici_id: int, oturum: Session) -> Proje:
    """Proje yoksa ya da başka bir öğrencinin profiline aitse 404 verir."""
    proje = oturum.get(Proje, proje_id)
    if proje is None or proje.profil.kullanici_id != kullanici_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proje bulunamadı.")
    return proje


@router.get("/projeler/{proje_id}", response_model=ProjeCevabi)
def proje_getir(
    proje_id: int,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Tek projenin bütün detayı."""
    return _cevap(kullanicinin_projesi(proje_id, kullanici_id, oturum))


@router.get("/surpriz/{profil_id}", response_model=ProjeCevabi)
def surpriz_getir(
    profil_id: int,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Öğrencinin ilgi alanları dışından, yapabileceği bir sürpriz proje."""
    profil = kullanicinin_profili(profil_id, kullanici_id, oturum)
    if not profil.onaylandi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Önce profilini onaylaman gerekiyor.")

    onceki = oturum.scalar(
        select(Proje).where(Proje.profil_id == profil_id, Proje.surpriz.is_(True)).order_by(Proje.id)
    )
    if onceki is not None:
        return _cevap(onceki)

    ilgi = {a["kod"] for a in profil.alanlar}
    istemedikleri = set(profil.istemedikleri)
    zaten_listede = set(
        oturum.scalars(select(Proje.havuz_proje_id).where(Proje.profil_id == profil_id))
    )

    def uygun(p):
        alanlar = {p["alan"], p.get("alan2")} - {None, ""}
        return (
            p["alan"] not in ilgi
            and not (alanlar & istemedikleri)
            and p["id"] not in zaten_listede
        )

    sozluk = _profil_sozlugu(profil)
    adaylar = [puanla({**p, "kaynak": "havuz"}, sozluk) for p in _havuzu_oku(oturum) if uygun(p)]
    if not adaylar:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Şu an sana uygun bir sürpriz proje bulunamadı.")

    # İlgi alanı dışı olduğu için uyum puanı düşük çıkar; seçimi yapılabilirlik ve özgünlük belirler
    adaylar.sort(key=lambda p: (p["puan_yapilabilirlik"], p["puan_ozgunluk"]), reverse=True)
    secilen = random.choice(adaylar[:SURPRIZ_ADAY])

    kalip = _kaliba_cevir(secilen, sira=99)  # 99: düelloya girmez
    kalip["surpriz"] = True
    kalip["duelloda"] = False
    proje = Proje(profil_id=profil_id, **{k: v for k, v in kalip.items() if k in PROJE_SUTUNLARI})
    oturum.add(proje)
    oturum.commit()
    return _cevap(proje)
