# Üye–giriş hesabı ve rol yönetimi

Kapsam: kullanıcı ve rol erişim yapısının hesap–üye bağlantısı.

## Yönetici akışı

1. Üyeler bölümünde üyeyi doğru merkezde oluşturun, üye e-postası doğrulanmış giriş hesabının e-postasıyla aynı olsun.
2. Listede Giriş hesabı bağla simgesini seçin. Tam e-postayı yazıp Hesabı doğrula düğmesine basın.
3. Doğrulanan hesap adını/e-postasını kontrol edip bağlamayı onaylayın. Aynı merkezde aynı hesap iki üyeye bağlanamaz.
4. Hesap bağlantısını kaldır işlemi geçmiş üye, abonelik ve ders verilerini silmez; link/unlink denetim kayıtları saklanır.
5. Merkez rolleri sayfasında yalnızca yönettiğiniz merkezlerde admin, instructor ve ainstructor rollerini e-postayla atayın veya kaldırın. Platform/organizasyon sahibi rolü bu arayüzden atanmaz.
6. Personel aynı zamanda öğrenci ise Öğrenci görünümüm sayfasından kendi üyeliklerini görebilir.

## Güvenlik

- Direct INSERT/UPDATE of members.profile_id through authenticated REST is denied; protected RPC is the only supported linking operation.
- Linking uses a confirmed Auth account's exact email and checks the stored member contact email if present, without trusting editable user metadata.
- Member center authorization uses the target member's actual center, not a client-supplied center.
- The same account can belong to separate centers but only one member per center.
- Every successful link or unlink change is recorded in member_account_link_audit. RLS limits audit reads to managers of that center.
- Synthetic SQL tests run inside ROLLBACK. Preserve all four existing @ftk.com QA accounts.

## Live acceptance checklist

- Owner/admin can link and unlink an existing member using an exact confirmed Auth email.
- Instructor/assistant cannot link accounts, assign manager roles, or read an unrelated center's member rows.
- Duplicate same-center binding, wrong member email, and cross-center management attempts fail.
- Account can hold a staff role and still see its own member record through Öğrenci görünümüm.
- Correct role assignment/removal only in managed centers, with no unintended role elevation.

Linked account/member records can be verified in Supabase SQL and UI. Real user-browser acceptance is separate from isolated CI tests.
