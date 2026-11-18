# Market Yard

Node.js + Express отдаёт статические HTML, CSS и ES-модули из public. PostgreSQL хранит пользователей, категории и лоты. SQL-миграции находятся в packages/db/prisma/migrations, Prisma в приложении не используется.

## Локальный запуск

1. Скопируйте .env.example в .env и задайте JWT_SECRET и SEED_ADMIN_PASSWORD.
2. Запустите docker compose up -d.
3. Выполните npm ci, npm run migrate:deploy, npm run seed, npm start.
4. Откройте http://localhost:3000. Регистрация работает без подтверждения почты в тестовом режиме.

Администратор создаётся seed-скриптом с email из SEED_ADMIN_EMAIL и паролем из SEED_ADMIN_PASSWORD. Пароль в репозитории отсутствует.

## Render

При создании Blueprint задайте PUBLIC_ORIGIN (адрес сайта с https), SEED_ADMIN_EMAIL и SEED_ADMIN_PASSWORD. Миграция и seed выполняются при запуске. Seed создаёт администратора только при отсутствии пользователя с указанным email.
