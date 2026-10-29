/* Recipes — a tiny personal cookbook.
   Data: localStorage cache + data.json in the GitHub repo (source of truth).
   Writes need a fine-grained token, entered once in Settings. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var KEY = 'recipes.v2', CFGKEY = 'recipes.cfg';
  var SRC = 'data.json';

  var UNITS = {
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbsp: 'tbsp', T: 'tbsp',
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', t: 'tsp',
    cup: 'cup', cups: 'cup', c: 'cup',
    ounce: 'oz', ounces: 'oz', oz: 'oz', pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    gram: 'g', grams: 'g', g: 'g', kilogram: 'kg', kilograms: 'kg', kg: 'kg',
    millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml', ml: 'ml',
    litre: 'l', litres: 'l', liter: 'l', liters: 'l', l: 'l',
    clove: 'clove', cloves: 'clove', can: 'can', cans: 'can', tin: 'tin', tins: 'tin',
    slice: 'slice', slices: 'slice', piece: 'piece', pieces: 'piece', pinch: 'pinch', pinches: 'pinch',
    bunch: 'bunch', bunches: 'bunch', sprig: 'sprig', sprigs: 'sprig', stick: 'stick', sticks: 'stick',
    packet: 'packet', packets: 'packet', handful: 'handful', handfuls: 'handful', head: 'head', heads: 'head'
  };
  var PLURALS = { cup: 'cups', clove: 'cloves', can: 'cans', tin: 'tins', slice: 'slices', piece: 'pieces', pinch: 'pinches', bunch: 'bunches', sprig: 'sprigs', stick: 'sticks', packet: 'packets', handful: 'handfuls', head: 'heads' };
  var FRACTIONS = { 0.5: '½', 0.25: '¼', 0.75: '¾', 0.333: '⅓', 0.667: '⅔', 0.125: '⅛', 0.375: '⅜', 0.625: '⅝', 0.875: '⅞' };

  var EXAMPLES = [
    { emoji: '🍝', name: 'Lemon spaghetti', ingredients: ['200g spaghetti', '3 cloves garlic', '1 lemon', '2 tbsp olive oil', '50g parmesan', 'salt to taste'], method: 'Boil the pasta. Warm sliced garlic in the oil, add zest and juice plus a splash of pasta water, toss with the pasta and parmesan.' },
    { emoji: '🍳', name: 'Shakshuka', ingredients: ['1 onion', '1 red pepper', '400g tinned tomatoes', '4 eggs', '1 tsp cumin', '1 tsp paprika', '2 tbsp olive oil'], method: 'Soften onion and pepper in oil, stir in the spices, add tomatoes and simmer 10 minutes. Make wells, crack in the eggs, cover until just set.' },
    { emoji: '🥣', name: 'Overnight oats', ingredients: ['50g oats', '120ml milk', '1 tbsp yoghurt', '1 tsp honey', '1 banana'], method: 'Stir everything but the banana together, leave in the fridge overnight, top with sliced banana in the morning.' }
  ];

  var cfg = merge({ owner: 'funferall', repo: 'recipes', branch: 'main', token: '' }, read(CFGKEY, {}));
  var S = read(KEY, null) || { updated: 0, recipes: [] };
  var sel = {}, active = {}, q = '';
  var editing = null, pendingImg = null;

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (b[k] !== undefined) o[k] = b[k]; return o; }
  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { note('Local storage full — remove a photo or two.'); } }

  /* ---------- ingredient parsing ---------- */
  function normNumber(tok) {
    if (!tok) return null;
    if (/^\d+\/\d+$/.test(tok)) { var p = tok.split('/'); return Number(p[1]) ? Number(p[0]) / Number(p[1]) : null; }
    if (/^\d+([.,]\d+)?$/.test(tok)) return parseFloat(tok.replace(',', '.'));
    return null;
  }
  function parseQty(tokens) {
    var a = normNumber(tokens[0]);
    if (a === null) return { qty: null, i: 0 };
    var sep = tokens[1];
    if (sep === '-' || sep === '–' || sep === '—' || sep === 'to') {
      var b = normNumber(tokens[2]);
      if (b !== null) return { qty: (a + b) / 2, i: 3 };
    }
    var b2 = normNumber(tokens[1]);
    if (b2 !== null && /^\d+\/\d+$/.test(tokens[1]) && a === Math.floor(a)) return { qty: a + b2, i: 2 };
    return { qty: a, i: 1 };
  }
  function parseIngredient(raw) {
    var line = String(raw || '').trim().replace(/^[•\-–*\s]+/, '');
    if (!line) return null;
    var t = line
      .replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g, function (m, d, f) { return d + ' ' + ({ '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 })[f]; })
      .replace(/([½¼¾⅓⅔⅛])/g, ' $1 ')
      .replace(/(\d)\s*-\s*(\d)/, '$1 - $2')
      .replace(/(\d)([a-zA-Z])/, '$1 $2');
    var tokens = t.split(/\s+/).filter(Boolean);
    var r = parseQty(tokens);
    var rest = tokens.slice(r.i);
    var unit = null;
    if (rest.length > 1) {
      var cand = rest[0].toLowerCase().replace(/\.$/, '');
      if (UNITS[cand]) { unit = UNITS[cand]; rest = rest.slice(1); }
    }
    var item = rest.join(' ').replace(/^of\s+/i, '').replace(/[.,;]+$/, '').trim().toLowerCase();
    return { qty: r.qty, unit: unit, item: item || line.toLowerCase(), raw: line };
  }
  function fmtQty(q) {
    if (q == null) return '';
    var whole = Math.floor(q), frac = q - whole;
    var key = null, k;
    for (k in FRACTIONS) if (Math.abs(frac - Number(k)) < 0.02) key = FRACTIONS[k];
    if (!key) return (Math.round(q * 100) / 100).toString();
    return (whole ? whole : '') + key;
  }
  function plural(qty, unit) {
    if (!unit) return '';
    if (qty != null && qty > 1 && PLURALS[unit]) return PLURALS[unit];
    return unit;
  }

  /* ---------- remote sync ---------- */
  function api(path, opts) {
    var url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + (path || '');
    opts = opts || {};
    opts.headers = merge({ Accept: 'application/vnd.github+json' }, opts.headers || {});
    if (cfg.token) opts.headers.Authorization = 'Bearer ' + cfg.token;
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 120)); });
      return r.json();
    });
  }
  function pull() {
    return api('/contents/data.json?ref=' + encodeURIComponent(cfg.branch))
      .then(function (j) {
        var txt = decodeURIComponent(escape(atob((j.content || '').replace(/\s/g, ''))));
        var d = JSON.parse(txt);
        if (d && Array.isArray(d.recipes)) {
          if (!S.updated || (d.updated || 0) > (S.updated || 0)) { S = d; saveLocal(); render(); note('Pulled from GitHub.'); }
          else note('Local copy is newer — push to keep it.');
        }
        return d;
      });
  }
  function push() {
    if (!cfg.token) return Promise.reject(new Error('No token set.'));
    var body = JSON.stringify({ v: 2, updated: Date.now(), recipes: S.recipes }, null, 2);
    var b64 = btoa(unescape(encodeURIComponent(body)));
    return api('/contents/data.json?ref=' + encodeURIComponent(cfg.branch))
      .then(function (j) { return j.sha; })
      .catch(function () { return null; })
      .then(function (sha) {
        var payload = { message: 'Update recipes (' + S.recipes.length + ')', content: b64, branch: cfg.branch };
        if (sha) payload.sha = sha;
        return api('/contents/data.json', { method: 'PUT', body: JSON.stringify(payload) });
      })
      .then(function () { S.updated = Date.now(); saveLocal(); return note('Pushed to GitHub.'); });
  }
  function note(msg) { var el = $('#s-status'); if (el) el.textContent = msg; }

  /* ---------- filtering + render ---------- */
  function matches(r) {
    var hay = (r.name + ' ' + (r.method || '') + ' ' + (r.ingredients || []).join(' ')).toLowerCase();
    if (q && hay.indexOf(q.toLowerCase()) === -1) return false;
    var items = (r.ingredients || []).map(function (l) { var p = parseIngredient(l); return p ? p.item : ''; });
    for (var k in active) {
      if (!active[k]) continue;
      if (!items.some(function (i) { return i.indexOf(k) !== -1; })) return false;
    }
    return true;
  }
  function chipList() {
    var counts = {};
    S.recipes.forEach(function (r) {
      (r.ingredients || []).forEach(function (l) {
        var p = parseIngredient(l); if (!p || !p.item) return;
        counts[p.item] = (counts[p.item] || 0) + 1;
      });
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 18);
  }
  function render() {
    var grid = $('#grid');
    var list = S.recipes.filter(matches);
    grid.innerHTML = list.length ? list.map(function (r) {
      var on = sel[r.id] ? ' sel' : '';
      var pic = r.img ? '<img src="' + r.img + '" alt="">' : '<div class="emoji">' + esc(r.emoji || '🍽') + '</div>';
      var ings = (r.ingredients || []).slice(0, 4).join(' · ');
      return '<article class="card' + on + '" data-id="' + r.id + '">' +
        '<div class="tick" data-tick="' + r.id + '" title="Add to shopping list">✓</div>' + pic +
        '<h3>' + esc(r.name) + '</h3><p>' + esc(ings || r.method || '') + '</p></article>';
    }).join('') : '<p class="empty">Nothing matches. ' + (S.recipes.length ? 'Try clearing the filters.' : 'Tap + to add a recipe.') + '</p>';

    var chips = $('#chips'), cs = chipList();
    chips.innerHTML = (cs.length ? '<button class="chip" data-chip="">All</button>' : '') +
      cs.map(function (c) { return '<button class="chip' + (active[c] ? ' on' : '') + '" data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');

    var n = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
    $('#bar').hidden = !n;
    $('#barn').textContent = n + (n === 1 ? ' recipe selected' : ' recipes selected');
  }

  /* ---------- shopping list ---------- */
  function buildList() {
    var map = {}, order = [];
    S.recipes.forEach(function (r) {
      if (!sel[r.id]) return;
      (r.ingredients || []).forEach(function (line) {
        var p = parseIngredient(line); if (!p) return;
        var key = p.item + '|' + (p.unit || '');
        if (!map[key]) { map[key] = { item: p.item, unit: p.unit, qty: 0, unknown: p.qty == null, src: [] }; order.push(key); }
        if (p.qty != null) map[key].qty += p.qty; else map[key].unknown = true;
        if (map[key].src.indexOf(r.name) === -1) map[key].src.push(r.name);
      });
    });
    return order.map(function (k) { return map[k]; });
  }
  function showShopping() {
    var rows = buildList();
    $('#shoplist').innerHTML = rows.length ? rows.map(function (x, i) {
      var amount = x.qty ? fmtQty(x.qty) + ' ' + plural(x.qty, x.unit) : (x.unit || '');
      return '<li data-i="' + i + '"><input type="checkbox"><span class="it"><b>' + esc(amount ? amount + ' ' : '') + esc(x.item) + '</b>' +
        '<span class="src">' + esc(x.src.join(', ')) + '</span></span></li>';
    }).join('') : '<p class="hint">Select some recipes first.</p>';
    $('#shoplist').querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () { cb.closest('li').classList.toggle('done', cb.checked); });
    });
    $('#shop')._rows = rows;
    $('#shop').showModal();
  }

  /* ---------- editor ---------- */
  function openEditor(id) {
    editing = id ? S.recipes.filter(function (r) { return r.id === id; })[0] : null;
    pendingImg = editing ? editing.img || null : null;
    $('#etitle').textContent = editing ? 'Edit recipe' : 'New recipe';
    $('#e-emoji').value = editing ? editing.emoji || '' : '';
    $('#e-name').value = editing ? editing.name : '';
    $('#e-ing').value = editing ? (editing.ingredients || []).join('\n') : '';
    $('#e-method').value = editing ? editing.method || '' : '';
    $('#e-del').style.display = editing ? '' : 'none';
    var pv = $('#preview');
    if (pendingImg) { pv.src = pendingImg; pv.style.display = 'block'; } else { pv.style.display = 'none'; pv.removeAttribute('src'); }
    $('#editor').showModal();
    setTimeout(function () { $('#e-name').focus(); }, 50);
  }
  function shrink(file) {
    return new Promise(function (resolve) {
      var img = new Image(), fr = new FileReader();
      fr.onload = function () { img.src = fr.result; };
      img.onload = function () {
        var max = 900, w = img.width, h = img.height;
        if (w > max || h > max) { var s = Math.min(max / w, max / h); w = Math.round(w * s); h = Math.round(h * s); }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- wiring ---------- */
  $('#q').addEventListener('input', function (e) { q = e.target.value.trim(); render(); });
  $('#add').addEventListener('click', function () { openEditor(null); });
  $('#grid').addEventListener('click', function (e) {
    var tick = e.target.closest('[data-tick]');
    if (tick) { var id = tick.getAttribute('data-tick'); sel[id] = !sel[id]; render(); return; }
    var card = e.target.closest('.card'); if (card) openEditor(card.getAttribute('data-id'));
  });
  $('#chips').addEventListener('click', function (e) {
    var c = e.target.closest('[data-chip]'); if (!c) return;
    var v = c.getAttribute('data-chip');
    if (!v) active = {};
    else active[v] = !active[v];
    render();
  });
  $('#clearsel').addEventListener('click', function () { sel = {}; render(); });
  $('#shopping').addEventListener('click', showShopping);
  $('#shopclose').addEventListener('click', function () { $('#shop').close(); });
  $('#shopcopy').addEventListener('click', function () {
    var rows = $('#shop')._rows || [];
    var text = rows.map(function (x) {
      var amount = x.qty ? fmtQty(x.qty) + ' ' + plural(x.qty, x.unit) : (x.unit || '');
      return '- ' + (amount ? amount + ' ' : '') + x.item;
    }).join('\n');
    navigator.clipboard.writeText(text).then(function () { $('#shopcopy').textContent = 'Copied'; setTimeout(function () { $('#shopcopy').textContent = 'Copy as text'; }, 1400); });
  });

  $('#e-photo').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    shrink(f).then(function (d) { pendingImg = d; var pv = $('#preview'); pv.src = d; pv.style.display = 'block'; });
  });
  $('#e-del').addEventListener('click', function () {
    if (!editing) return;
    if (!confirm('Delete "' + editing.name + '"?')) return;
    S.recipes = S.recipes.filter(function (r) { return r.id !== editing.id; });
    delete sel[editing.id]; saveLocal(); render(); $('#editor').close(); if (cfg.token) push().catch(function () {});
  });
  $('#e-cancel').addEventListener('click', function () { $('#editor').close(); });
  $('#eform').addEventListener('submit', function (e) {
    e.preventDefault();
    var rec = {
      id: editing ? editing.id : uid(),
      emoji: $('#e-emoji').value.trim(),
      name: $('#e-name').value.trim(),
      ingredients: $('#e-ing').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      method: $('#e-method').value.trim(),
      img: pendingImg || null,
      edited: Date.now()
    };
    if (!rec.name) return;
    if (editing) S.recipes = S.recipes.map(function (r) { return r.id === rec.id ? rec : r; });
    else S.recipes.unshift(rec);
    saveLocal(); render(); $('#editor').close(); if (cfg.token) push().catch(function () {});
  });

  $('#settings').addEventListener('click', function () {
    $('#s-owner').value = cfg.owner; $('#s-repo').value = cfg.repo; $('#s-branch').value = cfg.branch; $('#s-token').value = cfg.token || '';
    $('#cfgdlg').showModal();
  });
  $('#s-save').addEventListener('click', function () {
    cfg = { owner: $('#s-owner').value.trim(), repo: $('#s-repo').value.trim(), branch: $('#s-branch').value.trim() || 'main', token: $('#s-token').value.trim() };
    localStorage.setItem(CFGKEY, JSON.stringify(cfg)); note('Settings saved.');
  });
  $('#s-pull').addEventListener('click', function () { note('Pulling…'); pull().catch(function (e) { note('Pull failed: ' + e.message); }); });
  $('#s-push').addEventListener('click', function () { note('Pushing…'); push().catch(function (e) { note('Push failed: ' + e.message); }); });
  $('#s-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'recipes.json'; a.click();
  });
  $('#s-import').addEventListener('click', function () { $('#s-file').click(); });
  $('#s-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d.recipes || !Array.isArray(d.recipes)) throw new Error('no recipes array');
        S = d; saveLocal(); render(); note('Imported ' + d.recipes.length + ' recipes.');
      } catch (err) { note('Import failed: ' + err.message); }
    };
    fr.readAsText(f);
  });

  /* ---------- start ---------- */
  if (!S.recipes || !S.recipes.length) {
    S = { v: 2, updated: 0, recipes: EXAMPLES.map(function (r) { r.id = uid(); return r; }) };
    saveLocal();
  }
  render();
  if (cfg.repo) pull().catch(function () { note('Offline — using the local copy.'); });
})();
