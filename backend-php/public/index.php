<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

// Load .env if present
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
    foreach ($_ENV as $k => $v) if (getenv($k) === false) putenv("$k=$v");
}

require __DIR__ . '/../config/db.php';

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

// Ensure /api prefix (Kubernetes-style ingress mirrors the Python setup)
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
if (!str_starts_with($uri, '/api')) json_response(['error' => 'Not found'], 404);

$segments = path_segments();
$root = $segments[0] ?? '';

try {
    switch ($root) {
        case '':            json_response(['message' => 'StockFlow API']); break;
        case 'auth':        require __DIR__ . '/../src/auth.php'; break;
        case 'warehouses':  require __DIR__ . '/../src/warehouses.php'; break;
        case 'categories':  require __DIR__ . '/../src/categories.php'; break;
        case 'inventory':   require __DIR__ . '/../src/inventory.php'; break;
        case 'sales':       require __DIR__ . '/../src/sales.php'; break;
        case 'purchases':   require __DIR__ . '/../src/purchases.php'; break;
        case 'dashboard':   require __DIR__ . '/../src/dashboard.php'; break;
        case 'users':       require __DIR__ . '/../src/users.php'; break;
        default:            json_response(['error' => 'Not found'], 404);
    }
} catch (Throwable $e) {
    error_log('[stockflow] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $code = $e->getCode();
    $status = ($code >= 400 && $code < 600) ? $code : 500;
    json_response(['error' => $e->getMessage()], $status);
}
