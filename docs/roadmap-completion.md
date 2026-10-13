# Todo 1–10 — Geliştirme ve kabul durumu

Kullanıcı kararı: gerçek hesaplarla canlı kabul kontrolleri sona bırakılır. İzole testin geçmesi gerçek kabulün geçtiği anlamına gelmez. Mevcut GitHub/Supabase/Vercel düzeni, dört kalıcı hesabın şifreleri ve manuel/nakit ödeme yaklaşımı korunur.

| Madde | Geliştirme durumu | Uygulama |
|---|---|---|
| 1 | Önceki geliştirmeler tamam | Merkez/organizasyon/derse göre çoklu rol, üye-hesap bağlama |
| 2 | Tamam; gerçek e-posta kabulü açık | Öğrenci/eğitmen panelleri, profil ve şifre işlemleri |
| 3 | Tamam; gerçek kabul açık | Talep, geri çekme, gerekçeli ret, alternatif ve onay |
| 4 | Tamam | Grup programı, haftalık 1–52 ders, atomik çakışma kontrolü, üyelik aktarımı, grup/ders kontenjanı |
| 5 | Tamam | Manuel tahsilat defteri, kısmi ödeme, borç, iade ve tek seferlik ters kayıt |
| 6 | Tamam | Öğrenci iptali, geç iptal/gelmeme, ders iptali, erteleme, ayrı telafi ve tek seferlik kredi |
| 7 | Tamam | Mevcut talep bildirimleri + ders değişikliği, 24 saat içinde ders ve düşük kredi/7 gün içinde paket bitişi; 15 dakikalık uygulama içi hatırlatma işi |
| 8 | Tamam | Yöneticiye özel B2C pazarlama CRM, kaynak/ilgi/deneme/aşama, takip görevi, mevcut üyeye idempotent dönüşüm |
| 9 | Tamam | İstanbul tarih aralığı, net tahsilat, dönem sonu borç, yenileme, ders doluluğu, oda/eğitmen ayrılan saatleri ve aday kohortu dönüşümü; tam CSV |
| 10 | İhtiyaç değerlendirmesi tamam; bekleme listesi uygulandı | Grup kuyruğu ve yöneticiyle sıradaki kaydı terfi. Diğer koşullu modüller aşağıda ayrılır. |

## Ekranlar

- /dashboard/groups — program, öğrenci kaydı, gelecek ders listesi, kontenjan ve bekleme listesi.
- /dashboard/payments — tahsilat/iade/ters kayıt; tutar, tarih, yapan kişi ve açıklama.
- /dashboard/lesson-operations — öğrenci iptali, gelmeme, ders iptali, erteleme, telafi, merkez iptal süresi.
- /dashboard/crm — yalnızca yöneticilere açık aday ve takip kayıtları.
- /dashboard/reports — tarih filtreli rapor ve eksiksiz CSV.

## İş kuralları

- Programdaki herhangi bir oda/eğitmen çakışması tüm seriyi geri alır. Bekleyen özel ders talepleri yine oda ayırmaz; kesin grup dersleri onay sırasında çakışmaya girer.
- Grup kayıtları yalnızca gelecek planlanmış derslere aktarılır/kaldırılır. Geçmiş yoklamalar korunur.
- Tahsilat defteri istemciler için değişmez. Aynı işlem anahtarı tekrar ödeme oluşturmaz; aynı tahsilat bir kez ters çevrilebilir. İade net tahsilatı azaltır ve borcu artırır; paket/kredi durumu ayrıca yönetilir.
- Eski `paid` paketler açıkça “önceki ödeme durumundan açılış” olarak aktarılır. Tarih yoksa önceki kayıt oluşturma tarihi kullanılır; yeni bir tahsilat yapıldığı iddia edilmez.
- Ücretsiz öğrenci iptali varsayılan 24 saat öncedir, merkez yöneticisi 0–168 saat aralığında değiştirebilir. Erken grup iptali o dersteki yeri boşaltır; diğer haftalardaki grup kaydı sürer.
- Geç öğrenci iptali ve gelmeme bir kredi kullanır. Öğrencinin özel ders iptali odayı serbest bırakır; geç iptal cezası iade edilmez.
- Eğitmen/yönetici ders iptali kullanılan krediyi bir kez geri verir. İptal/ertelenmiş ders aynı kimlikle açılmaz; telafi ayrı kimliktir ve normal katılım kuralına göre kredi kullanır.
- Grup dersi tamamlanırken merkezdeki tüm paketler dolaşılmaz: yalnızca katılımı olan veya geç iptal/gelmeme sonucu olan üye işlenir. Bir ders/üye için daha önce kredi tüketilmişse başka paket seçilerek ikinci kez tüketilmez.
- Eski kredi kayıtları otomatik düzeltilmedi veya silinmedi; yeni kurallar bundan sonraki işlemlere uygulanır.
- Ders hatırlatmaları öğrenciye ve eğitmene, paket hatırlatmaları hesapla bağlı üyeye gider. Dedupe anahtarı tekrar bildirimi engeller. Dış kanallar ihtiyaç aşamasına bırakıldı.
- CRM aynı merkezde normalize edilmiş iletişim bilgileriyle eşleşen üyeyi kullanır. Birden çok üye eşleşirse otomatik birleştirme yapılmaz. Auth hesabı açma/bağlama ayrı mevcut işlemdir.
- Borç, seçilen dönem sonuna kadarki tahsilat hareketinden hesaplanır. Kredi/yenileme ve CRM aşama göstergeleri güncel durumdur; geriye dönük tarihsel kredi bakiyesi olarak sunulmaz.
- Oda/eğitmen kullanımı ayrılmış ders saatidir; çalışma saatleri tanımlanmadığından yanıltıcı kapasite yüzdesi üretilmez.

