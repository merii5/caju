# Caju Clay

Caju Clay seramik atölyesinin web sitesi. Ziyaretçiler atölyeleri inceleyebilir ve randevu talebi gönderebilir. Atölye ekibi talepleri yönetim panelinden takip eder ve kontenjanı ziyaretçiye ayrıca teyit eder.

## Yerel çalıştırma

Node.js 24 gereklidir. Uygulama Node.js’in HTTP ve SQLite modüllerini kullanır.

```powershell
$env:ADMIN_PASSWORD = Read-Host 'Yönetici parolası' -MaskInput
npm.cmd start
```

- Site [localhost:3000](http://localhost:3000) adresinde açılır.
- Yönetim paneli [localhost:3000/admin](http://localhost:3000/admin) adresindedir. İlk kurulumda varsayılan kullanıcı adı `admin` ve parola `ADMIN_PASSWORD` değeridir. İlk kullanıcı adını `ADMIN_USER` ile belirleyebilirsiniz.
Daha önce yerel kurulumda oluşturulmuş bir `.env.local` dosyası varsa sunucuyu `node --env-file=.env.local server.js` komutuyla tekrar başlatabilirsiniz. Hesap ilk çalıştırmada SQLite’a kaydedilir. Panelden yaptığınız hesap değişiklikleri sonraki başlatmalarda geçerlidir.

SQLite dosyası ilk çalıştırmada `data/caju.sqlite` altında oluşturulur. Test kayıtları ve yönetici parolası GitHub deposuna eklenmemelidir.

## Teknik akış

| İşlem | Arayüz | Sunucu |
| --- | --- | --- |
| Ekleme | İletişim sayfasındaki randevu formu | `POST /randevu` |
| Listeleme | Yönetim panelindeki Randevular sekmesi | `GET /admin/randevular` |
| Güncelleme | Talep durumunu kaydetme | `POST /admin/bookings/:id/status` |
| Silme | Silme menüsünden kalıcı silme | `POST /admin/bookings/:id/delete` |

Sunucu, form alanlarını kontrol eder ve geçerli talepleri parametreli bir SQLite sorgusuyla kaydeder. Geçersiz gönderimde form değerleri gösterilmeye devam eder. Panel, kullanıcı adı ve parola ister. Durum değiştirme ve silme formları oturum dışından gönderilen istekleri engellemek için bir güvenlik belirteci kullanır.

İletişim sayfasındaki mesaj formu `POST /mesaj` üzerinden SQLite’a kaydedilir. Gönderici bilgileri, konu ve mesaj yönetim panelindeki **Mesajlar** sekmesinde görünür.

**Mesajlar** bölümünde metinle arama yapabilir, konuya ve okunma durumuna göre filtreleyebilir, mesajları okundu veya okunmadı olarak işaretleyebilirsiniz. **Randevular** bölümünde isim, iletişim bilgisi veya notla arama yapabilir, atölye ve talep durumuna göre filtreleyebilirsiniz.

## Yazı ve blok yönetimi

- **Yazılar → Yeni Yazı Ekle** üzerinden bir yazı başlığı girin. Başlık, paragraf ve alıntı blokları ekleyebilir, sıralarını değiştirebilir ve kaldırabilirsiniz.
- **Taslağı Kaydet** değişiklikleri panelde saklar. **Kaydet ve Yayınla** yeni sürümü ana sayfadaki **Atölyeden Yazılar** bölümünde gösterir.
- **Düzenle** ile yayındaki bir yazıyı taslak olarak değiştirebilirsiniz. Ana sayfada son yayınlanan sürüm görünür. Paneldeki **Yayınla** düğmesi kayıtlı taslağı yayına alır.
- **Sil** işlemi yazıyı ve yayınlanan sürümünü kaldırır. Yazılar ve randevular aynı SQLite dosyasında saklanır.

## Hesap ve site ayarları

- **Hesabım** bölümünden mevcut parolanızı doğrulayarak kullanıcı adınızı, parolanızı veya ikisini değiştirebilirsiniz. Yeni parola en az 16 karakter olmalıdır. Kaydettikten sonra tüm açık yönetici oturumları kapanır.
- **Site Ayarları** bölümünden ana sayfanın duyurusunu, başlığını ve açıklamasını düzenleyebilirsiniz. Duyuruyu kaldırmak veya varsayılan ana sayfa metinlerine dönmek için ilgili alanı boş bırakıp kaydedin.

## GitHub ve Vercel dağıtımı

1. Teslim ZIP’ini açın ve içindeki proje dosyalarını boş bir GitHub deposuna yükleyin. ZIP dosyasının kendisini yüklemek yerine dosyaları deponun köküne koyun. Git kullanıyorsanız aşağıdaki komutlarda son satırdan önce `KULLANICI/DEPO` bölümünü değiştirin.

   ```powershell
   git init
   git add .
   git commit -m "Caju Clay web projesi"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/DEPO.git
   git push -u origin main
   ```

2. Turso’da boş bir veritabanı oluşturun ve erişim belirtecini alın. Uygulama tabloları ilk çalıştırmada oluşturur. Canlı veritabanı boş başlar ve yerel SQLite kayıtları kendiliğinden aktarılmaz.
3. Vercel’de **Add New → Project** üzerinden GitHub deposunu içe aktarın. Proje kökü depo kökü, Framework Preset **Other**, Node.js sürümü **24.x** olmalıdır. Özel bir Build Command veya Output Directory tanımlamayın. Sunucu işlevi ve yönlendirmeler `vercel.json` ile tanımlıdır.
4. Aşağıdaki değerleri **Settings → Environment Variables** bölümüne ekleyip dağıtın. Canlı ve önizleme dağıtımlarını kullanacaksanız farklı veritabanları ve farklı erişim belirteçleri tanımlayın.

| Değişken | Değer |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso veritabanı adresi. Genellikle `libsql://...` biçimindedir. |
| `TURSO_AUTH_TOKEN` | Turso veritabanı erişim belirteci. |
| `ADMIN_PASSWORD` | İlk hesap kurulumu için en az 16 karakterli benzersiz parola. |
| `ADMIN_USER` | İlk hesap kurulumu için isteğe bağlı yönetici kullanıcı adı |
| `PUBLIC_ORIGIN` | İsteğe bağlı sabit HTTPS adresi. Belirli bir alan adıyla form gönderimini sınırlandırmak için yalnızca ilgili Vercel ortamına ekleyin. |

Yerel sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinden dinler. Vercel’de formlar, yazılar, site ayarları ve yönetici oturumları Turso’da saklanır. Form ve giriş denemelerine uygulanan sayaçlar Vercel işlevinin her örneğinde ayrı çalışır. `.env.example` değişken adlarını gösterir. Gerçek değerleri GitHub’a eklemeyin.

Teslimden önce canlı adreste bir deneme randevusu oluşturun, yönetim panelinde durumunu değiştirin ve silin. Canlı URL’yi ve öğretim elemanının erişebildiği GitHub depo adresini teslim edin. Yönetici parolası ve gerçek randevu verileri özel kalmalıdır.

Dağıtım belgeleri için [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Vercel proje yapılandırması](https://vercel.com/docs/project-configuration), [Turso HTTP API](https://docs.turso.tech/sdk/http/reference).

## Sunum akışı

1. **45 saniye** — Caju Clay’i ve atölye randevularına ilişkin mevcut süreci tanıtın.
2. **1 dakika** — Gerçek müşteri brief’ini ve görüşme kanıtını gösterin. Brief’teki talepleri arayüz kararlarıyla ilişkilendirin.
3. **2 dakika** — Canlı sitede deneme talebi oluşturun. Yönetim paneline girin, talebi listeleyin, durumunu değiştirin ve silin.
4. **1 dakika** — `server.js` üzerinden form doğrulamasını ve dört SQLite işlemini açıklayın.
5. **45 saniye** — Codex’i Node.js ve SQLite entegrasyonu, form doğrulaması ve yerel HTTP kontrollerinde nasıl kullandığınızı anlatın.
6. **30 saniye** — Talepleri ve durumlarını tek panelden izlemenin atölye ekibine sağladığı faydayı özetleyin.
