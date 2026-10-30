/* Recipes — read view.
Tapping a card opens the recipe to read (ingredients + method), not the editor.
Self-contained: reads the same localStorage cache app.js writes. */
(function () {
'use strict';

var KEY = 'recipes.v2', allowApp = false, dlg = null, current = null;

function recipes() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return (v && v.recipes) || []; }
  catch (e) { return []; }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
}
function find(id) {
  var list = recipes();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function cardEl(id) { return document.querySelector('.card[data-id="' + id + '"]'); }
function ticked(id) { var c = cardEl(id); return !!(c && c.classList.contains('sel')); }

function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.getElementById('view');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'view'; document.body.appendChild(dlg); }
  dlg.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'v-done') { dlg.close(); return; }
    if (b.id === 'v-edit') {
      var id = current;
      dlg.close();
      allowApp = true;
      var c = cardEl(id);
      if (c) c.click(); else allowApp = false;
      return;
    }
    if (b.id === 'v-tick') {
      var card = cardEl(current);
      var t = card && card.querySelector('[data-tick]');
      if (t) t.click();
      labelTick();
    }
  });
  return dlg;
}

function labelTick() {
  var b = dlg && dlg.querySelector('#v-tick');
  if (!b) return;
  var on = ticked(current);
  b.textContent = on ? 'Listed \u2713' : 'List';
  b.style.borderColor = on ? '#4a4130' : '';
  b.style.color = on ? 'var(--lime)' : '';
  b.style.whiteSpace = 'nowrap';
}

function open(id) {
  var r = find(id);
  if (!r) return;
  current = id;
  var d = ensureDialog();
  var ings = (r.ingredients || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
  d.innerHTML = '<div class="sheet">' +
    (r.img ? '<img class="vimg" src="' + esc(r.img) + '" alt="">' : '') +
    '<h2>' + (r.emoji ? esc(r.emoji) + ' ' : '') + esc(r.name) + '</h2>' +
    (ings ? '<div><div class="lbl">Ingredients</div><ul class="ving">' + ings + '</ul></div>' : '') +
    (r.method ? '<div><div class="lbl">Method</div><p class="vm">' + esc(r.method) + '</p></div>' : '') +
    '<div class="row"><button type="button" id="v-tick" class="ghost">List</button>' +
    '<button type="button" id="v-edit" class="ghost">Edit</button>' +
    '<button type="button" id="v-done" class="primary">Done</button></div></div>';
  labelTick();
  if (!d.open) d.showModal();
}

/* capture phase on the grid, so the app's own card handler never fires for a plain tap */
document.getElementById('grid').addEventListener('click', function (e) {
  if (allowApp) { allowApp = false; return; }
  var t = e.target.closest && e.target.closest('[data-tick]');
  if (t) return;
  var card = e.target.closest && e.target.closest('.card');
  if (!card) return;
  var id = card.getAttribute('data-id');
  if (!id) return;
  e.stopPropagation();
  e.preventDefault();
  open(id);
}, true);

})();
