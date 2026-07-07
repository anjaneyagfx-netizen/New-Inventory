<?php
declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/** Send JSON response and terminate. */
function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Abort with a JSON error and HTTP status. */
function abort(int $status, string $detail): void {
    json_response(['detail' => $detail], $status);
}

/** Parse JSON body into an associative array. */
function body_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) abort(400, 'Invalid JSON body');
    return $data;
}

/** 15-char hex id (matches Python new_id). */
function new_id(): string {
    return substr(bin2hex(random_bytes(16)), 0, 15);
}

/** ISO-8601 UTC now string. */
function now_iso(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s.uP');
}

/** Hash a password with a strong algorithm (bcrypt). */
function hash_password(string $plain): string {
    return password_hash($plain, PASSWORD_BCRYPT);
}

/** Verify a plain password against a stored hash. */
function verify_password(string $plain, string $hash): bool {
    return password_verify($plain, $hash);
}

/** Encode a JWT for the given user id. */
function make_token(string $userId): string {
    $payload = [
        'sub' => $userId,
        'iat' => time(),
        'exp' => time() + jwt_ttl_hours() * 3600,
    ];
    return JWT::encode($payload, jwt_secret(), 'HS256');
}

/** Extract and validate the Authorization: Bearer token; return current user row or abort 401. */
function current_user(): array {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$hdr && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', $hdr, $m)) abort(401, 'Not authenticated');
    $token = $m[1];
    try {
        $payload = JWT::decode($token, new Key(jwt_secret(), 'HS256'));
    } catch (Throwable $e) {
        abort(401, 'Invalid token');
    }
    $stmt = db()->prepare('SELECT id, username, email, role, warehouse_ids FROM users WHERE id = ?');
    $stmt->execute([$payload->sub]);
    $user = $stmt->fetch();
    if (!$user) abort(401, 'User not found');
    $user['warehouse_ids'] = json_decode($user['warehouse_ids'] ?: '[]', true) ?: [];
    return $user;
}

/** Enforce that the user can edit data (owner or manager). */
function require_edit(array $user): void {
    if (!in_array($user['role'], ['owner', 'manager'], true)) abort(403, 'Insufficient permissions');
}

/** Enforce that the user is an owner. */
function require_owner(array $user): void {
    if ($user['role'] !== 'owner') abort(403, 'Only owner allowed');
}

/** Return true if the user has access to the given warehouse. */
function user_has_warehouse(array $user, string $warehouseId): bool {
    if ($user['role'] === 'owner') return true;
    return in_array($warehouseId, $user['warehouse_ids'] ?? [], true);
}

/** Coerce numeric-like MySQL columns to proper numbers in a row. */
function cast_numbers(array $row, array $intFields = [], array $floatFields = []): array {
    foreach ($intFields as $f) if (isset($row[$f])) $row[$f] = (int)$row[$f];
    foreach ($floatFields as $f) if (isset($row[$f])) $row[$f] = (float)$row[$f];
    return $row;
}

/** Get an in-order list of the current path segments after /api. */
function path_segments(): array {
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    if (str_starts_with($uri, '/api')) $uri = substr($uri, 4);
    return array_values(array_filter(explode('/', $uri), fn($s) => $s !== ''));
}

/** Get a query parameter or null. */
function q(string $key): ?string {
    return isset($_GET[$key]) ? (string)$_GET[$key] : null;
}
