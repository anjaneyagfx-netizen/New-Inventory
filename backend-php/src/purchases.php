<?php
declare(strict_types=1);
// Route: /api/purchases/*

$user = current_user();
$method = $_SERVER['REQUEST_METHOD'];
$sub = $segments[1] ?? null;
$billNo = ($sub === 'bill') ? ($segments[2] ?? null) : null;

function _purchase_item_total(array $it): float {
    return ($it['sheets'] * $it['pricePerSheet'])
         + ($it['uMolding'] * $it['pricePerU'])
         + ($it['lMolding'] * $it['pricePerL']);
}

if ($method === 'GET' && !$sub) {
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $stmt = db()->prepare('SELECT p.*, i.name AS item_name
                            FROM purchases p LEFT JOIN inventory_items i ON i.id = p.itemId
                            WHERE p.warehouse_id = ?
                            ORDER BY p.date DESC, p.created DESC');
    $stmt->execute([$wh]);
    $rows = array_map(function ($r) {
        $r['item_name'] = $r['item_name'] ?: 'Deleted';
        return cast_numbers($r, [], ['sheets_purchase', 'u_molding_purchase', 'l_molding_purchase', 'price_per_sheet', 'price_per_u_molding', 'price_per_l_molding', 'total_price']);
    }, $stmt->fetchAll());
    json_response($rows);
}

function _apply_purchase_bill(array $bill, array $user): void {
    $pdo = db();
    $findItem = $pdo->prepare('SELECT id, name FROM inventory_items WHERE id = ?');
    $incItem = $pdo->prepare('UPDATE inventory_items SET sheets = sheets + ?, uMolding = uMolding + ?, lMolding = lMolding + ? WHERE id = ?');
    $insP = $pdo->prepare('INSERT INTO purchases (id, bill_number, date, supplier_name, itemId, sheets_purchase, u_molding_purchase, l_molding_purchase, price_per_sheet, price_per_u_molding, price_per_l_molding, total_price, warehouse_id, userId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $supplier = $bill['supplier_name'] ?? ($bill['customer_name'] ?? '');
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
        if (!$findItem->fetch()) abort(400, "Item {$it['itemId']} not found");
        $incItem->execute([$it['sheets'], $it['uMolding'], $it['lMolding'], $it['itemId']]);
        $insP->execute([
            new_id(), $bill['bill_number'], $bill['date'], $supplier,
            $it['itemId'], $it['sheets'], $it['uMolding'], $it['lMolding'],
            $it['pricePerSheet'], $it['pricePerU'], $it['pricePerL'],
            _purchase_item_total($it), $bill['warehouse_id'], $user['id'],
        ]);
    }
}

if ($method === 'POST' && !$sub) {
    require_edit($user);
    $b = body_json();
    if (empty($b['warehouse_id']) || empty($b['bill_number']) || empty($b['date'])) abort(400, 'bill_number, date and warehouse_id required');
    if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');
    if (empty($b['items'])) abort(400, 'No items in bill');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        _apply_purchase_bill($b, $user);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true]);
}

if ($sub === 'bill' && $billNo && $method === 'PUT') {
    require_edit($user);
    $b = body_json();
    if (empty($b['warehouse_id'])) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Reverse old lines (subtract from inventory)
        $old = $pdo->prepare('SELECT itemId, sheets_purchase, u_molding_purchase, l_molding_purchase FROM purchases WHERE bill_number = ? AND warehouse_id = ?');
        $old->execute([$billNo, $b['warehouse_id']]);
        $reverse = $pdo->prepare('UPDATE inventory_items SET sheets = sheets - ?, uMolding = uMolding - ?, lMolding = lMolding - ? WHERE id = ?');
        foreach ($old->fetchAll() as $l) {
            $reverse->execute([(float)$l['sheets_purchase'], (float)$l['u_molding_purchase'], (float)$l['l_molding_purchase'], $l['itemId']]);
        }
        $pdo->prepare('DELETE FROM purchases WHERE bill_number = ? AND warehouse_id = ?')->execute([$billNo, $b['warehouse_id']]);
        _apply_purchase_bill($b, $user);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['ok' => true]);
}

if ($sub === 'bill' && $billNo && $method === 'DELETE') {
    require_edit($user);
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $old = $pdo->prepare('SELECT itemId, sheets_purchase, u_molding_purchase, l_molding_purchase FROM purchases WHERE bill_number = ? AND warehouse_id = ?');
        $old->execute([$billNo, $wh]);
        $reverse = $pdo->prepare('UPDATE inventory_items SET sheets = sheets - ?, uMolding = uMolding - ?, lMolding = lMolding - ? WHERE id = ?');
        foreach ($old->fetchAll() as $l) {
            $reverse->execute([(float)$l['sheets_purchase'], (float)$l['u_molding_purchase'], (float)$l['l_molding_purchase'], $l['itemId']]);
        }
        $pdo->prepare('DELETE FROM purchases WHERE bill_number = ? AND warehouse_id = ?')->execute([$billNo, $wh]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
