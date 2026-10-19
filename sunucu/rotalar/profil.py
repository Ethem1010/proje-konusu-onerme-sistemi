"""Profil adresleri: POST /profil, PUT /profil/{id}.

Profili Gemini değil, kendi eğittiğimiz model çıkarır (oneri_motoru/profil.py).
Bu yüzden cevap anında gelir, kota yoktur.
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from oneri_motoru.etiketler import ALAN_ADI
from oneri_motoru.profil import profil_cikar
from veritabani.baglanti import oturum_al
from veritabani.modeller import Bolum, Profil

from ..guvenlik import aktif_kullanici_id

router = APIRouter(prefix="/profil", tags=["Profil"])

EN_KISA_METIN = 20  # arayüzdeki kuralla aynı (dogrulama.js)
EN_FAZLA_ALAN = 5   # anlaşma belgesi: profilde 5 alan


# --- İstek ve cevap kalıpları ------------------------------------------------

class ProfilIstegi(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    bolum_id: Optional[int] = Field(default=None, examples=[1])
    bolum_diger: Optional[str] = Field(default=None, max_length=150, examples=[None])
    proje_turu: Literal["ders", "donem", "bitirme", "yarisma", "kisisel"] = Field(examples=["donem"])
    sure_hafta: int = Field(ge=1, le=24, examples=[12])
    metin: str = Field(min_length=EN_KISA_METIN, max_length=5000,
                       examples=["Unity ile oyun yapmak istiyorum ama web işlerinden sıkıldım, C# biliyorum."])
    haftalik_saat: int = Field(ge=1, le=80, examples=[8])
    ekip: int = Field(ge=1, le=20, examples=[3])
    tercih: Literal["uretmek", "arastirmak", "farketmez"] = Field(examples=["uretmek"])

    @model_validator(mode="after")
    def bolum_dolu_olmali(self):
        # Boş yazı "Diğer" sayılmasın
        if self.bolum_diger == "":
            self.bolum_diger = None
        if self.bolum_id is None and self.bolum_diger is None:
            raise ValueError("bolum_id ya da bolum_diger'den biri dolu olmalı.")
        return self


class Alan(BaseModel):
    kod: str = Field(examples=["oyun"])
    ad: Optional[str] = Field(default=None, examples=["Oyun Geliştirme"])  # gönderilmese de sunucu doldurur
    puan: int = Field(ge=1, le=5, examples=[5])

    @field_validator("kod")
    @classmethod
    def bilinen_alan(cls, kod):
        if kod not in ALAN_ADI:
            raise ValueError(f"Bilinmeyen alan kodu: {kod}")
        return kod


class ProfilGuncelleme(BaseModel):
    alanlar: list[Alan] = Field(min_length=1, max_length=EN_FAZLA_ALAN)
    istemedikleri: list[str] = Field(default_factory=list, examples=[["web"]])
    beceriler: list[str] = Field(default_factory=list, max_length=40, examples=[["Unity", "C#"]])

    @field_validator("istemedikleri")
    @classmethod
    def bilinen_alanlar(cls, kodlar):
        for kod in kodlar:
            if kod not in ALAN_ADI:
                raise ValueError(f"Bilinmeyen alan kodu: {kod}")
        return list(dict.fromkeys(kodlar))  # tekrarları at, sırayı koru

    @field_validator("beceriler")
    @classmethod
    def becerileri_temizle(cls, beceriler):
        temiz = [b.strip() for b in beceriler if b and b.strip()]
        return list(dict.fromkeys(temiz))

    @model_validator(mode="after")
    def celiski_olmasin(self):
        kodlar = [a.kod for a in self.alanlar]
        if len(kodlar) != len(set(kodlar)):
            raise ValueError("Aynı alan iki kez seçilmiş.")
        if set(kodlar) & set(self.istemedikleri):
            raise ValueError("Bir alan hem ilgi alanlarında hem istemediklerinde olamaz.")
        return self


class ProfilCevabi(BaseModel):
    id: int
    alanlar: list[dict]
    istemedikleri: list[str]
    beceriler: list[str]
    onaylandi: bool


def _cevap(profil: Profil) -> ProfilCevabi:
    return ProfilCevabi(
        id=profil.id,
        alanlar=profil.alanlar,
        istemedikleri=profil.istemedikleri,
        beceriler=profil.beceriler,
        onaylandi=profil.onaylandi,
    )


def kullanicinin_profili(profil_id: int, kullanici_id: int, oturum: Session) -> Profil:
    """Profil yoksa ya da başkasınınsa 404 verir. /oneriler gibi diğer adresler de kullanır."""
    profil = oturum.get(Profil, profil_id)
    if profil is None or profil.kullanici_id != kullanici_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil bulunamadı.")
    return profil


# --- Adresler ------------------------------------------------------------------

@router.post("", response_model=ProfilCevabi, status_code=status.HTTP_201_CREATED)
def profil_olustur(
    istek: ProfilIstegi,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Öğrencinin yazısından profil çıkarır ve kaydeder (henüz onaylanmamış)."""
    if istek.bolum_id is not None and oturum.get(Bolum, istek.bolum_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Seçilen bölüm bulunamadı.")

    try:
        sonuc = profil_cikar(istek.metin)
    except FileNotFoundError:
        # Model dosyası yok: sunucuyu çalıştıran kişi "python -m oneri_motoru.egitim" çalıştırmamış
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Profil modeli hazır değil. Sunucuda önce 'python -m oneri_motoru.egitim' çalıştırılmalı.",
        )

    profil = Profil(
        kullanici_id=kullanici_id,
        bolum_id=istek.bolum_id,
        bolum_diger=istek.bolum_diger if istek.bolum_id is None else None,
        proje_turu=istek.proje_turu,
        sure_hafta=istek.sure_hafta,
        metin=istek.metin,
        haftalik_saat=istek.haftalik_saat,
        ekip=istek.ekip,
        tercih=istek.tercih,
        alanlar=sonuc["alanlar"],
        istemedikleri=sonuc["istemedikleri"],
        beceriler=sonuc["beceriler"],
        onaylandi=False,
    )
    oturum.add(profil)
    oturum.commit()
    return _cevap(profil)


@router.put("/{profil_id}", response_model=ProfilCevabi)
def profil_onayla(
    profil_id: int,
    istek: ProfilGuncelleme,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Öğrencinin düzelttiği profili kaydeder ve onaylar."""
    profil = kullanicinin_profili(profil_id, kullanici_id, oturum)

    # Alan adını arayüze güvenmeden kendimiz yazıyoruz
    profil.alanlar = [{"kod": a.kod, "ad": ALAN_ADI[a.kod], "puan": a.puan} for a in istek.alanlar]
    profil.istemedikleri = istek.istemedikleri
    profil.beceriler = istek.beceriler
    profil.onaylandi = True
    oturum.commit()
    return _cevap(profil)