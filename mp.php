<?php
// Resim Bul v2 - iki kişilik oyun API'si (PHP 7.4+). Tahta sunucuda saklanır, istemci sadece açılan kartı görür.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const ROOM_DIR = __DIR__ . '/data/rooms/';
const COUNTER_FILE = __DIR__ . '/data/counter.json';
const RATE_FILE = __DIR__ . '/data/mprate.json';
const TURN_SECONDS = 20;     // hamle süresi
const PREVIEW_SECONDS = 4;   // ezber süresi (3 sn + bağlantı payı)
const MISS_SECONDS = 1.5;    // yanlış eşleşme açık kalma süresi
const AWAY_SECONDS = 45;     // bu kadar sessiz kalan oyuncu ayrılmış sayılır
const WAIT_SECONDS = 600;    // rakip bekleyen oda ömrü

function out($d, $code = 200) { http_response_code($code); echo json_encode($d); exit; }
function fail($code, $err) { out(['error' => $err], $code); }
function opp($s) { return $s === 'p1' ? 'p2' : 'p1'; }

function rateCheck($key, $limit) {
  $fp = @fopen(RATE_FILE, 'c+'); if (!$fp) return true;
  flock($fp, LOCK_EX); rewind($fp);
  $map = json_decode(trim((string) stream_get_contents($fp)), true) ?: [];
  $t = time(); $k = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . $key);
  foreach ($map as $kk => $l) { $map[$kk] = array_values(array_filter($l, fn($x) => $x > $t - 60)); if (!$map[$kk]) unset($map[$kk]); }
  $ok = count($map[$k] ?? []) < $limit;
  if ($ok) $map[$k][] = $t;
  ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($map)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
  return $ok;
}
function bump($countKey, $timeKey) {
  $fp = @fopen(COUNTER_FILE, 'c+'); if (!$fp) return;
  flock($fp, LOCK_EX); rewind($fp);
  $d = json_decode(trim((string) stream_get_contents($fp)), true);
  if (is_array($d)) {
    $d[$countKey] = ($d[$countKey] ?? 0) + 1; $d[$timeKey] = gmdate('Y-m-d\TH:i:s\Z');
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($d, JSON_PRETTY_PRINT)); fflush($fp);
  }
  flock($fp, LOCK_UN); fclose($fp);
}
function addEvent(&$r, $type, $seat = null) {
  $r['seq']++; $r['evs'][] = ['seq' => $r['seq'], 'type' => $type, 'seat' => $seat];
  $r['evs'] = array_slice($r['evs'], -6);
}
function dealt() { $d = array_merge(range(0, 17), range(0, 17)); shuffle($d); return $d; }
function startGame(&$r, $now) {
  $r['deck'] = dealt(); $r['m'] = array_fill(0, 36, null); $r['open'] = [];
  $r['scores'] = ['p1' => 0, 'p2' => 0]; $r['phase'] = 'preview'; $r['previewUntil'] = $now + PREVIEW_SECONDS;
  $r['turn'] = random_int(0, 1) ? 'p1' : 'p2'; $r['turnUntil'] = 0; $r['resolveAt'] = 0;
  $r['winner'] = null; $r['reason'] = null; $r['rematch'] = ['p1' => false, 'p2' => false];
  addEvent($r, 'start'); bump('MultiStartCount', 'MultiStartUpdatedAt');
}
function finish(&$r, $winner, $reason) {
  if ($r['phase'] === 'finished') return;
  $r['phase'] = 'finished'; $r['winner'] = $winner; $r['reason'] = $reason; $r['open'] = []; $r['resolveAt'] = 0;
  addEvent($r, 'end');
  if ($reason === 'done') bump('MultiEndCount', 'MultiEndUpdatedAt');
}
function advance(&$r, $now) {
  if ($r['phase'] === 'waiting' && $now - $r['created'] > WAIT_SECONDS) $r['phase'] = 'closed';
  if ($r['phase'] === 'preview' && $now >= $r['previewUntil']) { $r['phase'] = 'play'; $r['turnUntil'] = $now + TURN_SECONDS; }
  if ($r['phase'] !== 'play' && $r['phase'] !== 'preview') return;
  foreach (['p1', 'p2'] as $s) if ($now - $r['players'][$s]['seen'] > AWAY_SECONDS) { finish($r, opp($s), 'left'); return; }
  if ($r['phase'] !== 'play') return;
  if ($r['resolveAt'] > 0 && $now >= $r['resolveAt']) {
    $r['open'] = []; $r['resolveAt'] = 0; $r['turn'] = opp($r['turn']); $r['turnUntil'] = $now + TURN_SECONDS; addEvent($r, 'turn');
  } elseif ($r['resolveAt'] == 0 && $now >= $r['turnUntil']) {
    $r['open'] = []; $r['turn'] = opp($r['turn']); $r['turnUntil'] = $now + TURN_SECONDS; addEvent($r, 'timeout');
  }
}
function view($r, $seat, $now) {
  $cards = []; $pv = $r['phase'] === 'preview';
  for ($i = 0; $i < 36; $i++) {
    if (!$r['deck']) $cards[] = ['s' => 'c'];
    elseif ($pv) $cards[] = ['s' => 'o', 'p' => $r['deck'][$i]];
    elseif ($r['m'][$i] !== null) $cards[] = ['s' => 'm', 'p' => $r['deck'][$i], 'o' => $r['m'][$i]];
    elseif (in_array($i, $r['open'], true)) $cards[] = ['s' => 'o', 'p' => $r['deck'][$i]];
    else $cards[] = ['s' => 'c'];
  }
  $o = $seat ? opp($seat) : null;
  return [
    'code' => $r['code'], 'phase' => $r['phase'], 'seat' => $seat, 'turn' => $r['turn'], 'scores' => $r['scores'], 'cards' => $cards,
    'turnLeft' => $r['phase'] === 'play' ? max(0, (int) ceil($r['turnUntil'] - $now)) : 0,
    'previewLeft' => $pv ? max(0, (int) ceil($r['previewUntil'] - $now)) : 0,
    'resolving' => $r['resolveAt'] > 0, 'winner' => $r['winner'], 'reason' => $r['reason'],
    'rematch' => ['me' => $seat ? $r['rematch'][$seat] : false, 'opp' => $o ? $r['rematch'][$o] : false],
    'evs' => $r['evs'],
  ];
}
function withRoom($code, $fn) {
  if (!preg_match('/^\d{4}$/', (string) $code)) fail(404, 'no_room');
  $path = ROOM_DIR . $code . '.json';
  if (!is_file($path)) fail(404, 'no_room');
  $fp = fopen($path, 'c+'); flock($fp, LOCK_EX); rewind($fp);
  $room = json_decode((string) stream_get_contents($fp), true);
  if (!is_array($room)) fail(404, 'no_room');
  $res = $fn($room);
  ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($room)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
  out($res);
}
function seatOf($r, $token) {
  foreach (['p1', 'p2'] as $s) if ($r['players'][$s] && hash_equals($r['players'][$s]['token'], (string) $token)) return $s;
  fail(403, 'bad_token');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'post_only');
