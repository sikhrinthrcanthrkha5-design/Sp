/**
 * SP Furniture — Automatic status progression
 * Runs on page load + interval. Safe with localStorage / file://
 */
(function (global) {
  'use strict';

  var ORDERS_KEY = 'sp_furniture_orders';
  var CUSTOM_KEY = 'sp_furniture_custom_orders';
  var CONFIG_KEY = 'sp_auto_status_config';

  // เวลาเลื่อนสถานะ (มิลลิวินาที) — ค่าเริ่มต้นเหมาะกับเดโม
  // ปรับในแอดมินได้
  var DEFAULT_CONFIG = {
    enabled: true,
    // ออเดอร์ขาย
    orderRules: [
      { from: 'paid', to: 'confirmed', afterMin: 1 },
      { from: 'confirmed', to: 'production', afterMin: 2 },
      { from: 'production', to: 'shipping', afterMin: 3 },
      { from: 'shipping', to: 'done', afterMin: 2 }
      // cod_pending / cancelled ไม่เลื่อนอัตโนมัติ
    ],
    // สั่งทำตามแบบ
    customRules: [
      { from: 'new', to: 'reviewing', afterMin: 1 },
      { from: 'reviewing', to: 'quoted', afterMin: 2 },
      // quoted รอลูกค้า — ไม่เลื่อน
      { from: 'confirmed', to: 'production', afterMin: 1 },
      { from: 'production', to: 'done', afterMin: 3 }
    ]
  };

  function loadConfig() {
    try {
      var saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (!saved) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      return {
        enabled: saved.enabled !== false,
        orderRules: saved.orderRules || DEFAULT_CONFIG.orderRules,
        customRules: saved.customRules || DEFAULT_CONFIG.customRules
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function readList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  }

  function writeList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  function ensureTimestamp(item) {
    if (!item.statusChangedAt) {
      item.statusChangedAt = item.date || new Date().toISOString();
    }
    return item;
  }

  function findRule(rules, status) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].from === status) return rules[i];
    }
    return null;
  }

  /**
   * @returns {number} จำนวนรายการที่อัปเดต
   */
  function processList(key, rules) {
    var list = readList(key);
    var now = Date.now();
    var changed = 0;

    list.forEach(function (item) {
      if (item.autoStatus === false) return; // ล็อกโดยแอดมิน
      ensureTimestamp(item);
      var rule = findRule(rules, item.status);
      if (!rule) return;
      var afterMs = (Number(rule.afterMin) || 1) * 60 * 1000;
      var changedAt = new Date(item.statusChangedAt).getTime();
      if (isNaN(changedAt)) changedAt = now;
      if (now - changedAt >= afterMs) {
        item.status = rule.to;
        item.statusChangedAt = new Date().toISOString();
        item.lastAutoUpdate = item.statusChangedAt;
        item.autoHistory = item.autoHistory || [];
        item.autoHistory.push({
          at: item.statusChangedAt,
          from: rule.from,
          to: rule.to
        });
        changed++;
      }
    });

    if (changed > 0) writeList(key, list);
    return changed;
  }

  function runAutoStatus() {
    var cfg = loadConfig();
    if (!cfg.enabled) {
      return { orders: 0, custom: 0, enabled: false };
    }
    var o = processList(ORDERS_KEY, cfg.orderRules);
    var c = processList(CUSTOM_KEY, cfg.customRules);
    return { orders: o, custom: c, enabled: true };
  }

  // ให้หน้าอื่นเรียกหลังสร้างออเดอร์
  function stampNewStatus(item) {
    if (!item) return item;
    item.statusChangedAt = new Date().toISOString();
    return item;
  }

  global.SPAutoStatus = {
    run: runAutoStatus,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    stamp: stampNewStatus,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  // รันตอนโหลด + ทุก 30 วินาที
  function boot() {
    try { runAutoStatus(); } catch (e) {}
    setInterval(function () {
      try {
        var r = runAutoStatus();
        if ((r.orders || r.custom) && typeof global.SPAutoStatusOnUpdate === 'function') {
          global.SPAutoStatusOnUpdate(r);
        }
      } catch (e) {}
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
