function getQueryId() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('id'), 10);
}

function loadProduct() {
  const id = getQueryId();
  const loading = document.getElementById('productLoading');
  const notFound = document.getElementById('productNotFound');
  const content = document.getElementById('productContent');
  const relatedSection = document.getElementById('relatedSection');

  if (!id || isNaN(id)) {
    loading.style.display = 'none';
    notFound.style.display = 'block';
    return;
  }

  const product = products.find(p => p.id === id);
  if (!product) {
    loading.style.display = 'none';
    notFound.style.display = 'block';
    return;
  }

  const stock = typeof getStock === 'function' ? getStock(product.id) : (product.stock || 0);
  const outOfStock = stock < 1;
  const priceStr = typeof formatPrice === 'function' ? formatPrice(product.price) : '฿' + (product.price || 0).toLocaleString();

  document.title = `${product.name} | SP Furniture Factory`;
  document.getElementById('breadcrumbName').textContent = product.name;
  document.getElementById('mainImage').src = product.image;
  document.getElementById('mainImage').alt = product.name;
  document.getElementById('productCat').textContent = product.categoryName;
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productDesc').textContent = product.desc;
  document.getElementById('specMaterial').textContent = product.material || '—';
  document.getElementById('specSize').textContent = product.size || '—';
  document.getElementById('specColor').textContent = product.color || '—';
  document.getElementById('specCategory').textContent = product.categoryName;

  // Price & stock display
  let priceEl = document.getElementById('productPrice');
  if (!priceEl) {
    const h1 = document.getElementById('productName');
    priceEl = document.createElement('div');
    priceEl.id = 'productPrice';
    priceEl.className = 'detail-price';
    h1.insertAdjacentElement('afterend', priceEl);
  }
  let stockLabel, stockClass;
  if (outOfStock) { stockLabel = 'หมดสต็อก'; stockClass = 'out'; }
  else if (typeof isLowStock === 'function' && isLowStock(product.id)) { stockLabel = `⚠ สต็อกเหลือน้อย (${stock} ชิ้น)`; stockClass = 'low'; }
  else { stockLabel = `คงเหลือ ${stock} ชิ้น`; stockClass = ''; }
  priceEl.innerHTML = `${priceStr} <span class="detail-stock ${stockClass}">${stockLabel}</span>`;

  const featuresList = document.getElementById('featuresList');
  if (product.features && product.features.length) {
    featuresList.innerHTML = product.features.map(f => `<li>${f}</li>`).join('');
  } else {
    document.getElementById('productFeatures').style.display = 'none';
  }

  const actions = document.querySelector('.product-actions');
  if (actions) {
    if (outOfStock) {
      actions.innerHTML = `
        <button class="btn btn-primary" disabled style="opacity:0.5;cursor:not-allowed;">หมดสต็อก</button>
        <a href="index.html#products" class="btn btn-outline">ดูสินค้าอื่น</a>
      `;
    } else {
      actions.innerHTML = `
        <div class="detail-cart-row">
          <div class="detail-qty">
            <button type="button" onclick="changeDetailQty(-1)">−</button>
            <input type="number" id="detailQty" value="1" min="1" max="${stock}">
            <button type="button" onclick="changeDetailQty(1)">+</button>
          </div>
          <button class="btn btn-primary" onclick="addDetailToCart(${product.id})">🛒 เพิ่มลงตะกร้า</button>
        </div>
        <a href="index.html#contact" class="btn btn-outline">สอบถามสินค้าชิ้นนี้</a>
        <a href="index.html#products" class="btn btn-outline">ดูสินค้าอื่น</a>
      `;
    }
  }

  loading.style.display = 'none';
  content.style.display = 'grid';

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  if (related.length > 0) {
    relatedSection.style.display = 'block';
    const grid = document.getElementById('relatedGrid');
    grid.innerHTML = related.map(p => {
      const s = typeof getStock === 'function' ? getStock(p.id) : (p.stock || 0);
      const oos = s < 1;
      const pr = typeof formatPrice === 'function' ? formatPrice(p.price) : '฿' + (p.price || 0).toLocaleString();
      return `
      <div class="product-card ${oos ? 'out-of-stock' : ''} ${(!oos && typeof isLowStock === 'function' && isLowStock(p.id)) ? 'low-stock' : ''}">
        <a href="product.html?id=${p.id}" class="product-link">
          <div class="product-img-wrap">
            <span class="product-category-badge">${p.categoryName}</span>
            ${typeof stockBadgeHTML === 'function' ? stockBadgeHTML(p.id) : (oos ? '<span class="stock-badge out">หมดสต็อก</span>' : `<span class="stock-badge">คงเหลือ ${s}</span>`)}
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </div>
          <div class="product-body">
            <h3>${p.name}</h3>
            <p>${p.desc}</p>
            <div class="product-price">${pr}</div>
          </div>
        </a>
        <div class="product-meta" style="padding: 0 1.4rem 1.3rem;">
          <span class="product-tag">${p.categoryName}</span>
          ${oos
            ? '<button class="btn-add-cart" disabled style="opacity:0.4;cursor:not-allowed;">หมดสต็อก</button>'
            : `<button class="btn-add-cart" onclick="addToCart(${p.id})">+ ตะกร้า</button>`
          }
        </div>
      </div>`;
    }).join('');
  }
}

function changeDetailQty(delta) {
  const input = document.getElementById('detailQty');
  if (!input) return;
  const max = parseInt(input.max, 10) || 99;
  let val = parseInt(input.value, 10) || 1;
  val = Math.max(1, Math.min(max, val + delta));
  input.value = val;
}

function addDetailToCart(productId) {
  const input = document.getElementById('detailQty');
  const qty = input ? (parseInt(input.value, 10) || 1) : 1;
  addToCart(productId, qty);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initStock === 'function') initStock();
  loadProduct();
  if (typeof updateStockAlertBadge === 'function') updateStockAlertBadge();

  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('active'));
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }
});