## 10. madde: koşullu modüller

- Bekleme listesi: kontenjan yönetimini tamamladığı için uygulandı. Otomatik rezervasyon yapmaz; yönetici sıradaki öğrenciyi alır.
- Öğrenci gelişim takibi: gerçek kullanımda ölçülecek beceriler ve eğitmen kayıt biçimi belirlenmediği için geliştirilmedi.
- Etkinlik/biletleme: düzenli ders ve manuel paket tahsilatı kapsamının dışında; etkinlik ihtiyacı/kapsamı olmadan geliştirilmedi.
- Veli hesabı: mevcut B2C bireysel/yetişkin öğrenci modelinde ihtiyaç belirtilmedi; yeni kişi erişim ilişkisi eklenmedi.

Bunlar tamamlanmış modüller olarak gösterilmez. Listenin 10. maddesindeki “gerçek kullanım talebine göre değerlendirilsin” koşulu bu kararlarla karşılanır.

## İzole doğrulama

67 unit/SSR testi. Sentetik kullanıcı ve iki merkezli SQL kontratları: tekrar/seri rollback, kontenjan, merkezler arası ret, kısmi ödeme/retry/refund, yanlış grup kredi tüketimini engelleme, iptal iadesi, erken iptal, hatırlatma dedupe, CRM rol izolasyonu/aynı üyeye dönüşüm, 1.003 satırın eksiksiz raporu, bekleme listesi terfi/rollback. TypeScript, lint ve production build kontrol edilir. CI tüm ileri migration'ları temiz Supabase veritabanında sırayla uygulayıp test eder. Üretimde test üyesi/işlemi oluşturulmaz.

## Açık gerçek kabul listesi

2: gerçek sıfırlama e-postası ve bağlantı.
3: talep → alternatif → yanıt → onay/ret/geri çekme ve eşzamanlı onay.
4: gerçek haftalık program, öğrenciler, kontenjan ve oda/eğitmen takvimi.
5: kasa örnekleriyle kısmi tahsilat, iade ve ters kayıt mutabakatı.
6: okulun iptal süresini seçmesi; gerçek iptal/gelmeme/telafi ve kredi mutabakatı.
7: canlı zamanlanmış iş ve uygulama içi teslim.
8: gerçek adayın mevcut/yeni üyeye dönüşümü ve yönetici kapsamı.
9: dönem sonu mutabakatı ve dışa aktarılan dosyalar.
10: bekleme listesi kullanım testi; diğer ek modüllerin ihtiyaç kararı.

Gerçek kabul kullanıcı talimatıyla açık kalır; kalıcı test hesaplarının şifreleri değiştirilmez.


## Recovery düzeltmeleri — 14.10.2026

Kod ve canlı veritabanı durumu ayrı takip edilir. Eksik 4–9/bekleme listesi şeması canlıya atomik recovery migration'ıyla uygulandı; kaynak eşlemesi recovery-database-rollout.md içindedir.

- İç kredi/trigger fonksiyonlarının genel çalıştırma yetkisi kaldırıldı.
- Grup kredisi yalnızca gerçek katılımcı/gelmeme kayıtları için tüketilir.
- Yoklamada gelmeme yeni kredi kuralına bağlandı; kayıtlı olmayan grup öğrencisi ve iptal/gelmeme sonrası çelişkili katılım reddedilir.
- Dersin yalnızca bitiş saatinin değişmesi de bildirim oluşturur.
- Tahsilat yöntemi (cash/manual), ters kayıtta yöntemin korunması ve işlem anahtarı tutarlılığı eklendi.
- Öğrenci kendi ödenen/kalan tutarlarını görür; yalnızca paket sahibi kendi mali özetine erişir.
- CRM dönüşümleri merkez bazında kilitlenerek farklı iletişim anahtarlarıyla eşzamanlı dönüşüm yarışları sınırlandı.
- Recovery dalına push CI'ı tetikler. Vercel ve yetkilendirme belgeleri güncellendi.
- Yeni SQL kontratları bitiş saati bildirimi, gerçek yoklama/gelmeme, kredi iadesi, telafi/erteleme, ödeme yöntemi ve kişisel borç yalıtımını doğrular.

Gerçek oturumlu UI kabulü, e-posta teslimi ve canlı zamanlanmış bildirimin çalışması açık kalır. Kalıcı hesaplar ve QA üyesi korunur. Şifreler değiştirilmez. İhtiyaç belirtilmeyen ek modüller tamamlandı sayılmaz.
