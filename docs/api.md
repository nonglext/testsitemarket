# API первой половины сайта

- POST /api/auth/register, /api/auth/verify, /api/auth/login, /api/auth/refresh, /api/auth/logout
- GET /api/me, PATCH /api/me/theme
- GET /api/demo/wallet/balance — только текущий тестовый баланс для шапки
- GET /api/categories, /api/categories/:slug, /api/categories/:slug/lots
- GET /api/lots/:id, POST /api/lots
- GET /api/users/:id, /api/users/:id/lots, /api/users/:id/reviews
- POST /api/demo/orders/:id/review — покупатель после завершения заказа, оценка 1–5 и необязательный текст; один отзыв на заказ
- GET /api/admin/categories, POST /api/admin/categories, POST /api/admin/categories/:id/fields
- GET /health

Демо-баланс, заказы и переписка работают в тестовом режиме; реальные платежи не подключены.
