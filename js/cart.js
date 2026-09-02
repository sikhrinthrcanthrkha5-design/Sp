// ========== SHOPPING CART SYSTEM ==========
const CART_KEY = 'sp_furniture_cart';
const ORDERS_KEY = 'sp_furniture_orders';

/** ประมาณน้ำหนักจากข้อความขนาด (ซม.) หรือค่า weightKg ของสินค้า */
function estimateProductWeight(product) {
  if (!product) return null;
  if (product.weightKg != null && product.weightKg !== '') return Number(product.weightKg);
  var size = String(product.size || '');
  var nums = size.match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length < 2) return null;
  var dims = nums.slice(0, 3).map(Number);
  while (dims.length < 3) dims.push(dims[0] * 0.6);
  // สมมติความหนาแน่นไม้เฟอร์นิเจอร์เฉลี่ย ~0.00055 กก./ลบ.ซม. หักช่องว่าง 55%
  var vol = dims[0] * dims[1] * dims[2];
  var kg = vol * 0.00055 * 0.45;
  return Math.max(1, Math.round(kg * 10) / 10);
}

function enrichCartItem(product, qty) {
  var w = estimateProductWeight(product);
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    categoryName: product.categoryName,
    category: product.category,
    price: product.price || 0,
    qty: qty,
    material: product.material || '',
    size: product.size || '',
    color: product.color || '',
    weightKg: w,
    sku: 'SP-' + String(product.id).padStart(4, '0'),
    desc: product.desc || ''
  };
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  renderCartDrawer();
  if (typeof updateStockAlertBadge === 'function') updateStockAlertBadge();
}

function addToCart(productId, qty = 1) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const stock = getStock(productId);
  if (stock < 1) {
    alert('สินค้าหมดสต็อกแล้ว');
    return;
  }

  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty + qty > stock) {
    alert(`สต็อกเหลือเพียง ${stock} ชิ้น (ในตะกร้ามี ${currentQty} ชิ้นแล้ว)`);
    return;
  }

  if (existing) {
    existing.qty += qty;
    // อัปเดตสเปกถ้าของเก่ายังไม่มี
    if (!existing.material && product.material) existing.material = product.material;
    if (!existing.size && product.size) existing.size = product.size;
    if (!existing.color && product.color) existing.color = product.color;
    if (existing.weightKg == null) existing.weightKg = estimateProductWeight(product);
    if (!existing.sku) existing.sku = 'SP-' + String(product.id).padStart(4, '0');
  } else {
    cart.push(enrichCartItem(product, qty));
  }

  saveCart(cart);
  showCartToast(product.name);
  openCart();
}

function removeFromCart(productId) {
  saveCart(getCart().filter(item => item.id !== productId));
}

function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }

  const stock = getStock(productId);
  if (newQty > stock) {
    alert(`สต็อกเหลือเพียง ${stock} ชิ้น`);
    return;
  }

  item.qty = newQty;
  saveCart(cart);
}

function setQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const n = parseInt(qty, 10);
  if (isNaN(n) || n < 1) {
    removeFromCart(productId);
    return;
  }

  const stock = getStock(productId);
  if (n > stock) {
    alert(`สต็อกเหลือเพียง ${stock} ชิ้น`);
    item.qty = stock;
    saveCart(cart);
    return;
  }

  item.qty = n;
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);
}

