# elaginadary-ugc

UGC-портфолио для `elaginadaryugc.com`: сайт + админ-панель на Cloudflare Pages.

- Сайт: `public/index.html`, стили `public/assets/css/site.css`, логика `public/assets/js/site.js`
- Админка: `/admin/` (`public/admin/`)
- API (Cloudflare Pages Functions): `functions/api/content.js`, `functions/api/session.js`, `functions/api/media.js`
- Раздача фото и видео из R2: `functions/media/[[path]].js`
- Тексты по умолчанию: `lib/default-content.json`

Контент сайта хранится в KV (`CONTENT`), фото и видео — в R2 (`MEDIA`). Пока ничего не изменено в админке, сайт показывает тексты по умолчанию.

---

## Первая настройка в Cloudflare (один раз, ~10 минут)

### 1. Хранилища
1. **R2 → Overview → Create bucket**. Имя: `elaginadary-ugc-media`. Если R2 ещё не включён, Cloudflare попросит активировать его (бесплатно до 10 ГБ).
2. **Storage & Databases → KV → Create namespace**. Имя: `elaginadary-ugc-content`.

### 2. Проект Pages
1. **Workers & Pages → Create → вкладка Pages → Connect to Git** и выберите репозиторий `elaginadary-ugc`.
2. Настройки сборки:
   - Framework preset: **None**
   - Build command: *(пусто)*
   - Build output directory: `public`
3. **Save and Deploy**.

### 3. Привязки и пароль
В проекте откройте **Settings**:

1. **Bindings → Add**:
   - KV namespace: имя переменной `CONTENT` → `elaginadary-ugc-content`
   - R2 bucket: имя переменной `MEDIA` → `elaginadary-ugc-media`
2. **Variables and Secrets → Add** (тип **Secret**):
   - `ADMIN_PASSWORD`: пароль для входа в админку
   - `SESSION_SECRET`: любая длинная случайная строка, 40+ символов
3. **Deployments → у последнего деплоя ⋯ → Retry deployment**. Привязки начинают работать только после нового деплоя.

### 4. Домен
**Custom domains → Set up a custom domain** → `elaginadaryugc.com`, затем ещё раз для `www.elaginadaryugc.com`. Домен уже в Cloudflare, поэтому DNS-записи создадутся сами. HTTPS включится автоматически, http:// будет перенаправлять на https://.

### 5. Проверка
- `https://elaginadaryugc.com` — сайт
- `https://elaginadaryugc.com/admin/` — админка. Если сверху жёлтая плашка «Хранилище не подключено», значит пропущен шаг 3.

---

## Работа в админке
- **Главная**: имя, подзаголовок, фото первого экрана, Instagram, e-mail.
- **Обо мне**: фото, заголовок, пункты (каждый с новой строки), подпись.
- **Видео**: загрузка MP4/MOV до 95 МБ, название, бренд, категория, порядок ↑↓, обложка, удаление.
- **Фото**: две галереи («Фотография» и «UGC-фото»), загрузка, перенос между галереями, порядок, удаление.
- **Бренды**: список, каждый с новой строки. Пустой раздел на сайте скрыт.
- **Контакты**: заголовок блока и необязательное фото.

Изменения сохраняются автоматически. Большие фото уменьшаются в браузере перед загрузкой. HEIC браузер не открывает, поэтому присылайте JPG или PNG (iPhone при выгрузке из «Фото» обычно сам конвертирует в JPG).

Лимит на одно видео — 95 МБ (ограничение бесплатного тарифа Cloudflare на размер запроса). Длинные ролики сожмите перед загрузкой, например в HandBrake, пресет «Fast 1080p30».

## Локальный запуск
```
npm install
npm run dev
```
Сайт: http://localhost:8788, админка: http://localhost:8788/admin/, пароль: `dev-password`.
