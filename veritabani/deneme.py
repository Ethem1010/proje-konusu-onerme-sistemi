"""Bağlantı ve modeller çalışıyor mu? Ana klasörden çalıştır:

    python -m veritabani.deneme

Veritabanına deneme bir kullanıcı, profil ve proje yazar, geri okur,
sonra hepsini geri alır. Yani veritabanında hiçbir iz bırakmaz.
"""
from sqlalchemy import func, select

from .baglanti import OturumYapici
from .modeller import Bolum, HavuzProjesi, Kullanici, Profil, Proje


def main():
    with OturumYapici() as oturum:
        # 1. Okuma: bölüm listesi geliyor mu?
        sayi = oturum.scalar(select(func.count()).select_from(Bolum))
        print(f"Bölüm sayısı: {sayi}  (2 olmalı: Bilgisayar ve Yazılım Mühendisliği)")
        havuz = oturum.scalar(select(func.count()).select_from(HavuzProjesi))
        print(f"Havuzdaki proje sayısı: {havuz}  (havuz_yukle çalıştırıldıysa ~300)")
        for bolum in oturum.scalars(select(Bolum).order_by(Bolum.id).limit(3)):
            print(f"  - {bolum.ad} ({bolum.grup})")

        # 2. Yazma: kullanıcı, profil ve proje ekleyebiliyor muyuz?
        bilgisayar = oturum.scalar(select(Bolum).where(Bolum.ad == "Bilgisayar Mühendisliği"))
        kullanici = Kullanici(ad="Deneme Öğrenci", eposta="deneme@ornek.com", sifre_ozeti="ozet")
        profil = Profil(
            kullanici=kullanici,
            bolum=bilgisayar,
            proje_turu="donem",
            sure_hafta=8,
            metin="unity ile oyun yapmak istiyorum, c# biliyorum ama web işlerinden sıkıldım.",
            haftalik_saat=8,
            ekip=3,
            tercih="farketmez",
            alanlar=[{"kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5}],
            istemedikleri=["web"],
            beceriler=["Unity", "C#"],
        )
        Proje(
            profil=profil,
            kaynak="gemini",
            baslik="Algoritma Öğreten Bulmaca Oyunu",
            alan="oyun",
            zorluk=2,
            hafta=8,
            ne="Oyuncunun robotu komut bloklarıyla hedefe götürdüğü 2D bulmaca oyunu.",
            adimlar=["Bölümleri tasarla", "Hareketi kodla", "Bölüm geçişlerini yap", "Öğrencilerle dene"],
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