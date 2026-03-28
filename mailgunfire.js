function getConfig(env) {
  const domain  = env.DOMAIN  || '';
  const apiKey  = env.KEY     || '';
  const login   = env.FROM    || 'noreply';
  const display = env.DISPLAY || '';
  const eu      = env.EU !== undefined && env.EU !== '';
  if (!domain) return { error: 'DOMAIN not configured' };
  if (!apiKey) return { error: 'KEY not configured' };
  return { domain, apiKey, login, display, eu };
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mailgun Fire</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%25232563eb'/><stop offset='100%25' stop-color='%252306b6d4'/></linearGradient></defs><rect width='32' height='32' rx='6' fill='url(%2523g)'/><path d='M8 10h16v2H8zm0 5h12l4 4v5a2 2 0 01-2 2H10a2 2 0 01-2-2v-9z' fill='none' stroke='white' stroke-width='1.5'/><path d='M8 15h12l4 4' fill='none' stroke='white' stroke-width='1.5'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://{{CDN_HOST}}/npm/markdown-it@14/dist/markdown-it.min.js"><\/script>
<style>
:root{--bg:#f4f6f9;--surface:#fff;--surface2:#f8fafc;--surface3:#edf2f7;--border:#cbd5e1;--border-hi:#94a3b8;--accent:#2563eb;--accent-hi:#1d4ed8;--accent-glow:rgba(37,99,235,.12);--accent2:#06b6d4;--text:#1e293b;--text-muted:#64748b;--text-dim:#94a3b8;--success-bg:#ecfdf5;--success-fg:#059669;--success-bd:#10b981;--error-bg:#fef2f2;--error-fg:#dc2626;--error-bd:#ef4444;--chip-bg:#eff6ff;--chip-fg:#3b82f6;--chip-bd:#bfdbfe;--font:"Inter","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono","Fira Code","Cascadia Code",Consolas,monospace;--radius:8px;--radius-sm:5px;--transition:.18s cubic-bezier(.4,0,.2,1)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);background:linear-gradient(135deg,#e0e7ff 0%,#f4f6f9 40%,#ecfeff 100%);min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;color:var(--text)}
.card{background:var(--surface);border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.06);width:100%;max-width:680px;padding:32px 36px 28px;position:relative}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.card-header-left{display:flex;align-items:center;gap:14px}
.logo-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;flex-shrink:0}
h1{font-size:1.35rem;font-weight:700;color:var(--text);line-height:1.2}
.subtitle{font-size:.78rem;color:var(--text-muted);margin-top:2px}
.subtitle strong{color:var(--accent);font-weight:600}
.header-right{display:flex;gap:8px;align-items:center}
.logout-btn{border:none;border-radius:var(--radius-sm);padding:5px 12px;font-size:.78rem;font-weight:600;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--error-fg),#f97316);transition:var(--transition);font-family:var(--font);display:flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(220,38,38,.25)}
.logout-btn:hover{filter:brightness(1.1);box-shadow:0 4px 12px rgba(220,38,38,.35)}
.lang-select{font-family:var(--font);font-size:.78rem;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);cursor:pointer;outline:none;transition:border-color var(--transition)}
.lang-select:focus{border-color:var(--accent)}
form{display:flex;flex-direction:column;gap:14px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field-label{display:block;font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.input-group{display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color var(--transition),box-shadow var(--transition)}
.input-group:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.input-group .suffix{background:var(--surface3);color:var(--text-muted);font-size:.82rem;padding:0 10px;display:flex;align-items:center;border-left:1px solid var(--border);white-space:nowrap;user-select:all}
input[type="text"],input[type="email"]{font-family:var(--font);width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:.9rem;color:var(--text);background:var(--surface);outline:none;transition:border-color var(--transition),box-shadow var(--transition)}
input[type="text"]:focus,input[type="email"]:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.input-group input[type="text"]{border:none;border-radius:0}
.input-group input[type="text"]:focus{box-shadow:none}
.hint{font-size:.7rem;color:var(--text-dim);margin-top:3px}
.tag-input-wrap{display:flex;flex-wrap:wrap;gap:5px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);min-height:40px;align-items:center;cursor:text;transition:border-color var(--transition),box-shadow var(--transition)}
.tag-input-wrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.tag-chip{display:inline-flex;align-items:center;gap:4px;background:var(--chip-bg);color:var(--chip-fg);border:1px solid var(--chip-bd);border-radius:20px;padding:2px 8px 2px 10px;font-size:.82rem;line-height:1.4;animation:chipIn .15s ease}
@keyframes chipIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
.tag-chip .remove{cursor:pointer;font-size:.9rem;line-height:1;color:var(--chip-fg);opacity:.6;transition:opacity var(--transition);padding:0 2px}
.tag-chip .remove:hover{opacity:1}
input.tag-text{border:none;outline:none;font-family:var(--font);font-size:.88rem;flex:1;min-width:120px;padding:2px 0;background:transparent;color:var(--text)}
.editor-wrap{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color var(--transition),box-shadow var(--transition)}
.editor-wrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.editor-toolbar{display:flex;align-items:center;gap:2px;padding:6px 8px;background:var(--surface2);border-bottom:1px solid var(--border);flex-wrap:wrap}
.tb-sep{width:1px;height:18px;background:var(--border);margin:0 4px}
.tb-btn{font-family:var(--font);font-size:.78rem;padding:4px 7px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:var(--radius-sm);transition:all var(--transition);line-height:1.2}
.tb-btn:hover{background:var(--accent-glow);color:var(--accent)}
.tb-mode-toggle{margin-left:auto;display:flex;background:var(--surface3);border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border)}
.tb-mode-btn{font-family:var(--font);font-size:.72rem;padding:3px 10px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;transition:all var(--transition);font-weight:500}
.tb-mode-btn.active{background:var(--accent);color:#fff}
#wysiwygPane{min-height:200px;max-height:420px;overflow-y:auto;padding:14px 16px;font-size:.92rem;line-height:1.7;outline:none;color:var(--text)}
#wysiwygPane h1{font-size:1.5rem;font-weight:700;margin:16px 0 8px;line-height:1.3}
#wysiwygPane h2{font-size:1.25rem;font-weight:600;margin:14px 0 6px;line-height:1.3}
#wysiwygPane h3{font-size:1.1rem;font-weight:600;margin:12px 0 4px;line-height:1.3}
#wysiwygPane h4,#wysiwygPane h5,#wysiwygPane h6{font-size:1rem;font-weight:600;margin:10px 0 4px}
#wysiwygPane p{margin:6px 0}
#wysiwygPane ul,#wysiwygPane ol{margin:6px 0 6px 20px}
#wysiwygPane blockquote{border-left:3px solid var(--accent);margin:8px 0;padding:4px 12px;color:var(--text-muted);background:var(--surface2);border-radius:0 var(--radius-sm) var(--radius-sm) 0}
#wysiwygPane code{font-family:var(--mono);font-size:.85em;background:var(--surface3);padding:1px 5px;border-radius:3px}
#wysiwygPane a{color:var(--accent);text-decoration:underline}
#wysiwygPane hr{border:none;border-top:1px solid var(--border);margin:12px 0}
#wysiwygPane strong{font-weight:700}
#wysiwygPane em{font-style:italic}
#mdPane{width:100%;min-height:200px;max-height:420px;padding:14px 16px;border:none;outline:none;font-family:var(--mono);font-size:.88rem;line-height:1.7;color:var(--text);resize:vertical;background:var(--surface);display:none}
.btn-row{display:flex;justify-content:flex-end;gap:10px;margin-top:4px;align-items:center}
.btn-secondary{font-family:var(--font);font-size:.85rem;font-weight:500;padding:9px 18px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text-muted);cursor:pointer;transition:all var(--transition)}
.btn-secondary:hover{border-color:var(--border-hi);color:var(--text)}
.btn-primary{font-family:var(--font);font-size:.9rem;font-weight:600;padding:10px 28px;border:none;border-radius:var(--radius);background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;cursor:pointer;transition:all var(--transition);box-shadow:0 2px 8px rgba(37,99,235,.2)}
.btn-primary:hover{box-shadow:0 4px 16px rgba(37,99,235,.3);transform:translateY(-1px)}
.btn-primary:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
#status{font-size:.82rem;padding:8px 14px;border-radius:var(--radius);margin-top:4px;display:none;font-weight:500}
#status.ok{display:block;background:var(--success-bg);color:var(--success-fg);border:1px solid var(--success-bd)}
#status.err{display:block;background:var(--error-bg);color:var(--error-fg);border:1px solid var(--error-bd)}
.label-row{display:flex;align-items:center;justify-content:space-between}
.save-toggle{display:none;align-items:center;gap:6px;font-size:.78rem;color:var(--text-muted);cursor:pointer;user-select:none}
.save-toggle input{accent-color:var(--accent);cursor:pointer}
.section-divider{height:1px;background:var(--surface3);margin:4px 0}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--border-hi)}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:1000}
.drawer-overlay.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:90vw;background:var(--surface);box-shadow:-4px 0 24px rgba(0,0,0,.1);transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);z-index:1001;display:flex;flex-direction:column}
.drawer.open{transform:translateX(0)}
.drawer-header{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border)}
.drawer-title{font-size:1rem;font-weight:600;flex:1}
.drawer-close,.drawer-back{font-family:var(--font);font-size:1.1rem;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px 8px;border-radius:var(--radius-sm);transition:all var(--transition)}
.drawer-close:hover,.drawer-back:hover{background:var(--surface3);color:var(--text)}
.drawer-body{flex:1;overflow-y:auto;padding:12px 20px}
.sent-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--surface3);cursor:pointer;transition:background var(--transition)}
.sent-item:hover{background:var(--surface2)}
.sent-item input[type="checkbox"]{margin-top:4px;accent-color:var(--accent);cursor:pointer;flex-shrink:0}
.sent-item-content{flex:1;min-width:0}
.sent-item-subject{font-size:.88rem;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sent-item-meta{font-size:.74rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drawer-footer{padding:12px 20px;border-top:1px solid var(--border);display:none}
.drawer-footer button{font-family:var(--font);font-size:.82rem;font-weight:500;padding:7px 16px;border:1px solid var(--error-bd);border-radius:var(--radius);background:var(--error-bg);color:var(--error-fg);cursor:pointer;transition:all var(--transition);width:100%}
.drawer-footer button:hover{background:var(--error-fg);color:#fff}
.detail-meta{font-size:.8rem;color:var(--text-muted);margin-bottom:16px;line-height:1.8}
.detail-meta strong{color:var(--text);font-weight:500}
.detail-body{font-size:.9rem;line-height:1.7;color:var(--text)}
.detail-body code{font-family:var(--mono);font-size:.85em;background:var(--surface3);padding:1px 5px;border-radius:3px}
.detail-body pre{background:var(--surface3);padding:12px;border-radius:var(--radius);overflow-x:auto;margin:8px 0}
.detail-body pre code{background:none;padding:0}
.detail-body blockquote{border-left:3px solid var(--accent);padding:4px 12px;margin:8px 0;color:var(--text-muted);background:var(--surface2);border-radius:0 var(--radius-sm) var(--radius-sm) 0}
.detail-body a{color:var(--accent);text-decoration:underline}
.detail-body img{max-width:100%;border-radius:var(--radius)}
.detail-delete{margin-top:20px;padding-top:16px;border-top:1px solid var(--surface3)}
.detail-delete button{font-family:var(--font);font-size:.82rem;font-weight:500;padding:7px 16px;border:1px solid var(--error-bd);border-radius:var(--radius);background:var(--error-bg);color:var(--error-fg);cursor:pointer;transition:all var(--transition)}
.detail-delete button:hover{background:var(--error-fg);color:#fff}
[dir="rtl"] .card{direction:rtl}
[dir="rtl"] .input-group .suffix{border-left:none;border-right:1px solid var(--border)}
[dir="rtl"] .tb-mode-toggle{margin-left:0;margin-right:auto}
[dir="rtl"] #wysiwygPane blockquote,[dir="rtl"] .detail-body blockquote{border-left:none;border-right:3px solid var(--accent);padding-left:0;padding-right:.8em}
[dir="rtl"] .drawer{right:auto;left:0;transform:translateX(-100%);direction:rtl}
[dir="rtl"] .drawer.open{transform:translateX(0)}
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="card-header-left">
      <div class="logo-icon">
        <svg width="28" height="28" viewBox="0 0 32 32">
          <path d="M8 10h16v2H8zm0 5h12l4 4v5a2 2 0 01-2 2H10a2 2 0 01-2-2v-9z" fill="none" stroke="white" stroke-width="1.5"/>
          <path d="M8 15h12l4 4" fill="none" stroke="white" stroke-width="1.5"/>
        </svg>
      </div>
      <div>
        <h1>Mailgun Fire</h1>
        <div class="subtitle" id="hdr-sub" data-i18n="hdr_sub">Fire Your Mailgun</div>
      </div>
    </div>
    <div class="header-right">
      <select id="langSelect" class="lang-select">
        <option value="en">English</option>
        <option value="zh-cn">简体中文</option>
        <option value="zh-tw">繁體中文</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
        <option value="ms">Bahasa Melayu</option>
        <option value="vi">Tiếng Việt</option>
        <option value="th">ไทย</option>
        <option value="ta">தமிழ்</option>
        <option value="he">עברית</option>
        <option value="ar">العربية</option>
      </select>
      <button type="button" class="logout-btn" id="logoutBtn" style="display:none">&#x1F512; <span data-i18n="btn_logout">Logout</span></button>
    </div>
  </div>

  <form id="mailForm">
    <div class="row">
      <div>
        <label class="field-label" data-i18n="label_from">FROM</label>
        <div class="input-group">
          <input type="text" id="sender" value="{{DEFAULT_SENDER}}">
          <span class="suffix">@{{DOMAIN}}</span>
        </div>
      </div>
      <div>
        <label class="field-label" data-i18n="label_display">DISPLAY NAME</label>
        <input type="text" id="display" value="{{DEFAULT_DISPLAY}}" data-i18n-ph="ph_display" placeholder="Display name">
      </div>
    </div>

    <div class="section-divider"></div>

    <div>
      <label class="field-label" data-i18n="label_to">TO</label>
      <div class="tag-input-wrap" id="toWrap">
        <input class="tag-text" data-i18n-ph="ph_email" placeholder="email@example.com">
      </div>
      <div class="hint" data-i18n="hint_email">Press Enter, Tab, or comma to add</div>
    </div>

    <div>
      <label class="field-label" data-i18n="label_cc">CC</label>
      <div class="tag-input-wrap" id="ccWrap">
        <input class="tag-text" data-i18n-ph="ph_email" placeholder="email@example.com">
      </div>
    </div>

    <div>
      <label class="field-label" data-i18n="label_bcc">BCC</label>
      <div class="tag-input-wrap" id="bccWrap">
        <input class="tag-text" data-i18n-ph="ph_email" placeholder="email@example.com">
      </div>
    </div>

    <div class="section-divider"></div>

    <div>
      <label class="field-label" data-i18n="label_subject">SUBJECT</label>
      <input type="text" id="subject" data-i18n-ph="ph_subject" placeholder="Email subject">
    </div>

    <div>
      <div class="label-row">
        <label class="field-label" data-i18n="label_body">BODY</label>
        <label class="save-toggle" id="saveSentWrap" style="display:none">
          <input type="checkbox" id="saveSent" checked>
          <span data-i18n="save_sent">Save to sent</span>
        </label>
      </div>
      <div class="editor-wrap">
        <div class="editor-toolbar">
          <button type="button" class="tb-btn" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="tb-btn" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="tb-btn" data-cmd="underline" title="Underline"><u>U</u></button>
          <span class="tb-sep"></span>
          <button type="button" class="tb-btn" data-cmd="h1" title="Heading 1">H1</button>
          <button type="button" class="tb-btn" data-cmd="h2" title="Heading 2">H2</button>
          <button type="button" class="tb-btn" data-cmd="h3" title="Heading 3">H3</button>
          <span class="tb-sep"></span>
          <button type="button" class="tb-btn" data-cmd="insertUnorderedList" title="Bullet list">&#8226;</button>
          <button type="button" class="tb-btn" data-cmd="insertOrderedList" title="Numbered list">1.</button>
          <button type="button" class="tb-btn" data-cmd="blockquote" title="Blockquote">&ldquo;</button>
          <button type="button" class="tb-btn" data-cmd="code" title="Code">&lt;/&gt;</button>
          <span class="tb-sep"></span>
          <button type="button" class="tb-btn" data-cmd="link" title="Link">&#128279;</button>
          <button type="button" class="tb-btn" data-cmd="insertHorizontalRule" title="HR">&mdash;</button>
          <div class="tb-mode-toggle">
            <button type="button" class="tb-mode-btn active" data-mode="rich" data-i18n="mode_rich">Rich</button>
            <button type="button" class="tb-mode-btn" data-mode="md" data-i18n="mode_md">MD</button>
          </div>
        </div>
        <div id="wysiwygPane" contenteditable="true" data-i18n-ph="ph_body" data-placeholder="Compose your email..."></div>
        <textarea id="mdPane" data-i18n-ph="ph_body_md" placeholder="Write markdown here..."></textarea>
      </div>
    </div>

    <div id="status"></div>

    <div class="btn-row">
      <button type="button" class="btn-secondary" id="sentOpenBtn" style="display:none">&#128229; <span data-i18n="sent_history">View Sent</span></button>
      <button type="submit" class="btn-primary" id="sendBtn">&#9993; <span data-i18n="btn_send">Send</span></button>
    </div>
  </form>
</div>

<div class="drawer-overlay" id="drawerOverlay"></div>
<div class="drawer" id="sentDrawer">
  <div class="drawer-header">
    <button class="drawer-back" id="drawerBack" style="display:none">&larr;</button>
    <span class="drawer-title" id="drawerTitle" data-i18n="drawer_sent">Sent</span>
    <button class="drawer-close" id="drawerClose">&times;</button>
  </div>
  <div class="drawer-body" id="drawerList"></div>
  <div class="drawer-body" id="drawerDetail" style="display:none"></div>
  <div class="drawer-footer" id="drawerFooter" style="display:none">
    <button id="batchDeleteBtn" data-i18n="btn_delete">Delete selected</button>
  </div>
</div>

<script>
var I18N = {
  "en": { label_from:"FROM", label_display:"DISPLAY NAME", label_to:"TO", label_cc:"CC", label_bcc:"BCC", label_subject:"SUBJECT", label_body:"BODY", ph_display:"Display name", ph_email:"email@example.com", ph_subject:"Email subject", ph_body:"Compose your email...", ph_body_md:"Write markdown here...", hint_email:"Press Enter, Tab, or comma to add", mode_rich:"Rich", mode_md:"MD", btn_send:"Send", save_sent:"Save to sent", sent_history:"View sent", drawer_sent:"Sent", no_records:"No sent emails yet", btn_delete:"Delete selected", btn_delete_one:"Delete", err_no_to:"At least one recipient is required", err_network:"Network error", sending:"Sending...", hdr_sub:"Fire Your Mailgun", btn_logout:"Logout" },
  "zh-cn": { label_from:"发件人", label_display:"显示名称", label_to:"收件人", label_cc:"抄送", label_bcc:"密送", label_subject:"主题", label_body:"正文", ph_display:"显示名称", ph_email:"email@example.com", ph_subject:"邮件主题", ph_body:"撰写邮件...", ph_body_md:"在此编写 Markdown...", hint_email:"按 Enter、Tab 或逗号添加", mode_rich:"富文本", mode_md:"MD", btn_send:"发送", save_sent:"保存到已发送", sent_history:"查看已发送", drawer_sent:"已发送邮件", no_records:"暂无已发送邮件", btn_delete:"删除所选", btn_delete_one:"删除", err_no_to:"至少需要一个收件人", err_network:"网络错误", sending:"发送中...", hdr_sub:"扣动您的 Mailgun 扳机", btn_logout:"登出" },
  "zh-tw": { label_from:"寄件人", label_display:"顯示名稱", label_to:"收件人", label_cc:"副本", label_bcc:"密件副本", label_subject:"主旨", label_body:"內文", ph_display:"顯示名稱", ph_email:"email@example.com", ph_subject:"郵件主旨", ph_body:"撰寫郵件...", ph_body_md:"在此編寫 Markdown...", hint_email:"按 Enter、Tab 或逗號新增", mode_rich:"富文本", mode_md:"MD", btn_send:"傳送", save_sent:"儲存到已傳送", sent_history:"查看已傳送", drawer_sent:"已傳送郵件", no_records:"尚無已傳送郵件", btn_delete:"刪除所選", btn_delete_one:"刪除", err_no_to:"至少需要一個收件人", err_network:"網路錯誤", sending:"傳送中...", hdr_sub:"扣動您的 Mailgun 扳機", btn_logout:"登出" },
  "ja": { label_from:"差出人", label_display:"表示名", label_to:"宛先", label_cc:"CC", label_bcc:"BCC", label_subject:"件名", label_body:"本文", ph_display:"表示名", ph_email:"email@example.com", ph_subject:"メールの件名", ph_body:"メールを作成...", ph_body_md:"Markdownで記述...", hint_email:"Enter、Tab、またはカンマで追加", mode_rich:"リッチ", mode_md:"MD", btn_send:"送信", save_sent:"送信済みに保存", sent_history:"送信済み", drawer_sent:"送信済みメール", no_records:"送信済みメールはありません", btn_delete:"選択を削除", btn_delete_one:"削除", err_no_to:"宛先が必要です", err_network:"ネットワークエラー", sending:"送信中...", hdr_sub:"Mailgun の引き金を引け", btn_logout:"ログアウト" },
  "ko": { label_from:"보낸 사람", label_display:"표시 이름", label_to:"받는 사람", label_cc:"참조", label_bcc:"숨은 참조", label_subject:"제목", label_body:"본문", ph_display:"표시 이름", ph_email:"email@example.com", ph_subject:"이메일 제목", ph_body:"이메일 작성...", ph_body_md:"마크다운 작성...", hint_email:"Enter, Tab, 쉼표로 추가", mode_rich:"서식", mode_md:"MD", btn_send:"보내기", save_sent:"보낸 편지함에 저장", sent_history:"보낸 메일", drawer_sent:"보낸 편지함", no_records:"보낸 메일이 없습니다", btn_delete:"선택 삭제", btn_delete_one:"삭제", err_no_to:"수신자가 필요합니다", err_network:"네트워크 오류", sending:"전송 중...", hdr_sub:"Mailgun 방아쇠를 당겨라", btn_logout:"로그아웃" },
  "ms": { label_from:"DARIPADA", label_display:"NAMA PAPARAN", label_to:"KEPADA", label_cc:"CC", label_bcc:"BCC", label_subject:"SUBJEK", label_body:"ISI", ph_display:"Nama paparan", ph_email:"email@example.com", ph_subject:"Subjek e-mel", ph_body:"Tulis e-mel anda...", ph_body_md:"Tulis markdown di sini...", hint_email:"Tekan Enter, Tab, atau koma untuk menambah", mode_rich:"Kaya", mode_md:"MD", btn_send:"Hantar", save_sent:"Simpan ke dihantar", sent_history:"Dihantar", drawer_sent:"E-mel dihantar", no_records:"Tiada e-mel dihantar lagi", btn_delete:"Padam dipilih", btn_delete_one:"Padam", err_no_to:"Sekurang-kurangnya satu penerima diperlukan", err_network:"Ralat rangkaian", sending:"Menghantar...", hdr_sub:"Tarik picu Mailgun anda", btn_logout:"Log keluar" },
  "vi": { label_from:"T\u1EEA", label_display:"T\u00CAN HI\u1EC2N TH\u1ECA", label_to:"\u0110\u1EBEN", label_cc:"CC", label_bcc:"BCC", label_subject:"CH\u1EE6 \u0110\u1EC0", label_body:"N\u1ED8I DUNG", ph_display:"T\u00EAn hi\u1EC3n th\u1ECB", ph_email:"email@example.com", ph_subject:"Ch\u1EE7 \u0111\u1EC1 email", ph_body:"So\u1EA1n email...", ph_body_md:"Vi\u1EBFt markdown t\u1EA1i \u0111\u00E2y...", hint_email:"Nh\u1EA5n Enter, Tab ho\u1EB7c d\u1EA5u ph\u1EA9y \u0111\u1EC3 th\u00EAm", mode_rich:"Giàu", mode_md:"MD", btn_send:"G\u1EEDi", save_sent:"L\u01B0u vào \u0111ã g\u1EEDi", sent_history:"\u0110ã g\u1EEDi", drawer_sent:"\u0110\u00E3 g\u1EEDi", no_records:"Ch\u01B0a c\u00F3 email \u0111ã g\u1EEDi", btn_delete:"X\u00F3a \u0111ã ch\u1ECDn", btn_delete_one:"X\u00F3a", err_no_to:"C\u1EA7n \u00EDt nh\u1EA5t m\u1ED9t ng\u01B0\u1EDDi nh\u1EADn", err_network:"L\u1ED7i m\u1EA1ng", sending:"\u0110ang g\u1EEDi...", hdr_sub:"Bóp cò Mailgun của bạn", btn_logout:"Đăng xuất" },
  "th": { label_from:"\u0E08\u0E32\u0E01", label_display:"\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07", label_to:"\u0E16\u0E36\u0E07", label_cc:"\u0E2A\u0E33\u0E40\u0E19\u0E32", label_bcc:"\u0E2A\u0E33\u0E40\u0E19\u0E32\u0E25\u0E31\u0E1A", label_subject:"\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D", label_body:"\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32", ph_display:"\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E41\u0E2A\u0E14\u0E07", ph_email:"email@example.com", ph_subject:"\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E2D\u0E35\u0E40\u0E21\u0E25", ph_body:"\u0E40\u0E02\u0E35\u0E22\u0E19\u0E2D\u0E35\u0E40\u0E21\u0E25...", ph_body_md:"\u0E40\u0E02\u0E35\u0E22\u0E19 Markdown \u0E17\u0E35\u0E48\u0E19\u0E35\u0E48...", hint_email:"\u0E01\u0E14 Enter, Tab \u0E2B\u0E23\u0E37\u0E2D\u0E08\u0E38\u0E25\u0E20\u0E32\u0E04\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21", mode_rich:"\u0E23\u0E34\u0E0A", mode_md:"MD", btn_send:"\u0E2A\u0E48\u0E07", save_sent:"\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07", sent_history:"\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27", drawer_sent:"\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27", no_records:"\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07", btn_delete:"\u0E25\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01", btn_delete_one:"\u0E25\u0E1A", err_no_to:"\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E23\u0E32\u0E22", err_network:"\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E40\u0E04\u0E23\u0E37\u0E2D\u0E02\u0E48\u0E32\u0E22", sending:"\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07...", hdr_sub:"ลั่นไก Mailgun ของคุณ", btn_logout:"ออกจากระบบ" },
  "ta": { label_from:"\u0B87\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4\u0BC1", label_display:"\u0B95\u0BBE\u0B9F\u0BCD\u0B9A\u0BBF\u0BAA\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD", label_to:"\u0B95\u0BC1", label_cc:"\u0BAA\u0BBF\u0BB0\u0BA4\u0BBF", label_bcc:"\u0BAE\u0BB1\u0BC8 \u0BAA\u0BBF\u0BB0\u0BA4\u0BBF", label_subject:"\u0BAA\u0BCA\u0BB0\u0BC1\u0BB3\u0BCD", label_body:"\u0B89\u0BB3\u0BCD\u0BB3\u0B9F\u0B95\u0BCD\u0B95\u0BAE\u0BCD", ph_display:"\u0B95\u0BBE\u0B9F\u0BCD\u0B9A\u0BBF\u0BAA\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD", ph_email:"email@example.com", ph_subject:"\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0BB3\u0BCD", ph_body:"\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0B8E\u0BB4\u0BC1\u0BA4\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD...", ph_body_md:"Markdown \u0B8E\u0BB4\u0BC1\u0BA4\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD...", hint_email:"Enter, Tab \u0B85\u0BB2\u0BCD\u0BB2\u0BA4\u0BC1 \u0B95\u0BBE\u0BB1\u0BCD\u0BAA\u0BC1\u0BB3\u0BCD\u0BB3\u0BBF \u0B85\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BB5\u0BC1\u0BAE\u0BCD", mode_rich:"\u0BB0\u0BBF\u0B9A\u0BCD", mode_md:"MD", btn_send:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1", save_sent:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BBF\u0BAF\u0BA4\u0BBF\u0BB2\u0BCD \u0B9A\u0BC7\u0BAE\u0BBF", sent_history:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BBF\u0BAF\u0BA4\u0BC1", drawer_sent:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BBF\u0BAF\u0BA4\u0BC1", no_records:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BBF\u0BAF \u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0B87\u0BB2\u0BCD\u0BB2\u0BC8", btn_delete:"\u0BA4\u0BC7\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BA4\u0BC8 \u0BA8\u0BC0\u0B95\u0BCD\u0B95\u0BC1", btn_delete_one:"\u0BA8\u0BC0\u0B95\u0BCD\u0B95\u0BC1", err_no_to:"\u0B92\u0BB0\u0BC1 \u0BAA\u0BC6\u0BB1\u0BC1\u0BA8\u0BB0\u0BBE\u0BB5\u0BA4\u0BC1 \u0BA4\u0BC7\u0BB5\u0BC8", err_network:"\u0BAA\u0BBF\u0BA3\u0BC8\u0BAF\u0BAA\u0BCD \u0BAA\u0BBF\u0BB4\u0BC8", sending:"\u0B85\u0BA9\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1...", hdr_sub:"உங்கள் Mailgun-ஐ சுடுங்கள்", btn_logout:"வெளியேறு" },
  "he": { label_from:"\u05DE\u05D0\u05EA", label_display:"\u05E9\u05DD \u05EA\u05E6\u05D5\u05D2\u05D4", label_to:"\u05D0\u05DC", label_cc:"\u05D4\u05E2\u05EA\u05E7", label_bcc:"\u05D4\u05E2\u05EA\u05E7 \u05E1\u05DE\u05D5\u05D9", label_subject:"\u05E0\u05D5\u05E9\u05D0", label_body:"\u05D2\u05D5\u05E3", ph_display:"\u05E9\u05DD \u05EA\u05E6\u05D5\u05D2\u05D4", ph_email:"email@example.com", ph_subject:"\u05E0\u05D5\u05E9\u05D0 \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", ph_body:"\u05DB\u05EA\u05D5\u05D1 \u05D0\u05EA \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC...", ph_body_md:"\u05DB\u05EA\u05D5\u05D1 Markdown \u05DB\u05D0\u05DF...", hint_email:"\u05DC\u05D7\u05E5 Enter\u200F, Tab \u05D0\u05D5 \u05E4\u05E1\u05D9\u05E7 \u05DC\u05D4\u05D5\u05E1\u05E4\u05D4", mode_rich:"\u05E2\u05E9\u05D9\u05E8", mode_md:"MD", btn_send:"\u05E9\u05DC\u05D7", save_sent:"\u05E9\u05DE\u05D5\u05E8 \u05D1\u05E0\u05E9\u05DC\u05D7", sent_history:"\u05E0\u05E9\u05DC\u05D7", drawer_sent:"\u05E0\u05E9\u05DC\u05D7", no_records:"\u05D0\u05D9\u05DF \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC\u05D9\u05DD \u05E9\u05E0\u05E9\u05DC\u05D7\u05D5", btn_delete:"\u05DE\u05D7\u05E7 \u05E0\u05D1\u05D7\u05E8\u05D9\u05DD", btn_delete_one:"\u05DE\u05D7\u05E7", err_no_to:"\u05E0\u05D3\u05E8\u05E9 \u05DC\u05E4\u05D7\u05D5\u05EA \u05E0\u05DE\u05E2\u05DF \u05D0\u05D7\u05D3", err_network:"\u05E9\u05D2\u05D9\u05D0\u05EA \u05E8\u05E9\u05EA", sending:"\u05E9\u05D5\u05DC\u05D7...", hdr_sub:"לחץ על ההדק של Mailgun", btn_logout:"התנתק" },
  "ar": { label_from:"\u0645\u0646", label_display:"\u0627\u0633\u0645 \u0627\u0644\u0639\u0631\u0636", label_to:"\u0625\u0644\u0649", label_cc:"\u0646\u0633\u062E\u0629", label_bcc:"\u0646\u0633\u062E\u0629 \u0645\u062E\u0641\u064A\u0629", label_subject:"\u0627\u0644\u0645\u0648\u0636\u0648\u0639", label_body:"\u0627\u0644\u0646\u0635", ph_display:"\u0627\u0633\u0645 \u0627\u0644\u0639\u0631\u0636", ph_email:"email@example.com", ph_subject:"\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0628\u0631\u064A\u062F", ph_body:"\u0627\u0643\u062A\u0628 \u0628\u0631\u064A\u062F\u0643...", ph_body_md:"\u0627\u0643\u062A\u0628 Markdown \u0647\u0646\u0627...", hint_email:"\u0627\u0636\u063A\u0637 Enter \u0623\u0648 Tab \u0623\u0648 \u0641\u0627\u0635\u0644\u0629 \u0644\u0644\u0625\u0636\u0627\u0641\u0629", mode_rich:"\u063A\u0646\u064A", mode_md:"MD", btn_send:"\u0625\u0631\u0633\u0627\u0644", save_sent:"\u062D\u0641\u0638 \u0641\u064A \u0627\u0644\u0645\u0631\u0633\u0644", sent_history:"\u0627\u0644\u0645\u0631\u0633\u0644", drawer_sent:"\u0627\u0644\u0645\u0631\u0633\u0644", no_records:"\u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u0633\u0627\u0626\u0644 \u0645\u0631\u0633\u0644\u0629", btn_delete:"\u062D\u0630\u0641 \u0627\u0644\u0645\u062D\u062F\u062F", btn_delete_one:"\u062D\u0630\u0641", err_no_to:"\u0645\u0637\u0644\u0648\u0628 \u0645\u0633\u062A\u0644\u0645 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", err_network:"\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0634\u0628\u0643\u0629", sending:"\u062C\u0627\u0631\u064D \u0627\u0644\u0625\u0631\u0633\u0627\u0644...", hdr_sub:"اضغط على زناد Mailgun", btn_logout:"تسجيل خروج" }
};

var RTL_LANGS = { "he": true, "ar": true };
var currentLang = "en";
var DOMAIN = "{{DOMAIN}}";

function detectLang() {
  var supported = ["en","zh-cn","zh-tw","ja","ko","ms","vi","th","ta","he","ar"];
  var langs = navigator.languages || [navigator.language || "en"];
  for (var i = 0; i < langs.length; i++) {
    var tag = langs[i].toLowerCase();
    if (tag === "zh-hant" || tag === "zh-tw" || tag === "zh-hk" || tag === "zh-mo") return "zh-tw";
    if (tag.indexOf("zh") === 0) return "zh-cn";
    for (var j = 0; j < supported.length; j++) {
      if (tag === supported[j]) return supported[j];
    }
    var prefix = tag.split("-")[0];
    for (var k = 0; k < supported.length; k++) {
      if (supported[k] === prefix) return supported[k];
    }
  }
  return "en";
}

function applyI18n() {
  var t = I18N[currentLang] || I18N["en"];
  document.documentElement.dir = RTL_LANGS[currentLang] ? "rtl" : "ltr";

  document.title = "Mailgun Fire — " + t.hdr_sub;

  var els = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute("data-i18n");
    if (t[key]) {
      els[i].textContent = t[key];
    }
  }

  var phEls = document.querySelectorAll("[data-i18n-ph]");
  for (var j = 0; j < phEls.length; j++) {
    var phKey = phEls[j].getAttribute("data-i18n-ph");
    if (t[phKey]) {
      if (phEls[j].tagName === "DIV") {
        phEls[j].dataset.placeholder = t[phKey];
      } else {
        phEls[j].placeholder = t[phKey];
      }
    }
  }
}

var langSelect = document.getElementById("langSelect");
currentLang = detectLang();
langSelect.value = currentLang;
applyI18n();
langSelect.addEventListener("change", function() {
  currentLang = langSelect.value;
  applyI18n();
});

/* Markdown */
var md = window.markdownit({ html: false, linkify: true, typographer: true });
function mdToHtml(src) { return md.render(src); }

function htmlToMd(html) {
  var s = html;
  s = s.replace(/<h1[^>]*>(.*?)<\\/h1>/gi, "# $1\\n\\n");
  s = s.replace(/<h2[^>]*>(.*?)<\\/h2>/gi, "## $1\\n\\n");
  s = s.replace(/<h3[^>]*>(.*?)<\\/h3>/gi, "### $1\\n\\n");
  s = s.replace(/<h4[^>]*>(.*?)<\\/h4>/gi, "#### $1\\n\\n");
  s = s.replace(/<h5[^>]*>(.*?)<\\/h5>/gi, "##### $1\\n\\n");
  s = s.replace(/<h6[^>]*>(.*?)<\\/h6>/gi, "###### $1\\n\\n");
  s = s.replace(/<strong[^>]*>(.*?)<\\/strong>/gi, "**$1**");
  s = s.replace(/<b[^>]*>(.*?)<\\/b>/gi, "**$1**");
  s = s.replace(/<em[^>]*>(.*?)<\\/em>/gi, "*$1*");
  s = s.replace(/<i[^>]*>(.*?)<\\/i>/gi, "*$1*");
  s = s.replace(/<u[^>]*>(.*?)<\\/u>/gi, "$1");
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\\/a>/gi, "[$2]($1)");
  s = s.replace(/<code[^>]*>(.*?)<\\/code>/gi, "\`$1\`");
  s = s.replace(/<blockquote[^>]*>(.*?)<\\/blockquote>/gi, function(m, c) {
    var text = c.replace(/<[^>]+>/g, "").trim();
    return "> " + text + "\\n\\n";
  });
  s = s.replace(/<li[^>]*>(.*?)<\\/li>/gi, "- $1\\n");
  s = s.replace(/<hr[^>]*\\/?>/gi, "---\\n\\n");
  s = s.replace(/<br[^>]*\\/?>/gi, "\\n");
  s = s.replace(/<p[^>]*>(.*?)<\\/p>/gi, "$1\\n\\n");
  s = s.replace(/<div[^>]*>(.*?)<\\/div>/gi, "$1\\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  s = s.replace(/\\n{3,}/g, "\\n\\n");
  return s.trim();
}

/* TagInput */
function TagInput(wrapEl) {
  var self = this;
  self.wrap = wrapEl;
  self.input = wrapEl.querySelector("input.tag-text");
  self.tags = [];

  self.emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

  self.render = function() {
    var chips = self.wrap.querySelectorAll(".tag-chip");
    for (var i = 0; i < chips.length; i++) chips[i].remove();
    for (var j = 0; j < self.tags.length; j++) {
      var chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = self.tags[j];
      var rm = document.createElement("span");
      rm.className = "remove";
      rm.textContent = "\\u00d7";
      rm.dataset.idx = j;
      rm.addEventListener("click", function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.idx);
        self.tags.splice(idx, 1);
        self.render();
      });
      chip.appendChild(rm);
      self.wrap.insertBefore(chip, self.input);
    }
  };

  self.addTag = function(val) {
    var v = val.trim();
    if (!v) return false;
    if (!self.emailRegex.test(v)) return false;
    if (self.tags.indexOf(v) !== -1) return false;
    self.tags.push(v);
    self.render();
    return true;
  };

  self.wrap.addEventListener("click", function() { self.input.focus(); });

  self.input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (self.addTag(self.input.value)) self.input.value = "";
    }
    if (e.key === "Backspace" && self.input.value === "" && self.tags.length > 0) {
      self.tags.pop();
      self.render();
    }
  });

  self.input.addEventListener("paste", function(e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text");
    var parts = text.split(/[,;\\s]+/);
    for (var i = 0; i < parts.length; i++) self.addTag(parts[i]);
  });

  self.input.addEventListener("blur", function() {
    if (self.input.value.trim()) {
      if (self.addTag(self.input.value)) self.input.value = "";
    }
  });
}

