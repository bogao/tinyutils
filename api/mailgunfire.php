<?php
/**
 * mailgunfire.php
 *
 * GET  /api/mailgunfire  → render the compose UI
 * POST /api/mailgunfire  → send email via Mailgun SMTP, return JSON result
 *
 * Config: api/config.json  (key "mailgunfire")
 *   {
 *     "mailgunfire": {
 *       "domain":   "example.com",
 *       "login":    "noreply",
 *       "password": "",        // leave empty; set MAILGUNFIRE_PASSWORD env var instead
 *       "method":   "tls",    // "tls" (port 587) or "ssl" (port 465)
 *       "display":  "No Reply",
 *       "eu":       true       // true = smtp.eu.mailgun.org
 *     }
 *   }
 */

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * RFC 2047 encoded-word encoding for mail headers.
 * Splits text into ≤45-byte UTF-8 chunks so each encoded word stays under
 * the RFC 2047 limit of 75 characters:
 *   =?UTF-8?B? (10) + base64(45 bytes)=60 chars + ?= (2) = 72 chars ✓
 */
function encode_mime_header_value(string $str): string {
    if (!preg_match('/[^\x09\x20-\x7E]/', $str)) return $str; // pure ASCII — no encoding
    $parts = [];
    while ($str !== '') {
        $chunk = '';
        foreach (preg_split('//u', $str, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
            if (strlen($chunk . $ch) > 45) break;
            $chunk .= $ch;
        }
        if ($chunk === '') $chunk = mb_substr($str, 0, 1, 'UTF-8'); // safety: always advance
        $parts[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
        $str = substr($str, strlen($chunk));
    }
    return implode("\r\n ", $parts); // RFC 2047 folding
}

function load_config(): array {
    $path = __DIR__ . '/config.json';
    if (!file_exists($path)) {
        http_response_code(500);
        die(json_encode(['ok' => false, 'error' => 'config.json not found']));
    }
    $all = json_decode(file_get_contents($path), true);
    if (!isset($all['mailgunfire'])) {
        http_response_code(500);
        die(json_encode(['ok' => false, 'error' => '"mailgunfire" key missing in config.json']));
    }
    $cfg = $all['mailgunfire'];

    $env_domain = getenv('MAILGUNFIRE_DOMAIN');
    $env_login = getenv('MAILGUNFIRE_LOGIN');
    $env_display = getenv('MAILGUNFIRE_DISPLAY');
    $env_password = getenv('MAILGUNFIRE_PASSWORD');

    if ($env_domain !== false && $env_domain !== '') $cfg['domain'] = $env_domain;
    if ($env_login !== false && $env_login !== '') $cfg['login'] = $env_login;
    if ($env_display !== false) $cfg['display'] = $env_display;
    if ($env_password !== false && $env_password !== '') $cfg['password'] = $env_password;

    foreach (['domain', 'login', 'password', 'method'] as $k) {
        if (empty($cfg[$k])) {
            http_response_code(500);
            die(json_encode(['ok' => false, 'error' => "Missing \"$k\" in mailgunfire config"]));
        }
    }
    $cfg['method'] = strtolower($cfg['method']);
    if (!in_array($cfg['method'], ['tls', 'ssl'], true)) {
        http_response_code(500);
        die(json_encode(['ok' => false, 'error' => '"method" must be "tls" or "ssl"']));
    }
    return $cfg;
}

function markdown_to_html(string $md): string {
    // ── 1. Extract fenced code blocks before HTML-escaping ─────────────────
    $code_blocks = [];
    $md = preg_replace_callback(
        '/^```(\w*)\r?\n([\s\S]*?)^```\r?$/m',
        function ($m) use (&$code_blocks) {
            $idx = count($code_blocks);
            $attr = $m[1] ? ' class="language-' . htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8') . '"' : '';
            $code_blocks[] = '<pre><code' . $attr . '>'
                . htmlspecialchars($m[2], ENT_NOQUOTES, 'UTF-8')
                . '</code></pre>';
            return "\x00CB{$idx}\x00";
        },
        $md
    );

    // ── 2. HTML-escape the rest ─────────────────────────────────────────────
    $h = htmlspecialchars($md, ENT_NOQUOTES, 'UTF-8');

    // ── 3. Headings ────────────────────────────────────────────────────────
    for ($n = 6; $n >= 1; $n--) {
        $h = preg_replace('/^' . str_repeat('#', $n) . ' (.+)$/m', "<h{$n}>$1</h{$n}>", $h);
    }

    // ── 4. Inline markup ───────────────────────────────────────────────────
    $h = preg_replace('/\*\*\*(.+?)\*\*\*/', '<strong><em>$1</em></strong>', $h);
    $h = preg_replace('/\*\*(.+?)\*\*/',     '<strong>$1</strong>',          $h);
    $h = preg_replace('/\*(.+?)\*/',         '<em>$1</em>',                  $h);
    $h = preg_replace('/`(.+?)`/',           '<code>$1</code>',              $h);
    $h = preg_replace('/\[(.+?)\]\((.+?)\)/', '<a href="$2">$1</a>',        $h);

    // ── 5. Thematic break ──────────────────────────────────────────────────
    $h = preg_replace('/^---+$/m', '<hr>', $h);

    // ── 6. Blockquotes ─────────────────────────────────────────────────────
    $h = preg_replace('/^&gt; (.+)$/m', '<blockquote>$1</blockquote>', $h);

    // ── 7. Lists — mark items then group consecutive lines ─────────────────
    $h = preg_replace('/^[ \t]*[*\-] (.+)$/m',    '<li>$1</li>',       $h);
    $h = preg_replace('/^[ \t]*\d+\.\s+(.+)$/m',  '<li_ol>$1</li_ol>', $h);

    $lines = explode("\n", $h);
    $out_lines = [];
    $in_ul = false;
    $in_ol = false;
    foreach ($lines as $line) {
        if (str_starts_with($line, '<li>')) {
            if (!$in_ul) { $out_lines[] = '<ul>'; $in_ul = true; }
            $out_lines[] = $line;
        } elseif (str_starts_with($line, '<li_ol>')) {
            if (!$in_ol) { $out_lines[] = '<ol>'; $in_ol = true; }
            $out_lines[] = '<li>' . substr($line, 7, -8) . '</li>';
        } else {
            if ($in_ul) { $out_lines[] = '</ul>'; $in_ul = false; }
            if ($in_ol) { $out_lines[] = '</ol>'; $in_ol = false; }
            $out_lines[] = $line;
        }
    }
    if ($in_ul) $out_lines[] = '</ul>';
    if ($in_ol) $out_lines[] = '</ol>';
    $h = implode("\n", $out_lines);

    // ── 8. Build paragraph blocks ──────────────────────────────────────────
    $blocks = preg_split('/\n{2,}/', trim($h));
    $parts  = [];
    foreach ($blocks as $block) {
        $block = trim($block);
        if ($block === '') continue;
        if (preg_match('/^\x00CB\d+\x00$/', $block)) {
            $parts[] = $block; // code block placeholder — restored below
        } elseif (preg_match('/^<(h[1-6]|ul|ol|blockquote|hr|pre)/', $block)) {
            $parts[] = $block;
        } else {
            $parts[] = '<p>' . nl2br($block) . '</p>';
        }
    }
    $result = implode("\n", $parts);

    // ── 9. Restore code blocks ─────────────────────────────────────────────
    foreach ($code_blocks as $idx => $cb) {
        $result = str_replace("\x00CB{$idx}\x00", $cb, $result);
    }
    return $result;
}

function format_address_list(array $addrs): string {
    return implode(', ', array_filter(array_map('trim', $addrs)));
}

function send_email(array $cfg, string $sender, string $display, array $to, array $cc, array $bcc, string $subject, string $md_body, array $attachments = []): void {
    $smtp_host  = !empty($cfg['eu']) ? 'smtp.eu.mailgun.org' : 'smtp.mailgun.org';
    $port       = $cfg['method'] === 'ssl' ? 465 : 587;
    $from_email = $sender . '@' . $cfg['domain'];
    $smtp_user  = $cfg['login'] . '@' . $cfg['domain'];
    $html_body  = markdown_to_html($md_body);
    $boundary   = '----=_Part_' . md5(uniqid('', true));

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
    $from_addr = $display
        ? encode_mime_header_value($display) . " <$from_email>"
        : $from_email;
    $headers .= "From: $from_addr\r\n";
    $headers .= "To: " . format_address_list($to) . "\r\n";
    if (!empty($cc)) $headers .= "Cc: " . format_address_list($cc) . "\r\n";
    $headers .= "Subject: " . encode_mime_header_value($subject) . "\r\n";

    $alt_boundary = 'alt_' . $boundary;

    $body  = "--$boundary\r\n";
    $body .= "Content-Type: multipart/alternative; boundary=\"$alt_boundary\"\r\n";
    $body .= "\r\n";  // blank line: required separator between part-headers and part-body

    $body .= "--$alt_boundary\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($md_body)) . "\r\n";
    $body .= "--$alt_boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($html_body)) . "\r\n";
    $body .= "--$alt_boundary--\r\n";

    foreach ($attachments as $att) {
        $filename = $att['filename'] ?? 'attachment';
        $content  = $att['content'];
        $mime     = $att['mime'] ?? 'application/octet-stream';
        $body .= "--$boundary\r\n";
        // RFC 2231 / RFC 5987: encode non-ASCII filenames
        if (preg_match('/[^\x20-\x7E]/', $filename)) {
            $ascii_name = preg_replace('/[^\x20-\x7E]/', '_', $filename);
            $encoded    = rawurlencode($filename);
            $name_hdr   = '"' . $ascii_name . '"; name*=UTF-8\'\'' . $encoded;
            $disp_hdr   = '"' . $ascii_name . '"; filename*=UTF-8\'\'' . $encoded;
        } else {
            $q          = str_replace(['"', '\\'], ['\\"', '\\\\'], $filename);
            $name_hdr   = '"' . $q . '"';
            $disp_hdr   = '"' . $q . '"';
        }
        $body .= "Content-Type: $mime; name=$name_hdr\r\n";
        $body .= "Content-Disposition: attachment; filename=$disp_hdr\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split($content) . "\r\n";
    }
    $body .= "--$boundary--";

    $all_recipients = array_merge($to, $cc, $bcc);
    $errno = 0; $errstr = '';
    $socket = $cfg['method'] === 'ssl'
        ? fsockopen("ssl://$smtp_host", $port, $errno, $errstr, 15)
        : fsockopen($smtp_host, $port, $errno, $errstr, 15);
    if (!$socket) throw new RuntimeException("Cannot connect to $smtp_host:$port — $errstr ($errno)");

    $read  = function() use ($socket): string {
        $resp = '';
        while (!feof($socket)) { $line = fgets($socket, 512); $resp .= $line; if (strlen($line) >= 4 && $line[3] === ' ') break; }
        return $resp;
    };
    $write = function(string $cmd) use ($socket): void { fwrite($socket, $cmd . "\r\n"); };

    $read(); $write("EHLO localhost"); $read();
    if ($cfg['method'] === 'tls') {
        $write("STARTTLS"); $read();
        stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $write("EHLO localhost"); $read();
    }
    $write("AUTH LOGIN"); $read();
    $write(base64_encode($smtp_user)); $read();
    $write(base64_encode($cfg['password']));
    $auth_resp = $read();
    if (strpos($auth_resp, '235') === false) { fclose($socket); throw new RuntimeException("SMTP auth failed: $auth_resp"); }

    $write("MAIL FROM:<$from_email>"); $read();
    foreach ($all_recipients as $addr) { $addr = trim($addr); if ($addr !== '') { $write("RCPT TO:<$addr>"); $read(); } }
    $write("DATA"); $read();
    fwrite($socket, $headers . "\r\n" . $body . "\r\n.\r\n");
    $data_resp = $read();
    if (strpos($data_resp, '250') === false) { fclose($socket); throw new RuntimeException("SMTP DATA error: $data_resp"); }
    $write("QUIT"); fclose($socket);
}

// ── routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    $cfg   = load_config();
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $sender  = trim($input['sender']  ?? $cfg['login']);
    $display = trim($input['display'] ?? ($cfg['display'] ?? ''));
    $subject = trim($input['subject'] ?? '');
    $body    = trim($input['body']    ?? '');

    $norm = function($val): array {
        if (is_array($val)) return array_values(array_filter(array_map('trim', $val)));
        if (is_string($val) && $val !== '') return array_values(array_filter(array_map('trim', explode(',', $val))));
        return [];
    };
    $to  = $norm($input['to']  ?? ($input['recipient'] ?? []));
    $cc  = $norm($input['cc']  ?? []);
    $bcc = $norm($input['bcc'] ?? []);

    $attachments = [];
    if (!empty($input['attachments']) && is_array($input['attachments'])) {
        $max_size = 3 * 1024 * 1024;
        foreach ($input['attachments'] as $att) {
            if (!isset($att['content'], $att['filename'])) continue;
            $decoded = base64_decode($att['content'], true);
            if ($decoded === false) continue;
            if (strlen($decoded) > $max_size) continue;
            $attachments[] = [
                'filename' => substr($att['filename'], 0, 200),
                'content' => base64_encode($decoded),
                'mime' => $att['mime'] ?? 'application/octet-stream'
            ];
        }
    }

    $errors = [];
    if (empty($to))      $errors[] = 'At least one To recipient is required.';
    if ($subject === '') $errors[] = 'Subject is required.';
    if ($body    === '') $errors[] = 'Body cannot be empty.';
    if ($sender  === '') $sender = $cfg['login'];
    if ($errors) { http_response_code(400); echo json_encode(['ok' => false, 'error' => implode(' ', $errors)]); exit; }

    try {
        send_email($cfg, $sender, $display, $to, $cc, $bcc, $subject, $body, $attachments);
        $att_msg = $attachments ? ' with ' . count($attachments) . ' attachment(s)' : '';
        echo json_encode(['ok' => true, 'message' => "Email sent: {$sender}@{$cfg['domain']} → " . implode(', ', $to) . $att_msg]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ── GET: render UI ────────────────────────────────────────────────────────────
$cfg            = load_config();
$default_sender  = htmlspecialchars($cfg['login'],         ENT_QUOTES);
$default_display = htmlspecialchars($cfg['display'] ?? '', ENT_QUOTES);
$domain          = htmlspecialchars($cfg['domain'],         ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mailgun Fire</title>
<link rel="icon" type="image/svg+xml" href="mailgunfire.svg">
<style>
/* ── Reset & Base ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #f4f6f9;
  --surface:     #ffffff;
  --surface2:    #f8fafc;
  --surface3:    #edf2f7;
  --border:      #cbd5e1;
  --border-hi:   #94a3b8;
  --accent:      #2563eb;
  --accent-hi:   #1d4ed8;
  --accent-glow: rgba(37,99,235,.12);
  --accent2:     #06b6d4;
  --text:        #1e293b;
  --text-muted:  #64748b;
  --text-dim:    #94a3b8;
  --success-bg:  #ecfdf5;
  --success-fg: #059669;
  --success-bd: #10b981;
  --error-bg:    #fef2f2;
  --error-fg:    #dc2626;
  --error-bd:    #ef4444;
  --chip-bg:     #eff6ff;
  --chip-fg:     #3b82f6;
  --chip-bd:     #bfdbfe;
  --font:        "Inter", "Segoe UI", system-ui, sans-serif;
  --mono:        "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  --radius:      8px;
  --radius-sm:   5px;
  --transition:  .18s cubic-bezier(.4,0,.2,1);
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem 4rem;
  background-image:
    radial-gradient(ellipse at 20% 10%, rgba(37,99,235,.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 90%, rgba(6,182,212,.06) 0%, transparent 50%),
    linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: 100%;
  max-width: 720px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08), 0 0 0 1px rgba(255,255,255,.8);
}

.card-header {
  padding: 1.5rem 1.8rem 1.3rem;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-header-left { display: flex; align-items: center; gap: .9rem; flex-shrink: 1; min-width: 0; }
.card-header-left > * { flex-shrink: 0; }

.logo-icon {
  width: 38px; height: 38px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
  border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(37,99,235,.25);
}

.card-header h1 {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: .01em;
  color: var(--text);
}

.card-header .subtitle {
  font-size: .76rem;
  color: var(--text-muted);
  margin-top: .1rem;
}

.card-header .subtitle strong { color: var(--accent-hi); font-weight: 500; }

/* ── Hamburger Menu (Language Switcher) ─────────────────────────────────────── */
.lang-menu {
  position: relative;
}

.lang-trigger {
  width: 36px; height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface2);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  transition: var(--transition);
}

.lang-trigger:hover { border-color: var(--accent); background: var(--accent-glow); }

.lang-trigger span {
  display: block;
  width: 18px; height: 2px;
  background: var(--text-muted);
  border-radius: 1px;
  transition: var(--transition);
}

.lang-trigger:hover span { background: var(--accent); }

.lang-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  min-width: 120px;
  padding: .3rem;
  display: none;
  z-index: 100;
}

.lang-dropdown.show { display: block; }

.lang-dropdown .lang-btn {
  display: block;
  width: 100%;
  padding: .5rem .7rem;
  font-size: .8rem;
  font-weight: 500;
  text-align: left;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
}

.lang-dropdown .lang-btn:hover { background: var(--accent-glow); color: var(--accent-hi); }
.lang-dropdown .lang-btn.active { background: rgba(37,99,235,.15); color: var(--accent-hi); font-weight: 600; }

/* ── Form ─────────────────────────────────────────────────────────────────── */
form {
  padding: 1.6rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field-label {
  display: block;
  font-size: .72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .08em;
  margin-bottom: .4rem;
}

/* ── Input Group (sender+suffix) ──────────────────────────────────────────── */
.input-group {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface2);
  overflow: hidden;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.input-group:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.input-group .suffix {
  background: var(--surface3);
  padding: 0 .8rem;
  font-size: .82rem;
  color: var(--text-muted);
  border-left: 1px solid var(--border);
  white-space: nowrap;
  display: flex; align-items: center;
  font-family: var(--mono);
}

.input-group input {
  border: none;
  border-radius: 0;
  flex: 1;
  background: transparent;
}

/* ── Text Inputs ──────────────────────────────────────────────────────────── */
input[type="text"],
input[type="email"] {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: .6rem .85rem;
  font-size: .92rem;
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
  background: var(--surface2);
  font-family: var(--font);
}

input[type="text"]::placeholder,
input[type="email"]::placeholder { color: var(--text-muted); opacity: .7; }

input[type="text"]:focus,
input[type="email"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.hint {
  font-size: .72rem;
  color: var(--text-muted);
  margin-top: .3rem;
  line-height: 1.5;
}

/* ── Tag Input ────────────────────────────────────────────────────────────── */
.tag-input-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .3rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: .4rem .55rem;
  background: var(--surface2);
  cursor: text;
  transition: border-color var(--transition), box-shadow var(--transition);
  min-height: 40px;
}

.tag-input-wrap.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: .28rem;
  background: var(--chip-bg);
  color: var(--chip-fg);
  border: 1px solid var(--chip-bd);
  border-radius: var(--radius-sm);
  padding: .15rem .5rem;
  font-size: .78rem;
  font-weight: 500;
  white-space: nowrap;
  max-width: 240px;
  font-family: var(--mono);
}

.tag-chip span { overflow: hidden; text-overflow: ellipsis; }

.tag-chip .remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: rgba(59,130,246,.1);
  color: var(--chip-fg);
  font-size: .65rem; line-height: 1;
  cursor: pointer; flex-shrink: 0;
  border: none; padding: 0;
  transition: background var(--transition);
}

.tag-chip .remove:hover { background: rgba(59,130,246,.25); }

.tag-input-wrap input.tag-text {
  border: none; outline: none;
  flex: 1; min-width: 160px;
  font-size: .88rem;
  color: var(--text);
  background: transparent;
  padding: .1rem .2rem;
  box-shadow: none;
  font-family: var(--font);
}

.tag-input-wrap input.tag-text::placeholder { color: var(--text-muted); opacity: .55; }

/* ── Editor (WYSIWYG / Markdown) ─────────────────────────────────────────── */
.editor-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface2);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.editor-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: .15rem;
  padding: .45rem .6rem;
  background: var(--surface3);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.tb-sep {
  width: 1px; height: 18px;
  background: var(--border-hi);
  margin: 0 .2rem;
  flex-shrink: 0;
}

.tb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; height: 28px;
  padding: 0 .35rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-dim);
  font-size: .8rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
  white-space: nowrap;
}

