require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 5000;
const ORDER_EMAIL = process.env.ORDER_EMAIL || "vintchgadget@gmail.com";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:5000/admin";
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://vintchgadget.netlify.app",
    ],
  }),
);

app.use(express.json({ limit: "100kb" }));

const products = [
  { id: 1, name: "iPhone 16 Pro", price: 1850000, stock: 12 },
  { id: 2, name: "MacBook Pro", price: 2850000, stock: 8 },
  { id: 3, name: "Wireless Headphones", price: 185000, stock: 20 },
  { id: 4, name: "Smart Watch", price: 125000, stock: 15 },
  { id: 5, name: "Wireless Earbuds", price: 75000, stock: 25 },
  { id: 6, name: "Gaming Controller", price: 95000, stock: 10 },
  { id: 7, name: "Digital Camera", price: 650000, stock: 6 },
  { id: 8, name: "Bluetooth Speaker", price: 68000, stock: 18 },
  { id: 9, name: "Gaming Laptop", price: 2250000, stock: 5 },
  { id: 10, name: "Tablet", price: 480000, stock: 9 },
  { id: 11, name: "Wireless Mouse", price: 35000, stock: 30 },
  { id: 12, name: "Mechanical Keyboard", price: 85000, stock: 14 },
  { id: 13, name: "iphone 18", price: 3000000, stock: 10 },
  { id: 14, name: "Samsung Galaxy S25 Ultra", category: "Phones", price: 2500000, stock: 12, },
  { id: 15, name: "Google Pixel 9 Pro", price: 1600000, stock: 12 },
];

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

function readOrders() {
  const raw = fs.readFileSync(ORDERS_FILE, "utf8");
  const data = JSON.parse(raw);

  const savedOrders = Array.isArray(data)
    ? data
    : Array.isArray(data?.orders)
      ? data.orders
      : null;

  if (!savedOrders) {
    throw new Error(
      "The saved orders file has an unexpected format. No data was changed.",
    );
  }

  return savedOrders.map((order) => ({
    ...order,
    orderCode: order.orderCode || order.orderId || order.code || "",
    orderId: order.orderId || order.orderCode || order.code || "",
    status: order.status || "pending",
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          lineTotal: Number(
            item.lineTotal ??
              Number(item.unitPrice ?? item.price ?? 0) *
                Number(item.quantity || 0),
          ),
        }))
      : [],
    total: Number(order.total || 0),
    createdAt: order.createdAt || new Date(0).toISOString(),
    emailSent: order.emailSent === true,
  }));
}

