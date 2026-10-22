# Mimari ve veri kuralları

## Veri akışı

Web `/api` çağrılarını Next.js rewrite üzerinden NestJS'e yollar. Web oturumu httpOnly çerezdedir; mobil erişim JWT'si native ortamda SecureStore, web önizlemesinde sessionStorage içinde tutulur. Erişim oturumu 8 saattir. JWT iptali için merkezi revoke listesi bulunmaz; çıkış, istemcideki oturumu temizler.

API, imzalı oturumdan kullanıcı ve organizasyon kimliğini alır. İstemciden organizasyon kimliği kabul ederek yetki genişletmez. Her ilişkili kayıt festival/organizasyon zinciri üzerinden doğrulanır. Katılımcı snapshot'ında ekip, görev, vardiya, olay ve işlem geçmişi yoktur.

Başlangıçta SQL şeması idempotent olarak uygulanır. Bu sürüm şema dosyasıyla bootstrap yapar; sürümlü migration altyapısı içermez. Örnek veri yalnızca boş veritabanına ve geliştirme ortamında veya `SEED_DEMO=true` ile eklenir.

## Yazma işlemi

1. JWT ve rol doğrulanır; Zod girdiyi ayrıştırır.
2. PostgreSQL transaction açılır, organizasyona ait advisory lock alınır.
3. `(user_id, mutation_id)` için önceki sonuç aranır. Aynı anahtar ve aynı istek tekrar işlenmez; farklı istek 409 alır.
4. İlişkili kayıtlar, yetki ve iş kuralları kontrol edilir. Görev ve program düzenlemeleri beklenen `version` değerini gerektirir.
5. Değişiklik, idempotency sonucu ve audit kaydı aynı transaction içinde yazılır.
6. Commit sonrası yalnızca ilgili organizasyonun Socket.IO odasına `refresh` gönderilir.

Organizasyon başına kilit, demo ölçeğinde tutarlı kapasite ve zaman çakışması kontrolü sağlar; yüksek yazma hacminde daha dar kaynak kilitlerine geçilmelidir. Socket sunucusu tek süreçlidir; çoklu instance yayın katmanı eklenmemiştir.

## İş kuralları

- Performanslar festival tarihlerinde kalır; aynı sahne veya aynı sanatçı için örtüşme engellenir. Bitiş ve başlangıcın eşit olması örtüşme sayılmaz.
- Ekipman kapasitesi, aralıktaki rezervasyonların toplamı yerine eşzamanlı en yüksek kullanımla değerlendirilir. İade edilen rezervasyon kapasiteyi tüketmez.
- Aynı kişinin vardiyaları örtüşemez.
- Bir görev, bağımlılıkları tamamlanmadan başlatılamaz. Aktif bağlı görev varken ön koşul yeniden açılamaz.
- Bilet giriş işlemi kilit altında çalışır; aynı bilet için iki eşzamanlı isteğin yalnızca biri başarılı olur.
- Bilet QR imzası, erişim JWT'sinden farklı `purpose` taşır; giriş QR'ı oturum açmak için kullanılamaz.

## Mobil kuyruk

Görev durum değişikliği, kullanıcı kimliğine bağlı AsyncStorage anahtarında saklanır. Her mutasyonun sabit benzersiz işlem kimliği ve okunan sürümü vardır. API'ye ulaşamayan değişiklikler sırayla yeniden denenir. 409 çakışması kuyruğu durdurur; sunucudaki yeni veri ezilmez. Kullanıcı bekleyen kaydı kaldırıp güncel görevden tekrar işlem yapabilir.

Gönderim sürerken eklenen kayıtlar, gönderilen batch kimliklerinden ayrılarak korunur. Hesap değişirse eski isteğin sonucu yeni hesabın snapshot'ına uygulanmaz. Mobil 12 saniyede bir bağlantı/yenileme dener; işletim sistemi uygulamayı kapattığında çalışan arka plan zamanlayıcısı yoktur.

Snapshot ve görev kuyruğu cihazda korunur. Bunlar uçtan uca şifreli değildir; demo dışı dağıtımda cihaz yönetimi, saklama süresi ve veri sınıflandırması ayrıca tasarlanmalıdır. Fotoğraflar boyut sınırlı base64 metin olarak veritabanındadır; ölçekli dağıtım için nesne depolamaya taşınmalıdır.

## Saat ve dağıtım

Festival saat dilimi bu sürümde İstanbul / UTC+3'tür. ISO tarihleri düzenleme alanına dönüştürürken ortak `festivalInput` kullanılır. Birden çok saat dilimi desteklenmez.

Next.js rewrite hedefi derleme sırasında belirlenir (`STAGEFLOW_API_URL`). Docker build varsayılanı `http://api:9149`; yerel geliştirme varsayılanı `http://127.0.0.1:9149` olur. Web Socket.IO hedefi gerektiğinde derleme sırasında `NEXT_PUBLIC_API_URL` ile verilir. Mobil `EXPO_PUBLIC_API_URL` paketleme sırasında belirlenir. Gizli anahtarlar `NEXT_PUBLIC_` veya `EXPO_PUBLIC_` değişkenlerine konulmaz.
