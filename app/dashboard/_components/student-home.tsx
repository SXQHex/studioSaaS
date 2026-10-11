export function StudentHome() {
  return (
      <div className="dashboard-content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">HESAP</p>
            <h1>Hesabınız hazır</h1>
            <p className="dashboard-subtitle">
              Bu sürümde yönetim modülleri yalnızca yönetici ve yetkili eğitmen hesaplarına açıktır.
            </p>
          </div>
          <span className="today-pill">FTK Studio</span>
        </div>
        <section className="overview-panel student-access-panel">
          <div className="panel-heading">
            <div>
              <h2>Öğrenci erişimi</h2>
              <p>Kişisel ders ve abonelik görünümü henüz etkinleştirilmedi.</p>
            </div>
          </div>
          <div className="student-access-content">
            <p>Yönetim ekranlarına ihtiyaç duyuyorsanız stüdyo yöneticinizden rolünüzün kontrol edilmesini isteyin.</p>
          </div>
        </section>
      </div>
    
  );
}
