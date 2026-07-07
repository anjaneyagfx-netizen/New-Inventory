<?php
declare(strict_types=1);
// Route: /api/inventory/*

$user = current_user();
$method = $_SERVER['REQUEST_METHOD'];
$id = $segments[1] ?? null;

// GET /api/inventory?warehouse_id=...
if ($method === 'GET' && !$id) {
    $wh = q('warehouse_id');
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $stmt = db()->prepare('SELECT i.id, i.name, i.category, i.warehouse_id, i.sheets, i.uMolding, i.lMolding, i.image, i.created, c.name AS category_name
                            FROM inventory_items i LEFT JOIN categories c ON c.id = i.category
                            WHERE i.warehouse_id = ? ORDER BY i.created DESC');
    $stmt->execute([$wh]);
    $rows = array_map(function ($r) {
        $r['category_name'] = $r['category_name'] ?: 'Uncategorized';
        return cast_numbers($r, [], ['sheets', 'uMolding', 'lMolding']);
    }, $stmt->fetchAll());
    json_response($rows);
}

// POST /api/inventory
if ($method === 'POST' && !$id) {
    // Special sub-route: /api/inventory/bulk (handled below)
    if (($segments[1] ?? '') === 'bulk') { /* handled below */ }
    else {
        require_edit($user);
        $b = body_json();
        foreach (['name', 'category', 'warehouse_id'] as $f) if (empty($b[$f])) abort(400, "$f required");
        if (!user_has_warehouse($user, $b['warehouse_id'])) abort(403, 'No access');

        $check = db()->prepare('SELECT id FROM inventory_items WHERE warehouse_id = ? AND name = ?');
        $check->execute([$b['warehouse_id'], $b['name']]);
        if ($check->fetch()) abort(400, 'Item with this name already exists');

        $doc = [
            'id' => new_id(),
            'name' => $b['name'],
            'category' => $b['category'],
            'warehouse_id' => $b['warehouse_id'],
            'sheets' => (float)($b['sheets'] ?? 0),
            'uMolding' => (float)($b['uMolding'] ?? 0),
            'lMolding' => (float)($b['lMolding'] ?? 0),
            'image' => $b['image'] ?? null,
            'created' => now_iso(),
        ];
        db()->prepare('INSERT INTO inventory_items (id, name, category, warehouse_id, sheets, uMolding, lMolding, image) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$doc['id'], $doc['name'], $doc['category'], $doc['warehouse_id'], $doc['sheets'], $doc['uMolding'], $doc['lMolding'], $doc['image']]);
        json_response($doc);
    }
}

// POST /api/inventory/bulk
if (($segments[1] ?? '') === 'bulk' && $method === 'POST') {
    require_edit($user);
    $b = body_json();
    $wh = $b['warehouse_id'] ?? '';
    if (!$wh) abort(400, 'warehouse_id required');
    if (!user_has_warehouse($user, $wh)) abort(403, 'No access');

    $items = $b['items'] ?? [];
    $autoCats = $b['auto_categories'] ?? [];

    // Build existing category map
    $stmt = db()->prepare('SELECT id, name FROM categories WHERE warehouse_id = ?');
    $stmt->execute([$wh]);
    $catMap = [];
    foreach ($stmt->fetchAll() as $c) $catMap[strtolower($c['name'])] = $c['id'];

    $createdCats = 0;
    foreach ($autoCats as $cn) {
        $key = strtolower($cn);
        if (isset($catMap[$key])) continue;
        $nid = new_id();
        db()->prepare('INSERT INTO categories (id, name, warehouse_id) VALUES (?,?,?)')->execute([$nid, $cn, $wh]);
        $catMap[$key] = $nid;
        $createdCats++;
    }

    $created = $updated = $failed = 0;
    $findByName = db()->prepare('SELECT id, sheets, uMolding, lMolding FROM inventory_items WHERE warehouse_id = ? AND name = ?');
    $upd = db()->prepare('UPDATE inventory_items SET sheets = ?, uMolding = ?, lMolding = ?, category = COALESCE(?, category) WHERE id = ?');
    $ins = db()->prepare('INSERT INTO inventory_items (id, name, category, warehouse_id, sheets, uMolding, lMolding) VALUES (?,?,?,?,?,?,?)');
    foreach ($items as $row) {
        try {
            $catId = $row['category_id'] ?? null;
            if (!$catId && !empty($row['category_name'])) {
                $catId = $catMap[strtolower($row['category_name'])] ?? null;
            }
            $findByName->execute([$wh, $row['name']]);
            $existing = $findByName->fetch();
            if ($existing) {
                $upd->execute([
                    (float)($row['sheets'] ?? $existing['sheets']),
                    (float)($row['uMolding'] ?? $existing['uMolding']),
                    (float)($row['lMolding'] ?? $existing['lMolding']),
                    $catId,
                    $existing['id'],
                ]);
                $updated++;
            } else {
                $ins->execute([
                    new_id(), $row['name'], $catId, $wh,
                    (float)($row['sheets'] ?? 0),
                    (float)($row['uMolding'] ?? 0),
                    (float)($row['lMolding'] ?? 0),
                ]);
                $created++;
            }
        } catch (Throwable $e) {
            error_log('Bulk upsert row failed: ' . $e->getMessage());
            $failed++;
        }
    }
    json_response(['created' => $created, 'updated' => $updated, 'failed' => $failed, 'auto_created_categories' => $createdCats]);
}

// PUT /api/inventory/{id}
if ($id && $method === 'PUT') {
    require_edit($user);
    $b = body_json();
    $allowed = ['name', 'category', 'sheets', 'uMolding', 'lMolding', 'image'];
    $sets = [];
    $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $b) && $b[$f] !== null) {
            $sets[] = "$f = ?";
            $params[] = in_array($f, ['sheets', 'uMolding', 'lMolding']) ? (float)$b[$f] : $b[$f];
        }
    }
    if (!$sets) abort(400, 'No fields to update');
    $params[] = $id;
    db()->prepare('UPDATE inventory_items SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    $row = db()->prepare('SELECT id, name, category, warehouse_id, sheets, uMolding, lMolding, image, created FROM inventory_items WHERE id = ?');
    $row->execute([$id]);
    json_response($row->fetch() ?: null);
}

// DELETE /api/inventory/{id}
if ($id && $method === 'DELETE') {
    require_edit($user);
    db()->prepare('DELETE FROM sales WHERE itemId = ?')->execute([$id]);
    db()->prepare('DELETE FROM purchases WHERE itemId = ?')->execute([$id]);
    db()->prepare('DELETE FROM inventory_items WHERE id = ?')->execute([$id]);
    json_response(['deleted' => true]);
}

abort(404, 'Not found');
