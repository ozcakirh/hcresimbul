<?php
// Resim Bul - genel sayaç API'si (PHP 7.4+, IIS/Apache)
//   GET  api.php                  -> sayaçları verir
//   POST api.php?action=start     -> StartCount +1
//   POST api.php?action=complete  -> EndCount +1
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const DATA_FILE = __DIR__ . '/data/counter.json';
const RATE_FILE = __DIR__ . '/data/rate.json';
const RATE_LIMIT = 12;   // IP başına
const RATE_WINDOW = 60;  // saniye

function out($data, $code = 200) { http_response_code($code); echo json_encode($data); exit; }
function now() { return gmdate('Y-m-d\TH:i:s\Z'); }

$dir = dirname(DATA_FILE);
if (!is_dir($dir)) @mkdir($dir, 0755, true);
$fp = @fopen(DATA_FILE, 'c+');
if (!$fp) out(['error' => 'storage'], 500);

$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
flock($fp, $isPost ? LOCK_EX : LOCK_SH);

rewind($fp);
$raw = trim((string) stream_get_contents($fp));
if ($raw === '') {
  $data = ['StartCount' => 0, 'StartUpdatedAt' => null, 'EndCount' => 0, 'EndUpdatedAt' => null];
} else {
  $data = json_decode($raw, true);
  if (!is_array($data)) { flock($fp, LOCK_UN); out(['error' => 'corrupt'], 500); } // sıfırlamak yerine hata ver
}

if ($isPost) {
  $action = $_GET['action'] ?? '';
  if (!in_array($action, ['start', 'complete'], true)) { flock($fp, LOCK_UN); out(['error' => 'bad_action'], 400); }

  // Basit IP hız sınırı
  $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'x');
  $rate = is_file(RATE_FILE) ? (json_decode((string) file_get_contents(RATE_FILE), true) ?: []) : [];
  $t = time();
  foreach ($rate as $k => $list) {
    $rate[$k] = array_values(array_filter($list, fn($x) => $x > $t - RATE_WINDOW));
    if (!$rate[$k]) unset($rate[$k]);
  }
  if (count($rate[$ip] ?? []) >= RATE_LIMIT) { flock($fp, LOCK_UN); out(['error' => 'rate_limited'], 429); }

  if ($action === 'complete' && ($data['EndCount'] ?? 0) >= ($data['StartCount'] ?? 0)) {
    flock($fp, LOCK_UN); out(['error' => 'invalid'], 409); // biten sayısı başlayandan fazla olamaz
  }
  $rate[$ip][] = $t;
  @file_put_contents(RATE_FILE, json_encode($rate), LOCK_EX);

  if ($action === 'start') { $data['StartCount'] = ($data['StartCount'] ?? 0) + 1; $data['StartUpdatedAt'] = now(); }
  else { $data['EndCount'] = ($data['EndCount'] ?? 0) + 1; $data['EndUpdatedAt'] = now(); }

  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($data, JSON_PRETTY_PRINT)); fflush($fp);
}

flock($fp, LOCK_UN); fclose($fp);
out($data);
