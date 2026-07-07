<?php
declare(strict_types=1);
// Route: /api/sales/*

$user = current_user();
$method = $_SERVER['REQUEST_METHOD'];
$sub = $segments[1] ?? null;
$billNo = ($sub === 'bill') ? ($segments[2] ?? null) : null;

function _sale_item_total(array $it): float {
    return ($it['sheets'] * $it['pricePerSheet'])
         + ($it['uMolding'] * $it['pricePerU'])
         + ($it['lMolding'] * $it['pricePerL']);
}

// GET /api/sales?warehouse_id=...
if ($method === 'GET' && !$sub) {
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $stmt = db()->prepare('SELECT s.*, i.name AS item_name, i.category AS item_cat_id, c.name AS category_name
                            FROM sales s
                            LEFT JOIN inventory_items i ON i.id = s.itemId
                            LEFT JOIN categories c ON c.id = i.category
                            WHERE s.warehouse_id = ?
                            ORDER BY s.date DESC, s.created DESC');
    $stmt->execute([$wh]);
    $rows = array_map(function ($r) {
        $r['item_name'] = $r['item_name'] ?: 'Deleted';
        $r['category_name'] = $r['category_name'] ?: 'Uncategorized';
        unset($r['item_cat_id']);
        return cast_numbers($r, [], ['sheets_sale', 'u_molding_sale', 'l_molding_sale', 'price_per_sheet', 'price_per_u_molding', 'price_per_l_molding', 'total_price']);
    }, $stmt->fetchAll());
    json_response($rows);
}

// Helper: process a sale bill (create or update). Returns nothing; throws on error.
function _apply_sale_bill(array $bill, array $user): void {
    $pdo = db();
    $findItem = $pdo->prepare('SELECT id, name, sheets, uMolding, lMolding FROM inventory_items WHERE id = ?');
    $decItem = $pdo->prepare('UPDATE inventory_items SET sheets = sheets - ?, uMolding = uMolding - ?, lMolding = lMolding - ? WHERE id = ?');
    $insSale = $pdo->prepare('INSERT INTO sales (id, bill_number, date, customer_name, itemId, sheets_sale, u_molding_sale, l_molding_sale, price_per_sheet, price_per_u_molding, price_per_l_molding, total_price, warehouse_id, userId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($bill['items'] as $rawIt) {
        $it = [
            'itemId' => $rawIt['itemId'],
            'sheets' => (float)($rawIt['sheets'] ?? 0),
            'uMolding' => (float)($rawIt['uMolding'] ?? 0),
            'lMolding' => (float)($rawIt['lMolding'] ?? 0),
            'pricePerSheet' => (float)($rawIt['pricePerSheet'] ?? 0),
            'pricePerU' => (float)($rawIt['pricePerU'] ?? 0),
            'pricePerL' => (float)($rawIt['pricePerL'] ?? 0),
        ];
        $findItem->execute([$it['itemId']]);
        $inv = $findItem->fetch();
        if (!$inv) abort(400, "Item {$it['itemId']} not found");
        if ($it['sheets'] > (float)$inv['sheets'] || $it['uMolding'] > (float)$inv['uMolding'] || $it['lMolding'] > (float)$inv['lMolding']) {
            abort(400, "Insufficient stock for {$inv['name']}");
        }
        $decItem->execute([$it['sheets'], $it['uMolding'], $it['lMolding'], $it['itemId']]);
        $insSale->execute([
            new_id(), $bill['bill_number'], $bill['date'], $bill['customer_name'] ?? '',
            $it['itemId'], $it['sheets'], $it['uMolding'], $it['lMolding'],
            $it['pricePerSheet'], $it['pricePerU'], $it['pricePerL'],
            _sale_item_total($it), $bill['warehouse_id'], $user['id'],
        ]);
    }
}

// POST /api/sales
if ($method === 'POST' && !$sub) {
    require_edit($user);
    $b = body_json();
    if (empty($b['warehouse_id']) || empty($b['bill_number']) || empty($b['date'])) abort(400, 'bill_number, date and warehouse_id required');
    if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');
    if (empty($b['items'])) abort(400, 'No items in bill');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        _apply_sale_bill($b, $user);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true]);
}

// PUT /api/sales/bill/{bill_number}
if ($sub === 'bill' && $billNo && $method === 'PUT') {
    require_edit($user);
    $b = body_json();
    if (empty($b['warehouse_id'])) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Restore inventory for old lines
        $old = $pdo->prepare('SELECT itemId, sheets_sale, u_molding_sale, l_molding_sale FROM sales WHERE bill_number = ? AND warehouse_id = ?');
        $old->execute([$billNo, $b['warehouse_id']]);
        $restore = $pdo->prepare('UPDATE inventory_items SET sheets = sheets + ?, uMolding = uMolding + ?, lMolding = lMolding + ? WHERE id = ?');
        foreach ($old->fetchAll() as $l) {
            $restore->execute([(float)$l['sheets_sale'], (float)$l['u_molding_sale'], (float)$l['l_molding_sale'], $l['itemId']]);
        }
        $pdo->prepare('DELETE FROM sales WHERE bill_number = ? AND warehouse_id = ?')->execute([$billNo, $b['warehouse_id']]);
        _apply_sale_bill($b, $user);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true]);
}

// DELETE /api/sales/bill/{bill_number}?warehouse_id=...
if ($sub === 'bill' && $billNo && $method === 'DELETE') {
    require_edit($user);
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $old = $pdo->prepare('SELECT itemId, sheets_sale, u_molding_sale, l_molding_sale FROM sales WHERE bill_number = ? AND warehouse_id = ?');
        $old->execute([$billNo, $wh]);
        $restore = $pdo->prepare('UPDATE inventory_items SET sheets = sheets + ?, uMolding = uMolding + ?, lMolding = lMolding + ? WHERE id = ?');
        foreach ($old->fetchAll() as $l) {
            $restore->execute([(float)$l['sheets_sale'], (float)$l['u_molding_sale'], (float)$l['l_molding_sale'], $l['itemId']]);
        }
        $pdo->prepare('DELETE FROM sales WHERE bill_number = ? AND warehouse_id = ?')->execute([$billNo, $wh]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
