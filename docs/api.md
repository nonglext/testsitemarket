# API первой половины сайта

- POST /api/auth/register, /api/auth/verify, /api/auth/login, /api/auth/refresh, /api/auth/logout
- GET /api/me, PATCH /api/me/theme
- GET /api/categories, /api/categories/:slug, /api/categories/:slug/lots
- GET /api/lots/:id, POST /api/lots
- GET /api/users/:id, /api/users/:id/lots
- GET /api/admin/categories, POST /api/admin/categories, POST /api/admin/categories/:id/fields
- GET /health

Денежные операции, чат сделок и споры относятся к следующей части.
