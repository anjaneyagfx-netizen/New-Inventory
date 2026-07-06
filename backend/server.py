from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.hash import pbkdf2_sha256

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'stockflow-dev-secret-change-me')
JWT_ALG = 'HS256'
JWT_EXP_HOURS = 24 * 7

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="StockFlow API")
api = APIRouter(prefix="/api")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------- Utility helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex[:15]


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_edit(user: dict):
    if user.get("role") not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def require_owner(user: dict):
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only owner allowed")


async def user_has_warehouse(user: dict, warehouse_id: str) -> bool:
    if user.get("role") == "owner":
        return True
    return warehouse_id in (user.get("warehouse_ids") or [])


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ---------- Models ----------
class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    role: str
    warehouse_ids: List[str] = []


class WarehouseIn(BaseModel):
    name: str
    location: Optional[str] = None


class CategoryIn(BaseModel):
    name: str
    warehouse_id: str


class InventoryItemIn(BaseModel):
    name: str
    category: str  # category id
    warehouse_id: str
    sheets: float = 0
    uMolding: float = 0
    lMolding: float = 0
    image: Optional[str] = None  # base64 data URL


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    sheets: Optional[float] = None
    uMolding: Optional[float] = None
    lMolding: Optional[float] = None
    image: Optional[str] = None


class SaleItemIn(BaseModel):
    itemId: str
    sheets: float = 0
    uMolding: float = 0
    lMolding: float = 0
    pricePerSheet: float = 0
    pricePerU: float = 0
    pricePerL: float = 0


class BillIn(BaseModel):
    bill_number: str
    date: str
    customer_name: Optional[str] = ""
    supplier_name: Optional[str] = ""
    warehouse_id: str
    items: List[SaleItemIn]


class UserCreateIn(BaseModel):
    username: str
    email: Optional[str] = ""
    password: str
    role: str = "staff"
    warehouse_ids: List[str] = []


