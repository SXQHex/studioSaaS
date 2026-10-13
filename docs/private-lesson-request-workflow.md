# Todo 3 — Özel ders talep ve onay süreci

## Geliştirme kapsamı

Mevcut model korunur: özel ders talebini yetkili eğitmen, yalnızca erişebildiği üye için oluşturur; yönetici değerlendirme yapar. Öğrenci adına doğrudan yeni talep oluşturma ayrı bir akış olarak eklenmemiştir.

- Talep sahibi kendi bekleyen talebini geri çekebilir. Onaylı/reddedilmiş/geri çekilmiş talepler bu işlemle değişmez.
- Ret gerekçesi hem uygulamada hem RPC'de zorunludur.
- Yönetici bekleyen özel ders talebine açıklamalı alternatif saat önerebilir.
- Talep sahibi öneriyi kabul veya reddeder. Kabul sadece talebin saatini değiştirir; talep yönetici onayı bekler ve oda ayırmaz.
- Öneri sürümü yanıt sırasında kontrol edilir; eski ekrandaki yanıt değişmiş öneriye uygulanmaz.
- Her oluşturma, geri çekme, ret, onay ve alternatif işlemi sunucu tarafından işlem geçmişine yazılır. Geçmiş aynı talebin erişim kapsamıyla sınırlıdır.
- Bekleyen talep ve alternatif öneri kesinleşmiş ders oluşturmaz. Çakışma kontrolleri sadece onayda, aynı transaction içinde yeniden çalışır; mevcut oda/eğitmen exclusion constraint'leri eşzamanlı onayları da korur.
- Onayda aktif merkez/oda, oda kapasitesi, aktif üye, gelecekteki başlangıç ve eğitmenin merkez görevi yeniden kontrol edilir.
- Yönetici aynı oda/saatteki bekleyen grup taslaklarını özel dersin yanında görür.
- Geri çekme ve alternatif değişiklikleri uygulama içi bildirim oluşturur; dış e-posta teslimi bu maddenin kabul kanıtı değildir.
- Talep saatleri İstanbul saat dilimiyle girilir ve gösterilir.

## Doğrulama

56 unit testi, TypeScript ve production build yerel izole ortamda geçti. CI yeni migration'ı baseline ve önceki migration'lardan sonra temiz veritabanına uygulayarak sentetik kullanıcı/merkez/oda kayıtlarıyla kontrol eder:
geri çekme sahipliği, zorunlu ret gerekçesi, yanıtlanmamış alternatifin onay engeli, eski öneri sürümü, alternatif kabul/ret, rezervasyon oluşturmama, tekrar onay/geri çekme, oda/eğitmen çakışmasında transaction rollback ve işlem geçmişinin merkez yalıtımı.

## Açık gerçek kabul kontrolleri

Kullanıcı isteğiyle gerçek hesaplarla canlı senaryo kontrolleri sona bırakılmıştır. Canlı talep oluşturma → alternatif → kabul/ret → yönetici onayı/ret/geri çekme, eşzamanlı onay senaryosu ve bildirim teslimi henüz gerçek verilerle kabul edilmemiştir. Bu durum geliştirme ve izole testlerin tamamlanmasına engel değildir; gerçek kabul ayrıca açık tutulur.

Todo 2'nin gerçek sıfırlama e-postası teslimi/bağlantı kontrolü de açık kalır. Kalıcı dört test hesabının şifreleri değiştirilmez.
