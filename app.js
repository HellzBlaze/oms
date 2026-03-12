/* Local OMS (no server). Data stored in localStorage. */

const STORAGE_KEY = "local-oms.v1";

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(amount, currency) {
  const a = safeNumber(amount, 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(a);
  } catch {
    return `${currency} ${a.toFixed(2)}`;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedDB();
  try {
    const parsed = JSON.parse(raw);
    return normalizeDB(parsed);
  } catch {
    return seedDB();
  }
}

function normalizeDB(db) {
  const safe = db && typeof db === "object" ? db : {};
  return {
    meta: {
      version: 1,
      currency: safe.meta?.currency || "USD",
      updatedAt: safe.meta?.updatedAt || new Date().toISOString(),
    },
    products: Array.isArray(safe.products) ? safe.products : [],
    customers: Array.isArray(safe.customers) ? safe.customers : [],
    orders: Array.isArray(safe.orders)
      ? safe.orders.map((o) => ({
          ...o,
          status: o?.status || "draft",
          type: o?.type || "takeaway",
          table: o?.table || "",
          pickupName: o?.pickupName || "",
          paid: Boolean(o?.paid),
          items: Array.isArray(o?.items) ? o.items : [],
        }))
      : [],
  };
}

function saveDB(db) {
  db.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  renderAll();
}

function seedDB() {
  const db = {
    meta: { version: 1, currency: "USD", updatedAt: new Date().toISOString() },
    products: [
      { id: uid("prd"), name: "Sample item", sku: "SAMPLE-1", price: 5.0, stock: 20, reorderPoint: 5 },
      { id: uid("prd"), name: "Another item", sku: "SAMPLE-2", price: 12.5, stock: 8, reorderPoint: 3 },
    ],
    customers: [{ id: uid("cus"), name: "Walk-in", phone: "", email: "" }],
    orders: [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

let DB = loadDB();
let selectedOrderId = null;

// Elements
const el = {
  tabs: [...document.querySelectorAll(".tab[data-view]")],
  views: [...document.querySelectorAll(".view[data-view]")],
  btnNewOrder: document.getElementById("btnNewOrder"),
  btnExport: document.getElementById("btnExport"),
  fileImport: document.getElementById("fileImport"),
  btnReset: document.getElementById("btnReset"),

  kpiTodayOrders: document.getElementById("kpiTodayOrders"),
  kpiTodayRevenue: document.getElementById("kpiTodayRevenue"),
  kpiTodayAvg: document.getElementById("kpiTodayAvg"),
  kpiCurrencyHint: document.getElementById("kpiCurrencyHint"),
  openOrderPills: document.getElementById("openOrderPills"),
  lowStockTable: document.getElementById("lowStockTable"),

  kitchenTypeFilter: document.getElementById("kitchenTypeFilter"),
  btnKitchenRefresh: document.getElementById("btnKitchenRefresh"),
  kitchenOpen: document.getElementById("kitchenOpen"),
  kitchenReady: document.getElementById("kitchenReady"),

  orderSearch: document.getElementById("orderSearch"),
  orderStatusFilter: document.getElementById("orderStatusFilter"),
  orderList: document.getElementById("orderList"),
  orderDetails: document.getElementById("orderDetails"),
  orderDetailsHint: document.getElementById("orderDetailsHint"),
  orderDetailsActions: document.getElementById("orderDetailsActions"),

  productSearch: document.getElementById("productSearch"),
  btnNewProduct: document.getElementById("btnNewProduct"),
  productTable: document.getElementById("productTable"),

  customerSearch: document.getElementById("customerSearch"),
  btnNewCustomer: document.getElementById("btnNewCustomer"),
  customerTable: document.getElementById("customerTable"),

  footerStorage: document.getElementById("footerStorage"),

  modal: document.getElementById("modal"),
  modalForm: document.getElementById("modalForm"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalPrimary: document.getElementById("modalPrimary"),
};

function setView(view) {
  for (const t of el.tabs) t.classList.toggle("is-active", t.dataset.view === view);
  for (const v of el.views) v.classList.toggle("is-active", v.dataset.view === view);
}

function orderTotal(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, it) => sum + safeNumber(it.qty) * safeNumber(it.unitPrice), 0);
}

function orderLabel(order) {
  return order?.number ? `#${order.number}` : `Order`;
}

function customerById(id) {
  return DB.customers.find((c) => c.id === id) || null;
}

function productById(id) {
  return DB.products.find((p) => p.id === id) || null;
}

function statusClass(status) {
  return `status-${status || "draft"}`;
}

function orderTypeLabel(type) {
  if (type === "dine-in") return "Dine-in";
  if (type === "takeaway") return "Takeaway";
  if (type === "delivery") return "Delivery";
  return "—";
}

function orderExtraMeta(order) {
  const parts = [];
  if (order?.type === "dine-in" && order?.table) parts.push(`Table ${order.table}`);
  if ((order?.type === "takeaway" || order?.type === "delivery") && order?.pickupName) parts.push(order.pickupName);
  return parts.filter(Boolean).join(" • ");
}

function orderShortMeta(order) {
  const extra = orderExtraMeta(order);
  const type = order?.type ? orderTypeLabel(order.type) : "—";
  return extra ? `${type} • ${extra}` : type;
}

function ensureOrderNumber() {
  const max = DB.orders.reduce((m, o) => Math.max(m, safeNumber(o.number, 0)), 0);
  return max + 1;
}

function addProductLineToOrder(order, productId, qty, { unitPriceOverride = null, useStock = true } = {}) {
  const p = productById(productId);
  if (!p) throw new Error("Product not found.");
  const q = Math.max(1, Math.floor(safeNumber(qty, 1)));
  const use = Boolean(useStock);
  if (use && safeNumber(p.stock) < q) throw new Error(`Not enough stock for "${p.name}".`);
  const unitPrice = unitPriceOverride == null ? safeNumber(p.price) : safeNumber(unitPriceOverride);
  if (unitPrice < 0) throw new Error("Unit price must be >= 0.");

  order.items.push({
    id: uid("line"),
    productId: p.id,
    name: p.name,
    qty: q,
    unitPrice,
    usedStock: use,
  });
  if (use) p.stock = safeNumber(p.stock) - q;
  if (order.status === "draft") order.status = "open";
}

function openModal({ title, bodyHTML, primaryText = "Save", onSubmit }) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHTML;
  el.modalPrimary.textContent = primaryText;

  const handler = (ev) => {
    ev.preventDefault();
    try {
      onSubmit?.(new FormData(el.modalForm));
      el.modal.close();
      el.modalForm.removeEventListener("submit", handler);
    } catch (e) {
      // Keep modal open so user can correct inputs.
      alert(e?.message || String(e));
    }
  };
  el.modalForm.addEventListener("submit", handler);
  el.modal.showModal();
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function storageEstimate() {
  const raw = localStorage.getItem(STORAGE_KEY) || "";
  const bytes = new Blob([raw]).size;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function getPopularProducts(limit = 8) {
  const counts = new Map();
  for (const o of DB.orders) {
    for (const it of o.items || []) {
      if (!it?.productId) continue;
      counts.set(it.productId, (counts.get(it.productId) || 0) + safeNumber(it.qty, 1));
    }
  }
  return DB.products
    .slice()
    .map((p) => ({ p, c: counts.get(p.id) || 0 }))
    .sort((a, b) => b.c - a.c || (a.p.name || "").localeCompare(b.p.name || ""))
    .map((x) => x.p)
    .slice(0, limit);
}

// Dashboard render
function renderDashboard() {
  const currency = DB.meta.currency;
  el.kpiCurrencyHint.textContent = `Currency: ${currency} (editable in Export JSON for now).`;

  const t = todayISO();
  const todays = DB.orders.filter((o) => o.createdAt?.slice(0, 10) === t && o.status !== "cancelled");
  const revenue = todays
    .filter((o) => o.paid === true || o.status === "completed")
    .reduce((sum, o) => sum + orderTotal(o), 0);

  el.kpiTodayOrders.textContent = String(todays.length);
  el.kpiTodayRevenue.textContent = formatMoney(revenue, currency);
  el.kpiTodayAvg.textContent = todays.length ? formatMoney(revenue / todays.length, currency) : formatMoney(0, currency);

  const open = DB.orders
    .filter((o) => ["open", "ready", "draft"].includes(o.status))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  el.openOrderPills.innerHTML = open.length
    ? open
        .slice(0, 12)
        .map((o) => {
          const total = orderTotal(o);
          return `<button class="pill" type="button" data-order="${escapeHtml(o.id)}">
            <span class="mono">${escapeHtml(orderLabel(o))}</span>
            <span class="status ${statusClass(o.status)}">${escapeHtml(o.status || "draft")}</span>
            <span class="mono">${escapeHtml(formatMoney(total, currency))}</span>
          </button>`;
        })
        .join("")
    : `<div class="empty">No open orders.</div>`;

  // Low stock
  const low = DB.products
    .filter((p) => safeNumber(p.stock) <= safeNumber(p.reorderPoint))
    .sort((a, b) => safeNumber(a.stock) - safeNumber(b.stock));

  el.lowStockTable.innerHTML = low.length
    ? low
        .slice(0, 20)
        .map(
          (p) => `<tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${escapeHtml(String(safeNumber(p.stock)))}</td>
            <td class="num">${escapeHtml(String(safeNumber(p.reorderPoint)))}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3"><div class="empty">All good — no low stock.</div></td></tr>`;

  el.openOrderPills.querySelectorAll("[data-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedOrderId = btn.getAttribute("data-order");
      setView("orders");
      renderOrders();
      renderOrderDetails();
    });
  });
}

function renderKitchen() {
  if (!el.kitchenOpen || !el.kitchenReady) return;
  const typeFilter = (el.kitchenTypeFilter?.value || "").trim();
  const list = DB.orders
    .filter((o) => (typeFilter ? o.type === typeFilter : true))
    .filter((o) => o.status === "open" || o.status === "ready")
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  const open = list.filter((o) => o.status === "open");
  const ready = list.filter((o) => o.status === "ready");

  el.kitchenOpen.innerHTML = open.length ? open.map((o) => kitchenTicketHTML(o)).join("") : `<div class="empty">No open tickets.</div>`;
  el.kitchenReady.innerHTML = ready.length ? ready.map((o) => kitchenTicketHTML(o)).join("") : `<div class="empty">No ready tickets.</div>`;

  document.querySelectorAll("[data-kitchen-order]").forEach((t) => {
    const pick = () => {
      selectedOrderId = t.getAttribute("data-kitchen-order");
      setView("orders");
      renderOrders();
      renderOrderDetails();
    };
    t.addEventListener("click", pick);
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") pick();
    });
  });
}

