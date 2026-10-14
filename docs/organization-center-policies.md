# Organizasyon ve merkez politikaları

Ekran: /dashboard/settings. Organizasyon sahibi kendi organizasyonunun kurallarını; merkez yöneticisi yalnızca izin verilen merkez tercihlerini yönetir.

## Politika çözümleme

1. Zorunlu organizasyon değeri herkese uygulanır.
2. Tavsiye değerinde merkez tercihi geçerli sınırlar içindeyse uygulanır.
3. Merkez tercihi yoksa veya yeni sınırlar dışında kalmışsa organizasyon varsayılanı uygulanır.
4. Henüz organizasyon tanımı yoksa sistem başlangıç değeri tavsiye olarak kullanılır.

Merkez tercihi organizasyon varsayılanı değiştiğinde korunur. Zorunluya geçişte saklanır ama etkisizdir. Varsayılana dönüş tercihi kaldırır; sürüm sayısı düşmez. Eski ekranın kaydı güncel ayarı ezemez. Her değişiklik açıklama, aktör, önceki/yeni kayıt ve sürüm ile denetlenir.

## Başlangıç değerleri

| Ayar | Değer |
|---|---|
| Özel ders ücretsiz iptal | En az 12 saat önce |
| Grup öğrenci iptalinde iade | Hayır |
| Geç iptal / gelmeme kredisi | Bir kredi |
| Talep alt süresi | 0 saat |
| Talep ileri tarih sınırı | 90 gün |
| Aynı üye/merkez bekleyen özel ders talebi | 5 |
| Yeni özel ders paketi azami süresi | 90 gün |
| Yeni grup paketi azami süresi | 0: takvim süresi yok |
| Borçlu talep / grup kaydı / katılım engeli | Hayır; ayrı ayrı ayarlanabilir |
| Ders hatırlatması | 24 saat |
| Paket bitiş uyarısı | 7 gün |
| Düşük kredi eşiği | 1 |

Paket süresi azami süredir: daha kısa tarih girilebilir; boşsa pozitif politika süresi uygulanır. 0 takvim sınırı olmadığını belirtir. Mevcut paketler ve tüketimler değiştirilmez. Talep min/max zamanları birbiriyle çelişemez.

## Üç temel sınır

Çakışma, fiziksel kontenjan, çift kredi/tahsilat önleme, erişim yetkileri ve yönetici onayı sabit sistem garantileridir; politika tanımında bulunmaz.

Tavsiye sayısal değerlerinde organizasyon hard sistem sınırları içinden merkez alt/üst aralığını seçer. Boolean ayarlar zorunlu veya merkezce değiştirilebilir tavsiye olabilir.

Organizasyon sahibi normal işlemlerde zorunlu kurallardan muaf değildir. İptal/gelmeme istisnası ayrı owner/platform işlemiyle, tek ders/üye için gerekçeyle uygulanır. Bu işlem aynı transaction içinde iptali/gelmeme kaydını tamamlar ve politika sürümünü/istisnayı kaydeder. Talep/borç/paket kurallarında gizli owner bypass yoktur; bu kuralların dışına çıkmak için geçerli politikayı yetkili akışla değiştirmek gerekir.

## Uygulama ve doğrulama

İptal, gelmedi yoklaması, talep oluşturma/alternatif kabul/onay, grup kaydı/terfi ve katılım, yeni paket oluşturma ve cron bildirimleri etkin politikalara bağlıdır. İptal/gelmeme kaydı kendi politikasıyla sabittir; sonraki ders tamamlama eski sonucu yeniden fiyatlandırmaz.

Canlı kaynak migration eşlemesi:
- 20261014005823 organization_center_policies ← 20261014004641_organization_center_policies.sql
- 20261014005959 policy_revision_snapshots ← 20261014005928_policy_revision_snapshots.sql
- 20261014010046 policy_reset_revision ← 20261014010043_policy_reset_revision.sql

Temiz PostgreSQL SQL kontratı: zorunlu/owner engeli, tavsiye aralığı, varsayılan değişikliğinde tercih koruma, reset sonrası eski sürüm engeli, org yalıtımı, tam 12 saat, grup iptali, paket geçmişi, talep zamanı/sınırı, borç ve gerekçeli istisna, eski gelmeme kararının korunması ve bildirim dedupe. 72 unit/SSR testi, TypeScript, lint ve build geçti. Gerçek hesaplı UI kabulü sona bırakılmıştır.
