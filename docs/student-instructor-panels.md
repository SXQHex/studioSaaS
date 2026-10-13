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