function kitchenTicketHTML(order) {
  const cust = customerById(order.customerId)?.name || "—";
  const extra = orderExtraMeta(order);
  const when = (order.createdAt || "").slice(0, 16).replace("T", " ");
  const items = (order.items || []).slice().map((it) => {
    const p = productById(it.productId);
    const name = p?.name || it.name || "Item";
    return `<div class="ticket-line"><span>${escapeHtml(name)}</span><span class="qty">x${escapeHtml(String(Math.floor(safeNumber(it.qty, 1))))}</span></div>`;
  });
  return `<div class="ticket" role="button" tabindex="0" data-kitchen-order="${escapeHtml(order.id)}">
    <div class="ticket-head">
      <div>
        <div class="ticket-title">${escapeHtml(orderLabel(order))} <span class="tag ${statusClass(order.status)}">${escapeHtml(order.status)}</span></div>
        <div class="ticket-meta">
          <span>${escapeHtml(orderTypeLabel(order.type))}</span>
          ${extra ? `<span>${escapeHtml(extra)}</span>` : ""}
          <span>${escapeHtml(cust)}</span>
          <span class="mono">${escapeHtml(when)}</span>
        </div>
      </div>
    </div>
    <div class="ticket-items">
      ${items.length ? items.join("") : `<div class="muted small">No items</div>`}
    </div>
  </div>`;
}