class UserUpdateIn(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    warehouse_ids: Optional[List[str]] = None
    password: Optional[str] = None


# ---------- Seed ----------
async def seed_defaults():
    users_count = await db.users.count_documents({})
    if users_count == 0:
        wh1_id = new_id()
        wh2_id = new_id()
        await db.warehouses.insert_many([
            {"id": wh1_id, "name": "Main Warehouse", "location": "Mumbai", "created": now_iso()},
            {"id": wh2_id, "name": "Secondary Depot", "location": "Delhi", "created": now_iso()},
        ])
        admin_id = new_id()
        await db.users.insert_one({
            "id": admin_id,
            "username": "admin",
            "email": "admin@stockflow.local",
            "password_hash": pbkdf2_sha256.hash("admin123"),
            "role": "owner",
            "warehouse_ids": [wh1_id, wh2_id],
            "created": now_iso(),
        })

        # Seed categories
        cats = []
        for name in ["Aluminum", "Steel", "Plastic", "Composite"]:
            cats.append({"id": new_id(), "name": name, "warehouse_id": wh1_id, "created": now_iso()})
        for name in ["Rubber", "Foam"]:
            cats.append({"id": new_id(), "name": name, "warehouse_id": wh2_id, "created": now_iso()})
        await db.categories.insert_many(cats)

        # Seed inventory items
        items = []
        sample_names_wh1 = [
            ("AL-1024", cats[0]["id"]),
            ("AL-1025", cats[0]["id"]),
            ("ST-2010", cats[1]["id"]),
            ("ST-2011", cats[1]["id"]),
            ("PL-3009", cats[2]["id"]),
            ("CM-4001", cats[3]["id"]),
        ]
        for i, (nm, cid) in enumerate(sample_names_wh1):
            items.append({
                "id": new_id(),
                "name": nm,
                "category": cid,
                "warehouse_id": wh1_id,
                "sheets": 50 + i * 12,
                "uMolding": 30 + i * 8,
                "lMolding": 25 + i * 5,
                "image": None,
                "created": now_iso(),
            })
        # Add a couple low stock items
        items.append({
            "id": new_id(),
            "name": "AL-9999",
            "category": cats[0]["id"],
            "warehouse_id": wh1_id,
            "sheets": 4,
            "uMolding": 6,
            "lMolding": 2,
            "image": None,
            "created": now_iso(),
        })
        items.append({
            "id": new_id(),
            "name": "RB-500",
            "category": next((c["id"] for c in cats if c["warehouse_id"] == wh2_id), None),
            "warehouse_id": wh2_id,
            "sheets": 120,
            "uMolding": 80,
            "lMolding": 60,
            "image": None,
            "created": now_iso(),
        })
        await db.inventory_items.insert_many(items)

        logger.info("Seeded default admin, warehouses, categories and items")


# ---------- AUTH ----------
@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"username": data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not pbkdf2_sha256.verify(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "role": user["role"],
            "warehouse_ids": user.get("warehouse_ids", []),
        },
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- WAREHOUSES ----------
@api.get("/warehouses")
async def list_warehouses(user: dict = Depends(get_current_user)):
    all_ws = await db.warehouses.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    if user.get("role") == "owner":
        return all_ws
    ids = set(user.get("warehouse_ids") or [])
    return [w for w in all_ws if w["id"] in ids]


@api.post("/warehouses")
async def create_warehouse(data: WarehouseIn, user: dict = Depends(get_current_user)):
    require_owner(user)
    doc = {"id": new_id(), "name": data.name, "location": data.location or "", "created": now_iso()}
    await db.warehouses.insert_one(doc)
    return clean(doc)


@api.put("/warehouses/{wh_id}")
async def update_warehouse(wh_id: str, data: WarehouseIn, user: dict = Depends(get_current_user)):
    require_owner(user)
    await db.warehouses.update_one({"id": wh_id}, {"$set": {"name": data.name, "location": data.location or ""}})
    updated = await db.warehouses.find_one({"id": wh_id}, {"_id": 0})
    return updated


@api.delete("/warehouses/{wh_id}")
async def delete_warehouse(wh_id: str, user: dict = Depends(get_current_user)):
    require_owner(user)
    await db.warehouses.delete_one({"id": wh_id})
    await db.categories.delete_many({"warehouse_id": wh_id})
    await db.inventory_items.delete_many({"warehouse_id": wh_id})
    await db.sales.delete_many({"warehouse_id": wh_id})
    await db.purchases.delete_many({"warehouse_id": wh_id})
    return {"deleted": True}


# ---------- CATEGORIES ----------
@api.get("/categories")
async def list_categories(warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    cats = await db.categories.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return cats


@api.post("/categories")
async def create_category(data: CategoryIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, data.warehouse_id):
        raise HTTPException(403, "No access")
    exists = await db.categories.find_one({"warehouse_id": data.warehouse_id, "name": data.name})
    if exists:
        raise HTTPException(400, "Category already exists")
    doc = {"id": new_id(), "name": data.name, "warehouse_id": data.warehouse_id, "created": now_iso()}
    await db.categories.insert_one(doc)
    return clean(doc)


@api.put("/categories/{cat_id}")
async def update_category(cat_id: str, data: CategoryIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    await db.categories.update_one({"id": cat_id}, {"$set": {"name": data.name}})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(get_current_user)):
    require_edit(user)
    # Reassign items to uncategorized (null)
    await db.inventory_items.update_many({"category": cat_id}, {"$set": {"category": None}})
    await db.categories.delete_one({"id": cat_id})
    return {"deleted": True}


# ---------- INVENTORY ----------
@api.get("/inventory")
async def list_inventory(warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    items = await db.inventory_items.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort("created", -1).to_list(5000)
    # Attach category name
    cat_ids = list({i.get("category") for i in items if i.get("category")})
    cats = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c for c in cats}
    for i in items:
        c = cat_map.get(i.get("category"))
        i["category_name"] = c["name"] if c else "Uncategorized"
    return items


@api.post("/inventory")
async def create_inventory(data: InventoryItemIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, data.warehouse_id):
        raise HTTPException(403, "No access")
    exists = await db.inventory_items.find_one({"warehouse_id": data.warehouse_id, "name": data.name})
    if exists:
        raise HTTPException(400, "Item with this name already exists")
    doc = data.dict()
    doc["id"] = new_id()
    doc["created"] = now_iso()
    await db.inventory_items.insert_one(doc)
    return clean(doc)


@api.put("/inventory/{item_id}")
async def update_inventory(item_id: str, data: InventoryItemUpdate, user: dict = Depends(get_current_user)):
    require_edit(user)
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    await db.inventory_items.update_one({"id": item_id}, {"$set": update})
    return await db.inventory_items.find_one({"id": item_id}, {"_id": 0})


@api.delete("/inventory/{item_id}")
async def delete_inventory(item_id: str, user: dict = Depends(get_current_user)):
    require_edit(user)
    await db.sales.delete_many({"itemId": item_id})
    await db.purchases.delete_many({"itemId": item_id})
    await db.inventory_items.delete_one({"id": item_id})
    return {"deleted": True}


@api.post("/inventory/bulk")
async def bulk_upsert_inventory(payload: dict, user: dict = Depends(get_current_user)):
    """payload: {warehouse_id, items: [{name, category, sheets, uMolding, lMolding}]}"""
    require_edit(user)
    wh_id = payload.get("warehouse_id")
    if not await user_has_warehouse(user, wh_id):
        raise HTTPException(403, "No access")

    items_in = payload.get("items", [])
    auto_cats = payload.get("auto_categories", [])  # names to create

    # Auto-create missing categories
    created_cats = 0
    cat_map = {}
    existing_cats = await db.categories.find({"warehouse_id": wh_id}, {"_id": 0}).to_list(1000)
    for c in existing_cats:
        cat_map[c["name"].lower()] = c["id"]
    for cname in auto_cats:
        if cname.lower() in cat_map:
            continue
        new_c = {"id": new_id(), "name": cname, "warehouse_id": wh_id, "created": now_iso()}
        await db.categories.insert_one(new_c)
        cat_map[cname.lower()] = new_c["id"]
        created_cats += 1

    created = 0
    updated = 0
    failed = 0
    for row in items_in:
        try:
            cat_id = row.get("category_id")
            if not cat_id and row.get("category_name"):
                cat_id = cat_map.get(row["category_name"].lower())
            existing = await db.inventory_items.find_one({"warehouse_id": wh_id, "name": row["name"]})
            if existing:
                upd = {
                    "sheets": row.get("sheets", existing["sheets"]),
                    "uMolding": row.get("uMolding", existing["uMolding"]),
                    "lMolding": row.get("lMolding", existing["lMolding"]),
                }
                if cat_id:
                    upd["category"] = cat_id
                await db.inventory_items.update_one({"id": existing["id"]}, {"$set": upd})
                updated += 1
            else:
                doc = {
                    "id": new_id(),
                    "name": row["name"],
                    "category": cat_id,
                    "warehouse_id": wh_id,
                    "sheets": row.get("sheets", 0),
                    "uMolding": row.get("uMolding", 0),
                    "lMolding": row.get("lMolding", 0),
                    "image": None,
                    "created": now_iso(),
                }
                await db.inventory_items.insert_one(doc)
                created += 1
        except Exception as e:
            logger.error(f"Bulk upsert failed for {row}: {e}")
            failed += 1
    return {"created": created, "updated": updated, "failed": failed, "auto_created_categories": created_cats}


# ---------- SALES ----------
def _compute_item_total(it: dict) -> float:
    return (it["sheets"] * it["pricePerSheet"]) + (it["uMolding"] * it["pricePerU"]) + (it["lMolding"] * it["pricePerL"])


@api.get("/sales")
async def list_sales(warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    sales = await db.sales.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort([("date", -1), ("created", -1)]).to_list(5000)
    # attach item name/category
    item_ids = list({s["itemId"] for s in sales})
    items = await db.inventory_items.find({"id": {"$in": item_ids}}, {"_id": 0}).to_list(5000)
    imap = {i["id"]: i for i in items}
    cat_ids = list({i.get("category") for i in items if i.get("category")})
    cats = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(1000)
    cmap = {c["id"]: c["name"] for c in cats}
    for s in sales:
        it = imap.get(s["itemId"])
        s["item_name"] = it["name"] if it else "Deleted"
        s["category_name"] = cmap.get(it.get("category") if it else None, "Uncategorized")
    return sales


@api.post("/sales")
async def create_sale(bill: BillIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, bill.warehouse_id):
        raise HTTPException(403, "No access")
    if not bill.items:
        raise HTTPException(400, "No items in bill")

    created = []
    for it in bill.items:
        inv = await db.inventory_items.find_one({"id": it.itemId})
        if not inv:
            raise HTTPException(400, f"Item {it.itemId} not found")
        # Stock check
        if it.sheets > inv["sheets"] or it.uMolding > inv["uMolding"] or it.lMolding > inv["lMolding"]:
            raise HTTPException(400, f"Insufficient stock for item {inv['name']}")
        # Decrement stock
        await db.inventory_items.update_one(
            {"id": it.itemId},
            {"$inc": {"sheets": -it.sheets, "uMolding": -it.uMolding, "lMolding": -it.lMolding}},
        )
        item_total = _compute_item_total(it.dict())
        sale_doc = {
            "id": new_id(),
            "bill_number": bill.bill_number,
            "date": bill.date,
            "customer_name": bill.customer_name or "",
            "itemId": it.itemId,
            "sheets_sale": it.sheets,
            "u_molding_sale": it.uMolding,
            "l_molding_sale": it.lMolding,
            "price_per_sheet": it.pricePerSheet,
            "price_per_u_molding": it.pricePerU,
            "price_per_l_molding": it.pricePerL,
            "total_price": item_total,
            "warehouse_id": bill.warehouse_id,
            "userId": user["id"],
            "created": now_iso(),
        }
        await db.sales.insert_one(sale_doc)
        created.append(clean(sale_doc))
    return {"created": created}


@api.put("/sales/bill/{bill_number}")
async def update_sale_bill(bill_number: str, bill: BillIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, bill.warehouse_id):
        raise HTTPException(403, "No access")
    # Reverse old
    old = await db.sales.find({"bill_number": bill_number, "warehouse_id": bill.warehouse_id}).to_list(1000)
    for s in old:
        await db.inventory_items.update_one(
            {"id": s["itemId"]},
            {"$inc": {"sheets": s["sheets_sale"], "uMolding": s["u_molding_sale"], "lMolding": s["l_molding_sale"]}},
        )
    await db.sales.delete_many({"bill_number": bill_number, "warehouse_id": bill.warehouse_id})
    # Apply new
    for it in bill.items:
        inv = await db.inventory_items.find_one({"id": it.itemId})
        if not inv:
            raise HTTPException(400, f"Item {it.itemId} not found")
        if it.sheets > inv["sheets"] or it.uMolding > inv["uMolding"] or it.lMolding > inv["lMolding"]:
            raise HTTPException(400, f"Insufficient stock for {inv['name']}")
        await db.inventory_items.update_one(
            {"id": it.itemId},
            {"$inc": {"sheets": -it.sheets, "uMolding": -it.uMolding, "lMolding": -it.lMolding}},
        )
        item_total = _compute_item_total(it.dict())
        await db.sales.insert_one({
            "id": new_id(),
            "bill_number": bill.bill_number,
            "date": bill.date,
            "customer_name": bill.customer_name or "",
            "itemId": it.itemId,
            "sheets_sale": it.sheets,
            "u_molding_sale": it.uMolding,
            "l_molding_sale": it.lMolding,
            "price_per_sheet": it.pricePerSheet,
            "price_per_u_molding": it.pricePerU,
            "price_per_l_molding": it.pricePerL,
            "total_price": item_total,
            "warehouse_id": bill.warehouse_id,
            "userId": user["id"],
            "created": now_iso(),
        })
    return {"ok": True}


@api.delete("/sales/bill/{bill_number}")
async def delete_sale_bill(bill_number: str, warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    old = await db.sales.find({"bill_number": bill_number, "warehouse_id": warehouse_id}).to_list(1000)
    for s in old:
        await db.inventory_items.update_one(
            {"id": s["itemId"]},
            {"$inc": {"sheets": s["sheets_sale"], "uMolding": s["u_molding_sale"], "lMolding": s["l_molding_sale"]}},
        )
    await db.sales.delete_many({"bill_number": bill_number, "warehouse_id": warehouse_id})
    return {"deleted": True}


# ---------- PURCHASES ----------
@api.get("/purchases")
async def list_purchases(warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    docs = await db.purchases.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort([("date", -1), ("created", -1)]).to_list(5000)
    item_ids = list({s["itemId"] for s in docs})
    items = await db.inventory_items.find({"id": {"$in": item_ids}}, {"_id": 0}).to_list(5000)
    imap = {i["id"]: i for i in items}
    for s in docs:
        it = imap.get(s["itemId"])
        s["item_name"] = it["name"] if it else "Deleted"
    return docs


@api.post("/purchases")
async def create_purchase(bill: BillIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, bill.warehouse_id):
        raise HTTPException(403, "No access")
    if not bill.items:
        raise HTTPException(400, "No items in bill")

    for it in bill.items:
        inv = await db.inventory_items.find_one({"id": it.itemId})
        if not inv:
            raise HTTPException(400, f"Item {it.itemId} not found")
        # Add stock
        await db.inventory_items.update_one(
            {"id": it.itemId},
            {"$inc": {"sheets": it.sheets, "uMolding": it.uMolding, "lMolding": it.lMolding}},
        )
        item_total = _compute_item_total(it.dict())
        await db.purchases.insert_one({
            "id": new_id(),
            "bill_number": bill.bill_number,
            "date": bill.date,
            "supplier_name": bill.supplier_name or bill.customer_name or "",
            "itemId": it.itemId,
            "sheets_purchase": it.sheets,
            "u_molding_purchase": it.uMolding,
            "l_molding_purchase": it.lMolding,
            "price_per_sheet": it.pricePerSheet,
            "price_per_u_molding": it.pricePerU,
            "price_per_l_molding": it.pricePerL,
            "total_price": item_total,
            "warehouse_id": bill.warehouse_id,
            "userId": user["id"],
            "created": now_iso(),
        })
    return {"ok": True}


@api.put("/purchases/bill/{bill_number}")
async def update_purchase_bill(bill_number: str, bill: BillIn, user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, bill.warehouse_id):
        raise HTTPException(403, "No access")
    # Reverse old (subtract)
    old = await db.purchases.find({"bill_number": bill_number, "warehouse_id": bill.warehouse_id}).to_list(1000)
    for s in old:
        await db.inventory_items.update_one(
            {"id": s["itemId"]},
            {"$inc": {"sheets": -s["sheets_purchase"], "uMolding": -s["u_molding_purchase"], "lMolding": -s["l_molding_purchase"]}},
        )
    await db.purchases.delete_many({"bill_number": bill_number, "warehouse_id": bill.warehouse_id})
    # Apply new
    for it in bill.items:
        inv = await db.inventory_items.find_one({"id": it.itemId})
        if not inv:
            raise HTTPException(400, f"Item {it.itemId} not found")
        await db.inventory_items.update_one(
            {"id": it.itemId},
            {"$inc": {"sheets": it.sheets, "uMolding": it.uMolding, "lMolding": it.lMolding}},
        )
        item_total = _compute_item_total(it.dict())
        await db.purchases.insert_one({
            "id": new_id(),
            "bill_number": bill.bill_number,
            "date": bill.date,
            "supplier_name": bill.supplier_name or bill.customer_name or "",
            "itemId": it.itemId,
            "sheets_purchase": it.sheets,
            "u_molding_purchase": it.uMolding,
            "l_molding_purchase": it.lMolding,
            "price_per_sheet": it.pricePerSheet,
            "price_per_u_molding": it.pricePerU,
            "price_per_l_molding": it.pricePerL,
            "total_price": item_total,
            "warehouse_id": bill.warehouse_id,
            "userId": user["id"],
            "created": now_iso(),
        })
    return {"ok": True}


@api.delete("/purchases/bill/{bill_number}")
async def delete_purchase_bill(bill_number: str, warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_edit(user)
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    old = await db.purchases.find({"bill_number": bill_number, "warehouse_id": warehouse_id}).to_list(1000)
    for s in old:
        await db.inventory_items.update_one(
            {"id": s["itemId"]},
            {"$inc": {"sheets": -s["sheets_purchase"], "uMolding": -s["u_molding_purchase"], "lMolding": -s["l_molding_purchase"]}},
        )
    await db.purchases.delete_many({"bill_number": bill_number, "warehouse_id": warehouse_id})
    return {"deleted": True}


# ---------- DASHBOARD ----------
@api.get("/dashboard")
async def dashboard(warehouse_id: str = Query(...), user: dict = Depends(get_current_user)):
    if not await user_has_warehouse(user, warehouse_id):
        raise HTTPException(403, "No access")
    items = await db.inventory_items.find({"warehouse_id": warehouse_id}, {"_id": 0}).to_list(5000)
    cats = await db.categories.count_documents({"warehouse_id": warehouse_id})
    total_stock = sum((i.get("sheets", 0) + i.get("uMolding", 0) + i.get("lMolding", 0)) for i in items)
    low_stock = sum(1 for i in items if i.get("sheets", 0) < 10 or i.get("uMolding", 0) < 10 or i.get("lMolding", 0) < 10)

    recent_sales = await db.sales.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort([("date", -1), ("created", -1)]).limit(5).to_list(5)
    recent_purchases = await db.purchases.find({"warehouse_id": warehouse_id}, {"_id": 0}).sort([("date", -1), ("created", -1)]).limit(5).to_list(5)
    item_ids = list({s["itemId"] for s in recent_sales + recent_purchases})
    all_items_lookup = await db.inventory_items.find({"id": {"$in": item_ids}}, {"_id": 0}).to_list(1000)
    imap = {i["id"]: i["name"] for i in all_items_lookup}
    for s in recent_sales:
        s["item_name"] = imap.get(s["itemId"], "Deleted")
    for s in recent_purchases:
        s["item_name"] = imap.get(s["itemId"], "Deleted")

    return {
        "total_items": len(items),
        "total_stock": int(total_stock),
        "low_stock_count": low_stock,
        "total_categories": cats,
        "recent_sales": recent_sales,
        "recent_purchases": recent_purchases,
    }


# ---------- USERS (Owner only) ----------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    require_owner(user)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.post("/users")
async def create_user(data: UserCreateIn, user: dict = Depends(get_current_user)):
    require_owner(user)
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "Username taken")
    doc = {
        "id": new_id(),
        "username": data.username,
        "email": data.email or "",
        "password_hash": pbkdf2_sha256.hash(data.password),
        "role": data.role,
        "warehouse_ids": data.warehouse_ids,
        "created": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash")
    return clean(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateIn, user: dict = Depends(get_current_user)):
    require_owner(user)
    update = {}
    if data.email is not None:
        update["email"] = data.email
    if data.role is not None:
        update["role"] = data.role
    if data.warehouse_ids is not None:
        update["warehouse_ids"] = data.warehouse_ids
    if data.password:
        update["password_hash"] = pbkdf2_sha256.hash(data.password)
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return doc


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    require_owner(user)
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    return {"deleted": True}


# ---------- ROOT ----------
@api.get("/")
async def root():
    return {"message": "StockFlow API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    try:
        await seed_defaults()
    except Exception as e:
        logger.error(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
