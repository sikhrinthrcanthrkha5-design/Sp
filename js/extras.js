// ========== SEARCH + ORDER TRACK + FLOAT CONTACT ==========

// --- Config: แก้เบอร์ / LINE / WhatsApp จริงตรงนี้ ---
const CONTACT_CONFIG = {
  phone: '021234567',
  phoneDisplay: '02-123-4567',
  lineUrl: 'https://line.me/ti/p/~spfurniture',
  whatsapp: '66812345678', // รูปแบบ 66 + เบอร์ไม่ใส่ 0
  // LINE Notify (ทางเลือก): ใส่ token จาก https://notify-bot.line.me/
  // หมายเหตุ: จากไฟล์ local อาจถูก CORS บล็อก — ยังมีปุ่มแชร์ข้อความเข้า LINE เสมอ
  lineNotifyToken: ''
};

let currentSearch = '';
let currentCategory = 'all';

// ========== PRODUCT SEARCH ==========
function onProductSearch(value) {
  currentSearch = (value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.classList.toggle('show', currentSearch.length > 0);
  renderProducts(currentCategory);
}

function clearProductSearch() {
  const input = document.getElementById('productSearch');
  if (input) input.value = '';
  onProductSearch('');
  if (input) input.focus();
}

// Override filter to keep search
function filterProducts(category) {
  currentCategory = category || 'all';
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === currentCategory);
  });
  renderProducts(currentCategory);
}

// Patch renderProducts to support search (called from main.js definition - we wrap after load)
function applySearchFilter(list) {
  if (!currentSearch) return list;
  return list.filter(p => {
    const hay = [
      p.name,
      p.desc,
      p.categoryName,
      p.material,
      p.color,
      p.category
    ].join(' ').toLowerCase();
    return hay.indexOf(currentSearch) !== -1;
  });
}

// ========== ORDER TRACKING ==========
function getAllOrders() {
  try {
    return JSON.parse(localStorage.getItem('sp_furniture_orders') || '[]');
  } catch (e) {
    return [];
  }
}

function trackOrder(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('trackOrderId');
  const phoneInput = document.getElementById('trackPhone');
  const err = document.getElementById('trackError');
  const result = document.getElementById('trackResult');
  const q = ((input && input.value) || '').trim().toUpperCase();
  const phone = ((phoneInput && phoneInput.value) || '').replace(/\D/g, '');

  if (err) err.textContent = '';
  if (result) result.classList.remove('show');

  if (!q && !phone) {
    if (err) err.textContent = 'กรุณากรอกเลขที่ออเดอร์หรือเบอร์โทร';
    return;
  }

  let orders = [];
  let customs = [];
  try { orders = JSON.parse(localStorage.getItem('sp_furniture_orders') || '[]'); } catch (ex) {}
  try { customs = JSON.parse(localStorage.getItem('sp_furniture_custom_orders') || '[]'); } catch (ex) {}

  let order = null;
  let isCustom = false;

  if (q) {
    order = orders.find(o => String(o.id || '').toUpperCase() === q);
    if (!order) {
      const cm = customs.find(o => String(o.id || '').toUpperCase() === q);
      if (cm) {
        order = customToTrackShape(cm);
        isCustom = true;
      }
    }
  }
  if (!order && phone) {
    const matches = orders.filter(o => {
      const p = String((o.customer && o.customer.phone) || '').replace(/\D/g, '');
      return p && (p === phone || p.endsWith(phone) || phone.endsWith(p));
    });
    const cmMatches = customs.filter(o => {
      const p = String(o.phone || '').replace(/\D/g, '');
      return p && (p === phone || p.endsWith(phone) || phone.endsWith(p));
    });
    if (matches.length >= 1) {
      matches.sort((a, b) => new Date(b.date) - new Date(a.date));
      order = matches[0];
      if (matches.length > 1 && err) err.textContent = 'พบหลายออเดอร์ แสดงรายการล่าสุด (' + order.id + ')';
    } else if (cmMatches.length >= 1) {
      cmMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
      order = customToTrackShape(cmMatches[0]);
      isCustom = true;
      if (cmMatches.length > 1 && err) err.textContent = 'พบหลายคำสั่งทำ แสดงรายการล่าสุด (' + order.id + ')';
    }
  }

  if (!order) {
    if (err) err.textContent = 'ไม่พบออเดอร์/คำสั่งทำ กรุณาตรวจสอบเลขที่ (SP… หรือ CM…) หรือเบอร์โทร';
    return;
  }

  showTrackResult(order, isCustom);
}

