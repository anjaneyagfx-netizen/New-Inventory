<?php
declare(strict_types=1);
// Route: /api/categories/*

$user = current_user();
$method = $_SERVER['REQUEST_METHOD'];
$id = $segments[1] ?? null;

if ($method === 'GET' && !$id) {
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');
    $stmt = db()->prepare('SELECT id, name, warehouse_id, created FROM categories WHERE warehouse_id = ? ORDER BY name ASC');
    $stmt->execute([$wh]);
    json_response($stmt->fetchAll());
}

if ($method === 'POST' && !$id) {
    require_edit($user);
    $b = body_json();
    if (empty($b['name']) || empty($b['warehouse_id'])) abort(400, 'name and warehouse_id required');
    if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');

    $check = db()->prepare('SELECT id FROM categories WHERE warehouse_id = ? AND name = ?');
    $check->execute([$b['warehouse_id'], $b['name']]);
    if ($check->fetch()) abort(400, 'Category already exists');

    $doc = ['id' => new_id(), 'name' => $b['name'], 'warehouse_id' => $b['warehouse_id'], 'created' => now_iso()];
    db()->prepare('INSERT INTO categories (id, name, warehouse_id, created) VALUES (?,?,?,NOW())')
        ->execute([$doc['id'], $doc['name'], $doc['warehouse_id']]);
    json_response($doc);
}

if ($id && $method === 'PUT') {
    require_edit($user);
    $b = body_json();
    if (empty($b['name'])) abort(400, 'name required');
    db()->prepare('UPDATE categories SET name = ? WHERE id = ?')->execute([$b['name'], $id]);
    $row = db()->prepare('SELECT id, name, warehouse_id, created FROM categories WHERE id = ?');
    $row->execute([$id]);
    json_response($row->fetch() ?: null);
}

if ($id && $method === 'DELETE') {
    require_edit($user);
    db()->prepare('UPDATE inventory_items SET category = NULL WHERE category = ?')->execute([$id]);
    db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