var toInput = new TagInput(document.getElementById("toWrap"));
var ccInput = new TagInput(document.getElementById("ccWrap"));
var bccInput = new TagInput(document.getElementById("bccWrap"));

/* Editor */
var wysiwygPane = document.getElementById("wysiwygPane");
var mdPane = document.getElementById("mdPane");
var editorMode = "rich";

var modeButtons = document.querySelectorAll(".tb-mode-btn");
for (var mi = 0; mi < modeButtons.length; mi++) {
  modeButtons[mi].addEventListener("click", function() {
    var mode = this.getAttribute("data-mode");
    if (mode === editorMode) return;
    if (mode === "md") {
      mdPane.value = htmlToMd(wysiwygPane.innerHTML);
      wysiwygPane.style.display = "none";
      mdPane.style.display = "block";
    } else {
      wysiwygPane.innerHTML = mdToHtml(mdPane.value);
      mdPane.style.display = "none";
      wysiwygPane.style.display = "block";
    }
    editorMode = mode;
    for (var k = 0; k < modeButtons.length; k++) {
      modeButtons[k].classList.toggle("active", modeButtons[k].getAttribute("data-mode") === mode);
    }
  });
}

var tbButtons = document.querySelectorAll(".tb-btn[data-cmd]");
for (var bi = 0; bi < tbButtons.length; bi++) {
  tbButtons[bi].addEventListener("click", function() {
    var cmd = this.getAttribute("data-cmd");
    if (editorMode === "md") return;
    wysiwygPane.focus();
    if (cmd === "h1" || cmd === "h2" || cmd === "h3") {
      document.execCommand("formatBlock", false, cmd);
    } else if (cmd === "blockquote") {
      document.execCommand("formatBlock", false, "blockquote");
    } else if (cmd === "code") {
      var sel = window.getSelection();
      if (sel.rangeCount) {
        var range = sel.getRangeAt(0);
        var code = document.createElement("code");
        try { range.surroundContents(code); } catch(e) {}
      }
    } else if (cmd === "link") {
      var url = prompt("URL:");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
  });
}

function getBodyMarkdown() {
  if (editorMode === "md") return mdPane.value;
  return htmlToMd(wysiwygPane.innerHTML);
}

function getBodyHtml() {
  if (editorMode === "rich") return wysiwygPane.innerHTML;
  return mdToHtml(mdPane.value);
}

/* KV_BOUND */
var KV_BOUND = "{{KV_BOUND}}" === "true";
if (KV_BOUND) {
  document.getElementById("saveSentWrap").style.display = "";
  document.getElementById("sentOpenBtn").style.display = "";
}

/* Logout */
var LOCKED = "{{LOCKED}}" === "true";
if (LOCKED) {
  var logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.style.display = "";
  logoutBtn.addEventListener("click", function() {
    document.cookie = "mf_auth=; Path=/; Max-Age=0; Secure; SameSite=Strict";
    window.location.reload();
  });
}

/* Status */
function showStatus(ok, msg) {
  var el = document.getElementById("status");
  el.className = ok ? "ok" : "err";
  el.textContent = msg;
  el.style.display = "block";
  if (ok) setTimeout(function() { el.style.display = "none"; }, 5000);
}

/* Form submit */
document.getElementById("mailForm").addEventListener("submit", function(e) {
  e.preventDefault();
  var t = I18N[currentLang] || I18N["en"];

  if (toInput.input.value.trim()) toInput.addTag(toInput.input.value);
  if (ccInput.input.value.trim()) ccInput.addTag(ccInput.input.value);
  if (bccInput.input.value.trim()) bccInput.addTag(bccInput.input.value);

  if (toInput.tags.length === 0) {
    showStatus(false, t.err_no_to);
    return;
  }

  var bodyMd = getBodyMarkdown();
  var bodyHtml = getBodyHtml();
  var payload = {
    sender: document.getElementById("sender").value,
    display: document.getElementById("display").value,
    to: toInput.tags.join(", "),
    cc: ccInput.tags.join(", "),
    bcc: bccInput.tags.join(", "),
    subject: document.getElementById("subject").value,
    body: bodyMd,
    html: bodyHtml,
    save_sent: KV_BOUND && document.getElementById("saveSent").checked
  };

  var btn = document.getElementById("sendBtn");
  var btnLabel = btn.querySelector("[data-i18n]");
  btn.disabled = true;
  btnLabel.textContent = t.sending;
  showStatus(false, "");
  document.getElementById("status").style.display = "none";

  fetch(window.location.pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(function(res) { return res.json(); }).then(function(data) {
    btn.disabled = false;
    btnLabel.textContent = t.btn_send;
    if (data.success) {
      showStatus(true, data.message || "Sent!");
      toInput.tags = []; toInput.render(); toInput.input.value = "";
      ccInput.tags = []; ccInput.render(); ccInput.input.value = "";
      bccInput.tags = []; bccInput.render(); bccInput.input.value = "";
      document.getElementById("subject").value = "";
      wysiwygPane.innerHTML = "";
      mdPane.value = "";
    } else {
      showStatus(false, data.error || "Error");
    }
  }).catch(function(err) {
    btn.disabled = false;
    btnLabel.textContent = t.btn_send;
    showStatus(false, t.err_network + ": " + err.message);
  });
});

/* Drawer */
var drawerOverlay = document.getElementById("drawerOverlay");
var sentDrawer = document.getElementById("sentDrawer");
var drawerList = document.getElementById("drawerList");
var drawerDetail = document.getElementById("drawerDetail");
var drawerFooter = document.getElementById("drawerFooter");
var drawerBack = document.getElementById("drawerBack");
var drawerTitle = document.getElementById("drawerTitle");

function openDrawer() {
  drawerOverlay.classList.add("open");
  sentDrawer.classList.add("open");
  showListView();
  loadSentList();
}

function closeDrawer() {
  drawerOverlay.classList.remove("open");
  sentDrawer.classList.remove("open");
}

function showListView() {
  drawerList.style.display = "";
  drawerDetail.style.display = "none";
  drawerBack.style.display = "none";
  drawerFooter.style.display = "none";
  var t = I18N[currentLang] || I18N["en"];
  drawerTitle.textContent = t.drawer_sent || "Sent";
}

function showDetailView() {
  drawerList.style.display = "none";
  drawerDetail.style.display = "";
  drawerBack.style.display = "";
  drawerFooter.style.display = "none";
}

document.getElementById("sentOpenBtn").addEventListener("click", function() { openDrawer(); });
document.getElementById("drawerClose").addEventListener("click", function() { closeDrawer(); });
drawerOverlay.addEventListener("click", function() { closeDrawer(); });
drawerBack.addEventListener("click", function() { showListView(); loadSentList(); });

function loadSentList() {
  var t = I18N[currentLang] || I18N["en"];
  drawerList.innerHTML = "<div style='text-align:center;padding:20px;color:var(--text-dim)'>" + t.sending.replace("...", "") + "...</div>";
  fetch("/sent").then(function(r) { return r.json(); }).then(function(data) {
    var items = data.items || [];
    if (items.length === 0) {
      drawerList.innerHTML = "<div style='text-align:center;padding:40px 20px;color:var(--text-dim)'>" + t.no_records + "</div>";
      return;
    }
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var rec = items[i];
      var d = new Date(rec.ts).toLocaleString();
      html += "<div class='sent-item' data-id='" + rec.id + "'>";
      html += "<input type='checkbox' data-id='" + rec.id + "'>";
      html += "<div class='sent-item-content'>";
      html += "<div class='sent-item-subject'>" + escHtml(rec.subject || "(no subject)") + "</div>";
      html += "<div class='sent-item-meta'>" + escHtml(rec.from || "") + " &mdash; " + d + "</div>";
      html += "</div></div>";
    }
    drawerList.innerHTML = html;

    var checkboxes = drawerList.querySelectorAll("input[type=checkbox]");
    for (var c = 0; c < checkboxes.length; c++) {
      checkboxes[c].addEventListener("change", function() { toggleFooter(); });
      checkboxes[c].addEventListener("click", function(e) { e.stopPropagation(); });
    }

    var contents = drawerList.querySelectorAll(".sent-item-content");
    for (var ci = 0; ci < contents.length; ci++) {
      contents[ci].addEventListener("click", function() {
        var id = this.parentElement.getAttribute("data-id");
        loadDetail(id);
      });
    }
  }).catch(function() {
    drawerList.innerHTML = "<div style='text-align:center;padding:40px 20px;color:var(--error-fg)'>Failed to load</div>";
  });
}

function toggleFooter() {
  var checked = drawerList.querySelectorAll("input[type=checkbox]:checked");
  drawerFooter.style.display = checked.length > 0 ? "block" : "none";
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.getElementById("batchDeleteBtn").addEventListener("click", function() {
  var checked = drawerList.querySelectorAll("input[type=checkbox]:checked");
  var ids = [];
  for (var i = 0; i < checked.length; i++) ids.push(checked[i].getAttribute("data-id"));
  if (ids.length === 0) return;
  fetch("/sent/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ids })
  }).then(function(r) { return r.json(); }).then(function() {
    loadSentList();
    drawerFooter.style.display = "none";
  });
});

function loadDetail(id) {
  showDetailView();
  drawerDetail.innerHTML = "<div style='text-align:center;padding:20px;color:var(--text-dim)'>Loading...</div>";
  fetch("/sent/" + id).then(function(r) { return r.json(); }).then(function(rec) {
    var d = new Date(rec.ts).toLocaleString();
    var lang = I18N[currentLang] || I18N["en"];
    var joinArr = function(v) { return Array.isArray(v) ? v.join(", ") : (v || ""); };
    var metaHtml = "<strong>" + lang.label_from + ":</strong> " + escHtml(rec.from || "") + "<br>";
    metaHtml += "<strong>" + lang.label_to + ":</strong> " + escHtml(joinArr(rec.to)) + "<br>";
    if (rec.cc && rec.cc.length) metaHtml += "<strong>" + lang.label_cc + ":</strong> " + escHtml(joinArr(rec.cc)) + "<br>";
    if (rec.bcc && rec.bcc.length) metaHtml += "<strong>" + lang.label_bcc + ":</strong> " + escHtml(joinArr(rec.bcc)) + "<br>";
    metaHtml += "<strong>" + lang.label_subject + ":</strong> " + escHtml(rec.subject || "") + "<br>";
    metaHtml += "<div style='color:var(--text-dim);margin-top:4px'>" + d + "</div>";

    var bodyRendered = mdToHtml(rec.body || "");

    drawerDetail.innerHTML = "<div class='detail-meta'>" + metaHtml + "</div>"
      + "<div class='detail-body'>" + bodyRendered + "</div>"
      + "<div class='detail-delete'><button onclick='deleteOne(&quot;" + rec.id + "&quot;)'>" + (lang.btn_delete_one || "Delete") + "</button></div>";
  }).catch(function() {
    drawerDetail.innerHTML = "<div style='text-align:center;padding:40px 20px;color:var(--error-fg)'>Failed to load</div>";
  });
}

function deleteOne(id) {
  fetch("/sent/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] })
  }).then(function(r) { return r.json(); }).then(function() {
    showListView();
    loadSentList();
  });
}
<\/script>
</body>
</html>`;

function handleGet(env, cdnHost) {
  const cfg = getConfig(env);
  if (cfg.error) {
    return new Response(JSON.stringify({ error: cfg.error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const kvBound = env.SENT ? 'true' : 'false';
  const locked = env.LOCK ? 'true' : 'false';
  const html = HTML_TEMPLATE
    .replace(/\{\{CDN_HOST\}\}/g, cdnHost)
    .replace(/\{\{KV_BOUND\}\}/g, kvBound)
    .replace(/\{\{LOCKED\}\}/g, locked)
    .replace(/\{\{DOMAIN\}\}/g, cfg.domain)
    .replace(/\{\{DEFAULT_SENDER\}\}/g, cfg.login)
    .replace(/\{\{DEFAULT_DISPLAY\}\}/g, cfg.display);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

async function handlePost(request, env) {
  const cfg = getConfig(env);
  if (cfg.error) {
    return new Response(JSON.stringify({ error: cfg.error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sender = input.sender || cfg.login;
  const display = input.display || cfg.display;
  const to = input.to;
  const cc = input.cc || '';
  const bcc = input.bcc || '';
  const subject = input.subject;
  const body = input.body;
  const html = input.html || '';

  if (!to) {
    return new Response(JSON.stringify({ error: 'to is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!subject) {
    return new Response(JSON.stringify({ error: 'subject is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!body) {
    return new Response(JSON.stringify({ error: 'body is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fromAddr = display
    ? `${display} <${sender}@${cfg.domain}>`
    : `${sender}@${cfg.domain}`;

  const apiBase = cfg.eu
    ? 'https://api.eu.mailgun.net'
    : 'https://api.mailgun.net';

  const formData = new FormData();
  formData.append('from', fromAddr);
  formData.append('to', to);
  if (cc) formData.append('cc', cc);
  if (bcc) formData.append('bcc', bcc);
  formData.append('subject', subject);
  formData.append('text', body);
  formData.append('html', html || body);

  const mgUrl = `${apiBase}/v3/${cfg.domain}/messages`;
  const authHeader = 'Basic ' + btoa('api:' + cfg.apiKey);

  let mgResp;
  try {
    mgResp = await fetch(mgUrl, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: formData,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Mailgun request failed: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mgBody = await mgResp.text();
  let mgJson;
  try {
    mgJson = JSON.parse(mgBody);
  } catch {
    mgJson = { message: mgBody };
  }

  if (!mgResp.ok) {
    return new Response(JSON.stringify({ error: mgJson.message || 'Mailgun error', status: mgResp.status }), {
      status: mgResp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Save to KV if bound and requested
  if (env.SENT && input.save_sent !== false) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const record = {
      id,
      from: fromAddr,
      to,
      cc,
      bcc,
      subject,
      body,
      ts: Date.now(),
    };
    const kvOpts = {};
    const ttl = parseInt(env.TTL, 10);
    if (ttl > 0) kvOpts.expirationTtl = ttl;
    await env.SENT.put('sent:' + id, JSON.stringify(record), kvOpts);
  }

  return new Response(JSON.stringify({ success: true, message: mgJson.message || 'Queued' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSentList(env, url) {
  if (!env.SENT) {
    return new Response(JSON.stringify({ items: [], error: 'KV not bound' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const cursor = url.searchParams.get('cursor') || undefined;

  const listResult = await env.SENT.list({ prefix: 'sent:', limit, cursor });
  const items = [];
  for (const key of listResult.keys) {
    const val = await env.SENT.get(key.name);
    if (val) {
      try {
        items.push(JSON.parse(val));
      } catch {}
    }
  }

  return new Response(JSON.stringify({
    items,
    cursor: listResult.list_complete ? null : listResult.cursor,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSentDetail(env, id) {
  if (!env.SENT) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const val = await env.SENT.get('sent:' + id);
  if (!val) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(val, {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSentDelete(request, env) {
  if (!env.SENT) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ids = input.ids || [];
  for (const id of ids) {
    await env.SENT.delete('sent:' + id);
  }

  return new Response(JSON.stringify({ success: true, deleted: ids.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hashToken(password) {
  const data = new TextEncoder().encode('mf:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleUnlock(request, env) {
  const headers = { 'Content-Type': 'application/json' };
  if (!env.LOCK) {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }
  let input;
  try { input = await request.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400, headers });
  }
  if (input.password !== env.LOCK) {
    return new Response(JSON.stringify({ ok: false }), { status: 403, headers });
  }
  const token = await hashToken(env.LOCK);
  const maxAge = input.remember ? 2592000 : 86400; // 30 days or 1 day
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'mf_auth=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge,
    },
  });
}

function handleLockPage(env, cdnHost) {
  const html = LOCK_TEMPLATE.replace(/\{\{CDN_HOST\}\}/g, cdnHost);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

const LOCK_TEMPLATE = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mailgun Fire</title>' +
'<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Cdefs%3E%3ClinearGradient id=\'g\' x1=\'0%25\' y1=\'0%25\' x2=\'100%25\' y2=\'100%25\'%3E%3Cstop offset=\'0%25\' stop-color=\'%25232563eb\'/%3E%3Cstop offset=\'100%25\' stop-color=\'%252306b6d4\'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=\'32\' height=\'32\' rx=\'6\' fill=\'url(%2523g)\'/%3E%3Cpath d=\'M8 10h16v2H8zm0 5h12l4 4v5a2 2 0 01-2 2H10a2 2 0 01-2-2v-9z\' fill=\'none\' stroke=\'white\' stroke-width=\'1.5\'/%3E%3Cpath d=\'M8 15h12l4 4\' fill=\'none\' stroke=\'white\' stroke-width=\'1.5\'/%3E%3C/svg%3E">' +
'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Inter","Segoe UI",system-ui,sans-serif;background:linear-gradient(135deg,#e0e7ff 0%,#f4f6f9 40%,#ecfeff 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}' +
'.lock-card{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.08);padding:40px 36px;width:100%;max-width:380px;text-align:center}' +
'.lock-icon{width:56px;height:56px;margin:0 auto 20px;background:linear-gradient(135deg,#2563eb,#06b6d4);border-radius:14px;display:flex;align-items:center;justify-content:center}' +
'.lock-card h1{font-size:1.3rem;font-weight:700;color:#1e293b;margin-bottom:6px}' +
'.lock-card p{font-size:.85rem;color:#64748b;margin-bottom:20px}' +
'.lock-card input[type=password]{width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:.95rem;outline:none;transition:border-color .2s,box-shadow .2s}' +
'.lock-card input[type=password]:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}' +
'.lock-card .remember{display:flex;align-items:center;gap:6px;margin:14px 0 18px;font-size:.8rem;color:#64748b;cursor:pointer;justify-content:center}' +
'.lock-card .remember input{accent-color:#2563eb;cursor:pointer}' +
'.lock-card button{width:100%;padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;font-size:.95rem;font-weight:600;cursor:pointer;transition:filter .2s,box-shadow .2s}' +
'.lock-card button:hover{filter:brightness(1.05);box-shadow:0 4px 16px rgba(37,99,235,.3)}' +
'.lock-card button:disabled{opacity:.5;cursor:not-allowed}' +
'.lock-err{color:#dc2626;font-size:.82rem;margin-top:12px;min-height:1.2em}</style></head>' +
'<body><div class="lock-card">' +
'<div class="lock-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>' +
'<h1>Mailgun Fire</h1>' +
'<p id="lockMsg"></p>' +
'<form id="lockForm"><input type="password" id="lockPw" autofocus required>' +
'<label class="remember"><input type="checkbox" id="lockRemember"> <span id="lockRemLabel"></span></label>' +
'<button type="submit" id="lockBtn"></button>' +
'<div class="lock-err" id="lockErr"></div></form></div>' +
'<script>' +
'var L={' +
'en:{msg:"Enter password to continue",ph:"Password",rem:"Remember for 30 days",btn:"Unlock",wrong:"Wrong password",net:"Network error"},' +
'"zh-cn":{msg:"请输入密码以继续",ph:"密码",rem:"30天内不再要求密码",btn:"解锁",wrong:"密码错误",net:"网络错误"},' +
'"zh-tw":{msg:"請輸入密碼以繼續",ph:"密碼",rem:"30天內不再要求密碼",btn:"解鎖",wrong:"密碼錯誤",net:"網路錯誤"},' +
'ja:{msg:"パスワードを入力してください",ph:"パスワード",rem:"30日間パスワードを要求しない",btn:"ロック解除",wrong:"パスワードが違います",net:"ネットワークエラー"},' +
'ko:{msg:"비밀번호를 입력하세요",ph:"비밀번호",rem:"30일간 비밀번호 요구 안 함",btn:"잠금 해제",wrong:"비밀번호가 틀렸습니다",net:"네트워크 오류"},' +
'ms:{msg:"Masukkan kata laluan untuk meneruskan",ph:"Kata laluan",rem:"Ingat selama 30 hari",btn:"Buka kunci",wrong:"Kata laluan salah",net:"Ralat rangkaian"},' +
'vi:{msg:"Nhập mật khẩu để tiếp tục",ph:"Mật khẩu",rem:"Ghi nhớ 30 ngày",btn:"Mở khóa",wrong:"Sai mật khẩu",net:"Lỗi mạng"},' +
'th:{msg:"กรุณาใส่รหัสผ่านเพื่อดำเนินการต่อ",ph:"รหัสผ่าน",rem:"จำไว้ 30 วัน",btn:"ปลดล็อก",wrong:"รหัสผ่านผิด",net:"ข้อผิดพลาดเครือข่าย"},' +
'ta:{msg:"தொடர கடவுச்சொல்லை உள்ளிடவும்",ph:"கடவுச்சொல்",rem:"30 நாட்கள் நினைவில் வை",btn:"திறக்க",wrong:"தவறான கடவுச்சொல்",net:"பிணையப் பிழை"},' +
'he:{msg:"הזן סיסמה כדי להמשיך",ph:"סיסמה",rem:"זכור למשך 30 יום",btn:"פתח נעילה",wrong:"סיסמה שגויה",net:"שגיאת רשת"},' +
'ar:{msg:"أدخل كلمة المرور للمتابعة",ph:"كلمة المرور",rem:"تذكر لمدة 30 يومًا",btn:"فتح القفل",wrong:"كلمة المرور خاطئة",net:"خطأ في الشبكة"}' +
'};' +
'function dl(){var s=Object.keys(L);var c=navigator.languages||[navigator.language||"en"];' +
'for(var i=0;i<c.length;i++){var l=c[i].toLowerCase();if(s.indexOf(l)!==-1)return l;' +
'if(/^zh-(hant|tw|hk|mo)/.test(l))return"zh-tw";if(/^zh/.test(l))return"zh-cn";' +
'var p=l.split("-")[0];if(s.indexOf(p)!==-1)return p;}return"en";}' +
'var t=L[dl()]||L.en;' +
'document.getElementById("lockMsg").textContent=t.msg;' +
'document.getElementById("lockPw").placeholder=t.ph;' +
'document.getElementById("lockRemLabel").textContent=t.rem;' +
'document.getElementById("lockBtn").textContent=t.btn;' +
'if(["he","ar"].indexOf(dl())!==-1)document.documentElement.dir="rtl";' +
'document.getElementById("lockForm").addEventListener("submit",function(e){' +
'e.preventDefault();var btn=document.getElementById("lockBtn");var pw=document.getElementById("lockPw").value;' +
'var rem=document.getElementById("lockRemember").checked;var err=document.getElementById("lockErr");' +
'btn.disabled=true;err.textContent="";' +
'fetch("/unlock",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw,remember:rem})})' +
'.then(function(r){return r.json()}).then(function(d){' +
'if(d.ok){window.location.reload()}else{err.textContent=d.error||t.wrong;btn.disabled=false}' +
'}).catch(function(){err.textContent=t.net;btn.disabled=false})})' +
'</scr' + 'ipt></body></html>';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const cf = request.cf || {};
    const cdnHost = cf.country === 'CN' ? 'cdn.jsdmirror.com' : 'cdn.jsdelivr.net';

    // POST /unlock — verify password
    if (method === 'POST' && path === '/unlock') {
      return handleUnlock(request, env);
    }

    // Check LOCK — if LOCK secret set, require auth cookie
    if (env.LOCK) {
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/mf_auth=([^;]+)/);
      const valid = match && match[1] === await hashToken(env.LOCK);
      if (!valid) {
        if (method === 'GET' && path === '/') {
          return handleLockPage(env, cdnHost);
        }
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // GET / — compose UI
    if (method === 'GET' && path === '/') {
      return handleGet(env, cdnHost);
    }

    // POST / — send email
    if (method === 'POST' && path === '/') {
      return handlePost(request, env);
    }

    // GET /sent — list sent emails
    if (method === 'GET' && path === '/sent') {
      return handleSentList(env, url);
    }

    // GET /sent/:id — single sent detail
    if (method === 'GET' && path.startsWith('/sent/')) {
      const id = path.slice(6);
      return handleSentDetail(env, id);
    }

    // POST /sent/delete — batch delete
    if (method === 'POST' && path === '/sent/delete') {
      return handleSentDelete(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
