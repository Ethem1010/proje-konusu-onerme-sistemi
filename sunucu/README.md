# FastAPI sunucusu (Seyithan)

Arayüzden gelen istekleri karşılar, veritabanına yazar, öneri motorunu çağırır.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `main.py` | Uygulamayı kurar, CORS ayarı, bütün adresleri bağlar |
| `guvenlik.py` | Şifreyi bcrypt ile özetleme, giriş jetonu (JWT, 24 saat) |
| `yz_hakki.py` | Öğrencinin günlük Gemini hakkı (varsayılan 10) |
| `rotalar/auth.py` | Kayıt, giriş, `GET /auth/ben` |
| `rotalar/bolumler.py` | Bölüm listesi |
| `rotalar/profil.py` | Profil çıkarma (kendi modelimiz), düzeltme ve onay |
| `rotalar/oneriler.py` | 10 öneri: havuz + Gemini, puanlama, kayıt |
| `rotalar/projeler.py` | Proje detayı ve sürpriz proje |
| `rotalar/duello.py` | Düello maçlarının kaydı ve kuralları |
| `rotalar/secim.py` | Proje seçimi, 12 adımlık görev haritası, adım işaretleme |

Bütün adresler, istek ve cevap kalıpları ile hata kodları: [docs/anlasma.md](../docs/anlasma.md).

## Çalıştırma (ana klasörden)

```
uvicorn sunucu.main:app --reload
```

http://127.0.0.1:8000/docs adresinden bütün adresler denenebilir.

## Kurallar

- Giriş gerektiren her adres jetonu kontrol eder; jeton yoksa ya da geçersizse **401**.
- Başka bir öğrencinin profiline, projesine ya da haritasına erişim **404** verir
  (kaydın var olup olmadığı bile belli edilmez).
- Onaylanmamış profile öneri istenirse **400**; düello başladıktan sonra öneri yenilenirse **409**.
- Gemini cevap vermezse ya da günlük hak dolarsa hata verilmez: öneriler havuzdan,
  görev haritası yedek haritadan gelir. Hak sadece Gemini gerçekten cevap verdiyse düşer.

## Testler

`tests/test_sunucu.py` bütün adresleri ayrı bir test veritabanıyla dener (kurulum ana README'de):

```
python -m unittest tests.test_sunucu -v
```
