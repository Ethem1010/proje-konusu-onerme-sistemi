"""veri/projeler.csv'deki projeleri havuz_projeleri tablosuna yükler.

Tekrar çalıştırmak güvenlidir: aynı başlık zaten varsa eklenmez.
Çalıştırma: python -m veritabani.havuz_yukle
"""
from sqlalchemy import select

from oneri_motoru.veri import projeleri_oku

from .baglanti import OturumYapici
from .modeller import HavuzProjesi

SUTUNLAR = {c.name for c in HavuzProjesi.__table__.columns}


def main():
    eklenen = 0
    with OturumYapici() as oturum:
        var_olanlar = set(oturum.scalars(select(HavuzProjesi.baslik)))
        for proje in projeleri_oku():
            if proje["baslik"] in var_olanlar:
                continue
            oturum.add(HavuzProjesi(**{k: v for k, v in proje.items() if k in SUTUNLAR}))
            var_olanlar.add(proje["baslik"])
            eklenen += 1
        oturum.commit()
    print(f"{eklenen} proje eklendi.")


if __name__ == "__main__":
    main()