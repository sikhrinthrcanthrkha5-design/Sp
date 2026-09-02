(function () {
  'use strict';

  var PASSWORD = 'admin123';
  var SESSION_KEY = 'sp_admin_ok';
  var ORDERS_KEY = 'sp_furniture_orders';
  var QUOTES_KEY = 'sp_furniture_quotes';
  var CUSTOM_KEY = 'sp_furniture_custom_orders';
  var LOW = 5;

  var STATUS = {
    paid: 'ชำระแล้ว',
    cod_pending: 'รอ COD',
    confirmed: 'ยืนยันแล้ว',
    production: 'กำลังผลิต',
    shipping: 'จัดส่ง',
    done: 'สำเร็จ',
    cancelled: 'ยกเลิก'
  };
  var STATUS_KEYS = Object.keys(STATUS);
  var currentOrderId = null;
  var DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  function $(id) { return document.getElementById(id); }

  function money(n) {
    return '฿' + Number(n || 0).toLocaleString('th-TH');
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return iso || '—';
    }
  }

  function getOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveOrders(list) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  }

  function isLoggedIn() {
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return true; } catch (e) {}
    try { if (localStorage.getItem(SESSION_KEY) === '1') return true; } catch (e) {}
    return false;
  }

  function setLoggedIn(on) {
    try {
      if (on) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    try {
      if (on) localStorage.setItem(SESSION_KEY, '1');
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function stockOf(id) {
    if (typeof getStock === 'function') return getStock(id);
    if (typeof products === 'undefined') return 0;
    var p = products.find(function (x) { return x.id === id; });
    return p ? (p.stock || 0) : 0;
  }

  function setRing(el, pct, circumference) {
    if (!el) return;
    var p = Math.max(0, Math.min(100, pct));
    var offset = circumference - (circumference * p / 100);
    el.style.strokeDashoffset = String(offset);
  }

  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    var greet = h < 12 ? 'สวัสดีตอนเช้า' : h < 18 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    if ($('greetText')) $('greetText').textContent = greet + ',';
    if ($('clockChip')) {
      $('clockChip').textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
    if ($('dateChip')) {
      $('dateChip').textContent = now.toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
      });
    }
  }


  function initAdminSidebar() {
    var KEY = 'sp_admin_sb_collapsed';
    var shell = document.getElementById('screenApp');
    var btn = document.getElementById('adminSbToggle');
    if (!shell || !btn) return;
    function apply(on) {
      shell.classList.toggle('sb-collapsed', !!on);
      btn.textContent = on ? '»' : '«';
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    }
    try { apply(localStorage.getItem(KEY) === '1'); } catch (e) { apply(false); }
    btn.addEventListener('click', function () {
      apply(!shell.classList.contains('sb-collapsed'));
    });
  }
  function showApp() {
    if ($('screenLogin')) $('screenLogin').hidden = true;
    if ($('screenApp')) $('screenApp').hidden = false;
    try { if (typeof initStock === 'function') initStock(); } catch (e) {}
    updateClock();
    try { if (typeof SPAutoStatus !== 'undefined') SPAutoStatus.run(); } catch (e) {}
    try { initAutoStatusUI(); } catch (e) {}
    try { initAdminSidebar(); } catch (e) {}
    refreshAll();
  }

  function showLogin() {
    if ($('screenLogin')) $('screenLogin').hidden = false;
    if ($('screenApp')) $('screenApp').hidden = true;
  }

  function pill(status) {
    var label = STATUS[status] || status || '—';
    var cls = STATUS[status] ? status : 'paid';
    return '<span class="pill ' + cls + '">' + label + '</span>';
  }

  function refreshAll() {
    renderDash();
    renderOrders();
    renderQuotes();
    renderCustoms();
    renderStock();
  }


  var PIE_COLORS = ['#3ecbff', '#8b5cff', '#d4af37', '#4ade80', '#f0c14b', '#ff6b7a', '#60a5fa', '#a78bfa'];

  function polar(cx, cy, r, angleDeg) {
    var a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.9) {
      // full circle as two arcs
      var m = polar(cx, cy, r, startAngle + 180);
      var e = polar(cx, cy, r, startAngle + 359.9);
      var s = polar(cx, cy, r, startAngle);
      return 'M ' + s.x + ' ' + s.y +
        ' A ' + r + ' ' + r + ' 0 1 1 ' + m.x + ' ' + m.y +
        ' A ' + r + ' ' + r + ' 0 1 1 ' + e.x + ' ' + e.y;
    }
    var start = polar(cx, cy, r, endAngle);
    var end = polar(cx, cy, r, startAngle);
    var large = endAngle - startAngle > 180 ? 1 : 0;
    return 'M ' + start.x + ' ' + start.y +
      ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + end.x + ' ' + end.y;
  }

  /** slices: [{label, value, color?}] */
  function renderPie(containerId, legendId, slices, centerLabel) {
    var el = $(containerId);
    var legend = legendId ? $(legendId) : null;
    if (!el) return;

    var data = (slices || []).filter(function (s) { return Number(s.value) > 0; });
    var total = data.reduce(function (a, s) { return a + Number(s.value); }, 0);

    if (!total) {
      el.innerHTML = '<p class="pie-empty">ไม่มีข้อมูล</p>';
      if (legend) legend.innerHTML = '';
      return;
    }

    var cx = 50, cy = 50, r = 36, rIn = 22;
    var angle = 0;
    var paths = '';
    data.forEach(function (s, i) {
      var pct = Number(s.value) / total;
      var sweep = pct * 360;
      var start = angle;
      var end = angle + sweep;
      angle = end;
      var color = s.color || PIE_COLORS[i % PIE_COLORS.length];
      // donut segment via path (outer arc + inner arc reverse)
      var large = sweep > 180 ? 1 : 0;
      var p1 = polar(cx, cy, r, end);
      var p2 = polar(cx, cy, r, start);
      var p3 = polar(cx, cy, rIn, start);
      var p4 = polar(cx, cy, rIn, end);
      if (sweep >= 359.9) {
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((r + rIn) / 2) +
          '" fill="none" stroke="' + color + '" stroke-width="' + (r - rIn) + '" />';
      } else {
        paths += '<path d="M ' + p1.x + ' ' + p1.y +
          ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p2.x + ' ' + p2.y +
          ' L ' + p3.x + ' ' + p3.y +
          ' A ' + rIn + ' ' + rIn + ' 0 ' + large + ' 1 ' + p4.x + ' ' + p4.y +
          ' Z" fill="' + color + '" opacity="0.92">' +
          '<title>' + s.label + ': ' + s.value + '</title></path>';
      }
    });

    el.innerHTML =
      '<svg viewBox="0 0 100 100">' + paths + '</svg>' +
      '<div class="pie-center"><strong>' + total + '</strong><span>' +
      (centerLabel || 'รายการ') + '</span></div>';

    if (legend) {
      legend.innerHTML = data.map(function (s, i) {
        var color = s.color || PIE_COLORS[i % PIE_COLORS.length];
        var pct = Math.round((Number(s.value) / total) * 100);
        return '<li><span class="swatch" style="background:' + color + ';color:' + color +
          '"></span><span>' + s.label + '</span><span class="pct">' + pct + '%</span></li>';
      }).join('');
    }
  }

  function renderDash() {
    var orders = getOrders();
    var rev = 0;
    var cod = 0;
    var done = 0;
    orders.forEach(function (o) {
      rev += Number(o.total) || 0;
      if (o.status === 'cod_pending' || o.paymentMethod === 'cod') cod++;
      if (o.status === 'done' || o.status === 'paid' || o.status === 'shipping') done++;
    });

    if ($('cRevenue')) $('cRevenue').textContent = money(rev);
    if ($('cOrdersLine')) $('cOrdersLine').textContent = orders.length + ' ออเดอร์';
    if ($('cCod')) $('cCod').textContent = cod;

    var ok = 0, low = 0, out = 0, totalP = 0;
    if (typeof products !== 'undefined') {
      totalP = products.length;
      products.forEach(function (p) {
        var s = stockOf(p.id);
        if (s < 1) out++;
        else if (s <= LOW) low++;
        else ok++;
      });
    }
    if ($('cStockOk')) $('cStockOk').textContent = ok;
    if ($('cStockLow')) $('cStockLow').textContent = low;
    if ($('cStockOut')) $('cStockOut').textContent = out;

    var orderPct = orders.length ? Math.round((done / orders.length) * 100) : 0;
    var stockPct = totalP ? Math.round((ok / totalP) * 100) : 100;
    if ($('ringOrdersPct')) $('ringOrdersPct').textContent = orderPct + '%';
    if ($('ringStockPct')) $('ringStockPct').textContent = stockPct + '%';
    if ($('ringSysPct')) $('ringSysPct').textContent = Math.round((orderPct + stockPct) / 2) + '%';

    setRing($('ringOrdersFg'), orderPct, 327);
    setRing($('ringStockFg'), stockPct, 251);
    setRing($('ringSysFg'), Math.round((orderPct + stockPct) / 2), 251);

    if ($('mOrders')) $('mOrders').style.width = Math.min(100, orders.length * 10) + '%';
    if ($('mStock')) $('mStock').style.width = stockPct + '%';
    if ($('mCod')) $('mCod').style.width = (cod ? Math.min(100, cod * 20) : 5) + '%';

    // Weekly order + revenue bars
    var counts = [0, 0, 0, 0, 0, 0, 0];
    var revenues = [0, 0, 0, 0, 0, 0, 0];
    orders.forEach(function (o) {
      try {
        var d = new Date(o.date).getDay();
        counts[d]++;
        revenues[d] += Number(o.total) || 0;
      } catch (e) {}
    });
    var maxC = Math.max.apply(null, counts.concat([1]));
    var maxR = Math.max.apply(null, revenues.concat([1]));
    var weekSum = counts.reduce(function (a, b) { return a + b; }, 0);
    var weekRev = revenues.reduce(function (a, b) { return a + b; }, 0);
    if ($('weekTotal')) $('weekTotal').textContent = weekSum + ' ออเดอร์';
    if ($('weekRevenue')) $('weekRevenue').textContent = money(weekRev);

    var orderIdx = [1, 2, 3, 4, 5, 6, 0];
    var labels = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

    if ($('weekBars')) {
      $('weekBars').innerHTML = orderIdx.map(function (di, i) {
        var h = counts[di] ? Math.max(8, Math.round((counts[di] / maxC) * 100)) : 4;
        var val = counts[di] ? String(counts[di]) : '';
        return '<div class="bar-col">' +
          '<div class="val">' + val + '</div>' +
          '<div class="bar-track"><div class="bar" style="height:' + h + '%"></div></div>' +
          '<span class="lbl">' + labels[i] + '</span></div>';
      }).join('');
    }

    if ($('revenueBars')) {
      $('revenueBars').innerHTML = orderIdx.map(function (di, i) {
        var h = revenues[di] ? Math.max(8, Math.round((revenues[di] / maxR) * 100)) : 4;
        var val = revenues[di] ? (revenues[di] >= 1000 ? (Math.round(revenues[di]/1000) + 'k') : String(Math.round(revenues[di]))) : '';
        return '<div class="bar-col">' +
          '<div class="val">' + val + '</div>' +
          '<div class="bar-track"><div class="bar" style="height:' + h + '%"></div></div>' +
          '<span class="lbl">' + labels[i] + '</span></div>';
      }).join('');
    }

    // Status horizontal bars
    if ($('statusBars')) {
      var statusCount = {};
      STATUS_KEYS.forEach(function (k) { statusCount[k] = 0; });
      orders.forEach(function (o) {
        var st = o.status || 'paid';
        if (statusCount[st] === undefined) statusCount[st] = 0;
        statusCount[st]++;
      });
      var maxS = Math.max.apply(null, Object.keys(statusCount).map(function (k) { return statusCount[k]; }).concat([1]));
      var colorMap = {
        paid: 'ok', cod_pending: 'warn', confirmed: '', production: 'violet',
        shipping: '', done: 'ok', cancelled: 'danger'
      };
      var html = STATUS_KEYS.filter(function (k) { return statusCount[k] > 0; }).map(function (k) {
        var pct = Math.round((statusCount[k] / maxS) * 100);
        var fillCls = colorMap[k] || '';
        return '<div class="hbar-row">' +
          '<span class="name">' + (STATUS[k] || k) + '</span>' +
          '<div class="track"><div class="fill ' + fillCls + '" style="width:' + pct + '%"></div></div>' +
          '<span class="num">' + statusCount[k] + '</span></div>';
      }).join('');
      if (!html) html = '<p style="color:#6a7a96;font-size:0.85rem">ยังไม่มีข้อมูลสถานะ</p>';
      $('statusBars').innerHTML = html;
    }

    // Recent orders list
    var list = $('dashOrders');
    if (list) {
      var recent = orders.slice(0, 5);
      if (!recent.length) {
        list.innerHTML = '<li style="color:#6a7a96">ยังไม่มีออเดอร์</li>';
      } else {
        list.innerHTML = recent.map(function (o) {
          var name = (o.customer && o.customer.name) || 'ลูกค้า';
          var cls = o.status === 'cod_pending' ? 'warn' : (o.status === 'done' ? 'ok' : '');
          return '<li>' +
            '<span class="dot ' + cls + '"></span>' +
            '<span><button type="button" class="linkish" data-oid="' + o.id + '">' + o.id + '</button> · ' + name + '</span>' +
            '<span class="meta">' + money(o.total) + '</span>' +
            '</li>';
        }).join('');
      }
    }

    // Stock alerts
    var alerts = $('dashAlerts');
    if (alerts && typeof products !== 'undefined') {
      var items = products.filter(function (p) { return stockOf(p.id) <= LOW; })
        .sort(function (a, b) { return stockOf(a.id) - stockOf(b.id); })
        .slice(0, 5);
      if (!items.length) {
        alerts.innerHTML = '<li style="color:#6a7a96">สต็อกปกติทั้งหมด</li>';
      } else {
        alerts.innerHTML = items.map(function (p) {
          var s = stockOf(p.id);
          return '<li><img src="' + p.image + '" alt=""><span>' + p.name + '</span>' +
            '<span class="qty ' + (s < 1 ? 'out' : '') + '">' + s + '</span></li>';
        }).join('');
      }
    }

    // Pie charts
    var payMap = { promptpay: 0, transfer: 0, card: 0, cod: 0 };
    var payLabel = { promptpay: 'พร้อมเพย์', transfer: 'โอน', card: 'บัตร', cod: 'COD' };
    orders.forEach(function (o) {
      var m = o.paymentMethod || 'promptpay';
      if (payMap[m] === undefined) payMap[m] = 0;
      payMap[m]++;
    });
    renderPie('piePayment', 'legendPayment',
      Object.keys(payMap).map(function (k) {
        return { label: payLabel[k] || k, value: payMap[k] };
      }),
      'ออเดอร์'
    );

    renderPie('pieStock', 'legendStock', [
      { label: 'ปกติ', value: ok, color: '#4ade80' },
      { label: 'ต่ำ', value: low, color: '#f0c14b' },
      { label: 'หมด', value: out, color: '#ff6b7a' }
    ], 'สินค้า');

    var stSlices = STATUS_KEYS.map(function (k, i) {
      var cnt = 0;
      orders.forEach(function (o) { if ((o.status || 'paid') === k) cnt++; });
      return { label: STATUS[k], value: cnt, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    renderPie('pieStatus', 'legendStatus', stSlices, 'ออเดอร์');

    if ($('heroSub')) {
      $('heroSub').textContent = orders.length
        ? ('มี ' + orders.length + ' ออเดอร์ · สต็อกต่ำ ' + (low + out) + ' รายการ')
        : 'ยังไม่มีออเดอร์ในระบบ';
    }
  }

  function getFilteredOrders() {
    var filter = ($('filterStatus') && $('filterStatus').value) || 'all';
    var q = (($('orderSearch') && $('orderSearch').value) || '').trim().toLowerCase();
    var from = ($('orderDateFrom') && $('orderDateFrom').value) || '';
    var to = ($('orderDateTo') && $('orderDateTo').value) || '';
    var orders = getOrders();
    if (filter !== 'all') orders = orders.filter(function (o) { return o.status === filter; });
    if (from) {
      var fromT = new Date(from + 'T00:00:00').getTime();
      orders = orders.filter(function (o) { return new Date(o.date).getTime() >= fromT; });
    }
    if (to) {
      var toT = new Date(to + 'T23:59:59').getTime();
      orders = orders.filter(function (o) { return new Date(o.date).getTime() <= toT; });
    }
    if (q) {
      orders = orders.filter(function (o) {
        var name = ((o.customer && o.customer.name) || '').toLowerCase();
        var phone = ((o.customer && o.customer.phone) || '').toLowerCase();
        var id = String(o.id || '').toLowerCase();
        return id.indexOf(q) !== -1 || name.indexOf(q) !== -1 || phone.indexOf(q) !== -1;
      });
    }
    return orders;
  }

  function renderOrders() {
    var orders = getFilteredOrders();
    var body = $('ordersTable');
    var empty = $('ordersEmpty');
    if (!body) return;
    if (!orders.length) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    body.innerHTML = orders.map(function (o) {
      var name = (o.customer && o.customer.name) || '—';
      var phone = (o.customer && o.customer.phone) || '';
      var qty = (o.items || []).reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
      var pay = o.paymentMethod === 'cod' ? 'COD'
        : o.paymentMethod === 'promptpay' ? 'พร้อมเพย์'
        : o.paymentMethod === 'transfer' ? 'โอน'
        : o.paymentMethod === 'card' ? 'บัตร' : (o.paymentMethod || '—');
      return '<tr>' +
        '<td><strong>' + o.id + '</strong><br><small style="color:#6a7a96">' + fmtDate(o.date) + '</small></td>' +
        '<td>' + name + '<br><small style="color:#6a7a96">' + phone + '</small></td>' +
        '<td>' + qty + ' ชิ้น</td>' +
        '<td>' + money(o.total) + '</td>' +
        '<td>' + pay + '</td>' +
        '<td>' + pill(o.status) + '</td>' +
        '<td><button type="button" class="linkish" data-oid="' + o.id + '">จัดการ</button></td>' +
        '</tr>';
    }).join('');
  }

  function exportOrdersCsv() {
    var orders = getFilteredOrders();
    var lines = ['id,date,customer,phone,items,total,payment,status'];
    orders.forEach(function (o) {
      var name = ((o.customer && o.customer.name) || '').replace(/"/g, '""');
      var phone = ((o.customer && o.customer.phone) || '').replace(/"/g, '""');
      var qty = (o.items || []).reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
      lines.push(
        [o.id, o.date, '"' + name + '"', '"' + phone + '"', qty, o.total, o.paymentMethod || '', o.status || ''].join(',')
      );
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sp-orders.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printProduction(orderId) {
    var order = getOrders().find(function (o) { return o.id === orderId; });
    if (!order) return;
    var c = order.customer || {};
    var items = order.items || [];
    var rows = items.map(function (it, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + (it.name || '') +
        (it.sku ? '<br>รหัส: ' + it.sku : '') +
        (it.material ? '<br>วัสดุ: ' + it.material : '') +
        (it.size ? '<br>ขนาด: ' + it.size : '') +
        (it.color ? '<br>สี: ' + it.color : '') +
        (it.weightKg != null ? '<br>น้ำหนัก: ' + it.weightKg + ' กก./ชิ้น' : '') +
        '</td><td>' + (it.qty || 0) +
        '</td><td>' + (it.price || 0) + '</td><td></td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบสั่งผลิต ' + order.id + '</title>' +
      '<style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 8px}' +
      'table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}' +
      'th{background:#f5f5f5}.meta{margin:4px 0;font-size:13px}.sign{margin-top:40px;display:flex;justify-content:space-between}' +
      '.sign div{text-align:center;width:40%}.line{border-top:1px solid #333;margin-top:48px;padding-top:6px}' +
      '@media print{body{padding:0}}</style></head><body>' +
      '<h1>ใบสั่งผลิต / ใบจัดส่ง — SP Furniture Factory</h1>' +
      '<p class="meta"><b>เลขที่ออเดอร์:</b> ' + order.id + '</p>' +
      '<p class="meta"><b>วันที่:</b> ' + fmtDate(order.date) + '</p>' +
      '<p class="meta"><b>ลูกค้า:</b> ' + (c.name || '—') + ' | <b>โทร:</b> ' + (c.phone || '—') + '</p>' +
      '<p class="meta"><b>ที่อยู่:</b> ' + (c.address || '—') + '</p>' +
      '<p class="meta"><b>ชำระ:</b> ' + (order.paymentMethod || '—') + ' | <b>สถานะ:</b> ' + (STATUS[order.status] || order.status || '') + '</p>' +
      '<table><thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>ราคา</th><th>หมายเหตุผลิต</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<p class="meta" style="margin-top:12px"><b>ยอดรวม:</b> ' + money(order.total) + '</p>' +
      (c.note ? '<p class="meta"><b>หมายเหตุลูกค้า:</b> ' + c.note + '</p>' : '') +
      '<div class="sign"><div><div class="line">ผู้จัดทำ</div></div><div><div class="line">หัวหน้าผลิต</div></div></div>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>';
    var w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  function getQuotes() {
    try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveQuotes(list) {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(list));
  }

  var QUOTE_STATUS = { new: 'ใหม่', contacted: 'ติดต่อแล้ว', quoted: 'ส่งใบเสนอแล้ว', closed: 'ปิด' };

  function renderQuotes() {
    var filter = ($('filterQuote') && $('filterQuote').value) || 'all';
    var list = getQuotes();
    if (filter !== 'all') list = list.filter(function (q) { return q.status === filter; });
    var body = $('quotesTable');
    var empty = $('quotesEmpty');
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    var typeMap = { home: 'บ้าน', hotel: 'โรงแรม', office: 'ออฟฟิศ', custom: 'สั่งทำ', other: 'อื่นๆ' };
    body.innerHTML = list.map(function (q) {
      return '<tr>' +
        '<td><strong>' + q.id + '</strong></td>' +
        '<td>' + (q.name || '—') + '<br><small style="color:#6a7a96">' + (q.phone || '') + '</small></td>' +
        '<td>' + (typeMap[q.type] || q.type || '—') + '</td>' +
        '<td>' + (q.budget || '—') + '</td>' +
        '<td>' + fmtDate(q.date) + '</td>' +
        '<td><select data-qstatus="' + q.id + '">' +
          Object.keys(QUOTE_STATUS).map(function (k) {
            return '<option value="' + k + '"' + (q.status === k ? ' selected' : '') + '>' + QUOTE_STATUS[k] + '</option>';
          }).join('') +
        '</select></td>' +
        '<td><button type="button" class="linkish" data-qview="' + q.id + '">ดู</button></td>' +
        '</tr>';
    }).join('');
  }

  function exportQuotesCsv() {
    var list = getQuotes();
    var lines = ['id,date,name,phone,email,type,budget,status,detail'];
    list.forEach(function (q) {
      var detail = String(q.detail || '').replace(/"/g, '""').replace(/\n/g, ' ');
      lines.push([q.id, q.date, '"' + (q.name || '') + '"', '"' + (q.phone || '') + '"',
        '"' + (q.email || '') + '"', q.type || '', q.budget || '', q.status || '',
        '"' + detail + '"'].join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sp-quotes.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function viewQuote(id) {
    var q = getQuotes().find(function (x) { return x.id === id; });
    if (!q) return;
    alert(
      'เลขที่: ' + q.id + '\n' +
      'ลูกค้า: ' + q.name + '\n' +
      'โทร: ' + q.phone + '\n' +
      'อีเมล: ' + (q.email || '—') + '\n' +
      'ประเภท: ' + q.type + '\n' +
      'งบ: ' + (q.budget || '—') + '\n\n' +
      'รายละเอียด:\n' + q.detail
    );
  }

  function renderStock() {
    var body = $('stockTable');
    if (!body || typeof products === 'undefined') return;
    try { if (typeof initStock === 'function') initStock(); } catch (e) {}
    var q = (($('stockSearch') && $('stockSearch').value) || '').trim().toLowerCase();
    var filter = ($('filterStock') && $('filterStock').value) || 'all';
    var list = products.slice();
    if (q) {
      list = list.filter(function (p) {
        return (p.name + ' ' + (p.categoryName || '')).toLowerCase().indexOf(q) !== -1;
      });
    }
    list = list.filter(function (p) {
      var s = stockOf(p.id);
      if (filter === 'low') return s > 0 && s <= LOW;
      if (filter === 'out') return s < 1;
      if (filter === 'ok') return s > LOW;
      return true;
    });
    list.sort(function (a, b) { return stockOf(a.id) - stockOf(b.id); });
    body.innerHTML = list.map(function (p) {
      var s = stockOf(p.id);
      var cls = s < 1 ? 'out' : (s <= LOW ? 'low' : '');
      var price = typeof formatPrice === 'function' ? formatPrice(p.price) : money(p.price);
      return '<tr>' +
        '<td><div class="prod-cell"><img src="' + p.image + '" alt=""><span>' + p.name + '</span></div></td>' +
        '<td>' + (p.categoryName || '') + '</td>' +
        '<td>' + price + '</td>' +
        '<td><span class="stock-val ' + cls + '">' + s + '</span></td>' +
        '<td><div class="stock-edit">' +
          '<input type="number" min="0" data-sid="' + p.id + '" value="' + s + '">' +
          '<button type="button" data-save-stock="' + p.id + '">บันทึก</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function openOrder(id) {
    var order = getOrders().find(function (o) { return o.id === id; });
    if (!order) return;
    currentOrderId = id;
    $('modalTitle').textContent = order.id;
    var c = order.customer || {};
    var items = order.items || [];
    var html = '';
    function row(a, b) {
      return '<div class="row"><span class="lbl">' + a + '</span><span>' + b + '</span></div>';
    }
    html += row('ลูกค้า', c.name || '—');
    html += row('โทร', c.phone || '—');
    html += row('อีเมล', c.email || '—');
    html += row('ที่อยู่', c.address || '—');
    html += row('วันที่', fmtDate(order.date));
    html += row('ชำระ', order.paymentMethod || '—');
    html += '<div style="margin:0.8rem 0 0.3rem;color:#8b9bb8">รายการสินค้า</div>';
    items.forEach(function (it) {
      var detail = (it.name || '') + ' × ' + (it.qty || 0);
      var sub = [it.sku, it.material, it.size, it.color, it.weightKg != null ? ('~' + it.weightKg + 'กก.') : '']
        .filter(Boolean).join(' · ');
      if (sub) detail += '<br><small style="color:#6a7a96">' + sub + '</small>';
      html += row(detail, money((it.price || 0) * (it.qty || 0)));
    });
    html += '<div class="row" style="font-weight:700;color:var(--cyan)"><span>ยอดรวม</span><span>' + money(order.total) + '</span></div>';
    if (c.note) html += '<p style="margin-top:0.8rem;color:#8b9bb8">หมายเหตุ: ' + c.note + '</p>';
    $('modalBody').innerHTML = html;
    $('modalStatus').innerHTML = STATUS_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (order.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>';
    }).join('');
    $('modal').hidden = false;
  }

  function closeModal() {
    $('modal').hidden = true;
    currentOrderId = null;
  }

  function saveStatus() {
    if (!currentOrderId) return;
    var status = $('modalStatus').value;
    var list = getOrders();
    var i = list.findIndex(function (o) { return o.id === currentOrderId; });
    if (i < 0) return;
    list[i].status = status;
    list[i].statusChangedAt = new Date().toISOString();
    saveOrders(list);
    try {
      var last = JSON.parse(localStorage.getItem('sp_last_order') || 'null');
      if (last && last.id === currentOrderId) {
        last.status = status;
        localStorage.setItem('sp_last_order', JSON.stringify(last));
      }
    } catch (e) {}
    closeModal();
    refreshAll();
  }

  function saveStock(id) {
    var input = document.querySelector('input[data-sid="' + id + '"]');
    if (!input) return;
    var val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (typeof setStock === 'function') setStock(id, val);
    else if (typeof products !== 'undefined') {
      var p = products.find(function (x) { return x.id === id; });
      if (p) p.stock = val;
    }
    renderStock();
    renderDash();
  }


  var CUSTOM_STATUS = {
    new: 'ใหม่', reviewing: 'กำลังประเมิน', quoted: 'ส่งราคาแล้ว',
    confirmed: 'ลูกค้ายืนยัน', production: 'กำลังผลิต', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก'
  };
  var TYPE_LABEL = {
    table: 'โต๊ะ', chair: 'เก้าอี้', cabinet: 'ตู้ / ชั้นวาง', bed: 'เตียง',
    sofa: 'โซฟา / ชุดรับแขก', set: 'ชุดเฟอร์นิเจอร์', other: 'อื่นๆ'
  };
  var MAT_LABEL = {
    teak: 'ไม้สัก', oak: 'ไม้โอ๊ค', rubber: 'ไม้ยางพารา', mixed: 'ผสม / ตามแนะนำ', other: 'อื่นๆ'
  };

  function getCustoms() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveCustoms(list) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  }

  function renderCustoms() {
    var filter = ($('filterCustom') && $('filterCustom').value) || 'all';
    var list = getCustoms();
    if (filter !== 'all') list = list.filter(function (x) { return x.status === filter; });
    var body = $('customTable');
    var empty = $('customEmpty');
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    body.innerHTML = list.map(function (c) {
      return '<tr>' +
        '<td><strong>' + c.id + '</strong></td>' +
        '<td>' + (c.name || '—') + '<br><small style="color:#6a7a96">' + (c.phone || '') + '</small></td>' +
        '<td>' + (TYPE_LABEL[c.type] || c.type || '—') + '</td>' +
        '<td>' + (MAT_LABEL[c.material] || c.material || '—') + '</td>' +
        '<td>' + (c.qty || 1) + '</td>' +
        '<td>' + fmtDate(c.date) + '</td>' +
        '<td><select data-cstatus="' + c.id + '">' +
          Object.keys(CUSTOM_STATUS).map(function (k) {
            return '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + CUSTOM_STATUS[k] + '</option>';
          }).join('') +
        '</select></td>' +
        '<td><button type="button" class="linkish" data-cview="' + c.id + '">ดู</button> ' +
        (c.linkedOrderId ? '<small style="color:#6a7a96">' + c.linkedOrderId + '</small>' :
          '<button type="button" class="linkish" data-cconvert="' + c.id + '">แปลงเป็นออเดอร์</button>') +
        '</td>' +
        '</tr>';
    }).join('');
  }

  function viewCustom(id) {
    var c = getCustoms().find(function (x) { return x.id === id; });
    if (!c) return;
    var size = [];
    if (c.width) size.push('กว้าง ' + c.width);
    if (c.depth) size.push('ลึก ' + c.depth);
    if (c.height) size.push('สูง ' + c.height);
    var price = Number(c.estimatedPrice) || 0;
    var imgNote = (c.images && c.images.length) ? (c.images.length + ' รูป') : 'ไม่มี';
    var linked = c.linkedOrderId ? ('\nออเดอร์ขาย: ' + c.linkedOrderId) : '';
    var msg =
      'เลขที่: ' + c.id + '\n' +
      'ลูกค้า: ' + c.name + '\n' +
      'โทร: ' + c.phone + '\n' +
      'ติดต่อ: ' + (c.contact || '—') + '\n' +
      'ประเภท: ' + (TYPE_LABEL[c.type] || c.type) + '\n' +
      'จำนวน: ' + (c.qty || 1) + '\n' +
      'ขนาด: ' + (size.join(' × ') || 'ไม่ระบุ') + ' ซม.\n' +
      'วัสดุ: ' + (MAT_LABEL[c.material] || c.material) + '\n' +
      'สี: ' + (c.color || '—') + '\n' +
      'งบ: ' + (c.budget || '—') + '\n' +
      'ราคาประเมิน: ฿' + price.toLocaleString('th-TH') + '\n' +
      'รูปอ้างอิง: ' + imgNote + '\n' +
      'ลิงก์: ' + (c.ref || '—') + linked + '\n\n' +
      'รายละเอียด:\n' + (c.detail || '');

    if (!c.linkedOrderId && (c.status === 'quoted' || c.status === 'confirmed' || c.status === 'reviewing' || c.status === 'new')) {
      if (confirm(msg + '\n\nแปลงเป็นออเดอร์ขายตอนนี้?')) {
        convertCustomOrder(c.id);
      }
    } else {
      alert(msg);
    }
  }

  function convertCustomOrder(id) {
    var newId = null;
    if (typeof SPCustomOrder !== 'undefined' && SPCustomOrder.convertToOrder) {
      newId = SPCustomOrder.convertToOrder(id);
    } else {
      // fallback inline
      var list = getCustoms();
      var idx = list.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return;
      var c = list[idx];
      if (c.linkedOrderId) { alert('แปลงแล้ว: ' + c.linkedOrderId); return; }
      var price = Number(c.estimatedPrice) || 0;
      var order = {
        id: 'SP' + Date.now().toString(36).toUpperCase(),
        date: new Date().toISOString(),
        status: 'confirmed',
        statusChangedAt: new Date().toISOString(),
        paymentMethod: 'transfer',
        total: price * (c.qty || 1),
        customSourceId: c.id,
        customer: { name: c.name, phone: c.phone, email: c.contact || '', address: '', note: c.detail || '' },
        items: [{ id: 'custom', name: 'สั่งทำตามแบบ', qty: c.qty || 1, price: price, image: (c.images && c.images[0]) || '' }]
      };
      var orders = getOrders();
      orders.unshift(order);
      saveOrders(orders);
      c.status = 'confirmed';
      c.linkedOrderId = order.id;
      c.statusChangedAt = new Date().toISOString();
      list[idx] = c;
      saveCustoms(list);
      newId = order.id;
    }
    if (newId) {
      alert('แปลงเป็นออเดอร์ขายแล้ว: ' + newId);
      refreshAll();
    }
  }

  function exportCustomsCsv() {
    var list = getCustoms();
    var lines = ['id,date,name,phone,type,material,qty,width,depth,height,color,budget,status,detail'];
    list.forEach(function (c) {
      var detail = String(c.detail || '').replace(/"/g, '""').replace(/\n/g, ' ');
      lines.push([
        c.id, c.date, '"' + (c.name || '') + '"', '"' + (c.phone || '') + '"',
        c.type || '', c.material || '', c.qty || 1,
        c.width || '', c.depth || '', c.height || '',
        '"' + (c.color || '') + '"', c.budget || '', c.status || '',
        '"' + detail + '"'
      ].join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sp-custom-orders.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }


  function initAutoStatusUI() {
    var cfg = (typeof SPAutoStatus !== 'undefined') ? SPAutoStatus.loadConfig() : { enabled: true };
    var toggle = $('autoStatusToggle');
    if (toggle) {
      toggle.checked = cfg.enabled !== false;
      toggle.addEventListener('change', function () {
        var c = SPAutoStatus.loadConfig();
        c.enabled = !!toggle.checked;
        SPAutoStatus.saveConfig(c);
        updateAutoStatusInfo();
        renderAutoRules();
      });
    }
    updateAutoStatusInfo();
    renderAutoRules();
    window.SPAutoStatusOnUpdate = function (result) {
      updateAutoStatusInfo(result);
      refreshAll();
    };
  }

  function updateAutoStatusInfo(result) {
    var el = $('autoStatusInfo');
    var badge = $('autoRulesBadge');
    var cfg = (typeof SPAutoStatus !== 'undefined') ? SPAutoStatus.loadConfig() : { enabled: true };
    if (el) {
      if (!cfg.enabled) el.textContent = 'ออโต้: ปิด';
      else if (result && (result.orders || result.custom)) {
        el.textContent = 'เพิ่งอัปเดต ' + (result.orders + result.custom) + ' รายการ';
      } else {
        el.textContent = 'ออโต้: เปิด';
      }
    }
    if (badge) {
      badge.textContent = cfg.enabled ? 'เปิดอยู่' : 'ปิดอยู่';
    }
  }

  function renderAutoRules() {
    var el = $('autoRulesInfo');
    if (!el || typeof SPAutoStatus === 'undefined') return;
    var cfg = SPAutoStatus.loadConfig();
    function line(rules, title) {
      var rows = (rules || []).map(function (r) {
        return r.from + ' → ' + r.to + ' (' + r.afterMin + ' นาที)';
      }).join(' · ');
      return '<div><strong style="color:#c5d0e6">' + title + ':</strong> ' + (rows || '—') + '</div>';
    }
    el.innerHTML =
      line(cfg.orderRules, 'ออเดอร์ขาย') +
      line(cfg.customRules, 'สั่งทำตามแบบ') +
      '<div style="margin-top:0.4rem">ไม่เลื่อนอัตโนมัติ: COD รอชำระ · ยกเลิก · สถานะที่แอดมินล็อก</div>';
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.id === 'tab-' + name);
    });
    document.querySelectorAll('.side-btn[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    if (name === 'orders') renderOrders();
    if (name === 'quotes') renderQuotes();
    if (name === 'custom') renderCustoms();
    if (name === 'stock') renderStock();
    if (name === 'dash') renderDash();
  }

  function bind() {
    var form = $('formLogin');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var pass = (($('inputPassword') && $('inputPassword').value) || '').trim();
        if (pass === PASSWORD) {
          if ($('loginMsg')) $('loginMsg').textContent = '';
          setLoggedIn(true);
          showApp();
        } else if ($('loginMsg')) {
          $('loginMsg').textContent = 'รหัสผ่านไม่ถูกต้อง';
        }
      });
    }

    if ($('btnLogout')) {
      $('btnLogout').addEventListener('click', function () {
        setLoggedIn(false);
        showLogin();
      });
    }

    document.querySelectorAll('.side-btn[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    document.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-goto'));
      });
    });

    if ($('filterStatus')) $('filterStatus').addEventListener('change', renderOrders);
    if ($('orderSearch')) $('orderSearch').addEventListener('input', renderOrders);
    if ($('orderDateFrom')) $('orderDateFrom').addEventListener('change', renderOrders);
    if ($('orderDateTo')) $('orderDateTo').addEventListener('change', renderOrders);
    if ($('btnRefreshOrders')) $('btnRefreshOrders').addEventListener('click', refreshAll);
    if ($('btnExportCsv')) $('btnExportCsv').addEventListener('click', exportOrdersCsv);
    if ($('filterQuote')) $('filterQuote').addEventListener('change', renderQuotes);
    if ($('btnExportQuotes')) $('btnExportQuotes').addEventListener('click', exportQuotesCsv);
    if ($('modalPrint')) {
      $('modalPrint').addEventListener('click', function () {
        if (currentOrderId) printProduction(currentOrderId);
      });
    }
    if ($('stockSearch')) $('stockSearch').addEventListener('input', renderStock);
    if ($('filterStock')) $('filterStock').addEventListener('change', renderStock);

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-qstatus')) {
        var id = t.getAttribute('data-qstatus');
        var list = getQuotes();
        var i = list.findIndex(function (q) { return q.id === id; });
        if (i >= 0) { list[i].status = t.value; saveQuotes(list); }
      }
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-oid')) openOrder(t.getAttribute('data-oid'));
      if (t.getAttribute('data-save-stock')) saveStock(parseInt(t.getAttribute('data-save-stock'), 10));
      if (t.getAttribute('data-qview')) viewQuote(t.getAttribute('data-qview'));
      if (t.getAttribute('data-cview')) viewCustom(t.getAttribute('data-cview'));
      if (t.getAttribute('data-cconvert')) convertCustomOrder(t.getAttribute('data-cconvert'));
    });

    if ($('modalClose')) $('modalClose').addEventListener('click', closeModal);
    if ($('modalSave')) $('modalSave').addEventListener('click', saveStatus);
    if ($('modal')) {
      $('modal').addEventListener('click', function (e) {
        if (e.target === $('modal')) closeModal();
      });
    }

    setInterval(updateClock, 30000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    if (isLoggedIn()) showApp();
    else showLogin();
  });
})();
