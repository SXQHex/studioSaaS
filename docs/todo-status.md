# FTK Studio / FtkApp — Güncel Geliştirme Takibi
Son gözden geçirme: 14.10.2026 — recovery/studiosaas-pr13 kodu ve canlı Supabase.

[x] = uygulanmış ve belirtilen düzeyde doğrulanmış; [ ] = açık kabul veya ihtiyaç.
Kod/izole test/canlı şema kontrolü, gerçek kullanıcı kabulü yerine geçmez.
Mevcut GitHub deposu, Supabase backend ve Vercel dağıtım düzeni korunur.

**Plan kısıtı:** Supabase projesi Free plandadır. Auth sızdırılmış parola koruması bu planda etkinleştirilemez. Bu durum hata, açık sorun veya geliştirmelerin tamamlanmasını engelleyen bir kabul ölçütü olarak listelenmez.

| Sıra | Geliştirme | Geliştirme / canlı DB | Kabul |
|---|---|---|---|
| 1 | Kullanıcı, rol ve erişim | Uygulandı | Gerçek oturumlu son UI kontrolü açık |
| 2 | Öğrenci/eğitmen panelleri | Uygulandı | Gerçek sıfırlama e-postası açık |
| 3 | Özel ders talep/onay | Uygulandı | Gerçek akış ve eşzamanlı onay kabulü açık |
| 4 | Grup planlama/katılımcılar | Uygulandı | Gerçek program ve kontenjan kabulü açık |
| 5 | Manuel tahsilat | Uygulandı | Kasa mutabakatı açık |
| 6 | İptal/telafi/kredi | Uygulandı | Okul kuralı ve gerçek kredi mutabakatı açık |
| 7 | Bildirimler | Uygulandı; cron aktif | Zamanlanmış teslim ve dış e-posta kabulü açık |
| 8 | Yönetici CRM | Uygulandı | Gerçek aday dönüşümü kabulü açık |
| 9 | Raporlar | Uygulandı | Gerçek dönem mutabakatı açık |
| 10 | İhtiyaca bağlı modüller | Bekleme listesi uygulandı | Kullanım kabulü ve diğer modüllerin ihtiyaç kararı açık |

## 1. Kullanıcı, rol ve erişim

- [x] Altı rol, organizasyon/merkez/ders kapsamı, çoklu rol çözümleme ve RLS/RPC kontrolleri.
- [x] Hesap–üye bağlama/ayırma, doğrulanmış hesap kontrolü, merkezde mükerrerlik engeli ve denetim kaydı.
- [x] Öğrenci görünümüm ve yetkili merkez rol yönetimi.
- [x] İzole rol, kapsam ve merkez yalıtımı testleri.
- [ ] Gerçek yönetici/owner oturumuyla Üyeler → Giriş hesabı ve Merkez rolleri formunun son UI kabulü.
- [ ] Asistan hesabıyla kendi QA üyesinin görünmesi ve yetkisiz yönetim erişiminin son UI kabulü.

## 2. Öğrenci ve eğitmen panelleri

- [x] Kayıtlı dersler, paket, kredi, yoklama ve ödeme durumu.
- [x] Kısmi ödeme sonrası öğrenciye yalnızca kendi net ödenen tutarı ve kalan borcu gösteren mali özet.
- [x] Eğitmene kendi derslerinin öğrenci listesi; asistanın tam rehber erişimi engelli.
- [x] Profil adı düzenleme; yalnızca full_name sütununa yazma izni.
- [x] Mevcut şifre doğrulamalı değiştirme ve recovery bağlantısı akışı.
- [x] Önceki çalışmada oturumlu panel/şifre fixture kabulü kaydedildi; gerçek e-posta teslimi bunun kapsamı dışında.
- [ ] Gerçek şifre sıfırlama e-postası, şablon, redirect ve tek kullanımlık bağlantı teslimi.

## 3. Özel ders talebi

- [x] Geri çekme, zorunlu/görünür ret gerekçesi, alternatif saat ve sürüm kontrollü kabul/ret.
- [x] Bekleyen talepler oda ayırmaz; onayda oda/eğitmen çakışması tekrar kontrol edilir.
- [x] Geçmiş ve uygulama içi bildirimler.
- [x] İzole çakışma, rollback, yetki ve tekrar işlem testleri.
- [ ] Gerçek talep → alternatif → yanıt → onay/ret/geri çekme ve eşzamanlı onay kabulü.

## 4. Grup programı

- [x] Haftalık 1–52 ders serisi ve tek çakışmada tüm seri rollback.
- [x] Grup öğrenci kaydı/çıkarma, gelecek derslere aktarım ve geçmiş kayıtların korunması.
- [x] Ders/grup kontenjanı, fazla kayıt engeli ve bekleme kuyruğu.
- [x] Özel ders değerlendirmesinde planlanan grup oda kullanımı.
- [x] Tek ders iptali/ertelemesi/telafisi ile seri istisnaları.
- [ ] Gerçek haftalık program, katılımcı ve takvim kabulü.

## 5. Manuel/nakit tahsilat