function customToTrackShape(c) {
  const TYPE = { table: 'โต๊ะ', chair: 'เก้าอี้', cabinet: 'ตู้/ชั้นวาง', bed: 'เตียง', sofa: 'โซฟา', set: 'ชุดเฟอร์นิเจอร์', other: 'อื่นๆ' };
  const MAT = { teak: 'ไม้สัก', oak: 'ไม้โอ๊ค', rubber: 'ไม้ยางพารา', mixed: 'ผสม', other: 'อื่นๆ' };
  const price = Number(c.estimatedPrice) || 0;
  return {
    id: c.id,
    date: c.date,
    status: c.status,
    total: price * (c.qty || 1),
    paymentMethod: 'custom',
    linkedOrderId: c.linkedOrderId || null,
    isCustomOrder: true,
    customer: { name: c.name, phone: c.phone, email: c.contact || '', address: '', note: c.detail || '' },
    items: [{
      name: 'สั่งทำ: ' + (TYPE[c.type] || c.type || '') + ' (' + (MAT[c.material] || '') + ')',
      qty: c.qty || 1,
      price: price
    }]
  };
}

function showTrackResult(order, isCustom) {
  const result = document.getElementById('trackResult');
  if (!result) return;
  result.classList.add('show');

  const STATUS_MAP = {
    paid: { label: 'ชำระแล้ว', step: 1 },
    cod_pending: { label: 'รอ COD', step: 1 },
    confirmed: { label: 'ยืนยันแล้ว', step: 2 },
    production: { label: 'กำลังผลิต', step: 3 },
    shipping: { label: 'จัดส่ง', step: 4 },
    done: { label: 'สำเร็จ', step: 5 },
    cancelled: { label: 'ยกเลิก', step: 0 },
    // custom order statuses
    new: { label: 'รับคำขอแล้ว', step: 1 },
    reviewing: { label: 'กำลังประเมิน', step: 2 },
    quoted: { label: 'ส่งราคาแล้ว', step: 2 },
    // confirmed/production/done shared
  };
  const st = STATUS_MAP[order.status] || { label: order.status || '—', step: 1 };

  const idEl = document.getElementById('trackResId');
  const dateEl = document.getElementById('trackResDate');
  const statusEl = document.getElementById('trackResStatus');
  if (idEl) idEl.textContent = order.id;
  if (dateEl) {
    try {
      dateEl.textContent = new Date(order.date).toLocaleString('th-TH');
    } catch (e) { dateEl.textContent = order.date || '—'; }
  }
  if (statusEl) {
    statusEl.textContent = st.label;
    statusEl.className = 'track-status-badge ' + (order.status || 'default');
  }

  document.querySelectorAll('.track-step').forEach((el, i) => {
    el.classList.remove('done', 'current');
    if (st.step === 0) return;
    if (i + 1 < st.step) el.classList.add('done');
    if (i + 1 === st.step) el.classList.add('current');
  });

  const itemsEl = document.getElementById('trackResItems');
  const items = order.items || [];
  if (itemsEl) {
    itemsEl.innerHTML = items.map(it => {
      const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
      return '<div><span>' + (it.name || '') + ' × ' + (it.qty || 0) + '</span><span>฿' +
        line.toLocaleString('th-TH') + '</span></div>';
    }).join('') || '<div>ไม่มีรายการ</div>';
  }

  const total = order.total != null
    ? order.total
    : items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const totalEl = document.getElementById('trackResTotal');
  if (totalEl) totalEl.textContent = 'ยอดรวม ฿' + Number(total).toLocaleString('th-TH');

  const receiptLink = document.getElementById('trackReceiptLink');
  if (receiptLink) {
    if (isCustom || order.isCustomOrder) {
      if (order.linkedOrderId) {
        receiptLink.textContent = 'ดูออเดอร์ขาย ' + order.linkedOrderId;
        receiptLink.href = '#track';
        receiptLink.onclick = function (ev) {
          ev.preventDefault();
          const inp = document.getElementById('trackOrderId');
          if (inp) inp.value = order.linkedOrderId;
          trackOrder({ preventDefault: function () {} });
        };
      } else {
        receiptLink.textContent = 'งานสั่งทำ (ยังไม่แปลงเป็นออเดอร์ขาย)';
        receiptLink.removeAttribute('href');
        receiptLink.onclick = function (ev) { ev.preventDefault(); };
      }
    } else {
      receiptLink.textContent = 'ดูใบเสร็จ';
      receiptLink.onclick = null;
      try {
        const json = JSON.stringify(order);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        receiptLink.href = 'receipt.html?id=' + encodeURIComponent(order.id) + '#data=' + b64;
      } catch (e) {
        receiptLink.href = 'receipt.html?id=' + encodeURIComponent(order.id);
      }
    }
  }
}

