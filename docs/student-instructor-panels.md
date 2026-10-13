# Todo 2 — Öğrenci ve eğitmen panelleri (PR #10)

## Tamamlanan akışlar
- Öğrenci görünümünde sadece giriş hesabına bağlı üye kayıtlarının paketleri, kredileri, ödeme durumları, yoklamaları ve yaklaşan **kayıtlı** grup/özel dersleri gösterilir. Diğer merkezlerin grup dersleri "benim dersim" olarak gösterilmez.
- Öğrenci, eğitmen veya yönetici olarak çalışan aynı kimlik /dashboard/my-learning üzerinden kişisel üyeliklerini görüntüler.
- /dashboard/my-students ekranı yalnızca yönetilen ya da tam eğitmen olarak atanılan dersleri ve bu derslerin özel üye, grup kaydı, yoklamaya dayalı öğrenci listesini sunar. Asistanın yoklama rolü tek başına tam öğrenci rehberi açmaz.
- /dashboard/account ekranında kendi profil adı değiştirilebilir, giriş e-postası salt okunur; yetkili roller değiştirilemez.
- Şifre değiştirmede mevcut şifre önce yalıtılmış oturumla doğrulanır, yeni şifre yalnızca mevcut Auth kimliğine uygulanır. Şifreler loga ve uygulama tablolarına kaydedilmez.
- Şifremi unuttum akışı /login üzerinden Supabase Auth sıfırlama bağlantısıyla /reset-password sayfasına gider.

## Güvenlik kontrolleri
- Kendi profil adını düzenleme için profiles UPDATE yalnızca full_name sütununa verilir; role için istemci UPDATE yoktur.
- Derse özel roster RPC, auth.uid ile kontrol edilen yönetici veya o derse atanmış tam instructor kimliğini gerektirir. Çapraz merkez, öğrenci ve yalnızca ainstructor çağrıları 42501 ile reddedilir.
- İzole testler rollback yapar; kalıcı dört @ftk.com hesabı ve ortak test şifreleri değiştirilmez.

## Kabul listesi
1. /dashboard/my-learning ile QA - Asistan Öğrenci kendi bağlı üye kaydını, paketini ve planlanan kayıtlı dersini görür; kayıtlı olmadığı gruplar görünmez.
2. instructor@ftk.com /dashboard/my-students ekranında yalnızca atandığı derse ait QA - Asistan Öğrenci kaydını görür. Farklı merkez ve farklı ders öğrencilerine erişemez.
3. asist@ftk.com /dashboard/my-students ekranına erişemez, kendi öğrenci sayfasını açabilir.
4. Kullanıcı /dashboard/account üzerinden adını kaydeder; diğer kullanıcı profili ve yetki alanları değiştirilemez.
5. Şifre değiştirme ayrı bir **geçici** QA hesabında eski şifre doğru/yanlış ve yeni şifre uyumsuz senaryolarıyla doğrulanır. Kalıcı dört test hesabının şifrelerine dokunulmaz.
6. E-posta ile sıfırlama için geçici hesapta tek kullanımlık bağlantı, süresi geçmiş bağlantı ve yeni şifreyle giriş doğrulanır.

İzole SQL, unit, build ve Playwright CI sonuçları kod/doğrulama kanıtıdır. Gerçek oturumlu tarayıcı kabulü ayrı doğrulanmadan Todo 2'nin son iki kabul maddesi kapatılmamalıdır.

## Canlı kabul doğrulaması — 2026-10-13

- Dört kalıcı hesabın oturumları açıldı. Öğrenci görünümünde QA üyesi, 4/4 kredi, aktif paket, bekleyen ödeme ve kayıtlı tek yaklaşan ders görüldü.
- Eğitmen ve yönetici ders öğrenci listesinde yalnızca atanmış/yönetilen QA dersinin öğrencisini gördü. Asistan /dashboard/my-students isteğinde /dashboard'a yönlendirildi.
- Geçici, üye/merkez kaydı olmayan QA hesabında profil adı kaydedilip sayfa yenilenerek kalıcılığı doğrulandı; giriş e-postası salt okunurdu.
- Geçici hesapta uyuşmayan şifreler ve yanlış mevcut şifre reddedildi; doğru mevcut şifreyle değişiklik yapıldı. Auth yeni şifreyi kabul etti, eski şifreyi reddetti.
- Geçici hesaba doğrudan eklenen Auth tek kullanımlık recovery_token fixture'ıyla canlı /confirm → /reset-password → şifre güncelleme akışı ve yeni şifreyle Auth girişi doğrulandı. Kullanılmış ve süresi dolmuş fixture bağlantıları reddedildi.
- Fixture hesabının oturumları ve kullanıcı kaydı test sonunda silindi; kalan geçici kullanıcı sayısı 0. Kalıcı dört hesabın parolaları değiştirilmedi.
- Giriş kabul testleri IP başına 8/15 dakika sınırına ulaştı; limiter değiştirilmedi. Şifre sonrası kimlik doğrulaması Supabase Auth üzerinden yapıldı.
- Kabul sırasında öğrenci panelinde dersin UTC, eğitmen panelinde İstanbul saatiyle gösterildiği bulundu. Öğrenci ders başlangıç/bitiş, yoklama ve kredi hareketi zamanları Europe/Istanbul olarak düzeltildi.
- Düzeltme için UTC ve America/Los_Angeles ortamlarında 4 saat/gün sınırı testi eklendi. Toplam 52 unit testi, TypeScript ve production build geçti. Production build üzerinde oturumlu öğrenci ekranı 19:00–20:00 gösterdi; 390px genişlikte taşma bulunmadı.

**Açık kabul ölçütü:** Gerçek sıfırlama e-postasının teslimi, e-posta şablonu ve redirect allowlist bu çalışmada doğrulanmadı. Doğrudan üretilen fixture bağlantısı e-posta teslim kanıtı değildir. Todo 2'nin kodu ve oturumlu panel/şifre akışları doğrulandı; e-posta üzerinden tam uçtan uca kabul için bu son kontrol açık kalır.

2026-10-13 kullanıcı kararı: Gerçek e-posta kabul kontrolü diğer gerçek kontrollerle birlikte sona bırakılacak; açık kalır.
