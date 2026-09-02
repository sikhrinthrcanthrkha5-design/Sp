// ========== RECEIPT PAGE ==========

function decodeOrderFromHash() {
  try {
    var hash = window.location.hash || '';
    if (hash.indexOf('data=') === -1) return null;
    var b64 = hash.split('data=')[1];
    if (!b64) return null;
    var json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (e) {
    console.warn('hash decode failed', e);
    return null;
  }
}

function getOrderById(id) {
  // 1) URL hash payload (works even when localStorage is blocked)
  var fromHash = decodeOrderFromHash();
  if (fromHash) return fromHash;

  // 2) Full last-order backup
  try {
    var last = JSON.parse(localStorage.getItem('sp_last_order') || 'null');
    if (last && (!id || String(last.id) === String(id))) return last;
  } catch (e) {}

  // 3) Orders list
  try {
    var orders = JSON.parse(localStorage.getItem('sp_furniture_orders') || '[]');
    if (id) {
      var found = orders.find(function (o) { return String(o.id) === String(id); });
      if (found) return found;
    }
    if (orders.length) return orders[0];
  } catch (e) {}

  return null;
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateThai(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '—');
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return String(iso || '—');
  }
}

function bahtText(amount) {
  try {
    var ones = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    var positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    function readGroup(num) {
      num = Math.floor(Math.abs(Number(num) || 0));
      if (num === 0) return 'ศูนย์';
      if (num >= 1000000) {
        var mil = Math.floor(num / 1000000);
        var rest = num % 1000000;
        return readGroup(mil) + 'ล้าน' + (rest ? readGroup(rest) : '');
      }
      var s = '';
      var str = String(num);
      var len = str.length;
      for (var i = 0; i < len; i++) {
        var d = Number(str[i]);
        var pos = len - i - 1;
        if (d === 0) continue;
        if (pos === 1 && d === 1) s += 'สิบ';
        else if (pos === 1 && d === 2) s += 'ยี่สิบ';
        else if (pos === 0 && d === 1 && len > 1) s += 'เอ็ด';
        else s += ones[d] + (positions[pos] || '');
      }
      return s || 'ศูนย์';
    }

    var n = Math.round(Number(amount) * 100) / 100;
    var intPart = Math.floor(n);
    var satang = Math.round((n - intPart) * 100);
    var text = readGroup(intPart) + 'บาท';
    text += satang === 0 ? 'ถ้วน' : readGroup(satang) + 'สตางค์';
    return '(' + text + ')';
  } catch (e) {
    return '';
  }
}

function renderReceipt(order) {
  var items = order.items || [];
  var c = order.customer || {};

  document.getElementById('rOrderId').textContent = order.id || '—';
  document.getElementById('rDate').textContent = formatDateThai(order.date);

  var statusEl = document.getElementById('rStatus');
  if (order.status === 'cod_pending' || order.paymentMethod === 'cod') {
    statusEl.innerHTML = '<span class="status-cod">รอชำระปลายทาง (COD)</span>';
  } else {
    statusEl.innerHTML = '<span class="status-paid">ชำระแล้ว</span>';
  }

  document.getElementById('rName').textContent = c.name || '—';
  document.getElementById('rAddress').textContent = c.address || '—';
  document.getElementById('rEmail').textContent = c.email || '—';
  document.getElementById('rPhone').textContent = c.phone || '—';
  document.getElementById('rNote').textContent =
    c.note || (order.paymentMethod === 'cod' ? 'เก็บเงินปลายทางเมื่อส่งมอบสินค้า' : '—');
  document.getElementById('rSignCustomer').textContent = c.name ? '(' + c.name + ')' : '';

  var tbody = document.getElementById('rItems');
  var rows = items.map(function (item, i) {
    var line = (Number(item.price) || 0) * (Number(item.qty) || 0);
    return (
      '<tr>' +
      '<td class="col-no">' + (i + 1) + '</td>' +
      '<td class="col-item">' + (item.name || '') +
        (item.categoryName ? '<br><small style="color:#888">' + item.categoryName + '</small>' : '') +
        (item.sku ? '<br><small style="color:#888">รหัส: ' + item.sku + '</small>' : '') +
        (item.material ? '<br><small style="color:#888">วัสดุ: ' + item.material + '</small>' : '') +
        (item.size ? '<br><small style="color:#888">ขนาด: ' + item.size + '</small>' : '') +
        (item.color ? '<br><small style="color:#888">สี: ' + item.color + '</small>' : '') +
        (item.weightKg != null ? '<br><small style="color:#888">น้ำหนักประมาณ: ' + item.weightKg + ' กก./ชิ้น</small>' : '') +
      '</td>' +
      '<td class="col-qty">' + (item.qty || 0) + '</td>' +
      '<td class="col-price">' + formatMoney(item.price) + '</td>' +
      '<td class="col-total">' + formatMoney(line) + '</td>' +
      '</tr>'
    );
  }).join('');

  for (var i = items.length; i < 4; i++) {
    rows +=
      '<tr><td class="col-no">&nbsp;</td><td class="col-item">&nbsp;</td>' +
      '<td class="col-qty">&nbsp;</td><td class="col-price">&nbsp;</td><td class="col-total">&nbsp;</td></tr>';
  }
  tbody.innerHTML = rows;

  var subtotal =
    order.subtotal != null
      ? order.subtotal
      : items.reduce(function (s, it) {
          return s + (Number(it.price) || 0) * (Number(it.qty) || 0);
        }, 0);
  var tax = order.tax != null ? order.tax : Math.round(subtotal * 0.07);
  var discount = order.discount || 0;
  var grand = order.total != null ? order.total : subtotal + tax - discount;

  document.getElementById('rSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('rTax').textContent = formatMoney(tax);
  document.getElementById('rDiscount').textContent = formatMoney(discount);
  document.getElementById('rGrand').textContent = formatMoney(grand);
  document.getElementById('rBahtText').textContent = bahtText(grand);

  document.querySelectorAll('.chk').forEach(function (el) {
    var m = el.getAttribute('data-m');
    if (m === order.paymentMethod) el.classList.add('checked');
    else el.classList.remove('checked');
  });

  document.title = 'ใบเสร็จ ' + (order.id || '') + ' | SP Furniture Factory';
}

/** Build receipt URL with order embedded in hash (file:// safe) */
function buildReceiptUrl(order) {
  try {
    var json = JSON.stringify(order);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return 'receipt.html?id=' + encodeURIComponent(order.id) + '#data=' + b64;
  } catch (e) {
    return 'receipt.html?id=' + encodeURIComponent(order.id || '');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var loading = document.getElementById('receiptLoading');
  var notFound = document.getElementById('receiptNotFound');
  var content = document.getElementById('receiptContent');

  if (loading) loading.style.display = 'none';

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id') || null;
  try {
    id = id || localStorage.getItem('sp_last_order_id');
  } catch (e) {}

  var order = null;
  try {
    order = getOrderById(id);
  } catch (e) {
    console.error('receipt load error', e);
  }

  if (!order) {
    if (notFound) notFound.style.display = 'block';
    return;
  }

  if (content) content.style.display = 'block';
  try {
    renderReceipt(order);
  } catch (e) {
    console.error('receipt render error', e);
    if (notFound) {
      notFound.style.display = 'block';
      notFound.innerHTML =
        '<p>เกิดข้อผิดพลาดในการแสดงใบเสร็จ</p><a href="index.html">กลับหน้าหลัก</a>';
    }
    if (content) content.style.display = 'none';
  }
});
