"""Öğrencinin yazısından ilgi alanlarını tahmin eden model.

Nasıl çalışır?
1. Metin sayılara çevrilir (TF-IDF). Hem kelimelere ("unity", "telefon") hem de
   kelime parçalarına ("istemiyorum" içindeki "iste", "miyor") bakılır. Parçalara bakmak
   Türkçenin ekleri yüzünden önemli: "dockerla", "docker'ı", "docker" aynı şeyi anlatır.
2. Her alan için ayrı bir Lojistik Regresyon sınıflandırıcısı vardır. Her biri metni
   üç gruptan birine koyar: istemiyor (-1), bahsetmiyor (0), ilgileniyor (1-2).
3. Sonuçta her alan için "ilgilenme olasılığı" ve "istememe olasılığı" çıkar.

Eğitim:  python -m oneri_motoru.egitim
Kullanım: oneri_motoru/profil.py
"""
import re
from pathlib import Path

import joblib
import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from .etiketler import ALAN_KODLARI, sade

MODEL_DOSYASI = Path(__file__).resolve().parent / "model" / "profil_modeli.joblib"

OLUMSUZ, YOK, OLUMLU = -1, 0, 1

# --- Olumsuzluk işaretleme ---
# "oyun ilgimi çekiyor" ile "oyun hiç istemiyorum" ikisinde de "oyun" kelimesi geçer.
# Model bunları ayırabilsin diye olumsuz cümle parçasındaki kelimelerin başına "olmz_" eklenir:
#   "web istemiyorum" -> "olmz_web olmz_istemiyorum"
# Metin önce sadeleştirilir (etiketler.sade: "ı"->"i", "ğ"->"g"...), bu yüzden kalıplar Türkçe harfsiz yazılı.
# "istemiyom", "istemiyorum", "istemiyorm" hepsi "m[iu]yo" ile yakalanır.
_PARCA_SINIRI = re.compile(r"[,.;:!?\n]+|\b(?:ama|fakat|ancak|yalniz|lakin)\b")
_OLUMSUZLUK = re.compile(
    r"\b\w+(?:m[iu]yo\w*|m[ae]z\w*|m[ae]s[i]n\w*|m[ae]y[i]n\w*|m[ae]y[i]z\w*|m[ae]d[i]\w*|(?<!ta)m[ae]m)\b"
    r"|\b(?:sikil|bik[tkm]|nefret|asla|degil|kaldim|uzak dur)\w*"
    r"|\b(?:hoslanma|sevme|isteme)(?!k)\w*"  # "sevmek", "istemek" olumsuz değil
)


def olumsuz_isaretle(metin):
    parcalar = []
    for parca in _PARCA_SINIRI.split(metin):
        if parca and _OLUMSUZLUK.search(parca):
            parca = re.sub(r"\b(\w+)\b", r"olmz_\1", parca)
        parcalar.append(parca or "")
    return " ".join(parcalar)


def _on_isle(metin):
    return olumsuz_isaretle(sade(metin))


def _sinif(etiket):
    """Veri setindeki 2/1/0/-1 etiketini modelin üç sınıfına indirger."""
    if etiket > 0:
        return OLUMLU
    return OLUMSUZ if etiket < 0 else YOK


class ProfilModeli:
    def __init__(self, C=4.0):
        self.C = C
        self.kelime = TfidfVectorizer(
            preprocessor=_on_isle, ngram_range=(1, 2), min_df=1, sublinear_tf=True
        )
        self.parca = TfidfVectorizer(
            preprocessor=sade, analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True
        )
        self.siniflandiricilar = {}

    def _ozellik(self, metinler, egit=False):
        if egit:
            return hstack([self.kelime.fit_transform(metinler), self.parca.fit_transform(metinler)]).tocsr()
        return hstack([self.kelime.transform(metinler), self.parca.transform(metinler)]).tocsr()

    def egit(self, metinler, etiketler):
        """metinler: yazı listesi. etiketler: her yazı için {alan: -1/0/1/2}."""
        X = self._ozellik(metinler, egit=True)
        for kod in ALAN_KODLARI:
            y = np.array([_sinif(e[kod]) for e in etiketler])
            if len(set(y)) < 2:
                # Bu alan için veride tek tür örnek var (ör. hiç kimse istemiyorum dememiş).
                # Öğrenecek bir şey yok, hep o sınıfı söyleyen sabit bir tahmin kullanılır.
                self.siniflandiricilar[kod] = int(y[0])
                continue
            sinif = LogisticRegression(C=self.C, class_weight="balanced", max_iter=2000)
            sinif.fit(X, y)
            self.siniflandiricilar[kod] = sinif
        return self

    def olasiliklar(self, metinler):
        """Her metin için {alan: {"ilgi": 0-1, "istememe": 0-1}} listesi."""
        X = self._ozellik(metinler)
        sonuc = [{} for _ in metinler]
        for kod, sinif in self.siniflandiricilar.items():
            if isinstance(sinif, int):
                ilgi = np.full(len(metinler), 1.0 if sinif == OLUMLU else 0.0)
                istememe = np.full(len(metinler), 1.0 if sinif == OLUMSUZ else 0.0)
            else:
                p = sinif.predict_proba(X)
                siralama = list(sinif.classes_)
                ilgi = p[:, siralama.index(OLUMLU)] if OLUMLU in siralama else np.zeros(len(metinler))
                istememe = p[:, siralama.index(OLUMSUZ)] if OLUMSUZ in siralama else np.zeros(len(metinler))
            for i in range(len(metinler)):
                sonuc[i][kod] = {"ilgi": float(ilgi[i]), "istememe": float(istememe[i])}
        return sonuc

    def tahmin(self, metinler, esik=0.5):
        """Her metin için {alan: -1/0/1}: olasılığı eşiği geçen sınıf, geçmeyen 0."""
        tahminler = []
        for p in self.olasiliklar(metinler):
            t = {}
            for kod, o in p.items():
                if o["ilgi"] >= esik and o["ilgi"] >= o["istememe"]:
                    t[kod] = OLUMLU
                elif o["istememe"] >= esik:
                    t[kod] = OLUMSUZ
                else:
                    t[kod] = YOK
            tahminler.append(t)
        return tahminler

    def kaydet(self, dosya=MODEL_DOSYASI):
        Path(dosya).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, dosya)

    @staticmethod
    def yukle(dosya=MODEL_DOSYASI):
        if not Path(dosya).exists():
            raise FileNotFoundError(
                f"{dosya} bulunamadı. Önce modeli eğit: python -m oneri_motoru.egitim"
            )
        return joblib.load(dosya)
