# Geliştirme akışı

Kod üç özellik dalıyla ana dala alınır:

1. `feat/backend`: NestJS, PostgreSQL, ortak sözleşmeler ve entegrasyon testleri.
2. `feat/web`: Next.js operasyon masası ve canlı güncellemeler.
3. `feat/mobile`: Expo saha/katılımcı istemcisi, çevrimdışı kuyruk, kamera ve fotoğraf.

Bir sonraki dal, önceki özellik ana dala alındıktan sonra main'den açılır. Böylece mobil ve web PR'ları API temelini kullanır. Ortak tip değişikliği gerektiğinde tüketiciler ve testler aynı değişiklikte güncellenir. Ana dalın doğrulaması typecheck, gerçek veritabanıyla test, API/web build ve Expo export adımlarından oluşur.

Kök `package.json`, uygulama bağımlılıklarının birleşimini de içerir; bu, Windows'ta workspace symlink oluşturulamayan ortamlarda `npm ci --workspaces=false --ignore-scripts` ile kurulumu mümkün kılar. Sürüm değiştirirken uygulama manifesti, kök manifest ve lock dosyası birlikte güncellenmelidir.

## Test senaryoları

20 test; organizasyon izolasyonu, parola doğrulama, katılımcı veri sınırı, görev bağımlılığı, sürüm çakışması, idempotency, rol sınırı, program ve vardiya çakışması, ekipman kapasitesi, eşzamanlı bilet girişi, kuyruk sırası/koruma, İstanbul tarih dönüşümü ve sahne konumu sınırlarını kapsar.

Tarayıcı kabul kontrolü: teknik hesapla mobilde görev başlat; webde admin hesabının açık görev tablosunda yenilemeden durumu gör. Sunucuyu kapatıp mobilde bir görevi değiştir; “Eşitleme bekliyor” uyarısını gör, sunucuyu açınca kaydın eşitlenmesini doğrula.

Android Hermes export yalnızca JavaScript paketleme kontrolüdür. Dağıtılabilir APK/IPA için Android/iOS araçları veya EAS kurulumu, imzalama ve cihaz testi ayrıca gereklidir.