.tb-btn:hover { background: var(--surface3); color: var(--text); border-color: var(--border-hi); }
.tb-btn.active { background: rgba(37,99,235,.15); color: var(--accent-hi); border-color: var(--accent); }

.tb-mode-toggle {
  margin-left: auto;
  display: flex;
  border: 1px solid var(--border-hi);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tb-mode-btn {
  padding: .2rem .6rem;
  font-size: .72rem;
  font-weight: 600;
  letter-spacing: .03em;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
}

.tb-mode-btn.active { background: var(--accent); color: #fff; }
.tb-mode-btn:not(.active):hover { background: var(--surface3); color: var(--text); }

/* WYSIWYG contenteditable pane */
#wysiwygPane {
  min-height: 220px;
  max-height: 480px;
  overflow-y: auto;
  padding: .85rem 1rem;
  outline: none;
  font-size: .92rem;
  line-height: 1.7;
  color: var(--text);
  background: transparent;
}

#wysiwygPane:empty::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  opacity: .5;
  pointer-events: none;
}

#wysiwygPane h1,#wysiwygPane h2,#wysiwygPane h3,
#wysiwygPane h4,#wysiwygPane h5,#wysiwygPane h6 {
  margin: .6em 0 .3em; color: var(--text); font-weight: 600;
}
#wysiwygPane h1 { font-size: 1.5em; }
#wysiwygPane h2 { font-size: 1.25em; }
#wysiwygPane h3 { font-size: 1.1em; }
#wysiwygPane p  { margin-bottom: .55em; }
#wysiwygPane ul, #wysiwygPane ol { padding-left: 1.5em; margin-bottom: .5em; }
#wysiwygPane blockquote {
  border-left: 3px solid var(--accent);
  padding-left: .8em; margin: .5em 0;
  color: var(--text-dim); font-style: italic;
}
#wysiwygPane code {
  background: var(--surface3); padding: 1px 5px;
  border-radius: 4px; font-size: .85em;
  font-family: var(--mono); color: #0891b2;
}
#wysiwygPane a { color: var(--accent-hi); text-decoration: underline; }
#wysiwygPane hr { border: none; border-top: 1px solid var(--border); margin: .8em 0; }
#wysiwygPane strong { color: var(--text); font-weight: 700; }
#wysiwygPane em { color: var(--text-dim); font-style: italic; }

