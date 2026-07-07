# StockFlow — Node.js / Express Backend

Production-ready port of the StockFlow API to Node.js + Express + MongoDB (Mongoose). The React frontend does not need any change — all endpoints, request bodies, and response shapes are preserved exactly.

## Requirements
- Node.js **22+**
- MongoDB (self-hosted, MongoDB Atlas, or Hostinger's addon)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
PORT=8001
MONGO_URL=mongodb+srv://user:pass@cluster0.mongodb.net
DB_NAME=stockflow
JWT_SECRET=please-change-me-to-a-long-random-string
```

Optional:
- `JWT_EXPIRES_IN` (default `7d`)
- `CORS_ORIGIN` (comma-separated list; leave blank to allow all)
- `NODE_ENV=production` for combined access logs

## Install & Run

```bash
cd backend
npm install
npm start
```

On first startup with an empty DB the server automatically seeds:
- Default admin user — **admin / admin123**
- Two warehouses (Main Warehouse — Mumbai, Secondary Depot — Delhi)
- Sample categories and inventory items (including a low-stock example)

## Deploying on Hostinger Node.js Hosting

1. Push this `backend/` folder to a GitHub repository.
2. In Hostinger control panel: **Advanced → Node.js**.
3. Create a new Node.js app:
   - **Node version:** 22.x
   - **Application root directory:** `backend`
   - **Application startup file:** `server.js`
4. Add the environment variables (`PORT`, `MONGO_URL`, `DB_NAME`, `JWT_SECRET`).
5. Click **Run npm install**, then **Restart**.
6. Point your existing React frontend's `REACT_APP_BACKEND_URL` at the Hostinger domain that hosts the Node app.

Hostinger sets `PORT` automatically; `server.js` will honor whatever value Hostinger provides.

## API Reference

All endpoints are prefixed with `/api`. Every route except `/api/auth/login` requires an `Authorization: Bearer <token>` header. Standard error shape: `{ "detail": "...message..." }`.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | `{username, password}` → `{token, user}` |
| GET  | `/api/auth/me` | any | current user |
| GET  | `/api/warehouses` | any | list accessible warehouses |
| POST/PUT/DELETE | `/api/warehouses[/id]` | owner | manage warehouses (delete cascades) |
| GET  | `/api/categories?warehouse_id=` | scoped | list |
| POST/PUT/DELETE | `/api/categories[/id]` | manager+ | manage |
| GET  | `/api/inventory?warehouse_id=` | scoped | list with `category_name` |
| POST/PUT/DELETE | `/api/inventory[/id]` | manager+ | manage; `image` is a base64 data URL |
| POST | `/api/inventory/bulk` | manager+ | Excel-import upsert + auto-create categories |
| GET  | `/api/sales?warehouse_id=` | scoped | list with `item_name`, `category_name` |
| POST | `/api/sales` | manager+ | decrement stock, insert per-line sale docs |
| PUT  | `/api/sales/bill/{bill_number}` | manager+ | reverse + re-apply |
| DELETE | `/api/sales/bill/{bill_number}?warehouse_id=` | manager+ | reverse + delete |
| GET/POST/PUT/DELETE | `/api/purchases[...]` | manager+ | mirror of sales, increments stock |
| GET  | `/api/dashboard?warehouse_id=` | scoped | aggregated stats + recent tx |
| GET/POST/PUT/DELETE | `/api/users[/id]` | owner | user management |

## Project Structure

```
backend/
├─ package.json
├─ server.js               # bootstrap: DB → seed → listen
├─ app.js                  # Express app + middleware + routes
├─ .env.example
├─ config/
│  └─ db.js
├─ models/                 # Mongoose schemas (User, Warehouse, Category, InventoryItem, Sale, Purchase)
├─ controllers/            # one per resource
├─ routes/                 # express Routers, one per resource
├─ middleware/
│  ├─ auth.js              # requireAuth, requireEdit, requireOwner, userHasWarehouse
│  ├─ asyncHandler.js
│  └─ errorHandler.js
├─ utils/
│  ├─ ApiError.js          # structured HTTP error class
│  ├─ generateId.js        # 15-char hex ID (matches legacy backend)
│  └─ jwt.js               # sign/verify helpers
└─ seed/
   └─ seed.js
```

## Notes

- Passwords use **bcrypt** (`bcryptjs`, cost 10). Existing pbkdf2 hashes from the older Python backend are NOT compatible — seed a fresh database or reset users.
- Document `id` values are 15-character hex strings (`crypto.randomBytes(16).toString('hex').slice(0,15)`) so responses match the previous shape.
- Sales/purchase mutations run sequentially so inventory decrement/increment stays consistent per request. For very high concurrency you can wrap `applySaleBill` / `applyPurchaseBill` in a Mongoose transaction (requires a MongoDB replica set).
- Structured logging is provided by `morgan` (`dev` in development, `combined` when `NODE_ENV=production`).
- Security: `helmet` sets HTTP headers; API-only — the CSP is intentionally disabled.

## Local Smoke Test

```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

Expect a JSON response `{ token, user: { id, username, role: "owner", warehouse_ids: […] } }`.
