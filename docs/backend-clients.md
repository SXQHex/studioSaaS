# Ortak Supabase backend

Android, iOS, macOS, Windows ve mevcut web uygulaması aynı Supabase Auth,
PostgreSQL, RLS ve iş kurallarını kullanır. Native istemciler Next.js sunucusuna,
tarayıcı çerezlerine veya Server Action protokolüne ihtiyaç duymaz.

## Sorumluluklar

| İşlem | Kullanılacak yol | Yetki ve tutarlılık |
| --- | --- | --- |
| Giriş, kayıt, token yenileme, şifre sıfırlama | Supabase Auth | Kullanıcı oturumu; cihazda güvenli token saklama |
| Listeleme, kendi profil adını düzenleme, bildirim okuma | Data API / istemci SDK'sı | RLS ve izin verilen kolonlar |
| Basit üye ekleme ve iletişim bilgisi düzenleme | Data API / SDK veya `members.save` | Yönetilen merkez sınırı; hesap bağlantısı ayrı komuttur |
| Manuel tahsilat, iade, paket satışı, kredi, ders ve kayıt işlemleri | `studio-api` Edge Function | Kullanıcı JWT'si; doğrulama; PostgreSQL transaction, kilit ve tetikleyicileri |
| E-posta gönderimi | Mevcut outbox ve `process-studio-email` | Sınırlı parti; teslim, hata ve yeniden deneme kaydı |
| Kullanıcıya özel rapor ve karmaşık okuma | RLS korumalı RPC veya Edge sorgusu | Yetkiyi SQL de denetler; sunucu sayfalaması |

RLS hangi kayıtlara erişilebildiğini belirler; tek başına bütün iş kurallarını
uygulamaz. Kritik kurallar SQL constraint, trigger ve RPC'lerde korunur.
Finansal tabloya doğrudan yazmak veya hesabın rolünü istemciden değiştirmek
CRUD kapsamına girmez. Paket, ders ve kredi değişikliklerinde komutları kullanın.
Mevcut iç RPC'lerin doğrudan çağrılabilmesi Edge katmanına alternatif bir yetki
vermez: SQL aynı kullanıcı ve merkez kurallarını uygulamaya devam eder.

Web Server Action'ları yalnızca oturum alma ve ekran yenileme adaptörüdür.
`lib/backend/services` içindeki ortak servisleri çağırır. Edge API de aynı
servisleri derlenmiş olarak kullanır; ikinci bir iş kuralı kopyası yoktur.

## Adresler ve kimlik doğrulama

Proje kökü: `https://ysplylnwdfwizmuxvcqg.supabase.co`

- Data API: `/rest/v1/<table>`; RPC: `/rest/v1/rpc/<function>`.
- Edge API: `/functions/v1/studio-api/v1`.
- API sözleşmesi: `/functions/v1/studio-api/v1/openapi`.
- Komutlar: `POST /functions/v1/studio-api/v1/commands/<command>`.
- Sorgular: `GET /functions/v1/studio-api/v1/queries/<query>`.

Her korumalı istekte:

```http
Authorization: Bearer <Supabase user access_token>
apikey: <project publishable key>
Content-Type: application/json
```

Publishable key kullanıcı kimliği değildir. Kullanıcı JWT'si yerine gönderilmez.
İstemciye `service_role`, secret key veya veritabanı parolası verilmez.
API anahtarı kullanılan projeyle, access token kullanılan kullanıcıyla ilgilidir.

Edge Function her korumalı istekte `auth.getUser(token)` ile kullanıcıyı doğrular;
profili ve güncel kapsamlı rolleri veritabanından okur. Kullanıcının değiştirebildiği
`user_metadata` ve eski `profiles.role` yetki kaynağı değildir.
İsteğe özel Supabase istemcisi publishable/anon key ve **aynı kullanıcı JWT'siyle**
çalışır. Edge katmanı kullanıcı işlemleri için RLS'yi atlayan yönetici istemcisi
oluşturmaz. API'de keyfî SQL veya RPC adı kabul edilmez.

`verify_jwt = false`: OpenAPI ve CORS preflight halka açıktır. Bu ayar komutların
ve sorguların kimlik doğrulamasını kaldırmaz; handler ikisini de zorunlu doğrular.
Geçersiz, eksik veya süresi dolmuş token `401`; profilsiz hesap `403` alır.
Rol veya merkez yetkisi değişiklikleri token yenilemeyi beklemeden SQL ve ortak
rol çözümlemesinde dikkate alınır. CORS bir yetkilendirme yöntemi değildir.

## Tahsilat örneği

Şu an ödeme yöntemi **nakit veya manuel kayıt**. Kart tahsilatı/checkout entegrasyonu
bu değişikliğin kapsamı değildir.

```http
POST /functions/v1/studio-api/v1/commands/payments.command
```

```json
{
  "action": "collect",
  "subscription_id": "10000000-0000-4000-8000-000000000001",
  "method": "cash",
  "amount": 1500,
  "key": "10000000-0000-4000-8000-000000000002",
  "occurred_at": "2026-10-14T16:00:00Z",
  "note": "Nakit tahsilat"
}
```