/* Raw Markdown textarea */
#mdPane {
  width: 100%; min-height: 220px; max-height: 480px;
  resize: vertical;
  padding: .85rem 1rem;
  font-family: var(--mono);
  font-size: .85rem;
  line-height: 1.7;
  color: var(--text-dim);
  background: transparent;
  border: none; outline: none;
  tab-size: 2;
}

#mdPane::placeholder { color: var(--text-muted); opacity: .45; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.btn-row {
  display: flex; justify-content: flex-end;
  align-items: center; gap: .65rem; padding-top: .1rem;
}

.btn-secondary {
  padding: .55rem 1.1rem;
  border: 1px solid var(--border-hi);
  border-radius: var(--radius);
  background: var(--surface2);
  color: var(--text-dim);
  font-size: .88rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
}

.btn-secondary:hover { border-color: var(--accent); color: var(--accent-hi); background: var(--accent-glow); }

.btn-primary {
  padding: .58rem 1.5rem;
  border: none;
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
  color: #fff;
  font-size: .92rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  font-family: var(--font);
  letter-spacing: .01em;
  box-shadow: 0 2px 8px rgba(37,99,235,.3);
  display: flex; align-items: center; gap: .4rem;
}

.btn-primary:hover  { filter: brightness(1.05); box-shadow: 0 4px 16px rgba(37,99,235,.4); }
.btn-primary:active { transform: scale(.97); }
.btn-primary:disabled { opacity: .4; cursor: not-allowed; filter: none; box-shadow: none; }

