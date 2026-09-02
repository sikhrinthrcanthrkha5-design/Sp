// ========== RENDER PRODUCTS ==========
function renderProducts(filter) {
  const grid = document.getElementById('productsGrid');
  const noResults = document.getElementById('noProducts');
  if (!grid) return;

  if (typeof filter === 'undefined') {
    filter = typeof currentCategory !== 'undefined' ? currentCategory : 'all';
  }

  let filtered = filter === 'all'
    ? products.slice()
    : products.filter(p => p.category === filter);

  // Apply search if available
  if (typeof applySearchFilter === 'function') {
    filtered = applySearchFilter(filtered);
  } else if (typeof currentSearch === 'string' && currentSearch) {
    const q = currentSearch;
    filtered = filtered.filter(p => {
      const hay = [p.name, p.desc, p.categoryName, p.material, p.color, p.category]
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (noResults) {
      noResults.classList.add('show');
      noResults.textContent = (typeof currentSearch === 'string' && currentSearch)
        ? ('ไม่พบสินค้าที่ตรงกับ "' + currentSearch + '"')
        : 'ไม่พบสินค้าในหมวดนี้';
    }
    return;
  }

  if (noResults) noResults.classList.remove('show');

  grid.innerHTML = filtered.map(p => {
    const stock = typeof getStock === 'function' ? getStock(p.id) : (p.stock || 0);
    const outOfStock = stock < 1;
    const lowStock = !outOfStock && typeof isLowStock === 'function' && isLowStock(p.id);
    const priceStr = typeof formatPrice === 'function' ? formatPrice(p.price) : '฿' + (p.price || 0).toLocaleString();
    const badge = typeof stockBadgeHTML === 'function'
      ? stockBadgeHTML(p.id)
      : (outOfStock
          ? '<span class="stock-badge out">หมดสต็อก</span>'
          : '<span class="stock-badge">คงเหลือ ' + stock + '</span>');
    return (
      '<div class="product-card ' + (outOfStock ? 'out-of-stock' : '') + ' ' + (lowStock ? 'low-stock' : '') + '" data-category="' + p.category + '">' +
        '<a href="product.html?id=' + p.id + '" class="product-link">' +
          '<div class="product-img-wrap">' +
            '<span class="product-category-badge">' + p.categoryName + '</span>' +
            badge +
            '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy">' +
          '</div>' +
          '<div class="product-body">' +
            '<h3>' + p.name + '</h3>' +
            '<p>' + p.desc + '</p>' +
            '<div class="product-price">' + priceStr + '</div>' +
          '</div>' +
        '</a>' +
        '<div class="product-meta" style="padding: 0 1.4rem 1.3rem;">' +
          '<span class="product-tag">' + p.categoryName + '</span>' +
          (outOfStock
            ? '<button class="btn-add-cart" disabled style="opacity:0.4;cursor:not-allowed;">หมดสต็อก</button>'
            : '<button class="btn-add-cart" onclick="event.preventDefault(); addToCart(' + p.id + ')">+ ตะกร้า</button>') +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function filterProducts(category) {
  if (typeof currentCategory !== 'undefined') currentCategory = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });
  renderProducts(category);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initStock === 'function') initStock();
  renderProducts('all');
  if (typeof renderStockAlerts === 'function') renderStockAlerts();
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

function handleSubmit(e) {
  e.preventDefault();
  alert('ขอบคุณสำหรับข้อความของคุณ! ทีมงานจะติดต่อกลับโดยเร็วที่สุด\n\n(นี่เป็นเดโม)');
  e.target.reset();
}
