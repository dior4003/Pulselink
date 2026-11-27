# ahost.uz Hostingiga Joylash Qo‘llanmasi (cPanel + Node.js + MySQL)

## 1. MySQL bazasini yaratish (cPanel)
1. **cPanel → MySQL® Databases** bo‘limiga kiring.
2. Yangi baza yarating (masalan: `cpaneluser_pulselink`).
3. Yangi MySQL foydalanuvchi va parol yarating, so‘ng **Add User To Database** orqali **ALL PRIVILEGES** bering.
4. *(Ixtiyoriy)* **phpMyAdmin** orqali `server/database/schema.sql` ni import qiling (yoki server birinchi marta yonganda jadvallarni o‘zi yaratadi).

## 2. Web frontendni tayyorlash (`client/dist`)
Kompyuteringizda (yoki GitHub Actions’dagi `pulselink-web-dist` artifactidan):
```bash
cd client
npm install
CI=1 npx expo export --platform web
```
Hosil bo‘lgan `client/dist/` papkasini serverdagi `pulselink/client/dist/` ga yuklang.

## 3. Node.js ilovasini sozlash (cPanel → Setup Node.js App)
1. **Node.js version:** `20.x` (yoki `18.x`).
2. **Application mode:** `Production`.
3. **Application root:** `pulselink/server`.
4. **Application URL:** domeningiz (`https://sizning-domeningiz.uz`).
5. **Application startup file:** `app.js` (yoki `src/index.js`).
6. `pulselink/server/.env` faylini yarating (`server/.env.example` asosida):
   - `NODE_ENV=production`
   - `JWT_SECRET=` (kamida 48 belgili tasodifiy kalit)
   - `MOD_PASSKEY=` (moderatorlar uchun maxfiy kalit)
   - `CORS_ORIGIN=https://sizning-domeningiz.uz`
   - `TRUST_PROXY=1`
   - `DB_HOST=127.0.0.1`, `DB_USER=...`, `DB_PASSWORD=...`, `DB_NAME=...`, `DB_AUTO_CREATE=false`
7. cPanel’da **Run NPM Install** tugmasini bosing va **Restart** qiling.

## 4. Yashirin Moderatorlik rejimiga kirish
1. Oddiy foydalanuvchilar Moderator bo‘limini ko‘rmaydi.
2. phpMyAdmin’da o‘zingizning hisobingizga rol bering:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'sizning@email.uz';
   ```
3. Ilova sarlavhasidagi **"PulseLink"** yozuviga ketma-ket **5 marta** bosing (yoki `admin`/`moderator` hisobida tepada chiqadigan 🛡️ belgisini bosing) va `MOD_PASSKEY` bilan kiring.