/* ── Status ───────────────────────────────────────────────────────────────── */
#status {
  font-size: .85rem;
  padding: .65rem 1rem;
  border-radius: var(--radius);
  display: none;
  border: 1px solid;
  line-height: 1.5;
}

#status.ok  { background: var(--success-bg); color: var(--success-fg); border-color: var(--success-bd); }
#status.err { background: var(--error-bg);   color: var(--error-fg);   border-color: var(--error-bd); }

/* ── Divider ──────────────────────────────────────────────────────────────── */
.section-divider {
  height: 1px;
  background: var(--border);
  margin: -.1rem 0 -.1rem;
}

/* ── Scrollbar ────────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--surface2); }
::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* ── Attachments ─────────────────────────────────────────────────────────────── */
.attachment-area {
  display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
}
.attachment-list {
  display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .6rem;
}
.att-chip {
  display: inline-flex; align-items: center; gap: .35rem;
  background: var(--chip-bg); border: 1px solid var(--chip-bd);
  border-radius: var(--radius-sm); padding: .25rem .5rem;
  font-size: .78rem; color: var(--chip-fg);
}
.att-chip .att-name {
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.att-chip .att-size { color: var(--text-dim); font-size: .7rem; }
.att-chip .remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(59,130,246,.1); color: var(--chip-fg);
  font-size: .7rem; line-height: 1; cursor: pointer;
  border: none; padding: 0; margin-left: .1rem;
}
.att-chip .remove:hover { background: rgba(59,130,246,.25); }

