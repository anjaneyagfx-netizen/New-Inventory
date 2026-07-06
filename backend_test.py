#!/usr/bin/env python3
"""
Comprehensive backend API tests for StockFlow application
Tests all endpoints with proper authentication and data validation
"""
import requests
import json
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://app-overhaul-19.preview.emergentagent.com/api"

# Test credentials (seeded on startup)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Global state
admin_token = None
admin_user = None
warehouses = []
categories = []
inventory_items = []
manager_token = None
manager_user_id = None

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, test_name: str):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        print("\n" + "="*80)
        print(f"SUMMARY: {self.passed} passed, {self.failed} failed")
        if self.errors:
            print("\nFailed tests:")
            for err in self.errors:
                print(f"  - {err}")
        print("="*80)

result = TestResult()

def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
    """Make HTTP request with optional auth token"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            return requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            return requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PUT":
            return requests.put(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            return requests.delete(url, headers=headers, params=params, timeout=10)
    except Exception as e:
        print(f"Request error: {e}")
        raise

# ============================================================================
# 1. AUTH TESTS
# ============================================================================

def test_auth_login_success():
    """Test successful login with admin credentials"""
    global admin_token, admin_user
    resp = make_request("POST", "/auth/login", json_data={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    
    if resp.status_code != 200:
        result.fail("AUTH: Login success", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if "token" not in data or "user" not in data:
        result.fail("AUTH: Login success", f"Missing token or user in response: {data}")
        return
    
    user = data["user"]
    required_fields = ["id", "username", "role", "warehouse_ids"]
    missing = [f for f in required_fields if f not in user]
    if missing:
        result.fail("AUTH: Login success", f"Missing user fields: {missing}")
        return
    
    if user["role"] != "owner":
        result.fail("AUTH: Login success", f"Expected owner role, got {user['role']}")
        return
    
    admin_token = data["token"]
    admin_user = user
    result.success("AUTH: Login success with admin/admin123")

def test_auth_login_wrong_password():
    """Test login with wrong password returns 401"""
    resp = make_request("POST", "/auth/login", json_data={
        "username": ADMIN_USERNAME,
        "password": "wrongpassword"
    })
    
    if resp.status_code == 401:
        result.success("AUTH: Login with wrong password returns 401")
    else:
        result.fail("AUTH: Login with wrong password", f"Expected 401, got {resp.status_code}")

def test_auth_me_with_token():
    """Test /auth/me with valid token"""
    if not admin_token:
        result.fail("AUTH: /me with token", "No admin token available")
        return
    
    resp = make_request("GET", "/auth/me", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("AUTH: /me with token", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    user = resp.json()
    if user.get("role") != "owner":
        result.fail("AUTH: /me with token", f"Expected owner role, got {user.get('role')}")
        return
    
    result.success("AUTH: /me with valid token returns user")

def test_auth_me_without_token():
    """Test /auth/me without token returns 401"""
    resp = make_request("GET", "/auth/me")
    
    if resp.status_code == 401:
        result.success("AUTH: /me without token returns 401")
    else:
        result.fail("AUTH: /me without token", f"Expected 401, got {resp.status_code}")

# ============================================================================
# 2. WAREHOUSES TESTS
# ============================================================================

def test_warehouses_list():
    """Test GET /warehouses returns seeded warehouses"""
    global warehouses
    resp = make_request("GET", "/warehouses", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("WAREHOUSES: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    warehouses = resp.json()
    if len(warehouses) < 2:
        result.fail("WAREHOUSES: List", f"Expected at least 2 warehouses, got {len(warehouses)}")
        return
    
    names = [w.get("name") for w in warehouses]
    if "Main Warehouse" not in names or "Secondary Depot" not in names:
        result.fail("WAREHOUSES: List", f"Missing seeded warehouses. Got: {names}")
        return
    
    result.success(f"WAREHOUSES: List returns {len(warehouses)} warehouses")

def test_warehouses_create():
    """Test POST /warehouses creates new warehouse"""
    resp = make_request("POST", "/warehouses", token=admin_token, json_data={
        "name": "Test Warehouse NYC",
        "location": "New York"
    })
    
    if resp.status_code != 200:
        result.fail("WAREHOUSES: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    wh = resp.json()
    if not wh.get("id") or wh.get("name") != "Test Warehouse NYC":
        result.fail("WAREHOUSES: Create", f"Invalid response: {wh}")
        return
    
    warehouses.append(wh)
    result.success("WAREHOUSES: Create new warehouse")

def test_warehouses_update():
    """Test PUT /warehouses/{id} updates warehouse"""
    if not warehouses:
        result.fail("WAREHOUSES: Update", "No warehouses available")
        return
    
    wh = warehouses[-1]  # Use the one we just created
    resp = make_request("PUT", f"/warehouses/{wh['id']}", token=admin_token, json_data={
        "name": "Test Warehouse NYC Updated",
        "location": "Brooklyn"
    })
    
    if resp.status_code != 200:
        result.fail("WAREHOUSES: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    updated = resp.json()
    if updated.get("name") != "Test Warehouse NYC Updated":
        result.fail("WAREHOUSES: Update", f"Name not updated: {updated}")
        return
    
    result.success("WAREHOUSES: Update warehouse")

def test_warehouses_delete():
    """Test DELETE /warehouses/{id} deletes warehouse"""
    if len(warehouses) < 3:
        result.fail("WAREHOUSES: Delete", "Not enough warehouses to test delete")
        return
    
    wh = warehouses[-1]  # Delete the test one we created
    resp = make_request("DELETE", f"/warehouses/{wh['id']}", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("WAREHOUSES: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("WAREHOUSES: Delete", f"Delete not confirmed: {data}")
        return
    
    warehouses.pop()
    result.success("WAREHOUSES: Delete warehouse")

# ============================================================================
# 3. CATEGORIES TESTS
# ============================================================================

def test_categories_list():
    """Test GET /categories for Main Warehouse"""
    global categories
    if not warehouses:
        result.fail("CATEGORIES: List", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    if not wh1:
        result.fail("CATEGORIES: List", "Main Warehouse not found")
        return
    
    resp = make_request("GET", "/categories", token=admin_token, params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("CATEGORIES: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    categories = resp.json()
    expected_cats = ["Aluminum", "Steel", "Plastic", "Composite"]
    cat_names = [c.get("name") for c in categories]
    
    missing = [name for name in expected_cats if name not in cat_names]
    if missing:
        result.fail("CATEGORIES: List", f"Missing categories: {missing}. Got: {cat_names}")
        return
    
    result.success(f"CATEGORIES: List returns {len(categories)} categories")

def test_categories_create():
    """Test POST /categories creates new category"""
    if not warehouses:
        result.fail("CATEGORIES: Create", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("POST", "/categories", token=admin_token, json_data={
        "name": "TestCategory",
        "warehouse_id": wh1["id"]
    })
    
    if resp.status_code != 200:
        result.fail("CATEGORIES: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    cat = resp.json()
    if not cat.get("id") or cat.get("name") != "TestCategory":
        result.fail("CATEGORIES: Create", f"Invalid response: {cat}")
        return
    
    categories.append(cat)
    result.success("CATEGORIES: Create new category")

def test_categories_duplicate():
    """Test POST /categories with duplicate name returns 400"""
    if not warehouses or not categories:
        result.fail("CATEGORIES: Duplicate check", "No data available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("POST", "/categories", token=admin_token, json_data={
        "name": "TestCategory",  # Already exists
        "warehouse_id": wh1["id"]
    })
    
    if resp.status_code == 400:
        result.success("CATEGORIES: Duplicate name returns 400")
    else:
        result.fail("CATEGORIES: Duplicate check", f"Expected 400, got {resp.status_code}")

def test_categories_update():
    """Test PUT /categories/{id} updates category"""
    if not categories:
        result.fail("CATEGORIES: Update", "No categories available")
        return
    
    cat = categories[-1]
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("PUT", f"/categories/{cat['id']}", token=admin_token, json_data={
        "name": "TestCategoryUpdated",
        "warehouse_id": wh1["id"]
    })
    
    if resp.status_code != 200:
        result.fail("CATEGORIES: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    updated = resp.json()
    if updated.get("name") != "TestCategoryUpdated":
        result.fail("CATEGORIES: Update", f"Name not updated: {updated}")
        return
    
    result.success("CATEGORIES: Update category")

def test_categories_delete():
    """Test DELETE /categories/{id} deletes category"""
    if not categories:
        result.fail("CATEGORIES: Delete", "No categories available")
        return
    
    cat = categories[-1]
    resp = make_request("DELETE", f"/categories/{cat['id']}", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("CATEGORIES: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("CATEGORIES: Delete", f"Delete not confirmed: {data}")
        return
    
    categories.pop()
    result.success("CATEGORIES: Delete category")

# ============================================================================
# 4. INVENTORY TESTS
# ============================================================================

def test_inventory_list():
    """Test GET /inventory for Main Warehouse"""
    global inventory_items
    if not warehouses:
        result.fail("INVENTORY: List", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("INVENTORY: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    inventory_items = resp.json()
    item_names = [i.get("name") for i in inventory_items]
    
    if "AL-1024" not in item_names:
        result.fail("INVENTORY: List", f"Missing seeded item AL-1024. Got: {item_names}")
        return
    
    result.success(f"INVENTORY: List returns {len(inventory_items)} items")

def test_inventory_create():
    """Test POST /inventory creates new item"""
    if not warehouses or not categories:
        result.fail("INVENTORY: Create", "No warehouses or categories available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    cat = next((c for c in categories if c["warehouse_id"] == wh1["id"]), None)
    
    if not cat:
        result.fail("INVENTORY: Create", "No category found for Main Warehouse")
        return
    
    resp = make_request("POST", "/inventory", token=admin_token, json_data={
        "name": "TEST-ITEM-001",
        "category": cat["id"],
        "warehouse_id": wh1["id"],
        "sheets": 100,
        "uMolding": 50,
        "lMolding": 30
    })
    
    if resp.status_code != 200:
        result.fail("INVENTORY: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    item = resp.json()
    if not item.get("id") or item.get("name") != "TEST-ITEM-001":
        result.fail("INVENTORY: Create", f"Invalid response: {item}")
        return
    
    inventory_items.append(item)
    result.success("INVENTORY: Create new item")

def test_inventory_update():
    """Test PUT /inventory/{id} updates quantities"""
    if not inventory_items:
        result.fail("INVENTORY: Update", "No inventory items available")
        return
    
    item = inventory_items[-1]
    resp = make_request("PUT", f"/inventory/{item['id']}", token=admin_token, json_data={
        "sheets": 150,
        "uMolding": 75,
        "lMolding": 45
    })
    
    if resp.status_code != 200:
        result.fail("INVENTORY: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    updated = resp.json()
    if updated.get("sheets") != 150:
        result.fail("INVENTORY: Update", f"Quantities not updated: {updated}")
        return
    
    # Update local copy
    inventory_items[-1] = updated
    result.success("INVENTORY: Update quantities")

def test_inventory_bulk_upsert():
    """Test POST /inventory/bulk with auto_categories"""
    if not warehouses:
        result.fail("INVENTORY: Bulk upsert", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    
    resp = make_request("POST", "/inventory/bulk", token=admin_token, json_data={
        "warehouse_id": wh1["id"],
        "auto_categories": ["BulkTestCat"],
        "items": [
            {
                "name": "BULK-001",
                "category_name": "BulkTestCat",
                "sheets": 20,
                "uMolding": 10,
                "lMolding": 5
            },
            {
                "name": "TEST-ITEM-001",  # Existing item - should update
                "sheets": 200,
                "uMolding": 100,
                "lMolding": 50
            }
        ]
    })
    
    if resp.status_code != 200:
        result.fail("INVENTORY: Bulk upsert", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if data.get("auto_created_categories") != 1:
        result.fail("INVENTORY: Bulk upsert", f"Expected 1 auto-created category, got {data}")
        return
    
    if data.get("created") < 1 or data.get("updated") < 1:
        result.fail("INVENTORY: Bulk upsert", f"Expected creates and updates, got {data}")
        return
    
    result.success("INVENTORY: Bulk upsert with auto_categories")

def test_inventory_delete():
    """Test DELETE /inventory/{id} deletes item and related sales/purchases"""
    if not inventory_items:
        result.fail("INVENTORY: Delete", "No inventory items available")
        return
    
    item = inventory_items[-1]
    resp = make_request("DELETE", f"/inventory/{item['id']}", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("INVENTORY: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("INVENTORY: Delete", f"Delete not confirmed: {data}")
        return
    
    inventory_items.pop()
    result.success("INVENTORY: Delete item")

# ============================================================================
# 5. SALES TESTS
# ============================================================================

def test_sales_create():
    """Test POST /sales creates sale and decrements inventory"""
    if not warehouses or not inventory_items:
        result.fail("SALES: Create", "No warehouses or inventory available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    # Find an item with sufficient stock
    item = next((i for i in inventory_items if i.get("sheets", 0) >= 10), None)
    
    if not item:
        result.fail("SALES: Create", "No item with sufficient stock")
        return
    
    # Record original quantities
    original_sheets = item.get("sheets", 0)
    
    resp = make_request("POST", "/sales", token=admin_token, json_data={
        "bill_number": "SALE-TEST-001",
        "date": "2024-01-15",
        "customer_name": "Test Customer",
        "warehouse_id": wh1["id"],
        "items": [
            {
                "itemId": item["id"],
                "sheets": 5,
                "uMolding": 3,
                "lMolding": 2,
                "pricePerSheet": 100,
                "pricePerU": 50,
                "pricePerL": 30
            }
        ]
    })
    
    if resp.status_code != 200:
        result.fail("SALES: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    # Verify inventory was decremented
    inv_resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    updated_items = inv_resp.json()
    updated_item = next((i for i in updated_items if i["id"] == item["id"]), None)
    
    if not updated_item:
        result.fail("SALES: Create", "Item not found after sale")
        return
    
    expected_sheets = original_sheets - 5
    if updated_item.get("sheets") != expected_sheets:
        result.fail("SALES: Create", f"Inventory not decremented. Expected {expected_sheets}, got {updated_item.get('sheets')}")
        return
    
    result.success("SALES: Create sale and decrement inventory")

def test_sales_list():
    """Test GET /sales lists sales with item names"""
    if not warehouses:
        result.fail("SALES: List", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("GET", "/sales", token=admin_token, params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("SALES: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    sales = resp.json()
    if not sales:
        result.fail("SALES: List", "No sales found")
        return
    
    # Check that item_name is attached
    if "item_name" not in sales[0]:
        result.fail("SALES: List", "item_name not attached to sales")
        return
    
    result.success(f"SALES: List returns {len(sales)} sales")

def test_sales_insufficient_stock():
    """Test POST /sales with insufficient stock returns 400"""
    if not warehouses or not inventory_items:
        result.fail("SALES: Insufficient stock", "No data available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    item = inventory_items[0]
    
    resp = make_request("POST", "/sales", token=admin_token, json_data={
        "bill_number": "SALE-FAIL-001",
        "date": "2024-01-15",
        "customer_name": "Test Customer",
        "warehouse_id": wh1["id"],
        "items": [
            {
                "itemId": item["id"],
                "sheets": 999999,  # Way more than available
                "uMolding": 0,
                "lMolding": 0,
                "pricePerSheet": 100,
                "pricePerU": 0,
                "pricePerL": 0
            }
        ]
    })
    
    if resp.status_code == 400:
        result.success("SALES: Insufficient stock returns 400")
    else:
        result.fail("SALES: Insufficient stock", f"Expected 400, got {resp.status_code}")

def test_sales_update():
    """Test PUT /sales/bill/{bill_number} updates sale and adjusts inventory"""
    if not warehouses or not inventory_items:
        result.fail("SALES: Update", "No data available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    item = next((i for i in inventory_items if i.get("sheets", 0) >= 20), None)
    
    if not item:
        result.fail("SALES: Update", "No item with sufficient stock")
        return
    
    # Get current inventory
    inv_resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    current_items = inv_resp.json()
    current_item = next((i for i in current_items if i["id"] == item["id"]), None)
    original_sheets = current_item.get("sheets", 0)
    
    # Update the sale (change quantities)
    resp = make_request("PUT", "/sales/bill/SALE-TEST-001", token=admin_token, json_data={
        "bill_number": "SALE-TEST-001",
        "date": "2024-01-15",
        "customer_name": "Test Customer Updated",
        "warehouse_id": wh1["id"],
        "items": [
            {
                "itemId": item["id"],
                "sheets": 8,  # Changed from 5 to 8
                "uMolding": 4,
                "lMolding": 3,
                "pricePerSheet": 100,
                "pricePerU": 50,
                "pricePerL": 30
            }
        ]
    })
    
    if resp.status_code != 200:
        result.fail("SALES: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    result.success("SALES: Update bill")

def test_sales_delete():
    """Test DELETE /sales/bill/{bill_number} deletes and restores inventory"""
    if not warehouses:
        result.fail("SALES: Delete", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    
    # Get inventory before delete
    inv_resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    before_items = inv_resp.json()
    
    resp = make_request("DELETE", "/sales/bill/SALE-TEST-001", token=admin_token, 
                       params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("SALES: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("SALES: Delete", f"Delete not confirmed: {data}")
        return
    
    result.success("SALES: Delete bill and restore inventory")

# ============================================================================
# 6. PURCHASES TESTS
# ============================================================================

def test_purchases_create():
    """Test POST /purchases creates purchase and increments inventory"""
    if not warehouses or not inventory_items:
        result.fail("PURCHASES: Create", "No data available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    item = inventory_items[0]
    
    # Get current inventory
    inv_resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    current_items = inv_resp.json()
    current_item = next((i for i in current_items if i["id"] == item["id"]), None)
    original_sheets = current_item.get("sheets", 0)
    
    resp = make_request("POST", "/purchases", token=admin_token, json_data={
        "bill_number": "PURCH-TEST-001",
        "date": "2024-01-15",
        "supplier_name": "Test Supplier",
        "warehouse_id": wh1["id"],
        "items": [
            {
                "itemId": item["id"],
                "sheets": 10,
                "uMolding": 5,
                "lMolding": 3,
                "pricePerSheet": 80,
                "pricePerU": 40,
                "pricePerL": 25
            }
        ]
    })
    
    if resp.status_code != 200:
        result.fail("PURCHASES: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    # Verify inventory was incremented
    inv_resp = make_request("GET", "/inventory", token=admin_token, params={"warehouse_id": wh1["id"]})
    updated_items = inv_resp.json()
    updated_item = next((i for i in updated_items if i["id"] == item["id"]), None)
    
    expected_sheets = original_sheets + 10
    if updated_item.get("sheets") != expected_sheets:
        result.fail("PURCHASES: Create", f"Inventory not incremented. Expected {expected_sheets}, got {updated_item.get('sheets')}")
        return
    
    result.success("PURCHASES: Create purchase and increment inventory")

def test_purchases_list():
    """Test GET /purchases lists purchases"""
    if not warehouses:
        result.fail("PURCHASES: List", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("GET", "/purchases", token=admin_token, params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("PURCHASES: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    purchases = resp.json()
    if not purchases:
        result.fail("PURCHASES: List", "No purchases found")
        return
    
    result.success(f"PURCHASES: List returns {len(purchases)} purchases")

def test_purchases_update():
    """Test PUT /purchases/bill/{bill_number} updates purchase"""
    if not warehouses or not inventory_items:
        result.fail("PURCHASES: Update", "No data available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    item = inventory_items[0]
    
    resp = make_request("PUT", "/purchases/bill/PURCH-TEST-001", token=admin_token, json_data={
        "bill_number": "PURCH-TEST-001",
        "date": "2024-01-15",
        "supplier_name": "Test Supplier Updated",
        "warehouse_id": wh1["id"],
        "items": [
            {
                "itemId": item["id"],
                "sheets": 15,  # Changed from 10 to 15
                "uMolding": 8,
                "lMolding": 5,
                "pricePerSheet": 80,
                "pricePerU": 40,
                "pricePerL": 25
            }
        ]
    })
    
    if resp.status_code != 200:
        result.fail("PURCHASES: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    result.success("PURCHASES: Update bill")

def test_purchases_delete():
    """Test DELETE /purchases/bill/{bill_number} deletes and reverses inventory"""
    if not warehouses:
        result.fail("PURCHASES: Delete", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    
    resp = make_request("DELETE", "/purchases/bill/PURCH-TEST-001", token=admin_token,
                       params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("PURCHASES: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("PURCHASES: Delete", f"Delete not confirmed: {data}")
        return
    
    result.success("PURCHASES: Delete bill and reverse inventory")

# ============================================================================
# 7. DASHBOARD TESTS
# ============================================================================

def test_dashboard():
    """Test GET /dashboard returns aggregated stats"""
    if not warehouses:
        result.fail("DASHBOARD: Stats", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    resp = make_request("GET", "/dashboard", token=admin_token, params={"warehouse_id": wh1["id"]})
    
    if resp.status_code != 200:
        result.fail("DASHBOARD: Stats", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    required_fields = ["total_items", "total_stock", "low_stock_count", "total_categories", 
                      "recent_sales", "recent_purchases"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        result.fail("DASHBOARD: Stats", f"Missing fields: {missing}")
        return
    
    if not isinstance(data["recent_sales"], list) or not isinstance(data["recent_purchases"], list):
        result.fail("DASHBOARD: Stats", "recent_sales/purchases not lists")
        return
    
    result.success("DASHBOARD: Returns aggregated stats")

# ============================================================================
# 8. USERS TESTS (Owner only)
# ============================================================================

def test_users_list():
    """Test GET /users (owner only)"""
    resp = make_request("GET", "/users", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("USERS: List", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    users = resp.json()
    if not users:
        result.fail("USERS: List", "No users found")
        return
    
    # Should have at least admin user
    admin_found = any(u.get("username") == "admin" for u in users)
    if not admin_found:
        result.fail("USERS: List", "Admin user not found")
        return
    
    result.success(f"USERS: List returns {len(users)} users")

def test_users_create():
    """Test POST /users creates new user"""
    global manager_user_id
    if not warehouses:
        result.fail("USERS: Create", "No warehouses available")
        return
    
    wh1 = next((w for w in warehouses if w["name"] == "Main Warehouse"), None)
    
    resp = make_request("POST", "/users", token=admin_token, json_data={
        "username": "testmanager",
        "password": "manager123",
        "email": "manager@test.com",
        "role": "manager",
        "warehouse_ids": [wh1["id"]]
    })
    
    if resp.status_code != 200:
        result.fail("USERS: Create", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    user = resp.json()
    if not user.get("id") or user.get("username") != "testmanager":
        result.fail("USERS: Create", f"Invalid response: {user}")
        return
    
    manager_user_id = user["id"]
    result.success("USERS: Create new user")

def test_users_update():
    """Test PUT /users/{id} updates user"""
    if not manager_user_id:
        result.fail("USERS: Update", "No manager user available")
        return
    
    resp = make_request("PUT", f"/users/{manager_user_id}", token=admin_token, json_data={
        "role": "staff",
        "email": "manager_updated@test.com"
    })
    
    if resp.status_code != 200:
        result.fail("USERS: Update", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    user = resp.json()
    if user.get("role") != "staff":
        result.fail("USERS: Update", f"Role not updated: {user}")
        return
    
    result.success("USERS: Update user")

def test_users_non_owner_access():
    """Test that non-owner cannot access /users endpoint"""
    global manager_token
    
    # Login as manager
    resp = make_request("POST", "/auth/login", json_data={
        "username": "testmanager",
        "password": "manager123"
    })
    
    if resp.status_code != 200:
        result.fail("USERS: Non-owner access", f"Manager login failed: {resp.status_code}")
        return
    
    manager_token = resp.json()["token"]
    
    # Try to access /users as manager
    resp = make_request("GET", "/users", token=manager_token)
    
    if resp.status_code == 403:
        result.success("USERS: Non-owner gets 403 on /users")
    else:
        result.fail("USERS: Non-owner access", f"Expected 403, got {resp.status_code}")

def test_users_delete():
    """Test DELETE /users/{id} deletes user"""
    if not manager_user_id:
        result.fail("USERS: Delete", "No manager user available")
        return
    
    resp = make_request("DELETE", f"/users/{manager_user_id}", token=admin_token)
    
    if resp.status_code != 200:
        result.fail("USERS: Delete", f"Status {resp.status_code}, body: {resp.text}")
        return
    
    data = resp.json()
    if not data.get("deleted"):
        result.fail("USERS: Delete", f"Delete not confirmed: {data}")
        return
    
    result.success("USERS: Delete user")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all tests in order"""
    print("="*80)
    print("StockFlow Backend API Tests")
    print("="*80)
    print(f"Testing against: {BASE_URL}")
    print("="*80)
    
    # 1. Auth tests
    print("\n1. AUTH TESTS")
    print("-"*80)
    test_auth_login_success()
    test_auth_login_wrong_password()
    test_auth_me_with_token()
    test_auth_me_without_token()
    
    # 2. Warehouses tests
    print("\n2. WAREHOUSES TESTS")
    print("-"*80)
    test_warehouses_list()
    test_warehouses_create()
    test_warehouses_update()
    test_warehouses_delete()
    
    # 3. Categories tests
    print("\n3. CATEGORIES TESTS")
    print("-"*80)
    test_categories_list()
    test_categories_create()
    test_categories_duplicate()
    test_categories_update()
    test_categories_delete()
    
    # 4. Inventory tests
    print("\n4. INVENTORY TESTS")
    print("-"*80)
    test_inventory_list()
    test_inventory_create()
    test_inventory_update()
    test_inventory_bulk_upsert()
    test_inventory_delete()
    
    # 5. Sales tests
    print("\n5. SALES TESTS")
    print("-"*80)
    test_sales_create()
    test_sales_list()
    test_sales_insufficient_stock()
    test_sales_update()
    test_sales_delete()
    
    # 6. Purchases tests
    print("\n6. PURCHASES TESTS")
    print("-"*80)
    test_purchases_create()
    test_purchases_list()
    test_purchases_update()
    test_purchases_delete()
    
    # 7. Dashboard tests
    print("\n7. DASHBOARD TESTS")
    print("-"*80)
    test_dashboard()
    
    # 8. Users tests
    print("\n8. USERS TESTS")
    print("-"*80)
    test_users_list()
    test_users_create()
    test_users_update()
    test_users_non_owner_access()
    test_users_delete()
    
    # Summary
    result.summary()
    
    return result.failed == 0

if __name__ == "__main__":
    import sys
    success = run_all_tests()
    sys.exit(0 if success else 1)
