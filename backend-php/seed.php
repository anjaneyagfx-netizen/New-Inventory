<?php
declare(strict_types=1);
// Seed script: creates admin user, warehouses, categories, sample inventory.
// Run once: `php seed.php`

require __DIR__ . '/vendor/autoload.php';
if (file_exists(__DIR__ . '/.env')) {
    Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();
    foreach ($_ENV as $k => $v) if (getenv($k) === false) putenv("$k=$v");
}
require __DIR__ . '/config/db.php';
require __DIR__ . '/src/helpers.php';

$pdo = db();

// Apply schema (idempotent)
$schema = file_get_contents(__DIR__ . '/schema.sql');
foreach (array_filter(array_map('trim', explode(';', $schema))) as $stmt) {
    if ($stmt !== '') $pdo->exec($stmt);
}

$existing = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
if ($existing > 0) {
    fwrite(STDOUT, "[seed] users already present, skipping.\n");
    exit(0);
}

$wh1 = new_id();
$wh2 = new_id();
$pdo->prepare('INSERT INTO warehouses (id, name, location) VALUES (?,?,?)')->execute([$wh1, 'Main Warehouse', 'Mumbai']);
$pdo->prepare('INSERT INTO warehouses (id, name, location) VALUES (?,?,?)')->execute([$wh2, 'Secondary Depot', 'Delhi']);

$admin = new_id();
$pdo->prepare('INSERT INTO users (id, username, email, password_hash, role, warehouse_ids) VALUES (?,?,?,?,?,?)')
    ->execute([$admin, 'admin', 'admin@stockflow.local', hash_password('admin123'), 'owner', json_encode([$wh1, $wh2])]);

$cats = [];
foreach (['Aluminum', 'Steel', 'Plastic', 'Composite'] as $n) {
    $id = new_id();
    $cats[] = ['id' => $id, 'name' => $n, 'wh' => $wh1];
    $pdo->prepare('INSERT INTO categories (id, name, warehouse_id) VALUES (?,?,?)')->execute([$id, $n, $wh1]);
}
foreach (['Rubber', 'Foam'] as $n) {
    $id = new_id();
    $cats[] = ['id' => $id, 'name' => $n, 'wh' => $wh2];
    $pdo->prepare('INSERT INTO categories (id, name, warehouse_id) VALUES (?,?,?)')->execute([$id, $n, $wh2]);
}

$samples = [
    ['AL-1024', 0], ['AL-1025', 0], ['ST-2010', 1], ['ST-2011', 1],
    ['PL-3009', 2], ['CM-4001', 3],
];
$ins = $pdo->prepare('INSERT INTO inventory_items (id, name, category, warehouse_id, sheets, uMolding, lMolding) VALUES (?,?,?,?,?,?,?)');
foreach ($samples as $i => [$name, $ci]) {
    $ins->execute([new_id(), $name, $cats[$ci]['id'], $wh1, 50 + $i * 12, 30 + $i * 8, 25 + $i * 5]);
}
// One low-stock item
$ins->execute([new_id(), 'AL-9999', $cats[0]['id'], $wh1, 4, 6, 2]);
// Item in secondary warehouse
$secondaryCat = array_values(array_filter($cats, fn($c) => $c['wh'] === $wh2))[0]['id'];
$ins->execute([new_id(), 'RB-500', $secondaryCat, $wh2, 120, 80, 60]);

fwrite(STDOUT, "[seed] Done. Login with admin / admin123\n");