function writeOrders(orders) {
  const tempFile = `${ORDERS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(orders, null, 2), "utf8");
  fs.renameSync(tempFile, ORDERS_FILE);
}

const money = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function makeOrderCode(existingOrders) {
  let code;

  do {
    const digits = crypto.randomInt(0, 1000).toString().padStart(3, "0");

    const letter = String.fromCharCode(65 + crypto.randomInt(0, 26));
    code = digits + letter;
  } while (
    existingOrders.some(
      (order) => (order.orderCode || order.orderId || order.code) === code,
    )
  );

  return code;
}

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Date.now() + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function isAdmin(req) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!secret || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(parts[0])
    .digest();

  let provided;

  try {
    provided = Buffer.from(parts[1], "base64url");
  } catch {
    return false;
  }

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());

    return payload.role === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function adminOnly(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({
      message: "Please log in as an administrator.",
    });
  }

  next();
}

function emailHtml(order) {
  const rows = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #e9edf2">
        ${escapeHtml(item.name)}
      </td>
      <td style="padding:12px 8px;text-align:center;border-bottom:1px solid #e9edf2">
        ${item.quantity}
      </td>
      <td style="padding:12px 8px;text-align:right;border-bottom:1px solid #e9edf2">
        ${money(item.lineTotal)}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <div style="margin:0;background:#f3f5f8;padding:28px 10px;font-family:Arial,sans-serif;color:#202631">
      <div style="max-width:680px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e9ef">
        <div style="background:#171b24;padding:28px;color:white">
          <div style="font-size:12px;letter-spacing:3px;color:#c8d0dc">VINTCHGADGET</div>
          <h1 style="margin:12px 0 6px;font-size:26px">A new order has arrived</h1>
          <p style="margin:0;color:#cbd2dd">Review the customer details and accept when ready.</p>
        </div>
        <div style="padding:26px">
          <div style="background:#f3f5f8;border-radius:12px;padding:18px;margin-bottom:22px">
            <div style="font-size:12px;color:#677181">ORDER CODE</div>
            <div style="font-size:28px;font-weight:800;letter-spacing:3px;margin:6px 0">${escapeHtml(order.orderCode)}</div>
            <div style="color:#677181;font-size:13px">Submitted ${escapeHtml(new Date(order.createdAt).toLocaleString("en-NG"))}</div>
            <div style="margin-top:10px;font-weight:700;color:#9a6810">Pending admin acceptance · Payment on delivery</div>
          </div>
          <h2 style="font-size:17px">Customer details</h2>
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:7px 0;color:#677181">Name</td><td>${escapeHtml(order.customer.name)}</td></tr>
            <tr><td style="padding:7px 0;color:#677181">Email</td><td>${escapeHtml(order.customer.email)}</td></tr>
            <tr><td style="padding:7px 0;color:#677181">Phone</td><td>${escapeHtml(order.customer.phone)}</td></tr>
            <tr><td style="padding:7px 0;color:#677181">Delivery address</td><td>${escapeHtml(order.customer.address)}</td></tr>
            <tr><td style="padding:7px 0;color:#677181">Customer notes</td><td>${escapeHtml(order.customer.notes || "None")}</td></tr>
          </table>
          <h2 style="font-size:17px;margin-top:26px">Order items</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="background:#f3f5f8"><th style="text-align:left;padding:10px 8px">Product</th><th>Qty</th><th style="text-align:right;padding:10px 8px">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="display:flex;justify-content:space-between;padding:18px 0;font-size:19px;font-weight:800">
            <span>Order total</span><span>${money(order.total)}</span>
          </div>
          <p style="font-size:13px;color:#677181">Payment method: Cash/payment on delivery. No payment has been collected through this website.</p>
          <div style="text-align:center;padding:18px 0 8px">
            <a href="${escapeHtml(ADMIN_URL)}" style="display:inline-block;background:#16834a;color:#fff;text-decoration:none;font-weight:700;padding:16px 25px;border-radius:10px">Review &amp; Accept Order &rarr;</a>
          </div>
          <p style="font-size:12px;color:#7a8492;text-align:center">You must sign in to the admin dashboard before accepting an order.</p>
        </div>
      </div>
    </div>
  `;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "VintchGadget API" });
});

