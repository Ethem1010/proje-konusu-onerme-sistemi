"""Sistemin tanıdığı 12 alan ve 32 beceri.

Veri setindeki etiketler, modelin çıktısı ve arayüzde gösterilen adlar hep buradan gelir.
Bir alan ya da beceri eklenecekse sadece bu dosya değişir.
"""
import re

# (kod, arayüzde görünen ad)
ALANLAR = [
    ("web", "Web Geliştirme"),
    ("mobil", "Mobil Uygulama"),
    ("yapay_zeka", "Yapay Zekâ ve Makine Öğrenmesi"),
    ("goruntu_isleme", "Görüntü İşleme"),
    ("dogal_dil", "Doğal Dil İşleme"),
    ("veri_bilimi", "Veri Bilimi ve Analitik"),
    ("siber_guvenlik", "Siber Güvenlik"),
    ("gomulu_iot", "Gömülü Sistemler ve IoT"),
    ("oyun", "Oyun Geliştirme"),
    ("bulut_devops", "Bulut ve DevOps"),
    ("veritabani", "Veritabanı Sistemleri"),
    ("ag_dagitik", "Ağ ve Dağıtık Sistemler"),
]
ALAN_KODLARI = [kod for kod, _ in ALANLAR]
ALAN_ADI = dict(ALANLAR)

# Veri setindeki etiket değerleri
ISTIYOR_COK = 2   # "çok istiyorum"
ISTIYOR_AZ = 1    # "ilgimi çekiyor"
BAHSETMIYOR = 0   # tabloda boş hücre
ISTEMIYOR = -1    # "bunu istemiyorum"

# Beceri adı -> metinde geçebilecek yazılışlar.
# Kelimenin sonuna gelen ekler ("python'u", "dockerla") de yakalanır.
BECERILER = {
    "Python": ["python"],
    "Java": ["java"],
    "C": ["c dili", "c diliyle", "c dilinde", "c ile", "c programlama"],
    "C++": ["c++", "cpp"],
    "C#": ["c#", "c sharp", "csharp", ".net"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript"],
    "HTML/CSS": ["html", "css"],
    "React": ["react", "reactjs"],
    "Node.js": ["node.js", "nodejs", "node", "express"],
    "Flutter": ["flutter", "dart"],
    "Kotlin": ["kotlin"],
    "Swift": ["swift"],
    "SQL": ["sql", "mysql", "postgresql", "postgres"],
    "MongoDB": ["mongodb", "mongo"],
    "Linux": ["linux", "ubuntu", "bash"],
    "Git": ["git", "github"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS/Azure": ["aws", "azure"],
    "Unity": ["unity"],
    "Unreal": ["unreal"],
    "Arduino": ["arduino"],
    "Raspberry Pi": ["raspberry"],
    "OpenCV": ["opencv"],
    "PyTorch": ["pytorch", "torch"],
    "TensorFlow": ["tensorflow", "keras"],
    "scikit-learn": ["scikit-learn", "scikit", "sklearn"],
    "Pandas": ["pandas", "numpy"],
    "Ağ Temelleri": ["ağ temel", "tcp/ip", "wireshark", "network"],
    "Kriptografi": ["kriptografi"],
    "Figma": ["figma"],
}
BECERI_ADLARI = list(BECERILER)

# Alanı anlatan kelimelerin sade yazımı (etiketler.sade). Olumsuz bir cümlede geçerlerse öğrenci o alanı
# istemiyor sayılır: "web işlerinden hiç hoşlanmam" -> web. Kelimenin başı yeter: "oyun" -> "oyunlardan".
ALAN_KELIMELERI = {
    "web": [r"web", r"site", r"front ?end"],
    "mobil": [r"mobil", r"telefon uygulama", r"android", r"ios\b"],
    "yapay_zeka": [r"yapay zeka", r"makine ogren", r"derin ogren", r"model egit"],
    "goruntu_isleme": [r"goruntu", r"kamera", r"yuz tanima"],
    "dogal_dil": [r"dogal dil", r"chatbot", r"metin analiz", r"nlp\b"],
    "veri_bilimi": [r"veri bilim", r"veri analiz", r"istatistik", r"grafik"],
    "siber_guvenlik": [r"siber", r"guvenlik", r"hack", r"pentest", r"zafiyet", r"sifreleme"],
    "gomulu_iot": [r"gomulu", r"arduino", r"sensor", r"donanim", r"devre", r"lehim", r"robotik", r"mikrodenetleyici", r"iot\b"],
    "oyun": [r"oyun", r"unity"],
    "bulut_devops": [r"bulut", r"devops", r"docker", r"kubernetes", r"sunucu", r"cloud", r"deploy"],
    "veritabani": [r"veri ?taban", r"sql", r"database"],
    "ag_dagitik": [r"ag(lar\w*|dan|da|a|i|in|la)?\b", r"socket", r"soket", r"network", r"protokol", r"tcp"],
}
_ALAN_DESENLERI = {kod: re.compile(r"\b(?:" + "|".join(kelimeler) + ")") for kod, kelimeler in ALAN_KELIMELERI.items()}


def alan_kelimeleri_bul(metin):
    """Sade yazılmış metinde adı geçen alanların kodları."""
    return [kod for kod, desen in _ALAN_DESENLERI.items() if desen.search(metin)]

_HARF = "a-z0-9"

# Öğrenciler çoğu zaman telefonda Türkçe harf kullanmadan yazıyor: "ağ" yerine "ag", "sıkıldım" yerine "sikildim".
# Metin de yazılışlar da bu sade hâle çevrilip karşılaştırılır, böylece iki yazım da yakalanır.
_SADELESTIR = str.maketrans("çğıöşüâîû", "cgiosuaiu")


def turkce_kucuk(metin):
    """Python'un lower()'ı 'I' harfini 'i' yapar; Türkçede 'ı' olmalı."""
    return metin.replace("I", "ı").replace("İ", "i").lower()


def sade(metin):
    """Küçük harfe çevirir ve Türkçe harfleri sadeleştirir: "Ağ Güvenliği" -> "ag guvenligi"."""
    return turkce_kucuk(metin).translate(_SADELESTIR)


# Başka bir becerinin başı olan yazılışlar: "java" + "script" Java sayılmasın
_DEVAMI_OLMASIN = {"java": "script"}


def _desen(yazilis):
    yazilis = sade(yazilis)
    bas = rf"(?<![{_HARF}])"
    if yazilis in _DEVAMI_OLMASIN:
        return bas + re.escape(yazilis) + f"(?!{_DEVAMI_OLMASIN[yazilis]})"
    if len(yazilis) <= 3:
        # Kısa kelimelerde (js, aws, git) sadece kesme işaretli ek kabul edilir: "js'de" evet, "jsx" hayır
        return bas + re.escape(yazilis) + rf"(?:'[{_HARF}]*)?(?![{_HARF}])"
    return bas + re.escape(yazilis)


_DESENLER = {
    beceri: re.compile("|".join(_desen(y) for y in yazilislar))
    for beceri, yazilislar in BECERILER.items()
}


def beceri_bul(metin):
    """Metinde adı geçen becerileri listedeki sırayla döner."""
    metin = sade(metin)
    return [beceri for beceri, desen in _DESENLER.items() if desen.search(metin)]


def beceri_duzelt(ad):
    """Tablodaki ya da formdaki yazılışı resmi beceri adına çevirir. Tanınmazsa None."""
    ad = ad.strip()
    if ad in BECERILER:
        return ad
    bulunan = beceri_bul(ad)
    return bulunan[0] if bulunan else None
