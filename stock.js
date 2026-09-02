// ========== STOCK MANAGEMENT + LOW STOCK ALERTS ==========
const STOCK_KEY = 'sp_furniture_stock';
const LOW_STOCK_THRESHOLD = 5; // แจ้งเตือนเมื่อสต็อก <= 5
const STOCK_ALERT_DISMISSED_KEY = 'sp_stock_alert_dismissed';

function initStock() {
  const saved = localStorage.getItem(STOCK_KEY);
  if (saved) {
    try {
      const map = JSON.parse(saved);
      products.forEach(p => {
        if (map[p.id] !== undefined) p.stock = map[p.id];
      });
      return;
    } catch (e) {}
  }
  saveStock();
}

function saveStock() {
  const map = {};
  products.forEach(p => { map[p.id] = p.stock; });
  localStorage.setItem(STOCK_KEY, JSON.stringify(map));
  // Refresh alerts UI if present
  if (typeof renderStockAlerts === 'function') {
    try { renderStockAlerts(); } catch (e) {}
  }
  updateStockAlertBadge();
}

function getStock(productId) {
  const p = products.find(x => x.id === productId);
  return p ? (p.stock || 0) : 0;
}

function setStock(productId, qty) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  p.stock = Math.max(0, qty);
  saveStock();
}

function reduceStock(productId, qty) {
  const p = products.find(x => x.id === productId);
  if (!p) return false;
  if (p.stock < qty) return false;
  const before = p.stock;
  p.stock -= qty;
  saveStock();
  // Toast if just entered low stock zone
  if (before > LOW_STOCK_THRESHOLD && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD) {
    showLowStockToast(p.name, p.stock);
  } else if (p.stock === 0) {
    showLowStockToast(p.name, 0);
  }
  return true;
}

function isInStock(productId, qty = 1) {
  return getStock(productId) >= qty;
}

function isLowStock(productId) {
  const s = getStock(productId);
  return s > 0 && s <= LOW_STOCK_THRESHOLD;
}

function isOutOfStock(productId) {
  return getStock(productId) < 1;
}

function getStockStatus(productId) {
  const s = getStock(productId);
  if (s < 1) return 'out';
  if (s <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

function getLowStockProducts() {
  return products
    .filter(p => {
      const s = getStock(p.id);
      return s > 0 && s <= LOW_STOCK_THRESHOLD;
    })
    .sort((a, b) => getStock(a.id) - getStock(b.id));
}

function getOutOfStockProducts() {
  return products.filter(p => getStock(p.id) < 1);
}

function formatPrice(n) {
  return '฿' + Number(n).toLocaleString('th-TH');
}

/** Badge HTML for product cards */
function stockBadgeHTML(productId) {
  const s = getStock(productId);
  if (s < 1) {
    return '<span class="stock-badge out">หมดสต็อก</span>';
  }
  if (s <= LOW_STOCK_THRESHOLD) {
    return `<span class="stock-badge low">⚠ เหลือน้อย ${s}</span>`;
  }
  return `<span class="stock-badge">คงเหลือ ${s}</span>`;
}

function showLowStockToast(name, stock) {
  let toast = document.getElementById('stockAlertToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'stockAlertToast';
    toast.className = 'stock-alert-toast';
    document.body.appendChild(toast);
  }
  if (stock === 0) {
    toast.innerHTML = `<span class="toast-icon out">!</span> <strong>${name}</strong> หมดสต็อกแล้ว`;
    toast.classList.add('out');
  } else {
    toast.innerHTML = `<span class="toast-icon">⚠</span> <strong>${name}</strong> สต็อกเหลือน้อย (เหลือ ${stock} ชิ้น)`;
    toast.classList.remove('out');
  }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function updateStockAlertBadge() {
  try {
    const low = getLowStockProducts().length;
    const out = getOutOfStockProducts().length;
    const total = low + out;
    document.querySelectorAll('.stock-alert-badge').forEach(el => {
      el.textContent = total;
      el.style.display = total > 0 ? 'flex' : 'none';
    });
    const countEl = document.getElementById('stockAlertCount');
    if (countEl) {
      countEl.textContent = total > 0 ? (total + ' รายการ') : 'ปกติ';
    }
  } catch (e) {}
}

function renderStockAlerts() {
  const list = document.getElementById('stockAlertList');
  const empty = document.getElementById('stockAlertEmpty');
  if (!list) return;

  const low = getLowStockProducts();
  const out = getOutOfStockProducts();

  if (low.length === 0 && out.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    updateStockAlertBadge();
    return;
  }

  if (empty) empty.style.display = 'none';

  let html = '';

  if (out.length > 0) {
    html += `<div class="stock-alert-group"><h4 class="stock-alert-group-title out">หมดสต็อก (${out.length})</h4>`;
    html += out.map(p => `
      <div class="stock-alert-item out">
        <img src="${p.image}" alt="${p.name}">
        <div class="stock-alert-item-info">
          <strong>${p.name}</strong>
          <span>${p.categoryName}</span>
        </div>
        <span class="stock-alert-qty out">0</span>
      </div>
    `).join('');
    html += '</div>';
  }

  if (low.length > 0) {
    html += `<div class="stock-alert-group"><h4 class="stock-alert-group-title low">สต็อกต่ำ (≤${LOW_STOCK_THRESHOLD}) — ${low.length} รายการ</h4>`;
    html += low.map(p => {
      const s = getStock(p.id);
      return `
      <div class="stock-alert-item low">
        <img src="${p.image}" alt="${p.name}">
        <div class="stock-alert-item-info">
          <strong>${p.name}</strong>
          <span>${p.categoryName}</span>
        </div>
        <span class="stock-alert-qty low">${s}</span>
      </div>`;
    }).join('');
    html += '</div>';
  }

  list.innerHTML = html;
  updateStockAlertBadge();
}

function openStockAlertPanel() {
  const panel = document.getElementById('stockAlertPanel');
  const overlay = document.getElementById('stockAlertOverlay');
  if (panel) panel.classList.add('open');
  if (overlay) overlay.classList.add('open');
  renderStockAlerts();
}

function closeStockAlertPanel() {
  const panel = document.getElementById('stockAlertPanel');
  const overlay = document.getElementById('stockAlertOverlay');
  if (panel) panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// Init when products available
if (typeof products !== 'undefined') {
  initStock();
}