/* ── Modal ─────────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.5);
  display: none; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(2px);
}
.modal-overlay.show { display: flex; }

.modal-content {
  background: var(--surface);
  border-radius: 12px;
  padding: 2rem 2.5rem;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
  animation: modalIn .2s ease-out;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(.95) translateY(-10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-icon {
  width: 56px; height: 56px; margin: 0 auto 1rem;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
}
.modal-icon.success {
  background: var(--success-bg);
  color: var(--success-fg);
}
.modal-icon.error {
  background: var(--error-bg);
  color: var(--error-fg);
}
.modal-icon svg { width: 28px; height: 28px; }

.modal-title {
  font-size: 1.2rem; font-weight: 600;
  margin-bottom: .5rem; color: var(--text);
}

.modal-message {
  font-size: .9rem; color: var(--text-muted);
  margin-bottom: 1.5rem; line-height: 1.5;
  word-break: break-word;
}

.modal-btn {
  min-width: 100px;
}

.spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
  margin: 0 auto .8rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

.modal-progress {
  text-align: left;
  font-size: .85rem;
  color: var(--text-muted);
  margin: 1rem 0;
}

.modal-progress .step {
  display: flex;
  align-items: center;
  gap: .5rem;
  margin-bottom: .4rem;
}

.modal-progress .step.done { color: var(--success-fg); }
.modal-progress .step.err { color: var(--error-fg); }

.modal-progress .step-icon {
  width: 16px; height: 16px;
  flex-shrink: 0;
}
</style>
</head>
<body>
<div class="card">

  <!-- Header -->
  <div class="card-header">
    <div class="card-header-left">
      <div class="logo-icon">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
</div>
      <div>
        <h1 id="hdr-title">Mailgun Fire</h1>
        <div class="subtitle" id="hdr-sub">Send via Mailgun SMTP &mdash; domain: <strong><?= $domain ?></strong></div>
      </div>
    </div>
    <div class="lang-menu">
      <button class="lang-trigger" id="langTrigger" type="button">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="lang-dropdown" id="langDropdown">
        <button class="lang-btn" data-lang="en">English</button>
        <button class="lang-btn" data-lang="ja">日本語</button>
        <button class="lang-btn" data-lang="th">ภาษาไทย</button>
        <button class="lang-btn" data-lang="zh-cn">简体</button>
        <button class="lang-btn" data-lang="zh-tw">繁體</button>
      </div>
    </div>
  </div>

<form id="mailForm">

    <!-- From (Sender + Display Name) -->
    <div class="row">
      <div>
        <label class="field-label" data-i18n="label_from">FROM (USERNAME)</label>
        <div class="input-group">
          <input type="text" id="sender" value="<?= $default_sender ?>" data-i18n-ph="ph_from">
          <span class="suffix">@<?= $domain ?></span>
        </div>
      </div>
      <div>
        <label class="field-label" for="display" data-i18n="label_display">DISPLAY NAME</label>
        <input type="text" id="display" value="<?= $default_display ?>" data-i18n-ph="ph_display">
      </div>
    </div>

    <!-- To -->
    <div>
      <label class="field-label" data-i18n="label_to">TO</label>
      <div class="tag-input-wrap" id="toWrap">
        <input class="tag-text" type="email" autocomplete="off" data-i18n-ph="ph_email">
      </div>
      <p class="hint" data-i18n="hint_email">Press Enter or comma after each address.</p>
    </div>

    <!-- CC -->
    <div>
      <label class="field-label" data-i18n="label_cc">CC</label>
      <div class="tag-input-wrap" id="ccWrap">
        <input class="tag-text" type="email" autocomplete="off" data-i18n-ph="ph_email">
      </div>
    </div>

    <!-- BCC -->
    <div>
      <label class="field-label" data-i18n="label_bcc">BCC</label>
      <div class="tag-input-wrap" id="bccWrap">
        <input class="tag-text" type="email" autocomplete="off" data-i18n-ph="ph_email">
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- Subject -->
    <div>
      <label class="field-label" for="subject" data-i18n="label_subject">SUBJECT</label>
      <input type="text" id="subject" name="subject" data-i18n-ph="ph_subject" required>
    </div>

    <!-- Body editor -->
    <div>
      <label class="field-label" data-i18n="label_body">BODY</label>
      <div class="editor-wrap" id="editorWrap">

        <!-- Toolbar -->
        <div class="editor-toolbar" id="editorToolbar">
          <!-- Format buttons (WYSIWYG only) -->
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="bold"        title="Bold"><b>B</b></button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="italic"      title="Italic"><i>I</i></button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="underline"   title="Underline"><u>U</u></button>
          <div class="tb-sep wysiwyg-only"></div>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="h1"          title="H1">H1</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="h2"          title="H2">H2</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="h3"          title="H3">H3</button>
          <div class="tb-sep wysiwyg-only"></div>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="ul"          title="Unordered list">&#8226;&#8212;</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="ol"          title="Ordered list">1&#8212;</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="blockquote"  title="Blockquote">&#10077;</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="code"        title="Inline code">&lt;/&gt;</button>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="link"        title="Insert link">&#128279;</button>
          <div class="tb-sep wysiwyg-only"></div>
          <button type="button" class="tb-btn wysiwyg-only" data-cmd="hr"          title="Horizontal rule">&#8213;</button>

          <!-- Mode toggle (always visible) -->
          <div class="tb-mode-toggle">
            <button type="button" class="tb-mode-btn active" id="modeWysiwyg" data-i18n="mode_rich">Rich</button>
            <button type="button" class="tb-mode-btn"        id="modeMd"      data-i18n="mode_md">Markdown</button>
          </div>
        </div>

        <!-- WYSIWYG pane -->
        <div id="wysiwygPane" contenteditable="true" data-i18n-ph="ph_body"></div>

        <!-- Markdown pane (hidden by default) -->
        <textarea id="mdPane" style="display:none" data-i18n-ph="ph_body_md"></textarea>
      </div>
    </div>

    <!-- Attachments -->
    <div>
      <label class="field-label" data-i18n="label_attachments">ATTACHMENTS</label>
      <div class="attachment-area" id="attachmentArea">
        <input type="file" id="fileInput" multiple hidden>
        <button type="button" class="btn-secondary" id="attachBtn">
          <span>&#128206;</span>
          <span data-i18n="btn_attach">Add Files</span>
        </button>
        <span class="hint" data-i18n="hint_attach">Max 3MB per file</span>
      </div>
      <div class="attachment-list" id="attachmentList"></div>
    </div>

    <!-- Status -->
    <div id="status"></div>

    <!-- Actions -->
    <div class="btn-row">
      <button type="button" class="btn-secondary" id="clearBtn" data-i18n="btn_clear">Clear</button>
      <button type="submit" class="btn-primary"   id="sendBtn">
        <span>&#9993;</span>
        <span data-i18n="btn_send">Send Email</span>
      </button>
    </div>

  </form>
</div><!-- .card -->

<!-- Modal -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal-content">
    <div class="modal-icon" id="modalIcon"></div>
    <h2 class="modal-title" id="modalTitle"></h2>
    <p class="modal-message" id="modalMessage"></p>
    <button type="button" class="btn-primary modal-btn" id="modalClose" data-i18n="modal_ok">OK</button>
  </div>
</div>

<!-- Progress Modal -->
<div class="modal-overlay" id="progressOverlay">
  <div class="modal-content">
    <div class="spinner" id="progressSpinner"></div>
    <h2 class="modal-title" id="progressTitle" data-i18n="sending">Sending...</h2>
    <div class="modal-progress" id="progressSteps"></div>
    <button type="button" class="btn-primary modal-btn" id="progressClose" style="display:none" data-i18n="modal_ok">OK</button>
  </div>
</div>

<script>
'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// I18N
// ══════════════════════════════════════════════════════════════════════════════
const LANG = {
  en: {
    label_from:'FROM (USERNAME)', label_display:'DISPLAY NAME',
    label_to:'TO', label_cc:'CC', label_bcc:'BCC',
    label_subject:'SUBJECT', label_body:'BODY',
    label_attachments:'ATTACHMENTS', label_apikey:'API KEY',
    ph_display:'Optional', ph_from:'noreply', ph_email:'address@example.com — Enter to add',
    ph_subject:'Email subject', ph_apikey:'Enter your API key',
    ph_body:'Compose your message here…',
    ph_body_md:'Write in **Markdown**…',
    hint_email:'Press Enter or comma after each address.',
    hint_attach:'Max 3MB per file',
    hint_apikey:'Saved locally, never sent to server',
    mode_rich:'Rich', mode_md:'Markdown',
    btn_clear:'Clear', btn_send:'Send Email', btn_attach:'Add Files',
    err_no_to:'Please add at least one To recipient.',
    err_network:'Network error: ',
    err_apikey:'Please enter API key', err_nosign:'Auth failed',
    sending:'Sending…',
    hdr_sub:'Send via Mailgun SMTP — domain: ',
    modal_ok:'OK', modal_success:'Success', modal_error:'Error',
  },
  ja: {
    label_from:'差出人（ユーザー名）', label_display:'表示名',
    label_to:'宛先', label_cc:'CC', label_bcc:'BCC',
    label_subject:'件名', label_body:'本文', label_attachments:'添付ファイル',
    label_apikey:'APIキー',
    ph_display:'任意', ph_from:'noreply', ph_email:'address@example.com — Enter で追加',
    ph_subject:'メールの件名', ph_apikey:'APIキーを入力',
    ph_body:'ここにメッセージを入力してください…',
    ph_body_md:'**Markdown** で記述…',
    hint_email:'各アドレスの後に Enter またはカンマを押してください。',
    hint_attach:'ファイル最大3MB',
    hint_apikey:'ローカルに保存されます',
    mode_rich:'リッチ', mode_md:'Markdown',
    btn_clear:'クリア', btn_send:'送信', btn_attach:'ファイルを追加',
    err_no_to:'宛先を1件以上追加してください。',
    err_network:'ネットワークエラー: ',
    err_apikey:'APIキーを入力してください', err_nosign:'認証失敗',
    sending:'送信中…',
    hdr_sub:'Mailgun SMTP 経由で送信 — ドメイン: ',
    modal_ok:'OK', modal_success:'成功', modal_error:'エラー',
  },
  th: {
    label_from:'ผู้ส่ง (ชื่อผู้ใช้)', label_display:'ชื่อที่แสดง',
    label_to:'ถึง', label_cc:'สำเนา (CC)', label_bcc:'สำเนาลับ (BCC)',
    label_subject:'หัวเรื่อง', label_body:'เนื้อหา', label_attachments:'ไฟล์แนบ',
    label_apikey:'API Key',
    ph_display:'ไม่บังคับ', ph_from:'noreply', ph_email:'address@example.com — กด Enter เพื่อเพิ่ม',
    ph_subject:'หัวเรื่องล', ph_apอีเมikey:'ใส่ API key',
    ph_body:'เขียนข้อความที่นี่…',
    ph_body_md:'เขียนด้วย **Markdown**…',
    hint_email:'กด Enter หรือจุลภาคหลังจากแต่ละที่อยู่',
    hint_attach:'ไฟล์สูงสุด 3MB',
    hint_apikey:'จัดเก็บในเครื่อง',
    mode_rich:'รูปแบบ', mode_md:'Markdown',
    btn_clear:'ล้าง', btn_send:'ส่งอีเมล', btn_attach:'เพิ่มไฟล์',
    err_no_to:'กรุณาเพิ่มผู้รับอย่างน้อยหนึ่งคน',
    err_network:'ข้อผิดพลาดเครือข่าย: ',
    err_apikey:'กรุณาใส่ API key', err_nosign:'การยืนยันล้มเหลว',
    sending:'กำลังส่ง…',
    hdr_sub:'ส่งผ่าน Mailgun SMTP — โดเมน: ',
    modal_ok:'ตกลง', modal_success:'สำเร็จ', modal_error:'ข้อผิดพลาด',
  },
  'zh-cn': {
    label_from:'发件人（用户名）', label_display:'显示名称',
    label_to:'收件人', label_cc:'抄送', label_bcc:'密送',
    label_subject:'主题', label_body:'正文', label_attachments:'附件',
    label_apikey:'API 密钥',
    ph_display:'可选', ph_from:'noreply', ph_email:'address@example.com — 按 Enter 添加',
    ph_subject:'邮件主题', ph_apikey:'输入 API 密钥',
    ph_body:'在此撰写邮件…',
    ph_body_md:'用 **Markdown** 编写…',
    hint_email:'每个地址后按 Enter 或逗号确认。',
    hint_attach:'单个文件最大 3MB',
    hint_apikey:'本地存储，不会发送到服务器',
    mode_rich:'富文本', mode_md:'Markdown',
    btn_clear:'清空', btn_send:'发送邮件', btn_attach:'添加文件',
    err_no_to:'请至少添加一个收件人。',
    err_network:'网络错误：',
    err_apikey:'请输入 API 密钥', err_nosign:'认证失败',
    sending:'发送中…',
    hdr_sub:'通过 Mailgun SMTP 发送 — 域名：',
    modal_ok:'OK', modal_success:'成功', modal_error:'错误',
  },
  'zh-tw': {
    label_from:'寄件人（使用者名稱）', label_display:'顯示名稱',
    label_to:'收件人', label_cc:'副本', label_bcc:'密件副本',
    label_subject:'主旨', label_body:'內文', label_attachments:'附件',
    label_apikey:'API 金鑰',
    ph_display:'選填', ph_from:'noreply', ph_email:'address@example.com — 按 Enter 新增',
    ph_subject:'郵件主旨', ph_apikey:'輸入 API 金鑰',
    ph_body:'在此撰寫郵件…',
    ph_body_md:'以 **Markdown** 撰寫…',
    hint_email:'每個地址後按 Enter 或逗號確認。',
    hint_attach:'單一檔案最大 3MB',
    hint_apikey:'本地儲存，不會傳送至伺服器',
    mode_rich:'富文字', mode_md:'Markdown',
    btn_clear:'清除', btn_send:'寄送郵件', btn_attach:'新增檔案',
    err_no_to:'請至少新增一位收件人。',
    err_network:'網路錯誤：',
    err_apikey:'請輸入 API 金鑰', err_nosign:'認證失敗',
    sending:'傳送中…',
    hdr_sub:'透過 Mailgun SMTP 傳送 — 網域：',
    modal_ok:'OK', modal_success:'成功', modal_error:'錯誤',
  },
};

// ── Browser language detection ────────────────────────────────────────────
function detectLang() {
  const supported = Object.keys(LANG); // ['en','ja','th','zh-cn','zh-tw']
  const candidates = navigator.languages && navigator.languages.length
    ? [...navigator.languages]
    : [navigator.language || 'en'];

  for (const raw of candidates) {
    const lower = raw.toLowerCase();
    // Exact match first (e.g. "zh-cn", "zh-tw")
    if (supported.includes(lower)) return lower;
    // zh-hant / zh-tw / zh-hk / zh-mo → 繁體
    if (/^zh-(hant|tw|hk|mo)/.test(lower)) return 'zh-tw';
    // zh-hans / zh-cn / zh-sg / bare "zh" → 简体
    if (/^zh/.test(lower)) return 'zh-cn';
    // Prefix match for ja, th, en, etc.
    const prefix = lower.split('-')[0];
    if (supported.includes(prefix)) return prefix;
  }
  return 'en';
}

let currentLang = detectLang();

function t(key) { return (LANG[currentLang] || LANG.en)[key] || key; }

function applyI18n() {
  const lang = LANG[currentLang] || LANG.en;
  // data-i18n text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (lang[key] !== undefined) el.textContent = lang[key];
  });
  // data-i18n-ph placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (lang[key] !== undefined) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.placeholder = lang[key];
      } else {
        el.dataset.placeholder = lang[key]; // contenteditable
      }
    }
  });
  // header subtitle (has dynamic domain)
  const subEl = document.getElementById('hdr-sub');
  if (subEl) {
    subEl.innerHTML = lang.hdr_sub + '<strong><?= $domain ?></strong>';
  }
}

function setActiveLangBtn(lang) {
  document.querySelectorAll('.lang-dropdown .lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

const langTrigger = document.getElementById('langTrigger');
const langDropdown = document.getElementById('langDropdown');

langTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  langDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  langDropdown.classList.remove('show');
});

langDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.querySelectorAll('.lang-dropdown .lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    setActiveLangBtn(currentLang);
    applyI18n();
    langDropdown.classList.remove('show');
  });
});

// Activate the detected language button, then render
setActiveLangBtn(currentLang);
applyI18n();

// ══════════════════════════════════════════════════════════════════════════════
// MARKDOWN UTILITY
// ══════════════════════════════════════════════════════════════════════════════
function mdToHtml(md) {
  // Fenced code blocks first (before any escaping)
  const codeBlocks = [];
  md = md.replace(/^```(\w*)\n([\s\S]*?)^```$/gm, (_, lang, code) => {
    const attr = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre><code${attr}>${code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  let h = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^###### (.+)$/gm,'<h6>$1</h6>')
    .replace(/^##### (.+)$/gm,'<h5>$1</h5>')
    .replace(/^#### (.+)$/gm,'<h4>$1</h4>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>')
    .replace(/^---+$/gm,'<hr>')
    .replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/^[ \t]*[*\-] (.+)$/gm,'<li>$1</li>')
    .replace(/^[ \t]*\d+\.\s+(.+)$/gm,'<li_ol>$1</li_ol>');

  // Group consecutive <li> into <ul>, and <li_ol> into <ol>
  const lines = h.split('\n');
  const out = [];
  let inUl = false, inOl = false;
  for (const line of lines) {
    if (line.startsWith('<li>')) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(line);
    } else if (line.startsWith('<li_ol>')) {
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push('<li>' + line.slice(7, -8) + '</li>');
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(line);
    }
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  h = out.join('\n');

  h = h.split(/\n{2,}/).map(b => {
    b = b.trim(); if (!b) return '';
    if (/^\x00CB\d+\x00$/.test(b)) return b;
    if (/^<(h[1-6]|ul|ol|blockquote|hr|pre)/.test(b)) return b;
    return '<p>' + b.replace(/\n/g,'<br>') + '</p>';
  }).join('\n');

  // Restore code blocks
  codeBlocks.forEach((cb, i) => { h = h.replace(`\x00CB${i}\x00`, cb); });
  return h;
}

function htmlToMd(html) {
  // Basic HTML → Markdown for round-trip when switching modes
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi,         '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi,         '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi,         '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi,         '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi,         '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi,         '###### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi,           '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi,         '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi,           '*$1*')
    .replace(/<u[^>]*>(.*?)<\/u>/gi,           '$1')
    .replace(/<code[^>]*>(.*?)<\/code>/gi,     '`$1`')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi,'[$2]($1)')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) =>
      c.trim().split('\n').map(l => '> ' + l.trim()).join('\n') + '\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) =>
      c.replace(/<li[^>]*>(.*?)<\/li>/gi,'- $1\n') + '\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
      let n=1; return c.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${n++}. $1\n`) + '\n';
    })
    .replace(/<hr\s*\/?>/gi,   '\n---\n')
    .replace(/<br\s*\/?>/gi,   '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g,       '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAG INPUT
// ══════════════════════════════════════════════════════════════════════════════
class TagInput {
  constructor(wrap) {
    this.wrap  = wrap;
    this.input = wrap.querySelector('input.tag-text');
    this.tags  = [];
    this._bind();
  }
  _bind() {
    this.wrap.addEventListener('click', () => this.input.focus());
    this.input.addEventListener('focus', () => this.wrap.classList.add('focused'));
    this.input.addEventListener('blur',  () => {
      this.wrap.classList.remove('focused');
      this._commit(this.input.value);
    });
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); this._commit(this.input.value); }
      else if (e.key === 'Backspace' && this.input.value === '' && this.tags.length) this._remove(this.tags.length-1);
    });
    this.input.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData||window.clipboardData).getData('text');
      text.split(/[\s,;]+/).forEach(t => this._commit(t));
    });
  }
  _valid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  _commit(raw) {
    const val = raw.trim().replace(/,+$/,'');
    this.input.value = '';
    if (!val) return;
    if (!this._valid(val)) {
      this.input.style.color = 'var(--error-fg)';
      setTimeout(() => { this.input.style.color = ''; }, 700);
      this.input.value = val; return;
    }
    if (this.tags.some(t => t.toLowerCase() === val.toLowerCase())) return;
    this.tags.push(val);
    this._renderChip(val, this.tags.length-1);
  }
  _renderChip(email, index) {
    const chip  = document.createElement('span');
    chip.className  = 'tag-chip';
    chip.dataset.index = index;
    const lbl = document.createElement('span');
    lbl.textContent = email; lbl.title = email;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'remove';
    btn.innerHTML = '&#x2715;';
    btn.setAttribute('aria-label', 'Remove ' + email);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = this.tags.indexOf(email);
      if (idx !== -1) this._remove(idx);
    });
    chip.appendChild(lbl); chip.appendChild(btn);
    this.wrap.insertBefore(chip, this.input);
  }
  _remove(index) {
    this.tags.splice(index,1);
    this.wrap.querySelectorAll('.tag-chip').forEach(el => el.remove());
    this.tags.forEach((t,i) => this._renderChip(t,i));
  }
  getAddresses() { return [...this.tags]; }
  reset() { this.tags=[]; this.wrap.querySelectorAll('.tag-chip').forEach(el=>el.remove()); this.input.value=''; }
}

const toInput  = new TagInput(document.getElementById('toWrap'));
const ccInput  = new TagInput(document.getElementById('ccWrap'));
const bccInput = new TagInput(document.getElementById('bccWrap'));

// ══════════════════════════════════════════════════════════════════════════════
// EDITOR (WYSIWYG ↔ MARKDOWN)
// ══════════════════════════════════════════════════════════════════════════════
const wysiwygPane  = document.getElementById('wysiwygPane');
const mdPane       = document.getElementById('mdPane');
const modeWysiwyg  = document.getElementById('modeWysiwyg');
const modeMd       = document.getElementById('modeMd');

let editorMode = 'wysiwyg'; // 'wysiwyg' | 'md'

function setMode(mode) {
  if (mode === editorMode) return;
  if (mode === 'md') {
    // Convert current WYSIWYG HTML → Markdown
    mdPane.value = htmlToMd(wysiwygPane.innerHTML);
    wysiwygPane.style.display = 'none';
    mdPane.style.display      = 'block';
    document.querySelectorAll('.wysiwyg-only').forEach(el => { el.style.display='none'; });
    modeWysiwyg.classList.remove('active');
    modeMd.classList.add('active');
  } else {
    // Convert current Markdown → WYSIWYG HTML
    wysiwygPane.innerHTML = mdToHtml(mdPane.value);
    mdPane.style.display      = 'none';
    wysiwygPane.style.display = 'block';
    document.querySelectorAll('.wysiwyg-only').forEach(el => { el.style.display=''; });
    modeMd.classList.remove('active');
    modeWysiwyg.classList.add('active');
  }
  editorMode = mode;
}

modeWysiwyg.addEventListener('click', () => setMode('wysiwyg'));
modeMd.addEventListener('click',      () => setMode('md'));

// Toolbar commands
document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('mousedown', e => {
    e.preventDefault(); // don't steal focus from editor
    const cmd = btn.dataset.cmd;
    wysiwygPane.focus();
    switch (cmd) {
      case 'bold':       document.execCommand('bold');        break;
      case 'italic':     document.execCommand('italic');      break;
      case 'underline':  document.execCommand('underline');   break;
      case 'h1': case 'h2': case 'h3':
        document.execCommand('formatBlock', false, '<' + cmd + '>'); break;
      case 'ul':         document.execCommand('insertUnorderedList'); break;
      case 'ol':         document.execCommand('insertOrderedList');   break;
      case 'blockquote': document.execCommand('formatBlock', false, '<blockquote>'); break;
      case 'code': {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const code  = document.createElement('code');
          range.surroundContents(code);
        }
        break;
      }
      case 'link': {
        const url = prompt('URL:');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
      case 'hr':
        document.execCommand('insertHorizontalRule'); break;
    }
  });
});

// Update toolbar button active states
wysiwygPane.addEventListener('keyup',   updateToolbarState);
wysiwygPane.addEventListener('mouseup', updateToolbarState);

function updateToolbarState() {
  const cmds = { bold:'bold', italic:'italic', underline:'underline' };
  Object.entries(cmds).forEach(([cmd, state]) => {
    const btn = document.querySelector(`.tb-btn[data-cmd="${cmd}"]`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(state));
  });
}

// Get body content as Markdown regardless of mode
function getBodyMarkdown() {
  if (editorMode === 'md') return mdPane.value.trim();
  return htmlToMd(wysiwygPane.innerHTML).trim();
}

function isBodyEmpty() {
  if (editorMode === 'md') return mdPane.value.trim() === '';
  return wysiwygPane.innerText.trim() === '';
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════════════════════════
const modalOverlay = document.getElementById('modalOverlay');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

const progressOverlay = document.getElementById('progressOverlay');
const progressSteps = document.getElementById('progressSteps');
const progressClose = document.getElementById('progressClose');
const progressSpinner = document.getElementById('progressSpinner');
const progressTitle = document.getElementById('progressTitle');

function showModal(ok, title, msg) {
  const svg = ok
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  
  modalIcon.className = 'modal-icon ' + (ok ? 'success' : 'error');
  modalIcon.innerHTML = svg;
  modalTitle.textContent = title;
  modalMessage.textContent = msg;
  modalOverlay.classList.add('show');
}

modalClose.addEventListener('click', () => {
  modalOverlay.classList.remove('show');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('show');
});

const progressStepsList = [
  { key: 'step_preparing', en: 'Preparing data...', ja: 'データを準備中...', th: 'กำลังเตรียมข้อมูล...', 'zh-cn': '准备数据...', 'zh-tw': '準備資料...' },
  { key: 'step_encoding', en: 'Encoding attachments...', ja: '添付ファイルをエンコード中...', th: 'กำลังเข้ารหัสไฟล์แนบ...', 'zh-cn': '编码附件...', 'zh-tw': '編碼附件...' },
  { key: 'step_connecting', en: 'Connecting to SMTP server...', ja: 'SMTPサーバーに接続中...', th: 'กำลังเชื่อมต่อเซิร์ฟเวอร์ SMTP...', 'zh-cn': '连接 SMTP 服务器...', 'zh-tw': '連線 SMTP 伺服器...' },
  { key: 'step_auth', en: 'Authenticating...', ja: '認証中...', th: 'กำลังยืนยันตัวตน...', 'zh-cn': '验证身份...', 'zh-tw': '驗證身份...' },
  { key: 'step_sending', en: 'Sending email...', ja: 'メール送信中...', th: 'กำลังส่งอีเมล...', 'zh-cn': '发送邮件...', 'zh-tw': '傳送郵件...' },
  { key: 'step_done', en: 'Done!', ja: '完了！', th: 'เสร็จสิ้น!', 'zh-cn': '完成！', 'zh-tw': '完成！' }
];

function getStepText(step) {
  return step[currentLang] || step.en;
}

function showProgressModal() {
  progressSteps.innerHTML = progressStepsList.map((s, i) => `
    <div class="step" id="step_${i}">
      <span class="step-icon" id="step_icon_${i}">○</span>
      <span id="step_text_${i}">${getStepText(s)}</span>
    </div>
  `).join('');
  progressSpinner.style.display = 'block';
  progressClose.style.display = 'none';
  progressTitle.textContent = t('sending');
  progressOverlay.classList.add('show');
}

function updateProgress(stepIndex, done) {
  const el = document.getElementById(`step_${stepIndex}`);
  const icon = document.getElementById(`step_icon_${stepIndex}`);
  if (!el) return;
  el.classList.add(done ? 'done' : 'err');
  icon.innerHTML = done
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
}

function showProgressResult(ok, errorMsg) {
  progressSpinner.style.display = 'none';
  for (let i = 0; i < progressStepsList.length; i++) {
    updateProgress(i, i < 4 ? true : ok);
  }
  if (!ok && errorMsg) {
    const errDiv = document.createElement('div');
    errDiv.className = 'step err';
    errDiv.style.marginTop = '1rem';
    errDiv.innerHTML = `<span class="step-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span><span>${errorMsg}</span>`;
    progressSteps.appendChild(errDiv);
  }
  progressClose.style.display = 'inline-flex';
  progressTitle.textContent = ok ? t('modal_success') : t('modal_error');
}

progressClose.addEventListener('click', () => {
  progressOverlay.classList.remove('show');
});

progressOverlay.addEventListener('click', (e) => {
  if (e.target === progressOverlay) progressOverlay.classList.remove('show');
});

// ══════════════════════════════════════════════════════════════════════════════
// STATUS (legacy, unused)
// ══════════════════════════════════════════════════════════════════════════════
const status = document.getElementById('status');

function showStatus(ok, msg) {
  // Now using modal instead
  const title = ok ? t('modal_success') : t('modal_error');
  showModal(ok, title, msg);
}

// ══════════════════════════════════════════════════════════════════════════════
// CLEAR
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('clearBtn').addEventListener('click', () => {
  toInput.reset(); ccInput.reset(); bccInput.reset();
  document.getElementById('subject').value = '';
  wysiwygPane.innerHTML = '';
  mdPane.value = '';
  attachmentFiles = [];
  renderAttachments();
  status.style.display = 'none';
});

// ══════════════════════════════════════════════════════════════════════════════
// ATTACHMENTS
// ══════════════════════════════════════════════════════════════════════════════
const MAX_ATT_SIZE = 3 * 1024 * 1024;
let attachmentFiles = [];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderAttachments() {
  const list = document.getElementById('attachmentList');
  list.innerHTML = attachmentFiles.map((f, i) => `
    <div class="att-chip">
      <span class="att-name" title="${f.name}">${f.name}</span>
      <span class="att-size">${formatSize(f.size)}</span>
      <button type="button" class="remove" data-index="${i}">&#x2715;</button>
    </div>
  `).join('');
  list.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      attachmentFiles.splice(+btn.dataset.index, 1);
      renderAttachments();
    });
  });
}

document.getElementById('attachBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  for (const file of e.target.files) {
    if (file.size > MAX_ATT_SIZE) {
      showStatus(false, '✗ File too large: ' + file.name + ' (max 3MB)');
      continue;
    }
    if (attachmentFiles.length >= 10) {
      showStatus(false, '✗ Max 10 files allowed');
      break;
    }
    attachmentFiles.push({ name: file.name, size: file.size, file: file });
  }
  renderAttachments();
  e.target.value = '';
});

// ══════════════════════════════════════════════════════════════════════════════
// SUBMIT
// ══════════════════════════════════════════════════════════════════════════════
const form    = document.getElementById('mailForm');
const sendBtn = document.getElementById('sendBtn');

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  status.style.display = 'none';

  const to  = toInput.getAddresses();
  const cc  = ccInput.getAddresses();
  const bcc = bccInput.getAddresses();

  if (to.length === 0) { showModal(false, t('modal_error'), '✗ ' + t('err_no_to')); return; }

  sendBtn.disabled = true;
  sendBtn.querySelector('[data-i18n]').textContent = t('sending');

  showProgressModal();
  updateProgress(0, true);

  const attachments = await Promise.all(
    attachmentFiles.map(async f => ({
      filename: f.name,
      mime: f.file.type || 'application/octet-stream',
      content: await fileToBase64(f.file)
    }))
  );

  updateProgress(1, true);

  const payload = {
    sender:  (document.getElementById('sender') || {value:''}).value.trim(),
    display: (document.getElementById('display') || {value:''}).value.trim(),
    to, cc, bcc,
    subject: document.getElementById('subject').value.trim(),
    body:    getBodyMarkdown(),
    attachments: attachments.length ? attachments : undefined,
  };

  const headers = { 'Content-Type': 'application/json' };

  try {
    updateProgress(2, true);
    const res  = await fetch(window.location.pathname, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });
    updateProgress(3, true);
    const data = await res.json();
    if (data.ok) {
      updateProgress(4, true);
      showProgressResult(true);
    } else {
      showProgressResult(false, '✗ ' + data.error);
    }
  } catch (err) {
    showProgressResult(false, '✗ ' + t('err_network') + err.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.querySelector('[data-i18n]').textContent = t('btn_send');
  }
});

</script>
