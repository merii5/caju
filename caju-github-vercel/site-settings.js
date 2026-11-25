const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const fields = [
  { name: 'announcement', label: 'Duyuru', limit: 180, hint: 'Ana menünün altında görünür.' },
  { name: 'heroTitle', label: 'Ana sayfa başlığı', limit: 120 },
  { name: 'heroIntro', label: 'Ana sayfa açıklaması', limit: 300 }
];

async function createSiteSettings(db, initialUsername, initialPassword) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_account (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      username TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      announcement TEXT NOT NULL,
      hero_title TEXT NOT NULL,
      hero_intro TEXT NOT NULL
    );
  `);

  const getAccount = db.prepare('SELECT * FROM admin_account WHERE id = 1');
  const seedAccount = db.prepare('INSERT OR IGNORE INTO admin_account VALUES (1, ?, ?, ?)');
  const updateAccount = db.prepare('UPDATE admin_account SET username = ?, salt = ?, password_hash = ? WHERE id = 1 AND username = ? AND password_hash = ?');
  const getSettings = db.prepare('SELECT announcement, hero_title AS heroTitle, hero_intro AS heroIntro FROM site_settings WHERE id = 1');
  const saveSettings = db.prepare(`
    INSERT INTO site_settings VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET announcement = excluded.announcement,
      hero_title = excluded.hero_title, hero_intro = excluded.hero_intro
  `);

  function hash(password) {
    const salt = randomBytes(16).toString('hex');
    return [salt, scryptSync(password, salt, 64).toString('hex')];
  }

  if (!(await getAccount.get()) && initialPassword) await seedAccount.run(initialUsername, ...hash(initialPassword));

  function verify(account, password) {
    if (!account || typeof password !== 'string' || password.length > 256) return false;
    return timingSafeEqual(Buffer.from(account.password_hash, 'hex'), scryptSync(password, account.salt, 64));
  }

  async function authenticate(username, password) {
    const account = await getAccount.get();
    return verify(account, password) && account.username === username ? account : null;
  }

  async function changeAccount(form) {
    const account = await getAccount.get();
    const username = (form.get('username') || '').trim();
    const newPassword = form.get('newPassword') || '';
    if (!verify(account, form.get('currentPassword'))) return 'Mevcut parola hatalı.';
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return 'Kullanıcı adı 3–40 karakter olmalı. Harf, rakam, nokta, tire veya alt çizgi kullanın.';
    if (newPassword && (newPassword.length < 16 || newPassword.length > 256)) return 'Yeni parola 16–256 karakter olmalı.';
    if (newPassword !== (form.get('confirmPassword') || '')) return 'Yeni parolalar eşleşmiyor.';
    if (!newPassword && username === account.username) return 'Bir değişiklik yapabilmek için kullanıcı adını veya parolayı güncelleyin.';
    const credentials = hash(newPassword || form.get('currentPassword'));
    const result = await updateAccount.run(username, ...credentials, account.username, account.password_hash);
    return result.changes ? '' : 'Hesap bilgileri değişti. Tekrar deneyin.';
  }

  function readFields(form) {
    return Object.fromEntries(fields.map(({ name }) => [name, (form.get(name) || '').trim()]));
  }

  async function store(values) {
    if (fields.some(({ name, limit }) => values[name].length > limit)) return false;
    await saveSettings.run(values.announcement, values.heroTitle, values.heroIntro);
    return true;
  }

  return {
    authenticate, changeAccount, store, readFields,
    username: async () => (await getAccount.get())?.username,
    read: async () => (await getSettings.get()) || {}
  };
}

module.exports = { createSiteSettings, fields };