$in = json_decode((string) file_get_contents('php://input'), true) ?: [];
$action = $in['action'] ?? ''; $code = (string) ($in['code'] ?? ''); $token = $in['token'] ?? '';
$now = microtime(true);
if (!is_dir(ROOM_DIR)) @mkdir(ROOM_DIR, 0755, true);

if ($action === 'create') {
  if (!rateCheck('create', 6)) fail(429, 'rate_limited');
  foreach (glob(ROOM_DIR . '*.json') ?: [] as $f) if (filemtime($f) < time() - 1800) @unlink($f);
  for ($i = 0; $i < 60; $i++) {
    $c = (string) random_int(1000, 9999);
    $fp = @fopen(ROOM_DIR . $c . '.json', 'x'); // atomik: aynı kod ikinci kez oluşmaz
    if (!$fp) continue;
    $tok = bin2hex(random_bytes(16));
    $room = ['code' => $c, 'created' => $now, 'phase' => 'waiting', 'players' => ['p1' => ['token' => $tok, 'seen' => $now], 'p2' => null],
      'deck' => [], 'm' => [], 'open' => [], 'turn' => null, 'scores' => ['p1' => 0, 'p2' => 0], 'previewUntil' => 0, 'turnUntil' => 0,
      'resolveAt' => 0, 'seq' => 0, 'evs' => [], 'winner' => null, 'reason' => null, 'rematch' => ['p1' => false, 'p2' => false]];
    fwrite($fp, json_encode($room)); fclose($fp);
    out(array_merge(view($room, 'p1', $now), ['token' => $tok]));
  }
  fail(503, 'no_code');
}
if ($action === 'join') {
  if (!rateCheck('join', 15)) fail(429, 'rate_limited');
  withRoom($code, function (&$r) use ($now) {
    if ($r['phase'] !== 'waiting' || $r['players']['p2'] || $now - $r['players']['p1']['seen'] > AWAY_SECONDS) fail(409, 'full');
    $tok = bin2hex(random_bytes(16)); $r['players']['p2'] = ['token' => $tok, 'seen' => $now];
    startGame($r, $now);
    return array_merge(view($r, 'p2', $now), ['token' => $tok]);
  });
}
withRoom($code, function (&$r) use ($action, $in, $token, $now) {
  $seat = seatOf($r, $token); $r['players'][$seat]['seen'] = $now; advance($r, $now);
  if ($action === 'flip') {
    $i = (int) ($in['index'] ?? -1);
    if ($r['phase'] === 'play' && $r['turn'] === $seat && $r['resolveAt'] == 0 && $i >= 0 && $i < 36 && $r['m'][$i] === null && !in_array($i, $r['open'], true)) {
      $r['open'][] = $i; addEvent($r, 'flip', $seat);
      if (count($r['open']) === 2) {
        [$a, $b] = $r['open'];
        if ($r['deck'][$a] === $r['deck'][$b]) {
          $r['m'][$a] = $r['m'][$b] = $seat; $r['scores'][$seat]++; $r['open'] = []; $r['turnUntil'] = $now + TURN_SECONDS; addEvent($r, 'match', $seat);
          if ($r['scores']['p1'] + $r['scores']['p2'] === 18) {
            $p1 = $r['scores']['p1']; $p2 = $r['scores']['p2'];
            finish($r, $p1 === $p2 ? 'draw' : ($p1 > $p2 ? 'p1' : 'p2'), 'done');
          }
        } else { $r['resolveAt'] = $now + MISS_SECONDS; addEvent($r, 'miss', $seat); }
      }
    }
  } elseif ($action === 'leave') {
    if ($r['phase'] === 'waiting') $r['phase'] = 'closed';
    elseif ($r['phase'] === 'preview' || $r['phase'] === 'play') finish($r, opp($seat), 'left');
  } elseif ($action === 'rematch') {
    if ($r['phase'] === 'finished' && $r['reason'] === 'done') {
      $r['rematch'][$seat] = true;
      if ($r['rematch']['p1'] && $r['rematch']['p2']) startGame($r, $now);
    }
  }
  return view($r, $seat, $now);
});