Her yeni ödeme için cihaz UUID üretir. Bağlantı kopması nedeniyle aynı ödemeyi
yeniden gönderirken **aynı `key` ve aynı payload** kullanılır. Yeni key aynı
ödemenin yeniden gönderilmesi için kullanılmaz. Transaction ve tekrar işlem
koruması PostgreSQL'deki `payments_command` tarafından uygulanır.
İdempotency anahtarı olmayan mutasyonları otomatik yeniden denemeyin; önce
sunucudaki sonucu sorgulayın. Bütün komutların idempotent olduğu varsayılmaz.

Başarılı yanıt `{"ok":true,"data":...,"requestId":"..."}` biçimindedir.
Servis komutlarında `data` ayrıca `{ok:true,message,data?}` sonucu içerir.
Başarısız yanıt:

```json
{
  "ok": false,
  "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." },
  "requestId": "10000000-0000-4000-8000-000000000003"
}
```

İstemci kararlarını Türkçe hata metnine değil HTTP durumuna ve `error.code`'a
bağlayın. `401` sonrası oturumu Auth SDK ile yenileyin. Giriş başarıyla
yenilenmezse yeniden giriş isteyin. Yenilenen token ile mutasyon tekrarının
güvenli olup olmadığını komutun idempotency kuralı belirler.

## Native istemci kuralları

| Platform | Oturum saklama |
| --- | --- |
| Android | Keystore ile korunan şifreli depolama |
| iOS / macOS | Keychain |
| Windows | Credential Locker veya DPAPI ile korunan depolama |

Access/refresh token'ları düz dosyada veya logda saklamayın. Auth SDK'sının token
yenilemesini kullanın; aynı refresh token için paralel yenileme isteklerini
koordine edin. Mobil uygulama arka plandan dönünce oturum geçerliliğini kontrol
edin. E-posta onayı ve şifre sıfırlama için uygulama deep link'leri Supabase Auth
redirect allowlist'ine uygulamanın gerçek adresi belli olduğunda eklenmelidir.

Tarihler ISO 8601 UTC olarak taşınır. İş takvimi `Europe/Istanbul` üzerinden
yorumlanır; cihaz saat dilimi veritabanına gönderilen ders saatini değiştirmemelidir.
Liste sorgularında `page` 1'den başlar; liste yardımcıları 25 kayıt getirir.
Arama ve filtre parametreleri OpenAPI'de tanımlıdır. Doğrudan Data API okurken
`order` ve `range/limit` açıkça verilmelidir.

OpenAPI 3.1, komutların giriş şemalarını ve ortak hata zarfını kodla aynı kaynaktan
üretir. İşleme özgü yanıt `data` alanları şimdilik genel JSON'dur; üretilen Swift,
Kotlin veya C# istemcilerinde tam tipli response modelleri ayrıca tanımlanmalıdır.

## Çalıştırma ve dağıtım

```sh
npm run typecheck
npm test
npm run build:edge
npm run check:edge
deno check supabase/functions/studio-api/index.js
npm run test:edge
```

`entry.ts` ve `lib/backend` kaynak koddur. `index.js` otomatik üretilen tek Deno
modülüdür; elle düzenlenmez. SDK ve Zod import'ları package-lock sürümlerine
sabitlenir. Derleme React/Next.js import'unu ve `process.env` bağımlılığını reddeder.
CI eski kalmış bundle'ı reddeder ve Deno'da gerçek HTTP smoke testi çalıştırır.
Bu smoke testinin Auth/Data servisi izole fixture'dır; canlı ödeme göndermez.
SQL transaction ve merkez izolasyonu mevcut izole Supabase testlerinde sınanır.

`supabase/config.toml` fonksiyonun JavaScript entrypoint'ini belirler. Supabase
CLI komutlarının güncel `--help` çıktısıyla `studio-api` deploy edilir; mevcut
Vercel web dağıtımı bağımsız kalır. Supabase'in sağladığı `SUPABASE_URL` ve
`SUPABASE_ANON_KEY` kullanılabilir; `SUPABASE_PUBLISHABLE_KEY` varsa tercih edilir.
`STUDIO_API_ALLOWED_ORIGINS` virgülle ayrılan tarayıcı origin listesidir; varsayılan
`https://uye.fethiyetango.com`. Native HTTP istemcilerinin Origin başlığı gerekmez.

Edge Functions kısa API işleri ve dış servis I/O'su içindir. CPU yoğun hesapları
tek isteğe yığmayın: güncel platform CPU limiti istek başına 2 saniyedir.
Toplu e-posta mevcut kuyrukta sınırlı partiler halinde işlenir; uzun işler için
kalıcı kuyruk/checkpoint gerekir. Yeni bir ağır hesaplama modülü eklenmemiştir.

Resmî kaynaklar:

- [Edge kimlik doğrulama](https://supabase.com/docs/guides/functions/auth)
- [Authorization ve apikey](https://supabase.com/docs/guides/functions/auth-headers)
- [Edge routing](https://supabase.com/docs/guides/functions/routing)
- [Edge limitleri](https://supabase.com/docs/guides/functions/limits)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
