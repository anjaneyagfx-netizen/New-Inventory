<?php
declare(strict_types=1);
// Route: /api/users/*  (owner-only)

$user = current_user();
require_owner($user);
$method = $_SERVER['REQUEST_METHOD'];
$id = $segments[1] ?? null;

if ($method === 'GET' && !$id) {
    $rows = db()->query('SELECT id, username, email, role, warehouse_ids, created FROM users ORDER BY username')->fetchAll();
    foreach ($rows as &$r) $r['warehouse_ids'] = json_decode($r['warehouse_ids'] ?: '[]', true) ?: [];
    json_response($rows);
}

if ($method === 'POST' && !$id) {
    $b = body_json();
    foreach (['username', 'password'] as $f) if (empty($b[$f])) abort(400, "$f required");

    $check = db()->prepare('SELECT id FROM users WHERE username = ?');
    $check->execute([$b['username']]);
    if ($check->fetch()) abort(400, 'Username taken');

    $doc = [
        'id' => new_id(),
        'username' => $b['username'],
        'email' => $b['email'] ?? '',
        'role' => $b['role'] ?? 'staff',
        'warehouse_ids' => $b['warehouse_ids'] ?? [],
    ];
    db()->prepare('INSERT INTO users (id, username, email, password_hash, role, warehouse_ids) VALUES (?,?,?,?,?,?)')
        ->execute([$doc['id'], $doc['username'], $doc['email'], hash_password($b['password']), $doc['role'], json_encode($doc['warehouse_ids'])]);
    json_response($doc);
}

if ($id && $method === 'PUT') {
    $b = body_json();
    $sets = [];
    $params = [];
    if (isset($b['email'])) { $sets[] = 'email = ?'; $params[] = $b['email']; }
    if (isset($b['role'])) { $sets[] = 'role = ?'; $params[] = $b['role']; }
    if (isset($b['warehouse_ids'])) { $sets[] = 'warehouse_ids = ?'; $params[] = json_encode($b['warehouse_ids']); }
    if (!empty($b['password'])) { $sets[] = 'password_hash = ?'; $params[] = hash_password($b['password']); }
    if ($sets) {
        $params[] = $id;
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }
    $row = db()->prepare('SELECT id, username, email, role, warehouse_ids, created FROM users WHERE id = ?');
    $row->execute([$id]);
    $out = $row->fetch();
    if ($out) $out['warehouse_ids'] = json_decode($out['warehouse_ids'] ?: '[]', true) ?: [];
    json_response($out ?: null);
}

if ($id && $method === 'DELETE') {
    if ($id === $user['id']) abort(400, 'Cannot delete yourself');
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
