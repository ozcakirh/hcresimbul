# Resim Bul

**Resim Bul**, tarayıcıda çalışan 6 × 6 kartlık bir hafıza eşleştirme oyunudur. Oyunun amacı, 18 farklı resmin eşlerini mümkün olan az hamlede ve kısa sürede bulmaktır.

Kartlar oyuna başladığında 3 saniye açık gösterilir. Süre dolduktan sonra kartları ters çevirip önceki konumlarını hatırlayarak eşleşmeleri tamamlayabilirsiniz.

## Özellikler

- 36 kart ve 18 eşleşebilir çift
- Oyunun başında 3 saniyelik kart önizleme
- Hamle sayısı ve geçen süre takibi
- Eşleşen kartların görünür şekilde işaretlenmesi
- Başarılı eşleşmelerde tamamlanma özeti
- `Yeniden başla` seçeneği
- Masaüstü ve mobil cihazlara uyumlu tasarım
- Klavye odaklanması ve ekran okuyucular için kart etiketleri
- Kurulum veya harici bağımlılık gerektirmez

## Nasıl Oynanır?

1. `Oyuna başla` düğmesine tıklayın.
2. Gösterilen kartları 3 saniye boyunca inceleyin.
3. İki kart açarak eşleşip eşleşmediklerini kontrol edin.
4. Aynı resme sahip kartları bulmaya devam edin.
5. Tüm 18 çifti bulduğunuzda oyun biter ve süre ile hamle sayınız gösterilir.

Yanlış eşleşen kartlar kısa bir süre açık kaldıktan sonra otomatik olarak kapanır.

## Çalıştırma

Bu proje saf HTML, CSS ve JavaScript kullanır.

### Doğrudan Açma

1. Depoyu bilgisayarınıza indirin veya klonlayın.
2. `index.html` dosyasını herhangi bir modern tarayıcıda açın.

### Yerel Sunucu ile Çalıştırma

Python 3 yüklüyse proje klasöründe şu komutu kullanabilirsiniz:

```bash
python -m http.server 8000
```

Tarayıcıdan [http://localhost:8000](http://localhost:8000) adresini açın.

## Proje Yapısı

```text
.
├── index.html  # Sayfa yapısı ve oyun arayüzü
├── game.js     # Kart üretimi, oyun mantığı, süre ve hamle takibi
├── style.css   # Düzen, kart görünümü ve responsive tasarım
└── README.md   # Proje açıklaması
```

## Kullanılan Teknolojiler

- HTML5
- CSS3
- Vanilla JavaScript
- Tarayıcı DOM API'leri

## Tarayıcı Desteği

Modern masaüstü ve mobil tarayıcılarda çalışacak şekilde hazırlanmıştır:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

## Katkıda Bulunma

Katkılarınızı bekliyoruz.

1. Depoyu fork'layın.
2. Yeni bir özellik dalı oluşturun:

   ```bash
   git checkout -b feature/yeni-ozellik
   ```

3. Değişikliklerinizi yapıp commit edin.
4. Dalınızı fork ettiğiniz deponuza gönderin.
5. Bir pull request açın.