- [x] Ayrı eklemeli tahsilat defteri: tutar, tarih, yapan kişi, yöntem ve açıklama.
- [x] Kısmi tahsilat, net ödenen ve kalan borç.
- [x] Para iadesi ve tek seferlik ters kayıt; geçmiş silinmez, ters kayıtta yöntem korunur.
- [x] Tekrar işlem anahtarı ile mükerrer tahsilat engeli.
- [x] Para iadesi ile kredi iadesi ayrı işlemler.
- [ ] Gerçek kasa örnekleriyle kısmi tahsilat/iade/düzeltme mutabakatı.

## 6. İptal, erteleme, telafi ve kredi

- [x] Erken/geç öğrenci iptali, eğitmen iptali, gelmeme ve ayrı telafi.
- [x] Varsayılan ücretsiz iptal 24 saat; yönetici merkezde 0–168 saat seçebilir.
- [x] Geç iptal/gelmeme bir kredi; eğitmen iptalinde tüketilmiş kredi bir kez iade.
- [x] Grup tüketimi tüm merkez paketlerini dolaşmaz; yalnızca ilgili katılımcı ve sonuçlar işlenir.
- [x] Gelmedi yoklaması kredi kuralına bağlı; grup yoklaması kayıtlı öğrenci gerektirir.
- [x] İptal/gelmeme sonrası çelişkili katılım, iptal kimliğini yeniden açma ve çift kredi tüketimi engeli.
- [x] İç kredi ve trigger fonksiyonları anon/authenticated tarafından doğrudan çalıştırılamaz.
- [x] İzole tekrar, iade, telafi/erteleme ve öğrenci yalıtımı testleri.
- [ ] Okulun iptal süresi kararı ve gerçek kredi mutabakatı.

## 7. İşlemsel bildirimler

- [x] Talep sonucu, alternatif saat/yanıt, ders değişikliği ve paket hatırlatması.
- [x] Yalnızca ders bitiş saati değiştiğinde de bildirim.
- [x] Yaklaşan ders ve düşük kredi/7 gün içinde paket bitişi için tekrar önlemeli uygulama içi bildirim.
- [x] Canlı pg_cron işi aktif: her 15 dakika.
- [ ] Canlı zamanlanmış işin çalışması ve kullanıcı kutusunda teslim kabulü.
- [ ] Mevcut dış e-posta kanalının gerçek teslim, hata ve yeniden deneme kabulü. Yeni dış kanal eklenmedi.

## 8. Yönetici CRM

- [x] B2C aday, kaynak, ilgi alanı, deneme tarihi, takip görevi ve aşamalar.
- [x] Normalize e-posta/telefonla mevcut üyeye dönüşüm; tekrar dönüşüm aynı üyeyi döndürür.
- [x] Birden fazla eşleşmede otomatik birleştirme yapılmaz.
- [x] Sunucu, RPC ve RLS merkez yöneticisi kapsamı.
- [x] CRM dönüşümü merkez bazında kilitli; izole erişim ve dönüşüm testleri.
- [ ] Gerçek adayın mevcut/yeni üyeye dönüşümü kabulü.

## 9. Raporlar

- [x] Tahsilat, dönem sonu borç, yenileme, doluluk, oda/eğitmen ayrılan saat ve CRM dönüşümleri.
- [x] İstanbul saatine göre tarih filtresi.
- [x] Tam CSV; 1.003 satırlık dışa aktarım testi.
- [x] Kullanım ayrılmış ders saatidir; tanımlanmamış çalışma saatlerinden kapasite yüzdesi üretilmez.
- [ ] Gerçek dönem sonu mutabakatı ve dışa aktarma kabulü.

## 10. İhtiyaca bağlı modüller

- [x] Bekleme listesi ve yöneticiyle sıradaki kaydı gruba alma.
- [ ] Bekleme listesinin gerçek kullanım kabulü.
- [ ] Öğrenci gelişimi, etkinlik/biletleme ve veli hesabı: gerçek ihtiyaç ve kapsam bekliyor; geliştirilmiş sayılmaz.

## Teknik doğrulama ve dağıtım

- [x] Canlı eksik şema tek atomik migration ile uygulandı: 20261013231712 / roadmap_recovery_4_to_9_and_consistency.
- [x] Dokuz yeni tabloda RLS, kredi fonksiyonu yetkileri ve aktif cron kontrol edildi.
- [x] Mevcut kullanıcı/üye/paket/ders/kredi kayıt sayıları korundu; canlıya test fixture eklenmedi.
- [x] TypeScript, production build, bağımlılık denetimi ve izole SQL kontratları geçti.
- [x] Recovery dalı push işlemlerinde CI çalışacak şekilde düzeltildi.
- [x] Eski Netlify ve yetkilendirme belgeleri mevcut Vercel/scoped role düzenine göre güncellendi.
- [ ] Recovery değişikliklerinin üretim dalına alınması ve mevcut Vercel dağıtımında kabul.
- [ ] Advisor bakım maddeleri: public btree_gist ve tarihsel indeksler. Kullanılmayan indeksler otomatik silinmedi.

owner@ftk.com, admin@ftk.com, instructor@ftk.com, asist@ftk.com ve QA - Asistan Öğrenci korunur. Parolalar değiştirilmez veya dosyaya yazılmaz.
Gerçek kabul kontrolleri önceki kullanıcı kararıyla sona bırakılmıştır; bu dosyada tamamlanmış gösterilmez.