/* Admin dashboard */
app.get("/admin", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101114">
<title>VintchGadget | Admin</title>
<style>
:root{color-scheme:dark;--bg:#101114;--surface:#191a1f;--surface2:#202127;--border:#303139;--text:#f6f6f7;--muted:#a0a1ab;--orange:#ff8547;--green:#46d49b;--yellow:#f6c766;--red:#ff7777}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 15% 0%,rgba(255,122,59,.09),transparent 36%),var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
button,input,select{font:inherit}
button{cursor:pointer}
button:disabled{opacity:.55;cursor:wait}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--orange);outline-offset:3px}
.topbar{position:sticky;top:0;z-index:5;background:rgba(16,17,20,.92);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.08)}
.top-inner{max-width:1400px;margin:auto;min-height:76px;padding:14px 26px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{display:flex;align-items:center;gap:12px}
.brand-mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#171717;font-size:23px;font-weight:900;background:linear-gradient(145deg,#ffb17b,#ff6a2a)}
.brand-name{font-size:17px;font-weight:850;letter-spacing:-.5px}
.brand-name span{color:var(--orange)}
.eyebrow{font-size:10px;color:var(--muted);letter-spacing:2px;font-weight:800;margin-top:4px}
.top-actions{display:flex;align-items:center;gap:10px}
.live{display:flex;align-items:center;gap:8px;color:#c5c5cd;font-size:12px;border:1px solid var(--border);border-radius:30px;padding:9px 12px}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green)}
.btn{border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:12px;padding:11px 15px;font-weight:750;transition:transform .18s,background .18s}
.btn:hover{transform:translateY(-1px)}
.btn-primary{color:#19120e;border-color:transparent;background:linear-gradient(135deg,#ffad76,#ff6a2a)}
.btn-danger{color:#ffb1b1;background:#321f22;border-color:#593034}
.btn-small{padding:9px 12px;font-size:12px}
.delete-order-btn{width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,91,91,.35);border-radius:12px;background:rgba(255,91,91,.09);color:#ff7777;font-size:19px;transition:background .2s,transform .2s}
.delete-order-btn:hover{background:rgba(255,91,91,.22);transform:translateY(-2px)}
main{max-width:1400px;margin:auto;padding:32px 26px 55px}
.welcome{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px}
.welcome h1{margin:0;font-size:clamp(27px,4vw,39px);letter-spacing:-1.5px}
.welcome h1 span{color:var(--orange)}
.welcome p{margin:10px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
.date-label{color:var(--muted);font-size:12px;text-align:right}
.section-label{color:#b2b2bb;font-size:11px;font-weight:850;letter-spacing:1.8px;margin:0 0 14px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-bottom:28px}
.stat{min-width:0;padding:21px;border:1px solid var(--border);border-radius:19px;background:linear-gradient(145deg,#202127,#17181c);animation:rise .35s ease both}
.stat-name{color:var(--muted);font-size:13px;font-weight:650}
.stat-value{margin-top:17px;font-size:clamp(28px,3vw,36px);font-weight:850;letter-spacing:-1.3px}
.stat-foot{margin-top:7px;color:var(--muted);font-size:12px}
.workspace{border:1px solid var(--border);background:rgba(25,26,31,.94);border-radius:20px;overflow:hidden}
.workspace-head{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:22px 23px;border-bottom:1px solid var(--border)}
.workspace-head h2{margin:0;font-size:20px}
.workspace-head p{margin:6px 0 0;color:var(--muted);font-size:12px}
.order-count{color:var(--orange);font-size:12px;font-weight:800;background:rgba(255,133,71,.1);border:1px solid rgba(255,133,71,.2);padding:8px 11px;border-radius:30px}
.filters{display:grid;grid-template-columns:minmax(180px,1fr) 190px auto;gap:12px;padding:17px 23px;border-bottom:1px solid var(--border)}
.control{width:100%;min-height:44px;border:1px solid var(--border);border-radius:12px;background:#121317;color:var(--text);padding:11px 13px;font-size:13px}
.control::placeholder{color:#777984}
.search-wrap{position:relative}
.search-wrap .control{padding-left:14px}
.order-list{padding:4px 23px 23px}
.order{margin-top:16px;padding:20px;border:1px solid var(--border);border-radius:17px;background:linear-gradient(145deg,#202127,#191a1f);animation:rise .3s ease both}
.order-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.order-code{font-size:21px;font-weight:900;letter-spacing:2px}
.order-date{color:var(--muted);font-size:11px;margin-top:6px}
.status{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:30px;font-size:10px;font-weight:900;letter-spacing:.8px}
.status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.status-pending{color:var(--yellow);background:rgba(246,199,102,.1)}
.status-accepted{color:var(--green);background:rgba(70,212,155,.1)}
.order-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:19px}
.detail-box{min-width:0;padding:14px;border:1px solid #303139;border-radius:13px;background:rgba(12,13,16,.3)}
.detail-label{margin-bottom:9px;color:#8f909a;font-size:10px;font-weight:850;letter-spacing:1.4px;text-transform:uppercase}
.detail-value{color:#ededf0;font-size:13px;line-height:1.8;overflow-wrap:anywhere}
.items-box{margin-top:12px}
.items-list{display:grid;gap:9px}
.item-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.5}
.item-name{overflow-wrap:anywhere}
.item-price{font-weight:750;white-space:nowrap}
.order-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px;padding-top:18px;margin-top:18px;border-top:1px solid var(--border)}
.total-label{color:var(--muted);font-size:11px}
.total-value{margin-top:4px;font-size:24px;font-weight:900}
.payment-note{color:var(--muted);font-size:11px;margin-top:6px}
.order-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.accepted-note{color:var(--green);font-size:12px;font-weight:800}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-icon{font-size:28px;color:var(--orange);margin-bottom:13px}
.empty h3{color:var(--text);margin:0 0 8px;font-size:17px}
.empty p{font-size:13px;margin:0;line-height:1.7}
.message{margin:15px 23px 0;padding:12px 14px;border-radius:11px;font-size:12px;line-height:1.6;white-space:pre-wrap}
.message-error{color:#ffb5b5;background:#321f22;border:1px solid #593034}
.login-shell{max-width:440px;margin:65px auto;padding:0 18px}
.login-card{padding:30px;border:1px solid var(--border);border-radius:24px;background:linear-gradient(145deg,#202127,#16171b);box-shadow:0 24px 80px rgba(0,0,0,.25)}
.login-card h1{font-size:28px;margin:25px 0 9px}
.login-card>p{color:var(--muted);font-size:13px;line-height:1.7;margin:0 0 25px}
.field-label{display:block;color:#dedee3;font-size:12px;font-weight:750;margin:18px 0 8px}
.login-card .btn{width:100%;margin-top:12px;min-height:47px}
.login-foot{text-align:center;color:#777984;font-size:11px;margin-top:23px}
.footer{color:#777984;text-align:center;font-size:11px;margin-top:24px;line-height:1.8}
@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:760px){.top-inner{padding:12px 14px;min-height:66px}.brand-mark{width:39px;height:39px}.brand-name{font-size:15px}.eyebrow{font-size:8px;letter-spacing:1.5px}.live{display:none}main{padding:24px 13px 38px}.welcome{align-items:flex-start;flex-direction:column;margin-bottom:22px}.date-label{text-align:left}.stats{gap:9px}.stat{padding:14px 12px;border-radius:15px}.stat-name{font-size:11px}.stat-value{font-size:26px;margin-top:13px}.stat-foot{font-size:10px;line-height:1.5}.workspace-head{padding:17px 14px}.filters{grid-template-columns:1fr;padding:14px}.order-list{padding:0 11px 14px}.order{padding:14px;border-radius:15px}.order-grid{grid-template-columns:1fr;gap:10px;margin-top:14px}.order-bottom{align-items:flex-start;flex-direction:column;gap:14px}.order-actions{width:100%}.order-actions .btn{flex:1}.message{margin-left:14px;margin-right:14px}}
@media(max-width:390px){.top-actions .btn{padding:8px 9px;font-size:11px}.stats{grid-template-columns:1fr}.stat{padding:16px}.workspace-head{align-items:flex-start;flex-direction:column;gap:10px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<header class="topbar">
  <div class="top-inner">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">V</div>
      <div>
        <div class="brand-name">Vintch<span>Gadget</span></div>
        <div class="eyebrow">STORE CONTROL CENTER</div>
      </div>
    </div>
    <div class="top-actions">
      <div class="live"><span class="live-dot"></span> Admin session</div>
      <button class="btn btn-danger btn-small" id="logout" type="button">Sign out</button>
    </div>
  </div>
</header>

<main id="dashboard" hidden>
  <section class="welcome">
    <div>
      <div class="eyebrow" style="color:var(--orange);margin-bottom:12px">YOUR STORE AT A GLANCE</div>
      <h1>Good to see you, <span>Admin.</span></h1>
      <p>Manage orders, review customer details, and keep deliveries moving.</p>
    </div>
    <div class="date-label" id="today"></div>
  </section>

  <div class="section-label">ORDER OVERVIEW</div>
  <section class="stats">
    <article class="stat">
      <div class="stat-name">Total orders</div>
      <div class="stat-value" id="totalCount">0</div>
      <div class="stat-foot">All orders received</div>
    </article>
    <article class="stat">
      <div class="stat-name">Pending</div>
      <div class="stat-value" id="pendingCount">0</div>
      <div class="stat-foot">Awaiting your review</div>
    </article>
    <article class="stat">
      <div class="stat-name">Accepted</div>
      <div class="stat-value" id="acceptedCount">0</div>
      <div class="stat-foot">Orders you've accepted</div>
    </article>
  </section>

  <section class="workspace">
    <div class="workspace-head">
      <div>
        <h2>Order management</h2>
        <p>Review every order and update its status.</p>
      </div>
      <div class="order-count" id="visibleCount">0 orders</div>
    </div>

    <div class="filters">
      <div class="search-wrap">
        <input class="control" id="search" type="search" placeholder="Search code, customer, phone..." autocomplete="off">
      </div>
      <select class="control" id="statusFilter" aria-label="Filter orders by status">
        <option value="all">All statuses</option>
        <option value="pending">Pending orders</option>
        <option value="accepted">Accepted orders</option>
      </select>
      <button class="btn" id="refresh" type="button">↻ Refresh</button>
    </div>

    <div id="dashboardError" class="message message-error" hidden></div>
    <div id="orders" class="order-list" aria-live="polite"></div>
  </section>

  <div class="footer">VintchGadget Admin · Keep customer information private.<br>Orders are stored by your store's backend.</div>
</main>

<section class="login-shell" id="loginPanel" hidden>
  <div class="login-card">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">V</div>
      <div>
        <div class="brand-name">Vintch<span>Gadget</span></div>
        <div class="eyebrow">ADMINISTRATOR ACCESS</div>
      </div>
    </div>
    <h1>Welcome back.</h1>
    <p>Sign in to manage your store orders and customer deliveries.</p>
    <form id="loginForm">
      <label class="field-label" for="password">Admin password</label>
      <input class="control" id="password" type="password" placeholder="Enter your admin password" autocomplete="current-password" required>
      <button class="btn btn-primary" id="loginButton" type="submit">Sign in to dashboard →</button>
    </form>
    <div id="loginError" class="message message-error" hidden></div>
    <div class="login-foot">SECURE ADMIN ACCESS · VINTCHGADGET</div>
  </div>
</section>

<script>
let token = sessionStorage.getItem("vg_admin_token") || "";
let allOrders = [];
let refreshTimer = null;
let refreshBusy = false;

const dashboard = document.getElementById("dashboard");
const loginPanel = document.getElementById("loginPanel");
const ordersBox = document.getElementById("orders");
const dashboardError = document.getElementById("dashboardError");
const loginError = document.getElementById("loginError");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("statusFilter");

document.getElementById("today").textContent =
  new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

function showLoggedIn(on) {
  dashboard.hidden = !on;
  loginPanel.hidden = on;

  if (on) startAutoRefresh();
  else stopAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();

  refreshTimer = setInterval(function () {
    if (token && !dashboard.hidden && !refreshBusy) {
      loadOrders(true);
    }
  }, 15000);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

async function api(url, options) {
  options = options || {};

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...options.headers
    }
  });

  const body = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(body.message || body.error || "Request failed");
  }

  return body;
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  });
}

function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

function makeElement(tag, className, value) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;

  return element;
}

function getOrderCode(order) {
  return String(order.orderCode || order.orderId || order.code || "");
}

function renderStats(orders) {
  const pending = orders.filter(function (order) {
    return order.status !== "accepted";
  }).length;

  document.getElementById("totalCount").textContent = orders.length;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("acceptedCount").textContent =
    orders.length - pending;
}

function showDashboardError(message) {
  dashboardError.textContent = message;
  dashboardError.hidden = !message;
}

function signOut() {
  token = "";
  allOrders = [];
  sessionStorage.removeItem("vg_admin_token");
  showLoggedIn(false);
  ordersBox.replaceChildren();
}

async function acceptOrder(order, button) {
  const code = getOrderCode(order);

  if (!code) {
    showDashboardError("This order has no order code.");
    return;
  }

  button.disabled = true;
  button.textContent = "Accepting...";

  try {
    await api(
      "/api/admin/orders/" + encodeURIComponent(code) + "/accept",
      { method: "POST" }
    );

    await loadOrders();
  } catch (error) {
    showDashboardError(error.message);
    button.disabled = false;
    button.textContent = "✓ Accept order";

    if (/log in|administrator/i.test(error.message)) {
      signOut();
      loginError.textContent = "Your session expired. Please sign in again.";
      loginError.hidden = false;
    }
  }
}

async function deleteOrder(order, button) {
  const code = getOrderCode(order);

  if (!code) {
    showDashboardError("This order has no order code.");
    return;
  }

  const confirmed = window.confirm(
    "Permanently delete order #" + code +
    "\\n\\nThis action cannot be undone."
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "…";

  try {
    await api(
      "/api/admin/orders/" + encodeURIComponent(code),
      { method: "DELETE" }
    );

    allOrders = allOrders.filter(function (item) {
      return getOrderCode(item) !== code;
    });

    renderStats(allOrders);
    renderOrders();
    showDashboardError("Order #" + code + " was deleted successfully.");

    setTimeout(function () {
      if (dashboardError.textContent === "Order #" + code + " was deleted successfully.") {
        showDashboardError("");
      }
    }, 3500);
  } catch (error) {
    showDashboardError(error.message || "Could not delete this order.");
    button.disabled = false;
    button.textContent = "🗑";

    if (/log in|administrator/i.test(error.message)) {
      signOut();
      loginError.textContent = "Your session expired. Please sign in again.";
      loginError.hidden = false;
    }
  }
}

function renderOrders() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  const filtered = allOrders.filter(function (order) {
    const customer = order.customer || {};
    const searchable = [
      getOrderCode(order),
      customer.name,
      customer.email,
      customer.phone,
      customer.address
    ].join(" ").toLowerCase();

    const matchesTerm = searchable.includes(term);
    const matchesStatus =
      status === "all" || order.status === status;

    return matchesTerm && matchesStatus;
  });

  document.getElementById("visibleCount").textContent =
    filtered.length + (filtered.length === 1 ? " order" : " orders");

  ordersBox.replaceChildren();

  if (!filtered.length) {
    const empty = makeElement("div", "empty");
    empty.append(makeElement("div", "empty-icon", "⌕"));

    empty.append(
      makeElement(
        "h3",
        "",
        allOrders.length ? "No matching orders" : "Your orders will appear here"
      ),
      makeElement(
        "p",
        "",
        allOrders.length
          ? "Try another search or change the status filter."
          : "When a customer places an order, you can review it here."
      )
    );

    ordersBox.append(empty);
    return;
  }

  filtered.forEach(function (order) {
    const customer = order.customer || {};
    const code = getOrderCode(order);
    const card = makeElement("article", "order");
    const top = makeElement("div", "order-top");
    const titleGroup = makeElement("div", "");

    titleGroup.append(
      makeElement("div", "order-code", "#" + (code || "UNKNOWN")),
      makeElement(
        "div",
        "order-date",
        "Placed " + new Date(order.createdAt).toLocaleString("en-NG", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      )
    );

    const isAccepted = order.status === "accepted";

    const badge = makeElement(
      "span",
      "status " + (isAccepted ? "status-accepted" : "status-pending"),
      isAccepted ? "ACCEPTED" : "PENDING"
    );

    top.append(titleGroup, badge);

    const grid = makeElement("div", "order-grid");
    const customerBox = makeElement("div", "detail-box");
    customerBox.append(
      makeElement("div", "detail-label", "Customer details")
    );

    const customerDetails = makeElement("div", "detail-value");

    customerDetails.append(
      makeElement("div", "", safeText(customer.name) || "Name not provided"),
      makeElement("div", "", safeText(customer.email) || "Email not provided"),
      makeElement("div", "", safeText(customer.phone) || "Phone not provided")
    );

    customerBox.append(customerDetails);

    const deliveryBox = makeElement("div", "detail-box");
    deliveryBox.append(
      makeElement("div", "detail-label", "Delivery information")
    );

    const deliveryDetails = makeElement("div", "detail-value");

    deliveryDetails.append(
      makeElement("div", "", safeText(customer.address) || "No address provided"),
      makeElement("div", "", "Notes: " + (safeText(customer.notes) || "None"))
    );

    deliveryBox.append(deliveryDetails);
    grid.append(customerBox, deliveryBox);

    const itemsBox = makeElement("div", "detail-box items-box");
    itemsBox.append(makeElement("div", "detail-label", "Order items"));

    const itemsList = makeElement("div", "items-list");

    (Array.isArray(order.items) ? order.items : []).forEach(function (item) {
      const row = makeElement("div", "item-row");

      row.append(
        makeElement(
          "div",
          "item-name",
          safeText(item.name) + " × " + safeText(item.quantity)
        ),
        makeElement("div", "item-price", formatMoney(item.lineTotal))
      );

      itemsList.append(row);
    });

    itemsBox.append(itemsList);

    const bottom = makeElement("div", "order-bottom");
    const totalGroup = makeElement("div", "");

    totalGroup.append(
      makeElement("div", "total-label", "TOTAL ORDER VALUE"),
      makeElement("div", "total-value", formatMoney(order.total)),
      makeElement("div", "payment-note", "Payment on delivery")
    );

    const actions = makeElement("div", "order-actions");

    if (isAccepted) {
      actions.append(
        makeElement("span", "accepted-note", "✓ Order accepted")
      );
    } else {
      const acceptButton = makeElement(
        "button",
        "btn btn-primary",
        "✓ Accept order"
      );

      acceptButton.type = "button";
      acceptButton.addEventListener("click", function () {
        acceptOrder(order, acceptButton);
      });

      actions.append(acceptButton);
    }

    const deleteButton = makeElement(
      "button",
      "delete-order-btn",
      "🗑"
    );

    deleteButton.type = "button";
    deleteButton.title = "Delete order";
    deleteButton.setAttribute("aria-label", "Delete order");
    deleteButton.addEventListener("click", function () {
      deleteOrder(order, deleteButton);
    });

    actions.append(deleteButton);
    bottom.append(totalGroup, actions);
    card.append(top, grid, itemsBox, bottom);
    ordersBox.append(card);
  });
}

async function loadOrders(silent) {
  if (refreshBusy || !token) return;

  refreshBusy = true;

  const refreshButton = document.getElementById("refresh");

  if (!silent) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
  }

  try {
    const data = await api("/api/admin/orders");

    allOrders = Array.isArray(data.orders) ? data.orders : [];

    renderStats(allOrders);
    renderOrders();
    showDashboardError("");
  } catch (error) {
    showDashboardError(error.message);

    if (/log in|administrator/i.test(error.message)) {
      signOut();
      loginError.textContent = "Your session expired. Please sign in again.";
      loginError.hidden = false;
    }
  } finally {
    refreshBusy = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Refresh";
  }
}

document.getElementById("loginForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  loginError.hidden = true;
  loginError.textContent = "";

  const button = document.getElementById("loginButton");
  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: document.getElementById("password").value
      })
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.message || "Sign in failed");
    }

    token = data.token;
    sessionStorage.setItem("vg_admin_token", token);
    document.getElementById("password").value = "";

    showLoggedIn(true);
    await loadOrders();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in to dashboard →";
  }
});

document.getElementById("refresh").addEventListener("click", function () {
  loadOrders(false);
});

document.getElementById("logout").addEventListener("click", signOut);
searchInput.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);

if (token) {
  showLoggedIn(true);
  loadOrders();
} else {
  showLoggedIn(false);
}
</script>
</body>
</html>`);
});

/* Admin login */
app.post("/api/admin/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_TOKEN_SECRET;
  const provided =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!expected || !secret) {
    return res.status(503).json({
      message: "Admin login is not configured. Check your backend .env file.",
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  const matches =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!matches) {
    return res.status(401).json({
      message: "Incorrect admin password.",
    });
  }

  res.json({ token: createAdminToken() });
});

/* Retrieve orders */
app.get("/api/admin/orders", adminOnly, (_req, res) => {
  try {
    const orders = readOrders().sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    res.json({ orders });
  } catch (error) {
    console.error("Could not read orders:", error.message);

    res.status(500).json({
      message: "Could not load orders. Check the orders data file.",
    });
  }
});

/* Accept an order */
app.post("/api/admin/orders/:code/accept", adminOnly, (req, res) => {
  try {
    const orders = readOrders();
    const order = orders.find(
      (entry) => (entry.orderCode || entry.orderId) === req.params.code,
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status !== "accepted") {
      order.status = "accepted";
      order.acceptedAt = new Date().toISOString();
      writeOrders(orders);
    }

    res.json({
      message: "Order accepted.",
      order: {
        orderCode: order.orderCode,
        status: order.status,
        acceptedAt: order.acceptedAt,
      },
    });
  } catch (error) {
    console.error("Accept order error:", error.message);

    res.status(500).json({
      message: "Could not accept the order.",
    });
  }
});

/* Delete an order — administrator login required */
app.delete("/api/admin/orders/:code", adminOnly, (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    const orders = readOrders();

    const index = orders.findIndex((order) => {
      return String(order.orderCode || order.orderId || order.code) === code;
    });

    if (index === -1) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    orders.splice(index, 1);
    writeOrders(orders);

    return res.json({
      success: true,
      message: "Order deleted successfully.",
    });
  } catch (error) {
    console.error("Delete order error:", error.message);

    return res.status(500).json({
      message: "Could not delete the order.",
    });
  }
});

/* Customer order status: does not expose contact details */
app.get("/api/orders/:code/status", (req, res) => {
  try {
    const order = readOrders().find(
      (entry) => (entry.orderCode || entry.orderId) === req.params.code,
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json({
      orderCode: order.orderCode,
      status: order.status,
      total: order.total,
      paymentMethod: order.paymentMethod,
      items: order.items.map(({ name, quantity, unitPrice, lineTotal }) => ({
        name,
        quantity,
        unitPrice,
        lineTotal,
      })),
      createdAt: order.createdAt,
      acceptedAt: order.acceptedAt || null,
    });
  } catch (error) {
    console.error("Order status error:", error.message);

    res.status(500).json({
      message: "Could not retrieve order status.",
    });
  }
});

/* Create a customer order */
app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};
    const rawCustomer = body.customer;
    const rawItems = body.items;

    if (
      !rawCustomer ||
      typeof rawCustomer !== "object" ||
      Array.isArray(rawCustomer)
    ) {
      return res.status(400).json({
        message: "Please provide your customer details.",
      });
    }

    const customer = {
      name: cleanText(rawCustomer.name, 100),
      email: cleanText(rawCustomer.email, 254),
      phone: cleanText(rawCustomer.phone, 35),
      address: cleanText(rawCustomer.address, 500),
      notes: cleanText(rawCustomer.notes, 1000),
    };

    if (customer.name.length < 2) {
      return res.status(400).json({
        message: "Please enter your full name.",
      });
    }

    if (!validEmail(customer.email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (customer.phone.length < 7) {
      return res.status(400).json({
        message: "Please enter a valid phone number.",
      });
    }

    if (customer.address.length < 8) {
      return res.status(400).json({
        message: "Please enter your full delivery address.",
      });
    }

    if (
      !Array.isArray(rawItems) ||
      rawItems.length === 0 ||
      rawItems.length > 50
    ) {
      return res.status(400).json({
        message: "Your order must contain at least one product.",
      });
    }

    const requested = new Map();

    for (const item of rawItems) {
      if (
        !item ||
        !Number.isSafeInteger(item.id) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 50
      ) {
        return res.status(400).json({
          message: "One of the product quantities is invalid.",
        });
      }

      requested.set(item.id, (requested.get(item.id) || 0) + item.quantity);
    }

    const orderItems = [];

    for (const [id, quantity] of requested.entries()) {
      const product = products.find((entry) => entry.id === id);

      if (!product) {
        return res.status(400).json({
          message: "An item in your cart is no longer available.",
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          message: `${product.name} has a maximum order quantity of ${product.stock}. Please update your bag.`,
        });
      }

      orderItems.push({
        id: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        lineTotal: product.price * quantity,
      });
    }

    const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    if (!Number.isSafeInteger(total) || total <= 0) {
      return res.status(400).json({
        message: "The order total is invalid.",
      });
    }

    const orders = readOrders();
    const orderCode = makeOrderCode(orders);

    const order = {
      orderCode,
      orderId: orderCode,
      customer,
      items: orderItems,
      total,
      status: "pending",
      paymentMethod: "Payment on delivery",
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      emailSent: false,
    };

    /* Save the order before attempting email delivery */
    orders.push(order);
    writeOrders(orders);

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    let emailSent = false;

    if (apiKey && from) {
      try {
        const resend = new Resend(apiKey);

        const { error } = await resend.emails.send({
          from,
          to: [ORDER_EMAIL],
          replyTo: customer.email,
          subject: `New VintchGadget order ${orderCode} — ${customer.name}`,
          html: emailHtml(order),
          text: [
            `New VintchGadget order: ${orderCode}`,
            `Customer: ${customer.name}`,
            `Email: ${customer.email}`,
            `Phone: ${customer.phone}`,
            `Address: ${customer.address}`,
            `Notes: ${customer.notes || "None"}`,
            ...orderItems.map(
              (item) =>
                `${item.name} x ${item.quantity}: ${money(item.lineTotal)}`,
            ),
            `Total: ${money(total)}`,
            "Payment: Payment on delivery",
            `Admin dashboard: ${ADMIN_URL}`,
          ].join("\n"),
        });

        if (error) {
          console.error("Resend rejected order email:", error.message);
        } else {
          emailSent = true;
        }
      } catch (error) {
        console.error("Order email could not be sent:", error.message);
      }
    } else {
      console.error("Order saved, but Resend sender configuration is missing.");
    }

    order.emailSent = emailSent;

    try {
      const latestOrders = readOrders();
      const savedOrder = latestOrders.find(
        (entry) => entry.orderCode === orderCode,
      );

      if (savedOrder) {
        savedOrder.emailSent = emailSent;
        writeOrders(latestOrders);
      }
    } catch (saveError) {
      console.error(
        "Could not update email delivery status:",
        saveError.message,
      );
    }

    console.log(`Order saved: ${orderCode}; admin email sent: ${emailSent}`);

    return res.status(201).json({
      message: "Your order has been submitted successfully.",
      orderId: orderCode,
      orderCode,
      status: order.status,
      total,
      emailSent,
      emailNotice: emailSent
        ? undefined
        : "Your order was saved, but the admin email could not be sent.",
    });
  } catch (error) {
    console.error("Order submission failed:", error.message);

    return res.status(500).json({
      message:
        "We could not submit your order right now. Please try again later.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`VintchGadget API running on http://localhost:${PORT}`);
});
