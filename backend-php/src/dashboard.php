<?php
declare(strict_types=1);
// Route: /api/dashboard?warehouse_id=...

$user = current_user();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') abort(405, 'Method not allowed');

$wh = q('warehouse_id');
if (!$wh) abort(400, 'warehouse_id required');
if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

$pdo = db();

$stmt = $pdo->prepare('SELECT sheets, uMolding, lMolding FROM inventory_items WHERE warehouse_id = ?');
$stmt->execute([$wh]);
$items = $stmt->fetchAll();

$totalItems = count($items);
$totalStock = 0;
$lowStock = 0;
foreach ($items as $i) {
    $totalStock += (float)$i['sheets'] + (float)$i['uMolding'] + (float)$i['lMolding'];
    if ((float)$i['sheets'] < 10 || (float)$i['uMolding'] < 10 || (float)$i['lMolding'] < 10) $lowStock++;
}

$catStmt = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE warehouse_id = ?');
$catStmt->execute([$wh]);
$catCount = (int)$catStmt->fetchColumn();

$rs = $pdo->prepare('SELECT s.*, i.name AS item_name FROM sales s LEFT JOIN inventory_items i ON i.id = s.itemId WHERE s.warehouse_id = ? ORDER BY s.date DESC, s.created DESC LIMIT 5');
$rs->execute([$wh]);
$recentSales = array_map(fn($r) => array_merge($r, ['item_name' => $r['item_name'] ?: 'Deleted']), $rs->fetchAll());

$rp = $pdo->prepare('SELECT p.*, i.name AS item_name FROM purchases p LEFT JOIN inventory_items i ON i.id = p.itemId WHERE p.warehouse_id = ? ORDER BY p.date DESC, p.created DESC LIMIT 5');
$rp->execute([$wh]);
$recentPurchases = array_map(fn($r) => array_merge($r, ['item_name' => $r['item_name'] ?: 'Deleted']), $rp->fetchAll());

json_response([
    'total_items' => $totalItems,
    'total_stock' => (int)$totalStock,
    'low_stock_count' => $lowStock,
    'total_categories' => $catCount,
    'recent_sales' => $recentSales,
    'recent_purchases' => $recentPurchases,
]);