// Orders render
function renderOrders() {
  const q = (el.orderSearch.value || "").trim().toLowerCase();
  const statusFilter = el.orderStatusFilter.value || "";

  const currency = DB.meta.currency;
  const list = DB.orders
    .filter((o) => (statusFilter ? o.status === statusFilter : true))
    .filter((o) => {
      if (!q) return true;
      const cust = customerById(o.customerId)?.name || "";
      const hay = `${o.number || ""} ${o.status || ""} ${cust}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  el.orderList.innerHTML = list.length
    ? list
        .map((o) => {
          const cust = customerById(o.customerId)?.name || "—";
          const total = orderTotal(o);
          const active = o.id === selectedOrderId;
          const paidTag = o.paid ? `<span class="tag">Paid</span>` : `<span class="tag">Unpaid</span>`;
          const meta = orderShortMeta(o);
          return `<div class="list-item ${active ? "is-active" : ""}" data-order="${escapeHtml(o.id)}" role="button" tabindex="0">
            <div class="li-main">
              <div class="li-title">${escapeHtml(orderLabel(o))} <span class="tag ${statusClass(o.status)}">${escapeHtml(
            o.status || "draft"
          )}</span></div>
              <div class="li-sub">${escapeHtml(cust)}${meta ? " • " + escapeHtml(meta) : ""} • ${escapeHtml(
            (o.createdAt || "").slice(0, 16).replace("T", " ")
          )}</div>
            </div>
            <div class="li-right">
              <div class="mono">${escapeHtml(formatMoney(total, currency))}</div>
              <div class="row">${paidTag}</div>
            </div>
          </div>`;
        })
        .join("")
    : `<div class="empty">No orders yet. Click “New order”.</div>`;

  el.orderList.querySelectorAll("[data-order]").forEach((row) => {
    const pick = () => {
      selectedOrderId = row.getAttribute("data-order");
      renderOrders();
      renderOrderDetails();
    };
    row.addEventListener("click", pick);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") pick();
    });
  });
}

function renderOrderDetails() {
  const order = DB.orders.find((o) => o.id === selectedOrderId) || null;
  const currency = DB.meta.currency;
  el.orderDetailsActions.innerHTML = "";
  if (!order) {
    el.orderDetailsHint.textContent = "Select an order.";
    el.orderDetails.innerHTML = `<div class="empty">Pick an order on the left.</div>`;
    return;
  }
  el.orderDetailsHint.textContent = `${orderLabel(order)} • ${order.status || "draft"}`;

  const cust = customerById(order.customerId);
  const items = Array.isArray(order.items) ? order.items : [];
  const total = orderTotal(order);
  const extra = orderExtraMeta(order);

  const popular = getPopularProducts(8);
  const quickAddHTML = popular.length
    ? `<div class="divider"></div>
       <div class="label">Quick add</div>
       <div class="quick-add">
         ${popular
           .map(
             (p) =>
               `<button class="btn btn-ghost" type="button" data-quick-add="${escapeHtml(p.id)}">${escapeHtml(
                 p.name
               )}</button>`
           )
           .join("")}
       </div>`
    : "";

  el.orderDetailsActions.innerHTML = `
    <button class="btn btn-ghost" id="btnEditOrder" type="button">Edit</button>
    <button class="btn btn-ghost" id="btnAddItem" type="button">Add item</button>
    <button class="btn btn-ghost" id="btnTogglePaid" type="button">${order.paid ? "Mark unpaid" : "Mark paid"}</button>
    <button class="btn btn-ghost" id="btnAdvanceStatus" type="button">Next status</button>
  `;

  el.orderDetails.innerHTML = `
    <div class="row">
      <span class="tag ${statusClass(order.status)}">Status: ${escapeHtml(order.status || "draft")}</span>
      <span class="tag">Type: ${escapeHtml(orderTypeLabel(order.type))}${extra ? ` • ${escapeHtml(extra)}` : ""}</span>
      <span class="tag">Paid: ${order.paid ? "Yes" : "No"}</span>
      <span class="tag mono">${escapeHtml((order.createdAt || "").slice(0, 19).replace("T"," "))}</span>
    </div>

    <div class="divider"></div>

    <div class="form-grid">
      <div class="field">
        <div class="label">Customer</div>
        <div>${escapeHtml(cust?.name || "—")}</div>
        <div class="help">${escapeHtml(cust?.phone || "")} ${cust?.email ? "• " + escapeHtml(cust.email) : ""}</div>
      </div>
      <div class="field">
        <div class="label">Notes</div>
        <div>${escapeHtml(order.notes || "—")}</div>
      </div>
    </div>

    ${quickAddHTML}

    <div class="divider"></div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Qty</th>
            <th class="num">Unit</th>
            <th class="num">Line</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            items.length
              ? items
                  .map((it) => {
                    const p = productById(it.productId);
                    const name = p?.name || it.name || "Item";
                    const line = safeNumber(it.qty) * safeNumber(it.unitPrice);
                    return `<tr>
                      <td>${escapeHtml(name)}</td>
                      <td class="num">${escapeHtml(String(safeNumber(it.qty)))}</td>
                      <td class="num">${escapeHtml(formatMoney(it.unitPrice, currency))}</td>
                      <td class="num">${escapeHtml(formatMoney(line, currency))}</td>
                      <td class="num"><button class="btn btn-ghost" data-del-line="${escapeHtml(it.id)}" type="button">Remove</button></td>
                    </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="5"><div class="empty">No items yet. Add an item.</div></td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div class="divider"></div>
    <div class="row">
      <div class="grow"></div>
      <div class="tag">Total: <span class="mono">${escapeHtml(formatMoney(total, currency))}</span></div>
    </div>
  `;

  el.orderDetails.querySelectorAll("[data-quick-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        addProductLineToOrder(order, btn.getAttribute("data-quick-add"), 1, { useStock: true });
        saveDB(DB);
      } catch (e) {
        alert(e?.message || String(e));
      }
    });
  });

  el.orderDetails.querySelectorAll("[data-del-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-line");
      const idx = order.items.findIndex((x) => x.id === id);
      if (idx >= 0) {
        const removed = order.items.splice(idx, 1)[0];
        // Return stock only if this line reduced stock.
        if (removed?.productId && removed?.usedStock) {
          const p = productById(removed.productId);
          if (p) p.stock = safeNumber(p.stock) + safeNumber(removed.qty);
        }
        saveDB(DB);
      }
    });
  });

  document.getElementById("btnEditOrder").addEventListener("click", () => openEditOrder(order));
  document.getElementById("btnAddItem").addEventListener("click", () => openAddOrderItem(order));
  document.getElementById("btnTogglePaid").addEventListener("click", () => {
    order.paid = !order.paid;
    if (order.paid && order.status === "draft") order.status = "open";
    saveDB(DB);
  });
  document.getElementById("btnAdvanceStatus").addEventListener("click", () => {
    const flow = ["draft", "open", "ready", "completed"];
    const cur = order.status || "draft";
    const i = flow.indexOf(cur);
    order.status = flow[Math.min(i + 1, flow.length - 1)];
    if (order.status === "completed") order.paid = true;
    saveDB(DB);
  });
}

