<?php
declare(strict_types=1);
// Route: /api/auth/*

$sub = $segments[1] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($sub === 'login' && $method === 'POST') {
    $body = body_json();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if (!$username || !$password) abort(400, 'username and password required');

    $stmt = db()->prepare('SELECT id, username, email, role, warehouse_ids, password_hash FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $u = $stmt->fetch();
    if (!$u || !verify_password($password, $u['password_hash'])) abort(401, 'Invalid credentials');

    $token = make_token($u['id']);
    json_response([
        'token' => $token,
        'user' => [
            'id' => $u['id'],
            'username' => $u['username'],
            'email' => $u['email'],
            'role' => $u['role'],
            'warehouse_ids' => json_decode($u['warehouse_ids'] ?: '[]', true) ?: [],
        ],
    ]);
}

if ($sub === 'me' && $method === 'GET') {
    $user = current_user();
    json_response($user);
}

abort(404, 'Not found');
