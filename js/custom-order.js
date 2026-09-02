(function () {
  'use strict';

  var CUSTOM_KEY = 'sp_furniture_custom_orders';
  var ORDERS_KEY = 'sp_furniture_orders';
  var MAX_IMAGES = 3;
  var MAX_TOTAL_BYTES = 1.5 * 1024 * 1024; // ~1.5MB total as dataURL

  var TYPE_LABEL = {
    table: 'โต๊ะ', chair: 'เก้าอี้', cabinet: 'ตู้ / ชั้นวาง', bed: 'เตียง',
    sofa: 'โซฟา / ชุดรับแขก', set: 'ชุดเฟอร์นิเจอร์', other: 'อื่นๆ'
  };
  var MAT_LABEL = {
    teak: 'ไม้สัก', oak: 'ไม้โอ๊ค', rubber: 'ไม้ยางพารา', mixed: 'ผสม / ตามแนะนำ', other: 'อื่นๆ'
  };

  // ราคาฐานต่อ ลบ.ซม. โดยประมาณ (บาท) — เดโม
  var MATERIAL_RATE = {
    teak: 0.012,    // ไม้สัก
    oak: 0.009,
    rubber: 0.005,
    mixed: 0.007,
    other: 0.006
  };
  var TYPE_MULT = {
    table: 1.0, chair: 0.85, cabinet: 1.15, bed: 1.25,
    sofa: 1.4, set: 1.6, other: 1.0
  };
  var BASE_FEE = 1500; // ค่าแรงขั้นต่ำ

  // ความหนาแน่นไม้โดยประมาณ (กก./ลบ.ซม.) หลังหักช่องว่างชิ้นงาน ~50%
  var MATERIAL_DENSITY = {
    teak: 0.00035,
    oak: 0.00032,
    rubber: 0.00028,
    mixed: 0.00030,
    other: 0.00028
  };

  var pendingImages = []; // dataURLs

  function $(id) { return document.getElementById(id); }

  function val(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function readForm() {
    return {
      name: val('cName'),
      phone: val('cPhone'),
      contact: val('cContact'),
      type: val('cType'),
      qty: parseInt(val('cQty'), 10) || 1,
      width: parseFloat(val('cW')) || 0,
      depth: parseFloat(val('cD')) || 0,
      height: parseFloat(val('cH')) || 0,
      material: val('cMaterial'),
      color: val('cColor'),
      budget: val('cBudget'),
      detail: val('cDetail'),
      ref: val('cRef'),
      images: pendingImages.slice()
    };
  }

  /** คำนวณราคาประเมินจาก ก×ล×ส × วัสดุ × ประเภท × จำนวน */
  function estimatePrice(d) {
    var w = Number(d.width) || 0;
    var depth = Number(d.depth) || 0;
    var h = Number(d.height) || 0;
    var qty = Number(d.qty) || 1;
    if (!w && !depth && !h) {
      return { total: 0, note: 'กรอกขนาดอย่างน้อย 1 ด้านเพื่อประมาณราคา' };
    }
    // ใช้ค่าเฉลี่ยถ้าขาดด้าน
    if (!w) w = Math.max(depth, h, 50);
    if (!depth) depth = Math.max(w * 0.5, 40);
    if (!h) h = Math.max(w * 0.4, 40);

    var volume = w * depth * h; // ลบ.ซม.
    var rate = MATERIAL_RATE[d.material] || MATERIAL_RATE.other;
    var mult = TYPE_MULT[d.type] || 1;
    var unit = BASE_FEE + volume * rate * mult;
    // ปัดเป็นหลักร้อย
    unit = Math.ceil(unit / 100) * 100;
    var total = unit * qty;
    var dens = MATERIAL_DENSITY[d.material] || MATERIAL_DENSITY.other;
    var weightUnit = Math.max(0.5, Math.round(volume * dens * 10) / 10);
    var weightTotal = Math.round(weightUnit * qty * 10) / 10;
    return {
      unit: unit,
      total: total,
      weightUnit: weightUnit,
      weightTotal: weightTotal,
      note: 'ประมาณการจากขนาด ' + w + '×' + depth + '×' + h + ' ซม. · น้ำหนักประมาณ ' + weightTotal + ' กก. · ยังไม่รวมขนส่ง/ติดตั้ง'
    };
  }

  function money(n) {
    return '฿' + Number(n || 0).toLocaleString('th-TH');
  }

  function updatePriceUI() {
    var d = readForm();
    var est = estimatePrice(d);
    var el = $('priceEstimateVal');
    var note = $('priceEstimateNote');
    if (el) el.textContent = est.total > 0 ? money(est.total) : '—';
    if (note) {
      if (est.total > 0 && est.weightTotal) {
        note.textContent = est.note || '';
      } else {
        note.textContent = est.note || 'กรอกขนาดและวัสดุเพื่อคำนวณ';
      }
    }
    var wEl = document.getElementById('weightEstimateVal');
    if (wEl) wEl.textContent = est.weightTotal ? (est.weightTotal + ' กก.') : '—';
    return est;
  }

  function sizeText(d) {
    var parts = [];
    if (d.width) parts.push('กว้าง ' + d.width + ' ซม.');
    if (d.depth) parts.push('ลึก ' + d.depth + ' ซม.');
    if (d.height) parts.push('สูง ' + d.height + ' ซม.');
    return parts.length ? parts.join(' × ') : 'ไม่ระบุขนาด';
  }

  function imagesHtml(images) {
    if (!images || !images.length) return '';
    return '<div class="preview-imgs">' + images.map(function (src) {
      return '<img src="' + src + '" alt="อ้างอิง">';
    }).join('') + '</div>';
  }

  function buildPreviewHtml(d, est) {
    est = est || estimatePrice(d);
    return (
      '<div class="preview-rows">' +
      row('ชื่อ', d.name || '—') +
      row('โทร', d.phone || '—') +
      row('ติดต่ออื่น', d.contact || '—') +
      row('ประเภท', TYPE_LABEL[d.type] || d.type || '—') +
      row('จำนวน', (d.qty || 1) + ' ชิ้น') +
      row('ขนาด', sizeText(d)) +
      row('วัสดุ', MAT_LABEL[d.material] || d.material || '—') +
      row('สี / ฟินิช', d.color || '—') +
      row('งบประมาณ', d.budget || 'ไม่ระบุ') +
      row('ราคาประเมิน', est.total > 0 ? money(est.total) : '—') +
      row('น้ำหนักประมาณ', est.weightTotal ? (est.weightTotal + ' กก.') : '—') +
      row('รายละเอียด', d.detail || '—') +
      (d.ref ? row('ลิงก์อ้างอิง', '<a href="' + d.ref + '" target="_blank" rel="noopener">เปิดลิงก์</a>') : '') +
      '</div>' +
      imagesHtml(d.images) +
      (est.note ? '<p class="field-hint" style="margin-top:0.6rem">' + est.note + '</p>' : '')
    );
  }

  function row(k, v) {
    return '<div class="preview-row"><span>' + k + '</span><strong>' + v + '</strong></div>';
  }

  function renderThumbs() {
    var box = $('cThumbs');
    if (!box) return;
    box.innerHTML = pendingImages.map(function (src, i) {
      return '<div class="thumb"><img src="' + src + '" alt=""><button type="button" data-rm="' + i + '">✕</button></div>';
    }).join('');
  }

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var remain = MAX_IMAGES - pendingImages.length;
    if (remain <= 0) {
      alert('อัปโหลดได้สูงสุด ' + MAX_IMAGES + ' รูป');
      return;
    }
    files = files.slice(0, remain);

    var readers = files.map(function (file) {
      return new Promise(function (resolve) {
        if (!file.type || file.type.indexOf('image/') !== 0) {
          resolve(null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(function (results) {
      results.forEach(function (dataUrl) {
        if (!dataUrl) return;
        // ตรวจขนาดรวมคร่าวๆ
        var total = pendingImages.reduce(function (s, x) { return s + x.length; }, 0) + dataUrl.length;
        if (total > MAX_TOTAL_BYTES * 1.37) { // dataURL overhead
          alert('รูปใหญ่เกินไป กรุณาลดขนาดหรือจำนวนรูป');
          return;
        }
        pendingImages.push(dataUrl);
      });
      renderThumbs();
    });
  }

  function showPreview() {
    var d = readForm();
    var body = $('customPreviewBody');
    var box = $('customPreviewBox');
    if (!body) return;
    if (!d.name || !d.phone || !d.type || !d.material || !d.detail) {
      body.innerHTML = '<p class="custom-msg err">กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบก่อนดูสรุป</p>';
      return;
    }
    var est = updatePriceUI();
    body.innerHTML = buildPreviewHtml(d, est);
    if (box) box.classList.add('ready');
  }

  function saveCustom(e) {
    if (e && e.preventDefault) e.preventDefault();
    var d = readForm();
    var msg = $('customMsg');
    if (!d.name || !d.phone || !d.type || !d.material || !d.detail) {
      if (msg) {
        msg.className = 'custom-msg err';
        msg.textContent = 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ';
      }
      return;
    }

    var est = estimatePrice(d);
    var order = {
      id: 'CM' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      status: 'new',
      statusChangedAt: new Date().toISOString(),
      name: d.name,
      phone: d.phone,
      contact: d.contact,
      type: d.type,
      qty: d.qty,
      width: d.width || '',
      depth: d.depth || '',
      height: d.height || '',
      material: d.material,
      color: d.color,
      budget: d.budget,
      detail: d.detail,
      ref: d.ref,
      images: d.images,
      estimatedPrice: est.total || 0,
      estimatedWeightKg: est.weightTotal || 0,
      estimateNote: est.note || '',
      linkedOrderId: null
    };

    var list = [];
    try { list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (ex) {}
    list.unshift(order);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));

    try { if (typeof notifyLineCustom === 'function') notifyLineCustom(order); } catch (e) {}

    if (msg) {
      msg.className = 'custom-msg ok';
      msg.textContent = 'ส่งคำสั่งทำแล้ว เลขที่ ' + order.id +
        (est.total ? ' · ราคาประเมิน ' + money(est.total) : '') +
        ' — ติดตามได้ที่เมนูติดตามออเดอร์';
    }

    var form = $('customForm');
    if (form) form.reset();
    pendingImages = [];
    renderThumbs();
    updatePriceUI();

    var body = $('customPreviewBody');
    if (body) {
      body.innerHTML = buildPreviewHtml(order, est) +
        '<p class="custom-msg ok" style="margin-top:0.8rem">บันทึกแล้ว · เลขที่ <strong>' + order.id +
        '</strong> · ใช้เลขนี้ติดตามสถานะได้</p>';
    }
  }

  /**
   * แปลงคำสั่งทำเป็นออเดอร์ขาย (เรียกจากแอดมิน)
   */
  function convertCustomToOrder(customId) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) {}
    var idx = list.findIndex(function (x) { return x.id === customId; });
    if (idx < 0) return null;
    var c = list[idx];
    if (c.linkedOrderId) return c.linkedOrderId;

    var price = Number(c.estimatedPrice) || 0;
    var name = (TYPE_LABEL[c.type] || 'งานสั่งทำ') + ' (' + (MAT_LABEL[c.material] || c.material || '') + ')';
    var order = {
      id: 'SP' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      status: 'confirmed',
      statusChangedAt: new Date().toISOString(),
      paymentMethod: 'transfer',
      total: price * (c.qty || 1),
      customSourceId: c.id,
      customer: {
        name: c.name,
        phone: c.phone,
        email: c.contact || '',
        address: '',
        note: c.detail || ''
      },
      items: [{
        id: 'custom',
        name: name,
        qty: c.qty || 1,
        price: price,
        image: (c.images && c.images[0]) || '',
        material: MAT_LABEL[c.material] || c.material || '',
        size: [c.width, c.depth, c.height].filter(Boolean).join('×') + (c.width || c.depth || c.height ? ' ซม.' : ''),
        color: c.color || '',
        weightKg: c.estimatedWeightKg || null,
        sku: c.id
      }]
    };

    var orders = [];
    try { orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch (e) {}
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    c.status = 'confirmed';
    c.statusChangedAt = new Date().toISOString();
    c.linkedOrderId = order.id;
    list[idx] = c;
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return order.id;
  }

  // export for admin

  var CUSTOM_STATUS_LABEL = {
    new: 'รับคำขอแล้ว',
    reviewing: 'กำลังประเมิน',
    quoted: 'ส่งราคาแล้ว',
    confirmed: 'ลูกค้ายืนยัน',
    production: 'กำลังผลิต',
    done: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก'
  };

  function normalizePhone(p) {
    return String(p || '').replace(/\D/g, '');
  }

  function findCustomsByPhone(phone) {
    var q = normalizePhone(phone);
    if (!q || q.length < 8) return [];
    var list = [];
    try { list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) {}
    return list.filter(function (c) {
      var p = normalizePhone(c.phone);
      return p && (p === q || p.endsWith(q) || q.endsWith(p));
    }).sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  function formatDateShort(iso) {
    try {
      return new Date(iso).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) { return iso || '—'; }
  }

  function renderMyCustomList(items) {
    var box = $('myCustomList');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<p class="my-custom-empty">ไม่พบรายการสั่งทำสำหรับเบอร์นี้</p>';
      return;
    }
    box.innerHTML = items.map(function (c) {
      var st = CUSTOM_STATUS_LABEL[c.status] || c.status || '—';
      var stClass = c.status || 'new';
      var size = [c.width, c.depth, c.height].filter(Boolean).join('×');
      if (size) size += ' ซม.';
      var price = Number(c.estimatedPrice) || 0;
      var weight = Number(c.estimatedWeightKg) || 0;
      var type = TYPE_LABEL[c.type] || c.type || '—';
      var mat = MAT_LABEL[c.material] || c.material || '—';
      var linked = c.linkedOrderId
        ? '<span class="mc-linked">ออเดอร์ขาย: ' + c.linkedOrderId + '</span>'
        : '';
      var thumb = (c.images && c.images[0])
        ? '<img class="mc-thumb" src="' + c.images[0] + '" alt="">'
        : '<div class="mc-thumb placeholder">CM</div>';
      return (
        '<article class="mc-card">' +
          '<div class="mc-top">' + thumb +
            '<div class="mc-head">' +
              '<div class="mc-id">' + c.id + '</div>' +
              '<span class="mc-status ' + stClass + '">' + st + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="mc-body">' +
            '<div class="mc-row"><span>ประเภท</span><strong>' + type + '</strong></div>' +
            '<div class="mc-row"><span>วัสดุ</span><strong>' + mat + '</strong></div>' +
            (size ? '<div class="mc-row"><span>ขนาด</span><strong>' + size + '</strong></div>' : '') +
            '<div class="mc-row"><span>จำนวน</span><strong>' + (c.qty || 1) + ' ชิ้น</strong></div>' +
            (price ? '<div class="mc-row"><span>ราคาประเมิน</span><strong>' + money(price) + '</strong></div>' : '') +
            (weight ? '<div class="mc-row"><span>น้ำหนักประมาณ</span><strong>' + weight + ' กก.</strong></div>' : '') +
            '<div class="mc-row"><span>วันที่ส่ง</span><strong>' + formatDateShort(c.date) + '</strong></div>' +
            linked +
          '</div>' +
          '<div class="mc-actions">' +
            '<button type="button" class="btn btn-outline btn-sm" data-track-cm="' + c.id + '">ติดตามสถานะ</button>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function searchMyCustoms(e) {
    if (e && e.preventDefault) e.preventDefault();
    var phone = val('myCustomPhone');
    var msg = $('myCustomMsg');
    if (normalizePhone(phone).length < 8) {
      if (msg) { msg.className = 'my-custom-msg err'; msg.textContent = 'กรุณากรอกเบอร์โทรให้ครบ'; }
      renderMyCustomList([]);
      return;
    }
    var items = findCustomsByPhone(phone);
    if (msg) {
      msg.className = 'my-custom-msg' + (items.length ? ' ok' : '');
      msg.textContent = items.length
        ? 'พบ ' + items.length + ' รายการ'
        : '';
    }
    renderMyCustomList(items);
    try { sessionStorage.setItem('sp_my_custom_phone', phone); } catch (ex) {}
  }

  window.SPCustomOrder = {
    convertToOrder: convertCustomToOrder,
    estimatePrice: estimatePrice,
    findByPhone: findCustomsByPhone,
    TYPE_LABEL: TYPE_LABEL,
    MAT_LABEL: MAT_LABEL
  };

  document.addEventListener('DOMContentLoaded', function () {
    var form = $('customForm');
    var btn = $('btnCustomPreview');
    var file = $('cImages');
    if (btn) btn.addEventListener('click', showPreview);
    if (form) form.addEventListener('submit', saveCustom);
    if (file) {
      file.addEventListener('change', function () {
        handleFiles(file.files);
        file.value = '';
      });
    }
    var thumbs = $('cThumbs');
    if (thumbs) {
      thumbs.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.getAttribute && t.getAttribute('data-rm') != null) {
          var i = parseInt(t.getAttribute('data-rm'), 10);
          pendingImages.splice(i, 1);
          renderThumbs();
        }
      });
    }
    ['cW', 'cD', 'cH', 'cMaterial', 'cType', 'cQty'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', updatePriceUI);
      if (el) el.addEventListener('change', updatePriceUI);
    });
    updatePriceUI();

    var myForm = $('myCustomForm');
    if (myForm) myForm.addEventListener('submit', searchMyCustoms);
    var listBox = $('myCustomList');
    if (listBox) {
      listBox.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.getAttribute && t.getAttribute('data-track-cm')) {
          var id = t.getAttribute('data-track-cm');
          // หน้าแยก: ไป track.html พร้อมเลขที่
          if (!document.getElementById('trackOrderId')) {
            window.location.href = 'track.html?id=' + encodeURIComponent(id);
            return;
          }
          var trackInput = document.getElementById('trackOrderId');
          if (trackInput) trackInput.value = id;
          var trackSec = document.getElementById('track');
          if (trackSec) trackSec.scrollIntoView({ behavior: 'smooth' });
          if (typeof trackOrder === 'function') {
            trackOrder({ preventDefault: function () {} });
          }
        }
      });
    }
    // auto-load last phone
    try {
      var lastPhone = sessionStorage.getItem('sp_my_custom_phone');
      if (lastPhone && $('myCustomPhone')) {
        $('myCustomPhone').value = lastPhone;
        searchMyCustoms();
      }
    } catch (ex) {}
  });
})();
