# StockFlow — PHP Backend

A drop-in PHP + MySQL port of the FastAPI backend. Same JSON contracts, same routes, same behavior (JWT auth, RBAC, inventory decrement/restore on sales/purchases, dashboard aggregates, Excel-bulk import). The React frontend does not need any change — just point `REACT_APP_BACKEND_URL` at this API.

## Requirements
- PHP 8.1+ (needs the PDO MySQL extension, JSON, OpenSSL)
- MySQL 8+ or MariaDB 10.5+
- Composer
- Apache with `mod_rewrite` (or Nginx — see the sample block below)

## Setup

```bash
cd backend-php
composer install
cp .env.example .env
# edit .env with your DB credentials + a strong JWT_SECRET

# create the database (adjust name/user):
mysql -u root -p -e "CREATE DATABASE stockflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# apply schema + seed defaults
php seed.php
```

Default login after seed: **admin / admin123**.

## Running locally

```bash
cd backend-php/public
php -S 0.0.0.0:8001
```

The API is now reachable at `http://localhost:8001/api/...`.

> When you use PHP's built-in server, the router is `public/index.php`. The included `.htaccess` handles Apache; for Nginx or Caddy, see below.

## Deploying on Apache (typical shared hosting)

1. Upload everything **except** the `vendor` folder (or upload it too if your host lacks Composer).
2. Point the vhost's `DocumentRoot` to `/backend-php/public`.
3. Make sure `AllowOverride All` is set so `.htaccess` is applied.
4. Run `composer install` on the server, then `php seed.php` from the project root.

## Deploying on Nginx + PHP-FPM

```nginx
server {
  listen 80;
  server_name api.example.com;
  root /var/www/backend-php/public;
  index index.php;

  location / {
    try_files $uri $uri/ /index.php?$query_string;
  }

  location ~ \.php$ {
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
  }
}
```

## API Reference

Every route is prefixed with `/api` and (except `/auth/login`) requires an `Authorization: Bearer <token>` header.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{username, password}` → `{token, user}` |
| GET | `/auth/me` | any | current user |
| GET | `/warehouses` | any | list of accessible warehouses |
| POST/PUT/DELETE | `/warehouses[/id]` | owner | delete cascades |
| GET | `/categories?warehouse_id=` | scoped | list |
| POST/PUT/DELETE | `/categories[/id]` | manager+ | delete → items become uncategorized |
| GET | `/inventory?warehouse_id=` | scoped | includes `category_name` |
| POST/PUT/DELETE | `/inventory[/id]` | manager+ | image is a base64 data URL |
| POST | `/inventory/bulk` | manager+ | Excel-import upsert + auto-create categories |
| GET | `/sales?warehouse_id=` | scoped | includes `item_name`, `category_name` |
| POST | `/sales` | manager+ | atomic decrement of inventory |
| PUT | `/sales/bill/{bill_number}` | manager+ | reverse+reapply |
| DELETE | `/sales/bill/{bill_number}?warehouse_id=` | manager+ | reverse+delete |
| GET/POST/PUT/DELETE | `/purchases[...]` | manager+ | mirror of sales, increments inventory |
| GET | `/dashboard?warehouse_id=` | scoped | aggregate stats + recent tx |
| GET/POST/PUT/DELETE | `/users[/id]` | owner | user management |

## Notes
- Passwords are stored using bcrypt (`password_hash(..., PASSWORD_BCRYPT)`); the Python backend used pbkdf2. Existing hashes are not portable — re-seed or ask users to reset.
- All mutations on `sales` / `purchases` / warehouse deletion are wrapped in transactions so inventory can never end up in an inconsistent state on a partial failure.
- Row-level `id`s use 15-char hex strings (matches the Python backend's format).
- CORS is permissive (`*`) for development. Tighten `Access-Control-Allow-Origin` in `public/index.php` before production.

## File Layout

```
backend-php/
├─ composer.json
├─ .env.example
├─ schema.sql              # MySQL schema
├─ seed.php                # one-time seed script
├─ config/
│  └─ db.php               # PDO connection + JWT config
├─ public/
│  ├─ index.php            # front controller
│  └─ .htaccess
└─ src/
   ├─ helpers.php          # utilities (auth, JWT, json_response, etc.)
   ├─ auth.php
   ├─ warehouses.php
   ├─ categories.php
   ├─ inventory.php
   ├─ sales.php
   ├─ purchases.php
   ├─ dashboard.php
   └─ users.php
```
