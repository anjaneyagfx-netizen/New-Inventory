<?php
declare(strict_types=1);
// Route: /api/warehouses/*

$user = current_user();
$method = $_SERVER['REQUEST_METHOD'];
$id = $segments[1] ?? null;

if ($method === 'GET' && !$id) {
    $rows = db()->query('SELECT id, name, location, created FROM warehouses ORDER BY name ASC')->fetchAll();
    if ($user['role'] !== 'owner') {
        $rows = array_values(array_filter($rows, fn($w) => in_array($w['id'], $user['warehouse_ids'], true)));
    }
    json_response($rows);
}

if ($method === 'POST' && !$id) {
    require_owner($user);
    $b = body_json();
    if (empty($b['name'])) abort(400, 'name required');
    $doc = ['id' => new_id(), 'name' => $b['name'], 'location' => $b['location'] ?? '', 'created' => now_iso()];
    db()->prepare('INSERT INTO warehouses (id, name, location, created) VALUES (?,?,?,NOW())')
        ->execute([$doc['id'], $doc['name'], $doc['location']]);
    json_response($doc);
}

if ($id && $method === 'PUT') {
    require_owner($user);
    $b = body_json();
    db()->prepare('UPDATE warehouses SET name = ?, location = ? WHERE id = ?')
        ->execute([$b['name'] ?? '', $b['location'] ?? '', $id]);
    $row = db()->prepare('SELECT id, name, location, created FROM warehouses WHERE id = ?');
    $row->execute([$id]);
    json_response($row->fetch() ?: null);
}

if ($id && $method === 'DELETE') {
    require_owner($user);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM sales WHERE warehouse_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM purchases WHERE warehouse_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM inventory_items WHERE warehouse_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM categories WHERE warehouse_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM warehouses WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
