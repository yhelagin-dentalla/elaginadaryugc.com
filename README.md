# elaginadary-ugc

UGC-портфолио для `elaginadaryugc.com`: сайт + админ-панель на Cloudflare Pages.

- Сайт: `public/index.html`, стили `public/assets/css/site.css`, логика `public/assets/js/site.js`
- Админка: `/admin/` (`public/admin/`)
- API (Cloudflare Pages Functions): `functions/api/content.js`, `functions/api/session.js`, `functions/api/media.js`
- Раздача фото и видео из R2: `functions/media/[[path]].js`
- Тексты по умолчанию: `lib/default-content.json`

Контент сайта хранится в KV (`CONTENT`), фото и видео — в R2 (`MEDIA`). Пока ничего не изменено в админке, сайт показывает тексты по умолчанию.

---

## Первая настройка в Cloudflare (один раз)

Привязки хранилищ уже прописаны в `wrangler.toml`: KV `elaginadary-ugc-content` создан, R2-бакет `elaginadary-ugc-media` ждёт включения R2.

### 1. Включить R2 и создать бакет
1. В дашборде откройте **R2 Object Storage** и нажмите **Get started / Purchase R2**. До 10 ГБ бесплатно, но Cloudflare может попросить привязать карту.
2. **Create bucket** → имя `elaginadary-ugc-media` (точно такое), Location: Automatic.

### 2. Проект Pages из GitHub
1. **Workers & Pages → Create → вкладка Pages → Connect to Git** → репозиторий `yhelagin-dentalla/elaginadaryugc.com`.
2. Production branch: `main`, Framework preset: **None**, Build command: *(пусто)*, Build output directory: `public`.
3. **Save and Deploy**.

### 3. Пароль админки
**Settings → Variables and Secrets → Add**, тип **Secret**, окружение Production:
- `ADMIN_PASSWORD`: пароль для входа в админку
- `SESSION_SECRET`: любая длинная случайная строка, 40+ символов

Потом **Deployments → ⋯ у последнего деплоя → Retry deployment**.

### 4. Домен
**Custom domains → Set up a custom domain** → `elaginadaryugc.com`, затем `www.elaginadaryugc.com`. DNS-записи и HTTPS настроятся сами.

### 5. Проверка
- `https://elaginadaryugc.com` — сайт
- `https://elaginadaryugc.com/admin/` — админка. Жёлтая плашка «Хранилище не подключено» означает, что бакет R2 не создан или назван иначе.

---

## Работа в админке
- **Главная**: фото первого экрана, положение кадра, имя в шапке, e-mail и Instagram (кнопки на первом экране и в блоке «Связаться»), SEO.
- **Текст «Hi Brands»**: заголовок и пункты рядом с фото, каждый пункт с новой строки.
- **Видео**: загрузка MP4/MOV до 95 МБ, название, бренд, категория, порядок ↑↓, обложка, удаление. Категории редактируются там же.
- **Фото**: загрузка, категория у каждого фото, порядок, удаление. Категории редактируются там же.
- **Бренды**: список, каждый с новой строки. Пустой раздел на сайте скрыт.
- **Контакты**: рукописный заголовок, текст и фото справа.

Пока видео или фото не загружены, на сайте стоят заглушки как в макете Figma, а кнопки категорий показываются без переключения. После загрузки показываются только категории, в которых есть материалы.

Изменения сохраняются автоматически. Большие фото уменьшаются в браузере перед загрузкой. HEIC браузер не открывает, поэтому присылайте JPG или PNG (iPhone при выгрузке из «Фото» обычно сам конвертирует в JPG).

Лимит на одно видео — 95 МБ (ограничение бесплатного тарифа Cloudflare на размер запроса). Длинные ролики сожмите перед загрузкой, например в HandBrake, пресет «Fast 1080p30».

## Локальный запуск
```
npm install
npm run dev
```
Сайт: http://localhost:8788 (локальные копии KV и R2), админка: http://localhost:8788/admin/, пароль: `dev-password`.
