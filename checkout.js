// ========== CHECKOUT PAGE ==========


function buildReceiptUrl(order) {
  try {
    var json = JSON.stringify(order);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return 'receipt.html?id=' + encodeURIComponent(order.id) + '#data=' + b64;
  } catch (e) {
    return 'receipt.html?id=' + encodeURIComponent(order.id || '');
  }
}

const PAY_LABELS = {
  promptpay: 'พร้อมเพย์ (PromptPay)',
  transfer: 'โอนผ่านธนาคาร',
  card: 'บัตรเครดิต / เดบิต',
  cod: 'เก็บเงินปลายทาง (COD)'
};

function renderSummary() {
  const cart = getCart();
  const container = document.getElementById('summaryItems');
  const totalEl = document.getElementById('summaryTotal');
  const qrAmount = document.getElementById('qrAmount');
  const transferAmount = document.getElementById('transferAmount');

  if (!cart.length) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:1rem;">ตะกร้าว่าง — <a href="index.html#products" style="color:var(--gold)">เลือกสินค้า</a></p>';
    totalEl.textContent = '฿0';
    document.getElementById('payBtn').disabled = true;
    return;
  }

  container.innerHTML = cart.map(item => {
    const meta = [
      item.sku || '',
      item.material || '',
      item.size || '',
      item.color || '',
      item.weightKg != null ? ('~' + item.weightKg + ' กก.') : ''
    ].filter(Boolean).join(' · ');
    return `
    <div class="summary-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="summary-item-info">
        <h4>${item.name}</h4>
        <span>${formatPrice(item.price)} × ${item.qty}</span>
        ${meta ? '<small class="summary-meta">' + meta + '</small>' : ''}
      </div>
      <div class="summary-item-price">${formatPrice(item.price * item.qty)}</div>
    </div>`;
  }).join('');

  const total = getCartTotal();
  const tax = Math.round(total * 0.07);
  const grand = total + tax;
  totalEl.innerHTML = formatPrice(grand) + '<small style="display:block;font-size:0.75rem;color:#888;font-family:sans-serif;font-weight:400;">รวม VAT 7%</small>';
  if (qrAmount) qrAmount.textContent = formatPrice(grand);
  if (transferAmount) transferAmount.textContent = formatPrice(grand);
  document.getElementById('payBtn').disabled = false;
}

function setupPaymentTabs() {
  document.querySelectorAll('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.pay-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById('panel-' + radio.value);
      if (panel) panel.style.display = 'block';

      const btn = document.getElementById('payBtn');
      if (radio.value === 'cod') {
        btn.textContent = 'ยืนยันคำสั่งซื้อ (COD)';
      } else {
        btn.textContent = 'ยืนยันการชำระเงิน';
      }
    });
  });
}

function setupCardInputs() {
  const num = document.getElementById('cardNumber');
  if (num) {
    num.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  const exp = document.getElementById('cardExpiry');
  if (exp) {
    exp.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      e.target.value = v;
    });
  }
}

function submitCheckout(e) {
  e.preventDefault();

  const cart = getCart();
  if (!cart.length) {
    alert('ตะกร้าว่าง');
    return;
  }

  for (const item of cart) {
    if (!isInStock(item.id, item.qty)) {
      alert(`“${item.name}” สต็อกไม่พอ (เหลือ ${getStock(item.id)} ชิ้น)`);
      return;
    }
  }

  const method = document.querySelector('input[name="payment"]:checked')?.value || 'promptpay';

  if (method === 'card') {
    const cn = (document.getElementById('cardNumber')?.value || '').replace(/\s/g, '');
    if (cn.length < 13) {
      alert('กรุณากรอกหมายเลขบัตรให้ครบ');
      return;
    }
  }

  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังดำเนินการ...';

  setTimeout(() => {
    const result = processPayment({
      customer: {
        name: document.getElementById('cName').value.trim(),
        phone: document.getElementById('cPhone').value.trim(),
        email: document.getElementById('cEmail').value.trim(),
        address: document.getElementById('cAddress').value.trim(),
        note: document.getElementById('cNote').value.trim()
      },
      paymentMethod: method
    });

    if (!result.success) {
      alert(result.message || 'เกิดข้อผิดพลาด');
      btn.disabled = false;
      btn.textContent = method === 'cod' ? 'ยืนยันคำสั่งซื้อ (COD)' : 'ยืนยันการชำระเงิน';
      return;
    }

    const order = result.order;
    document.getElementById('orderId').textContent = order.id;

    const title = document.getElementById('successTitle');
    const desc = document.getElementById('successDesc');
    if (method === 'cod') {
      title.textContent = 'ยืนยันคำสั่งซื้อสำเร็จ!';
      desc.innerHTML = 'คำสั่งซื้อแบบเก็บเงินปลายทาง<br>ระบบจองสต็อกแล้ว · ชำระเมื่อรับสินค้า';
    } else {
      title.textContent = 'ชำระเงินสำเร็จ!';
      desc.innerHTML = 'ระบบได้ตัดสต็อกสินค้าเรียบร้อยแล้ว<br>ทีมงานจะติดต่อยืนยันและนัดส่งมอบต่อไป';
    }

    const receiptUrl = buildReceiptUrl(order);
    const receiptBtn = document.getElementById('viewReceiptBtn');
    if (receiptBtn) {
      receiptBtn.href = receiptUrl;
      receiptBtn.onclick = function (ev) {
        ev.preventDefault();
        window.location.href = receiptUrl;
      };
    }

    document.getElementById('successOverlay').classList.add('show');

    // ไปหน้าใบเสร็จอัตโนมัติหลังยืนยัน
    setTimeout(function () {
      window.location.href = receiptUrl;
    }, 1500);
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initStock === 'function') initStock();
  renderSummary();
  setupPaymentTabs();
  setupCardInputs();
  updateCartBadge();
});
