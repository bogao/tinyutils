# tinyutils

A collection of tiny, self-contained utility scripts.

---

## Mailgun Fire

A single-file Cloudflare Worker for sending emails via the Mailgun HTTP API, with a rich compose UI.

### Features

- **Rich text editor** with WYSIWYG / Markdown toggle (powered by markdown-it)
- **To / CC / BCC** tag-style email input with validation
- **11 languages** auto-detected from browser: English, 简体中文, 繁體中文, 日本語, 한국어, Bahasa Melayu, Tiếng Việt, ไทย, தமிழ், עברית, العربية (with full RTL support)
- **Sent history** stored in Cloudflare KV (optional) with drawer UI, detail view, and batch delete
- **Password lock** via a `LOCK` secret — shows an unlock modal before granting access, with "remember 30 days" option
### Setup

1. Create a Cloudflare Worker and paste the contents of `mailgunfire.js`
2. Set the following **environment variables** (Settings > Variables):

   | Variable  | Type     | Description                                   |
   |-----------|----------|-----------------------------------------------|
   | `DOMAIN`  | Text     | Your Mailgun domain, e.g. `mydomain.tld`    |
   | `KEY`     | Secret   | Mailgun API key                               |
   | `FROM`    | Text     | Default sender username, e.g. `noreply`       |
   | `DISPLAY` | Text     | Default display name, e.g. `John Doe`           |
   | `EU`      | Text     | If present, use Mailgun EU region; otherwise US |
   | `TTL`     | Text     | KV record expiration in seconds (integer >= 60); ignored if invalid; omit for permanent storage |
   | `LOCK`    | Secret   | Access password (4+ ASCII printable chars, no spaces); ignored if invalid; omit for open access |

3. (Optional) Bind a **KV namespace** named `SENT` to enable sent email history
4. Deploy

---

## Mailgun Fire（简体中文）

一个单文件 Cloudflare Worker，通过 Mailgun HTTP API 发送邮件，附带富文本编辑界面。

### 功能

- **富文本编辑器**，支持所见即所得 / Markdown 切换（基于 markdown-it）
- **收件人 / 抄送 / 密送** 标签式邮箱输入，自动校验
- **11 种语言**，根据浏览器自动匹配：English、简体中文、繁體中文、日本語、한국어、Bahasa Melayu、Tiếng Việt、ไทย、தமிழ்、עברית、العربية（完整 RTL 支持）
- **已发送记录**，存储于 Cloudflare KV（可选），支持抽屉式查看、详情浏览和批量删除
- **密码锁**，通过 `LOCK` Secret 启用，访问前需输入密码，可勾选"30 天内免密"
### 配置步骤

1. 创建一个 Cloudflare Worker，将 `mailgunfire.js` 的内容粘贴进去
2. 设置以下**环境变量**（Settings > Variables）：

   | 变量名    | 类型     | 说明                                          |
   |-----------|----------|-----------------------------------------------|
   | `DOMAIN`  | Text     | Mailgun 域名，如 `mydomain.tld`             |
   | `KEY`     | Secret   | Mailgun API 密钥                              |
   | `FROM`    | Text     | 默认发件人用户名，如 `noreply`                |
   | `DISPLAY` | Text     | 默认显示名称，如 `John Doe`                     |
   | `EU`      | Text     | 只要该键存在即使用欧洲区域，否则使用美国区域  |
   | `TTL`     | Text     | 已发送记录保存时长（秒，整数 >= 60），不合法则忽略，不设则永久保存 |
   | `LOCK`    | Secret   | 访问密码（4+ 位 ASCII 可打印字符，不含空格），不合法则忽略，不设则开放访问 |

3. （可选）绑定一个名为 `SENT` 的 **KV 命名空间**以启用已发送记录
4. 部署

---

## Mailgun Fire（繁體中文）

單檔案 Cloudflare Worker，透過 Mailgun HTTP API 發送郵件，附帶富文字編輯介面。

### 功能

- **富文字編輯器**，支援所見即所得 / Markdown 切換（基於 markdown-it）
- **收件人 / 副本 / 密件副本** 標籤式信箱輸入，自動驗證
- **11 種語言**，根據瀏覽器自動匹配：English、简体中文、繁體中文、日本語、한국어、Bahasa Melayu、Tiếng Việt、ไทย、தமிழ்、עברית、العربية（完整 RTL 支援）
- **已傳送紀錄**，儲存於 Cloudflare KV（選用），支援抽屜式檢視、詳情瀏覽和批次刪除
- **密碼鎖**，透過 `LOCK` Secret 啟用，存取前需輸入密碼，可勾選「30 天內免密」
### 設定步驟

1. 建立一個 Cloudflare Worker，將 `mailgunfire.js` 的內容貼入
2. 設定以下**環境變數**（Settings > Variables）：

   | 變數名    | 類型     | 說明                                          |
   |-----------|----------|-----------------------------------------------|
   | `DOMAIN`  | Text     | Mailgun 網域，如 `mydomain.tld`             |
   | `KEY`     | Secret   | Mailgun API 金鑰                              |
   | `FROM`    | Text     | 預設寄件人使用者名稱，如 `noreply`            |
   | `DISPLAY` | Text     | 預設顯示名稱，如 `John Doe`                     |
   | `EU`      | Text     | 只要該鍵存在即使用歐洲區域，否則使用美國區域  |
   | `TTL`     | Text     | 已傳送紀錄保存時長（秒，整數 >= 60），不合法則忽略，不設則永久保存 |
   | `LOCK`    | Secret   | 存取密碼（4+ 位 ASCII 可列印字元，不含空格），不合法則忽略，不設則開放存取 |

3. （選用）綁定一個名為 `SENT` 的 **KV 命名空間**以啟用已傳送紀錄
4. 部署

---

## gnum.py

Graham's number calculator using Conway chained arrow notation.