const QUOTES_KEY = 'sp_furniture_quotes';

function handleQuoteSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = (document.getElementById('qName') || {}).value || '';
  const phone = (document.getElementById('qPhone') || {}).value || '';
  const email = (document.getElementById('qEmail') || {}).value || '';
  const type = (document.getElementById('qType') || {}).value || '';
  const budget = (document.getElementById('qBudget') || {}).value || '';
  const detail = (document.getElementById('qDetail') || {}).value || '';
  const msg = document.getElementById('quoteMsg');

  if (!name.trim() || !phone.trim() || !type || !detail.trim()) {
    if (msg) { msg.style.color = '#e55'; msg.textContent = 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ'; }
    return;
  }

  const quote = {
    id: 'QT' + Date.now().toString(36).toUpperCase(),
    date: new Date().toISOString(),
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    type: type,
    budget: budget,
    detail: detail.trim(),
    status: 'new'
  };

  let list = [];
  try { list = JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch (ex) {}
  list.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(list));

  try {
    var qtext = '[SP Furniture] ขอใบเสนอราคา ' + quote.id + '\n' +
      'ลูกค้า: ' + quote.name + ' | โทร: ' + quote.phone + '\n' +
      'ประเภท: ' + quote.type + ' | งบ: ' + (quote.budget || '—') + '\n' +
      (quote.detail || '');
    localStorage.setItem('sp_last_line_message', qtext);
    sendLineNotify(qtext);
    showLineNotifyToast(quote.id);
  } catch (e) {}

  if (msg) {
    msg.style.color = '#6dcc80';
    msg.textContent = 'ส่งคำขอแล้ว เลขที่ ' + quote.id + ' — ทีมงานจะติดต่อกลับเร็วๆ นี้';
  }
  const form = document.getElementById('quoteForm');
  if (form) form.reset();
}

// legacy name used by old form
function handleSubmit(e) { handleQuoteSubmit(e); }


// ========== LINE NOTIFY / SHARE ==========
function buildOrderLineMessage(order) {
  if (!order) return '';
  var c = order.customer || {};
  var lines = [];
  lines.push('[SP Furniture] ออเดอร์ใหม่ ' + (order.id || ''));
  lines.push('ลูกค้า: ' + (c.name || '—') + ' | โทร: ' + (c.phone || '—'));
  lines.push('ชำระ: ' + (order.paymentMethod || '—') + ' | สถานะ: ' + (order.status || '—'));
  lines.push('ยอดรวม: ฿' + Number(order.total || 0).toLocaleString('th-TH'));
  lines.push('--- รายการ ---');
  (order.items || []).forEach(function (it, i) {
    var row = (i + 1) + ') ' + (it.name || '') + ' × ' + (it.qty || 0) +
      ' = ฿' + (Number(it.price || 0) * Number(it.qty || 0)).toLocaleString('th-TH');
    if (it.sku) row += ' [' + it.sku + ']';
    if (it.material) row += ' | วัสดุ: ' + it.material;
    if (it.size) row += ' | ขนาด: ' + it.size;
    if (it.color) row += ' | สี: ' + it.color;
    if (it.weightKg != null) row += ' | ~' + it.weightKg + 'กก./ชิ้น';
    lines.push(row);
  });
  if (c.address) lines.push('ที่อยู่: ' + c.address);
  if (c.note) lines.push('หมายเหตุ: ' + c.note);
  return lines.join('\n');
}

function buildCustomLineMessage(custom) {
  if (!custom) return '';
  var lines = [];
  lines.push('[SP Furniture] คำสั่งทำ ' + (custom.id || ''));
  lines.push('ลูกค้า: ' + (custom.name || '—') + ' | โทร: ' + (custom.phone || '—'));
  lines.push('ประเภท: ' + (custom.type || '—') + ' | วัสดุ: ' + (custom.material || '—'));
  lines.push('ขนาด: ' + [custom.width, custom.depth, custom.height].filter(Boolean).join('×') + ' ซม.');
  lines.push('จำนวน: ' + (custom.qty || 1));
  if (custom.estimatedPrice) lines.push('ราคาประเมิน: ฿' + Number(custom.estimatedPrice).toLocaleString('th-TH'));
  if (custom.estimatedWeightKg) lines.push('น้ำหนักประมาณ: ' + custom.estimatedWeightKg + ' กก.');
  if (custom.detail) lines.push('รายละเอียด: ' + custom.detail);
  return lines.join('\n');
}