function updateCartBadge() {
  try { if (window.SPSidebar && SPSidebar.updateCartBadge) SPSidebar.updateCartBadge(); } catch (e) {}

  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

function showCartToast(name) {
  let toast = document.getElementById('cartToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cartToast';
    toast.className = 'cart-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>✓</span> เพิ่ม “${name}” ลงตะกร้าแล้ว`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatPrice(n) {
  return '฿' + Number(n).toLocaleString('th-TH');
}

// ========== CART DRAWER UI ==========
function renderCartDrawer() {
  const list = document.getElementById('cartItems');
  const empty = document.getElementById('cartEmpty');
  const footer = document.getElementById('cartFooter');
  if (!list) return;

  const cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    if (footer) footer.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (footer) footer.style.display = 'block';

  list.innerHTML = cart.map(item => {
    const stock = typeof getStock === 'function' ? getStock(item.id) : 99;
    const lineTotal = (item.price || 0) * item.qty;
    const specs = [
      item.sku ? 'รหัส: ' + item.sku : '',
      item.material ? 'วัสดุ: ' + item.material : '',
      item.size ? 'ขนาด: ' + item.size : '',
      item.color ? 'สี: ' + item.color : '',
      item.weightKg != null ? 'น้ำหนักประมาณ: ' + item.weightKg + ' กก./ชิ้น' : ''
    ].filter(Boolean).map(function (s) { return '<span>' + s + '</span>'; }).join('');
    return `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-img">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span class="cart-item-cat">${item.categoryName || ''} · คงเหลือ ${stock}</span>
        <div class="cart-item-specs">${specs}</div>
        <div class="cart-item-price">${formatPrice(item.price)} × ${item.qty} = <strong>${formatPrice(lineTotal)}</strong></div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
          <input type="number" class="qty-input" value="${item.qty}" min="1" max="${stock}"
                 onchange="setQty(${item.id}, this.value)">
          <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
          <button class="cart-remove" onclick="removeFromCart(${item.id})" title="ลบ">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const totalItems = document.getElementById('cartTotalItems');
  const totalPrice = document.getElementById('cartTotalPrice');
  if (totalItems) totalItems.textContent = getCartCount();
  if (totalPrice) totalPrice.textContent = formatPrice(getCartTotal());
}

function openCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartDrawer();
}

function closeCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function goToCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    alert('ตะกร้าว่าง');
    return;
  }
  // Validate stock before checkout
  for (const item of cart) {
    const stock = getStock(item.id);
    if (item.qty > stock) {
      alert(`“${item.name}” สต็อกไม่พอ (เหลือ ${stock} ชิ้น)`);
      return;
    }
  }
  closeCart();
  window.location.href = 'checkout.html';
}

// ========== ORDERS ==========
function getOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOrder(order) {
  if (order && !order.statusChangedAt) {
    order.statusChangedAt = order.date || new Date().toISOString();
  }
  if (typeof SPAutoStatus !== 'undefined' && SPAutoStatus.stamp) {
    SPAutoStatus.stamp(order);
  }
  const orders = getOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function processPayment(orderData) {
  const cart = getCart();
  if (cart.length === 0) return { success: false, message: 'ตะกร้าว่าง' };

  // Re-check stock
  for (const item of cart) {
    if (!isInStock(item.id, item.qty)) {
      return { success: false, message: `“${item.name}” สต็อกไม่พอ` };
    }
  }

  // Deduct stock
  for (const item of cart) {
    reduceStock(item.id, item.qty);
  }

  const method = orderData.paymentMethod || 'promptpay';
  const isCod = method === 'cod';
  const subtotal = getCartTotal();
  const taxRate = 0.07;
  const tax = Math.round(subtotal * taxRate);
  const discount = 0;
  const grandTotal = subtotal + tax - discount;

  const order = {
    id: 'SP' + Date.now().toString(36).toUpperCase(),
    date: new Date().toISOString(),
    items: cart.map(i => ({ ...i })),
    subtotal: subtotal,
    tax: tax,
    taxRate: taxRate,
    discount: discount,
    total: grandTotal,
    customer: orderData.customer,
    paymentMethod: method,
    status: isCod ? 'cod_pending' : 'paid'
  };

  saveOrder(order);
  try {
    localStorage.setItem('sp_last_order_id', order.id);
    localStorage.setItem('sp_last_order', JSON.stringify(order));
  } catch (e) {}
  clearCart();
  try {
    if (typeof notifyLineOrder === 'function') notifyLineOrder(order);
  } catch (e) {}
  return { success: true, order };
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initStock === 'function') initStock();
  updateCartBadge();
  renderCartDrawer();
  if (typeof updateStockAlertBadge === 'function') updateStockAlertBadge();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });
});