function openEditOrder(order) {
  const custOptions = DB.customers
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === order.customerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");

  openModal({
    title: `Edit ${orderLabel(order)}`,
    primaryText: "Save",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Customer</div>
          <select class="select" name="customerId" required>
            ${custOptions}
          </select>
          <div class="help">Add a new customer in the Customers tab if needed.</div>
        </div>
        <div class="field">
          <div class="label">Status</div>
          <select class="select" name="status" required>
            ${["draft","open","ready","completed","cancelled"].map(s => `<option value="${s}" ${s === (order.status || "draft") ? "selected":""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Order type</div>
          <select class="select" name="type" required>
            ${["dine-in","takeaway","delivery"].map(t => `<option value="${t}" ${t === (order.type || "takeaway") ? "selected":""}>${orderTypeLabel(t)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <div class="label">Table / Pickup name</div>
          <input class="input" name="tableOrPickup" value="${escapeHtml(order.type === "dine-in" ? (order.table || "") : (order.pickupName || ""))}" placeholder="e.g. 4 or Amina" />
          <div class="help">Dine-in uses table number. Takeaway/Delivery uses pickup name.</div>
        </div>
      </div>
      <div class="field">
        <div class="label">Notes</div>
        <input class="input" name="notes" value="${escapeHtml(order.notes || "")}" placeholder="Optional…" />
      </div>
      <div class="warn-box small">
        Changing to <b>cancelled</b> will not auto-return stock. Remove line items first if you want stock back.
      </div>
    `,
    onSubmit: (fd) => {
      order.customerId = String(fd.get("customerId") || "");
      order.status = String(fd.get("status") || "draft");
      order.type = String(fd.get("type") || "takeaway");
      const tableOrPickup = String(fd.get("tableOrPickup") || "").trim();
      order.table = order.type === "dine-in" ? tableOrPickup : "";
      order.pickupName = order.type === "dine-in" ? "" : tableOrPickup;
      order.notes = String(fd.get("notes") || "").trim();
      if (order.status === "completed") order.paid = true;
      saveDB(DB);
    },
  });
}

function openAddOrderItem(order) {
  if (!DB.products.length) {
    alert("Add a product first (Products tab).");
    return;
  }
  const options = DB.products
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.sku || "—")})</option>`)
    .join("");

  openModal({
    title: `Add item to ${orderLabel(order)}`,
    primaryText: "Add",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Product</div>
          <select class="select" name="productId" required>${options}</select>
        </div>
        <div class="field">
          <div class="label">Qty</div>
          <input class="input" name="qty" type="number" min="1" step="1" value="1" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Unit price</div>
          <input class="input" name="unitPrice" type="number" min="0" step="0.01" placeholder="Leave blank to use product price" />
          <div class="help">You can override price per order line (discounts, specials).</div>
        </div>
        <div class="field">
          <div class="label">Use stock?</div>
          <select class="select" name="useStock">
            <option value="yes" selected>Yes (reduce stock)</option>
            <option value="no">No</option>
          </select>
          <div class="help">If you’re selling non-stock items, choose No.</div>
        </div>
      </div>
    `,
    onSubmit: (fd) => {
      const productId = String(fd.get("productId") || "");
      const qty = Math.max(1, Math.floor(safeNumber(fd.get("qty"), 1)));
      const useStock = String(fd.get("useStock") || "yes") === "yes";
      const unitPriceRaw = String(fd.get("unitPrice") || "").trim();
      const unitPriceOverride = unitPriceRaw === "" ? null : unitPriceRaw;
      addProductLineToOrder(order, productId, qty, { unitPriceOverride, useStock });
      saveDB(DB);
    },
  });
}

function createNewOrder() {
  const walkIn = DB.customers.find((c) => (c.name || "").toLowerCase() === "walk-in") || DB.customers[0] || null;
  const order = {
    id: uid("ord"),
    number: ensureOrderNumber(),
    status: "draft",
    type: "takeaway",
    table: "",
    pickupName: "",
    customerId: walkIn?.id || "",
    notes: "",
    paid: false,
    items: [],
    createdAt: new Date().toISOString(),
  };
  DB.orders.push(order);
  saveDB(DB);
  selectedOrderId = order.id;
  setView("orders");
  renderOrders();
  renderOrderDetails();
}

// Products render
function renderProducts() {
  const q = (el.productSearch.value || "").trim().toLowerCase();
  const currency = DB.meta.currency;
  const list = DB.products
    .filter((p) => {
      if (!q) return true;
      const hay = `${p.name || ""} ${p.sku || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  el.productTable.innerHTML = list.length
    ? list
        .map((p) => {
          const low = safeNumber(p.stock) <= safeNumber(p.reorderPoint);
          return `<tr>
            <td>
              <div style="font-weight:760">${escapeHtml(p.name)}</div>
              <div class="muted small mono">${escapeHtml(p.id)}</div>
            </td>
            <td>${escapeHtml(p.sku || "—")}</td>
            <td class="num">${escapeHtml(formatMoney(p.price, currency))}</td>
            <td class="num">${low ? `<span class="danger">${escapeHtml(String(safeNumber(p.stock)))}</span>` : escapeHtml(String(safeNumber(p.stock)))}</td>
            <td class="num">${escapeHtml(String(safeNumber(p.reorderPoint)))}</td>
            <td class="num">
              <button class="btn btn-ghost" data-edit-prd="${escapeHtml(p.id)}" type="button">Edit</button>
              <button class="btn btn-ghost" data-del-prd="${escapeHtml(p.id)}" type="button">Delete</button>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6"><div class="empty">No products. Add one.</div></td></tr>`;

  el.productTable.querySelectorAll("[data-edit-prd]").forEach((b) => b.addEventListener("click", () => openEditProduct(b.getAttribute("data-edit-prd"))));
  el.productTable.querySelectorAll("[data-del-prd]").forEach((b) => b.addEventListener("click", () => deleteProduct(b.getAttribute("data-del-prd"))));
}

function openNewProduct() {
  openModal({
    title: "New product",
    primaryText: "Create",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Name</div>
          <input class="input" name="name" required placeholder="e.g. Chicken wrap" />
        </div>
        <div class="field">
          <div class="label">SKU (optional)</div>
          <input class="input" name="sku" placeholder="e.g. WRAP-CHKN" />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Price</div>
          <input class="input" name="price" type="number" min="0" step="0.01" value="0" required />
        </div>
        <div class="field">
          <div class="label">Starting stock</div>
          <input class="input" name="stock" type="number" step="1" value="0" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Reorder point</div>
          <input class="input" name="reorderPoint" type="number" step="1" value="0" required />
          <div class="help">Low stock alert triggers at/below this number.</div>
        </div>
        <div class="field">
          <div class="label">Currency</div>
          <input class="input" name="currency" value="${escapeHtml(DB.meta.currency)}" placeholder="USD" />
          <div class="help">Set once per device (stored locally).</div>
        </div>
      </div>
    `,
    onSubmit: (fd) => {
      const name = String(fd.get("name") || "").trim();
      const sku = String(fd.get("sku") || "").trim();
      const price = safeNumber(fd.get("price"), 0);
      const stock = Math.floor(safeNumber(fd.get("stock"), 0));
      const reorderPoint = Math.floor(safeNumber(fd.get("reorderPoint"), 0));
      const currency = String(fd.get("currency") || "").trim().toUpperCase() || DB.meta.currency;
      if (!name) throw new Error("Name required.");
      if (price < 0) throw new Error("Price must be >= 0.");
      DB.meta.currency = currency;
      DB.products.push({ id: uid("prd"), name, sku, price, stock, reorderPoint });
      saveDB(DB);
    },
  });
}

function openEditProduct(productId) {
  const p = productById(productId);
  if (!p) return;
  openModal({
    title: `Edit product`,
    primaryText: "Save",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Name</div>
          <input class="input" name="name" required value="${escapeHtml(p.name)}" />
        </div>
        <div class="field">
          <div class="label">SKU</div>
          <input class="input" name="sku" value="${escapeHtml(p.sku || "")}" />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Price</div>
          <input class="input" name="price" type="number" min="0" step="0.01" value="${escapeHtml(String(safeNumber(p.price)))}" required />
        </div>
        <div class="field">
          <div class="label">Stock</div>
          <input class="input" name="stock" type="number" step="1" value="${escapeHtml(String(Math.floor(safeNumber(p.stock))))}" required />
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <div class="label">Reorder point</div>
          <input class="input" name="reorderPoint" type="number" step="1" value="${escapeHtml(String(Math.floor(safeNumber(p.reorderPoint))))}" required />
        </div>
      </div>
    `,
    onSubmit: (fd) => {
      const name = String(fd.get("name") || "").trim();
      const sku = String(fd.get("sku") || "").trim();
      const price = safeNumber(fd.get("price"), 0);
      const stock = Math.floor(safeNumber(fd.get("stock"), 0));
      const reorderPoint = Math.floor(safeNumber(fd.get("reorderPoint"), 0));
      if (!name) throw new Error("Name required.");
      if (price < 0) throw new Error("Price must be >= 0.");
      p.name = name;
      p.sku = sku;
      p.price = price;
      p.stock = stock;
      p.reorderPoint = reorderPoint;
      saveDB(DB);
    },
  });
}

function deleteProduct(productId) {
  const p = productById(productId);
  if (!p) return;
  const used = DB.orders.some((o) => (o.items || []).some((it) => it.productId === productId));
  const msg = used
    ? `“${p.name}” appears in existing orders. Delete anyway? (Old orders will keep the line name but lose product link.)`
    : `Delete “${p.name}”?`;
  if (!confirm(msg)) return;
  for (const o of DB.orders) {
    for (const it of o.items || []) {
      if (it.productId === productId) it.productId = null;
    }
  }
  DB.products = DB.products.filter((x) => x.id !== productId);
  saveDB(DB);
}

// Customers render
function renderCustomers() {
  const q = (el.customerSearch.value || "").trim().toLowerCase();
  const list = DB.customers
    .filter((c) => {
      if (!q) return true;
      const hay = `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const counts = new Map();
  for (const o of DB.orders) {
    const id = o.customerId || "";
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  el.customerTable.innerHTML = list.length
    ? list
        .map((c) => {
          const n = counts.get(c.id) || 0;
          const protectedWalkIn = (c.name || "").toLowerCase() === "walk-in";
          return `<tr>
            <td>
              <div style="font-weight:760">${escapeHtml(c.name)}</div>
              <div class="muted small mono">${escapeHtml(c.id)}</div>
            </td>
            <td>${escapeHtml(c.phone || "—")}</td>
            <td>${escapeHtml(c.email || "—")}</td>
            <td class="num">${escapeHtml(String(n))}</td>
            <td class="num">
              <button class="btn btn-ghost" data-edit-cus="${escapeHtml(c.id)}" type="button">Edit</button>
              <button class="btn btn-ghost" data-del-cus="${escapeHtml(c.id)}" type="button" ${protectedWalkIn ? "disabled" : ""}>Delete</button>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5"><div class="empty">No customers. Add one.</div></td></tr>`;

  el.customerTable.querySelectorAll("[data-edit-cus]").forEach((b) => b.addEventListener("click", () => openEditCustomer(b.getAttribute("data-edit-cus"))));
  el.customerTable.querySelectorAll("[data-del-cus]").forEach((b) => b.addEventListener("click", () => deleteCustomer(b.getAttribute("data-del-cus"))));
}

function openNewCustomer() {
  openModal({
    title: "New customer",
    primaryText: "Create",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Name</div>
          <input class="input" name="name" required placeholder="e.g. Amina" />
        </div>
        <div class="field">
          <div class="label">Phone (optional)</div>
          <input class="input" name="phone" placeholder="e.g. +1 555 123 4567" />
        </div>
      </div>
      <div class="field">
        <div class="label">Email (optional)</div>
        <input class="input" name="email" placeholder="e.g. amina@example.com" />
      </div>
    `,
    onSubmit: (fd) => {
      const name = String(fd.get("name") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const email = String(fd.get("email") || "").trim();
      if (!name) throw new Error("Name required.");
      DB.customers.push({ id: uid("cus"), name, phone, email });
      saveDB(DB);
    },
  });
}

function openEditCustomer(customerId) {
  const c = customerById(customerId);
  if (!c) return;
  const protectedWalkIn = (c.name || "").toLowerCase() === "walk-in";
  openModal({
    title: "Edit customer",
    primaryText: "Save",
    bodyHTML: `
      <div class="form-grid">
        <div class="field">
          <div class="label">Name</div>
          <input class="input" name="name" required value="${escapeHtml(c.name)}" ${protectedWalkIn ? "disabled" : ""} />
          ${protectedWalkIn ? `<div class="help">Walk-in is a default customer.</div>` : ``}
        </div>
        <div class="field">
          <div class="label">Phone</div>
          <input class="input" name="phone" value="${escapeHtml(c.phone || "")}" />
        </div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <input class="input" name="email" value="${escapeHtml(c.email || "")}" />
      </div>
    `,
    onSubmit: (fd) => {
      if (!protectedWalkIn) c.name = String(fd.get("name") || "").trim();
      c.phone = String(fd.get("phone") || "").trim();
      c.email = String(fd.get("email") || "").trim();
      if (!c.name) throw new Error("Name required.");
      saveDB(DB);
    },
  });
}

function deleteCustomer(customerId) {
  const c = customerById(customerId);
  if (!c) return;
  if ((c.name || "").toLowerCase() === "walk-in") return;
  const used = DB.orders.some((o) => o.customerId === customerId);
  const msg = used
    ? `“${c.name}” is used on existing orders. Delete anyway? (Orders will show customer as —.)`
    : `Delete “${c.name}”?`;
  if (!confirm(msg)) return;
  for (const o of DB.orders) if (o.customerId === customerId) o.customerId = "";
  DB.customers = DB.customers.filter((x) => x.id !== customerId);
  saveDB(DB);
}

// Import/Export/Reset
function exportBackup() {
  const payload = normalizeDB(DB);
  const filename = `oms-backup_${todayISO()}.json`;
  downloadJSON(filename, payload);
}

async function importBackup(file) {
  const text = await file.text();
  const parsed = normalizeDB(JSON.parse(text));
  if (!confirm("Importing will replace your current local data on this device. Continue?")) return;
  DB = parsed;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  selectedOrderId = null;
  renderAll();
}

function resetAll() {
  if (!confirm("This clears ALL local OMS data on this device. Did you export a backup?")) return;
  localStorage.removeItem(STORAGE_KEY);
  DB = loadDB();
  selectedOrderId = null;
  renderAll();
}

function renderAll() {
  el.footerStorage.textContent = `Storage used: ${storageEstimate()} • Updated: ${new Date(DB.meta.updatedAt).toLocaleString()}`;
  renderDashboard();
  renderKitchen();
  renderOrders();
  renderOrderDetails();
  renderProducts();
  renderCustomers();
}

// Events
el.tabs.forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
el.btnNewOrder.addEventListener("click", createNewOrder);
el.btnExport.addEventListener("click", exportBackup);
el.fileImport.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (f) await importBackup(f);
});
el.btnReset.addEventListener("click", resetAll);

el.orderSearch.addEventListener("input", renderOrders);
el.orderStatusFilter.addEventListener("change", renderOrders);
el.productSearch.addEventListener("input", renderProducts);
el.customerSearch.addEventListener("input", renderCustomers);

el.btnNewProduct.addEventListener("click", openNewProduct);
el.btnNewCustomer.addEventListener("click", openNewCustomer);

el.kitchenTypeFilter?.addEventListener("change", renderKitchen);
el.btnKitchenRefresh?.addEventListener("click", renderKitchen);

// Initial render
renderAll();