function openLineShare(text) {
  var encoded = encodeURIComponent(text || '');
  // เปิดแชร์ข้อความผ่าน LINE (มือถือ/เดสก์ท็อปที่มี LINE)
  var url = 'https://line.me/R/share?text=' + encoded;
  window.open(url, '_blank', 'noopener');
}

function sendLineNotify(text) {
  var token = (CONTACT_CONFIG.lineNotifyToken || '').trim();
  if (!token) return Promise.resolve({ ok: false, reason: 'no_token' });
  // LINE Notify API — อาจถูก CORS บน file:// / บางโฮสต์
  return fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + token
    },
    body: 'message=' + encodeURIComponent('\n' + text)
  }).then(function (r) {
    return { ok: r.ok, status: r.status };
  }).catch(function (e) {
    return { ok: false, reason: String(e) };
  });
}

function notifyLineOrder(order) {
  var text = buildOrderLineMessage(order);
  // พยายาม Notify ถ้ามี token
  sendLineNotify(text).then(function () {});
  // เก็บข้อความล่าสุดให้ปุ่มแจ้ง LINE
  try { localStorage.setItem('sp_last_line_message', text); } catch (e) {}
  showLineNotifyToast(order && order.id);
}

function notifyLineCustom(custom) {
  var text = buildCustomLineMessage(custom);
  sendLineNotify(text).then(function () {});
  try { localStorage.setItem('sp_last_line_message', text); } catch (e) {}
  showLineNotifyToast(custom && custom.id);
}

function showLineNotifyToast(refId) {
  var toast = document.getElementById('lineNotifyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lineNotifyToast';
    toast.className = 'line-notify-toast';
    toast.innerHTML = '<span></span><button type="button" id="lineShareBtn">แจ้งผ่าน LINE</button>';
    document.body.appendChild(toast);
    toast.querySelector('#lineShareBtn').addEventListener('click', function () {
      var msg = '';
      try { msg = localStorage.getItem('sp_last_line_message') || ''; } catch (e) {}
      openLineShare(msg);
    });
  }
  toast.querySelector('span').textContent = 'มีรายการใหม่' + (refId ? ' (' + refId + ')' : '') + ' — แจ้งทีมงานผ่าน LINE ได้';
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 8000);
}

// ========== FLOAT CONTACT ==========
function toggleFloatContact() {
  const actions = document.getElementById('floatActions');
  const btn = document.getElementById('floatToggle');
  if (!actions || !btn) return;
  actions.classList.toggle('show');
  btn.classList.toggle('open');
}

function initFloatContactLinks() {
  const phone = document.getElementById('floatPhone');
  const line = document.getElementById('floatLine');
  const wa = document.getElementById('floatWa');
  if (phone) {
    phone.href = 'tel:' + CONTACT_CONFIG.phone;
    const lab = phone.querySelector('.label');
    if (lab) lab.textContent = CONTACT_CONFIG.phoneDisplay;
  }
  if (line) line.href = CONTACT_CONFIG.lineUrl;
  if (wa) wa.href = 'https://wa.me/' + CONTACT_CONFIG.whatsapp;
}

document.addEventListener('DOMContentLoaded', function () {
  initFloatContactLinks();
  // track.html?id=CMxxxx
  try {
    var params = new URLSearchParams(window.location.search);
    var tid = params.get('id');
    if (tid) {
      var inp = document.getElementById('trackOrderId');
      if (inp) {
        inp.value = tid;
        if (typeof trackOrder === 'function') trackOrder({ preventDefault: function () {} });
      }
    }
  } catch (e) {}

  var qf = document.getElementById('quoteForm');
  if (qf) qf.addEventListener('submit', handleQuoteSubmit);

  // Close float menu when clicking outside
  document.addEventListener('click', function (e) {
    const wrap = document.getElementById('floatContact');
    if (!wrap || wrap.contains(e.target)) return;
    const actions = document.getElementById('floatActions');
    const btn = document.getElementById('floatToggle');
    if (actions) actions.classList.remove('show');
    if (btn) btn.classList.remove('open');
  });
});
