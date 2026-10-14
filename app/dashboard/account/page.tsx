import { requireRole } from "@/lib/supabase/access";
import { AccountSettings } from "./account-settings";

export const metadata = { title: "Hesap ve güvenlik | FTK Studio" };

export default async function AccountPage() {
  const { profile, email } = await requireRole(["student"]);
  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">KİŞİSEL AYARLAR</p>
          <h1>Hesap ve güvenlik</h1>
          <p className="dashboard-subtitle">
            Profil adınızı ve giriş şifrenizi yönetin. Rolleriniz ve merkez
            yetkileriniz bu ekrandan değiştirilemez.
          </p>
        </div>
      </div>
      <AccountSettings fullName={profile.fullName} email={email} />
    </div>
  );
}
