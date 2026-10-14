"""Bağlantı ve modeller çalışıyor mu? Ana klasörden çalıştır:

    python -m veritabani.deneme

Veritabanına deneme bir kullanıcı, profil ve proje yazar, geri okur,
sonra hepsini geri alır. Yani veritabanında hiçbir iz bırakmaz.
"""
from sqlalchemy import func, select

from .baglanti import OturumYapici
from .modeller import Bolum, Kullanici, Profil, Proje


def main():
    with OturumYapici() as oturum:
        # 1. Okuma: bölüm listesi geliyor mu?
        sayi = oturum.scalar(select(func.count()).select_from(Bolum))
        print(f"Bölüm sayısı: {sayi}  (61 olmalı)")
        for bolum in oturum.scalars(select(Bolum).order_by(Bolum.id).limit(3)):
            print(f"  - {bolum.ad} ({bolum.grup})")

        # 2. Yazma: kullanıcı, profil ve proje ekleyebiliyor muyuz?
        makine = oturum.scalar(select(Bolum).where(Bolum.ad == "Makine Mühendisliği"))
        kullanici = Kullanici(ad="Deneme Öğrenci", eposta="deneme@ornek.com", sifre_ozeti="ozet")
        profil = Profil(
            kullanici=kullanici,
            bolum=makine,
            proje_turu="donem",
            sure_hafta=8,
            metin="SolidWorks biliyorum, robotik ilgimi çekiyor.",
            haftalik_saat=8,
            ekip=3,
            tercih="farketmez",
            alanlar=[{"ad": "Robotik", "puan": 5}],
            beceriler=[{"ad": "SolidWorks", "biliyor": True}],
        )
        Proje(
            profil=profil,
            baslik="Engelden Kaçan Depo Robotu",
            alan="Robotik",
            zorluk=2,
            hafta=8,
            ne="Çizgi izleyen ve engelde duran bir robot.",
            adimlar=["Gövdeyi tasarla", "Motorları bağla", "Kodu yaz", "Parkurda dene"],
            puan_toplam=78,
        )
        oturum.add(kullanici)
        oturum.flush()  # veritabanına gönder ama kalıcı kaydetme

        print(f"Eklenen kullanıcı numarası: {kullanici.id}")
        print(f"Profilin bölümü: {profil.bolum.ad}")
        print(f"Profilin proje sayısı: {len(profil.projeler)}, ilki: {profil.projeler[0].baslik}")

        # 3. Geri al: deneme verisi veritabanında kalmasın
        oturum.rollback()
        print("Deneme verisi geri alındı. Her şey çalışıyor.")


if __name__ == "__main__":
    main()