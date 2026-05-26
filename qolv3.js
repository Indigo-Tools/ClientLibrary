/* QoL v3: command palette, smart search, notes, pins,
   similar clients, stats, QR, bulk actions, konami, schedule theme.
   Depends on globals from script.js. */

// ── Pins (separate from favorites; show at top) ──
const PINS_KEY = 'nyxora_pins_v1';
function loadPins() { try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]')); } catch { return new Set(); } }
function savePins(s) { try { localStorage.setItem(PINS_KEY, JSON.stringify([...s])); } catch {} }
let pinned = loadPins();
function togglePin(clientId, name) {
    if (pinned.has(clientId)) { pinned.delete(clientId); toast(`${name}: unpinned`, 'thumbtack-slash'); }
    else { pinned.add(clientId); toast(`${name}: pinned`, 'thumbtack'); }
    savePins(pinned);
    document.querySelectorAll(`[data-pin-id="${clientId}"]`).forEach(el => el.classList.toggle('active', pinned.has(clientId)));
}

// ── Per-client notes ──
const NOTES_KEY = 'nyxora_notes_v1';
function loadNotes() { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { return {}; } }
function saveNotes(o) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(o)); } catch {} }
function getNote(id) { return loadNotes()[id] || ''; }
function openNote(clientId, name) {
    const current = getNote(clientId);
    const updated = prompt(`Note for ${name}:`, current);
    if (updated === null) return;
    const all = loadNotes();
    if (updated.trim()) all[clientId] = updated.trim(); else delete all[clientId];
    saveNotes(all);
    toast(updated.trim() ? 'Note saved' : 'Note removed', 'note-sticky');
    document.querySelectorAll(`[data-note-id="${clientId}"]`).forEach(el => el.classList.toggle('has-note', !!updated.trim()));
}

// ── Smart search operators: tag:, version:, has: ──
function parseSearch(raw) {
    const ops = { tag: [], version: [], has: [] };
    let rest = raw;
    rest = rest.replace(/(tag|version|has):([^\s]+)/gi, (_, k, v) => { ops[k.toLowerCase()].push(v.toLowerCase()); return ''; });
    return { text: rest.trim().toLowerCase(), ops };
}
function matchesOps(client, ops) {
    const allTags = [...(client.tags || []), client.isPopular ? 'popular' : null, client.isOptifine ? 'optifine' : null].filter(Boolean);
    if (ops.tag.length && !ops.tag.every(t => allTags.includes(t))) return false;
    if (ops.version.length) {
        const cv = (client.compatVersions || []).map(v => v.replace('_', '.'));
        if (!ops.version.every(v => cv.includes(v))) return false;
    }
    for (const h of ops.has) {
        if (h === 'screenshots' && !(client.screenshots && client.screenshots.length)) return false;
        if (h === 'video' && !(client.screenshots && client.screenshots.some(s => s.type === 'video'))) return false;
        if (h === 'extensions' && !(client.extensions && client.extensions.length)) return false;
        if (h === 'notes' && !getNote(client.id)) return false;
        if (h === 'pinned' && !pinned.has(client.id)) return false;
        if (h === 'favorites' && !favorites.has(client.id)) return false;
    }
    return true;
}

// ── Similar clients (by tag/version overlap) ──
function similarClients(client, limit) {
    limit = limit || 5;
    const tags = new Set([...(client.tags || []), client.isOptifine ? 'optifine' : '', client.isPopular ? 'popular' : ''].filter(Boolean));
    return allClients
        .filter(c => c.id !== client.id)
        .map(c => {
            const otherTags = new Set([...(c.tags || []), c.isOptifine ? 'optifine' : '', c.isPopular ? 'popular' : ''].filter(Boolean));
            let overlap = 0; tags.forEach(t => { if (otherTags.has(t)) overlap++; });
            const versionMatch = (client.compatVersions || []).some(v => (c.compatVersions || []).includes(v)) ? 1 : 0;
            return { c, score: overlap * 2 + versionMatch };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(x => x.c);
}

// ── Command palette ──
function buildCmdkActions() {
    return [
        { id:'a:settings', label:'Open settings',         icon:'fa-gear',         run:openSettings },
        { id:'a:stats',    label:'Your library stats',    icon:'fa-chart-simple', run:openStats },
        { id:'a:help',     label:'Keyboard shortcuts',    icon:'fa-keyboard',     run:openHelp },
        { id:'a:random',   label:'Random client',         icon:'fa-shuffle',      run:randomClient },
        { id:'a:theme',    label:'Cycle theme',           icon:'fa-palette',      run:cycleTheme },
        { id:'a:filter',   label:'Toggle filter panel',   icon:'fa-filter',       run:toggleFilterPanel },
        { id:'a:expand',   label:'Expand / collapse all', icon:'fa-angles-down',  run:expandCollapseAll },
        { id:'a:clearfav', label:'Clear all filters',     icon:'fa-broom',        run:clearAllFilters },
        { id:'a:export',   label:'Export favorites',      icon:'fa-file-export',  run:exportFavorites },
        { id:'a:top',      label:'Jump to top',           icon:'fa-arrow-up',     run:function(){ window.scrollTo({top:0,behavior:'smooth'}); } },
        { id:'a:bottom',   label:'Jump to bottom',        icon:'fa-arrow-down',   run:function(){ window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); } },
        { id:'a:party',    label:'Party mode',            icon:'fa-champagne-glasses', run:partyMode },
    ];
}
function cmdkScore(text, lower) {
    if (!lower) return 1;
    const t = text.toLowerCase();
    if (t.startsWith(lower)) return 100;
    if (t.includes(lower)) return 50;
    let i = 0; for (const ch of lower) { i = t.indexOf(ch, i); if (i < 0) return 0; i++; } return 10;
}
function cmdkItems(q) {
    const items = [];
    const lower = q.toLowerCase().trim();
    buildCmdkActions().forEach(a => { const s = cmdkScore(a.label, lower); if (s) items.push(Object.assign({}, a, { _s: s, kind: 'action' })); });
    libraryTree.forEach(cat => { const s = cmdkScore(cat.displayName, lower); if (s) items.push({ id:`cat:${cat.name}`, label:`Category: ${cat.displayName}`, icon:'fa-layer-group', _s:s, kind:'cat', cat: cat.name }); });
    allClients.forEach(c => { const s = cmdkScore(c.displayName, lower); if (s) items.push({ id:`c:${c.id}`, label:c.displayName, icon:'fa-cube', _s:s, kind:'client', clientId:c.id }); });
    items.sort((a, b) => b._s - a._s);
    return items.slice(0, 50);
}
let cmdkIndex = 0;
function renderCmdk(q) {
    q = q || '';
    const list = document.getElementById('cmdk-list');
    if (!list) return;
    const items = cmdkItems(q);
    if (cmdkIndex >= items.length) cmdkIndex = Math.max(0, items.length - 1);
    list.innerHTML = items.length === 0
        ? '<div class="cmdk-empty">No matches</div>'
        : items.map((it, i) => `<div class="cmdk-item${i === cmdkIndex ? ' active' : ''}" data-i="${i}"><i class="fa-solid ${it.icon}"></i><span>${it.label}</span><span class="cmdk-kind">${it.kind}</span></div>`).join('');
    list.querySelectorAll('.cmdk-item').forEach(el => {
        el.addEventListener('mouseenter', function () { cmdkIndex = +el.dataset.i; list.querySelectorAll('.cmdk-item').forEach((e, i) => e.classList.toggle('active', i === cmdkIndex)); });
        el.addEventListener('click', function () { runCmdk(items[+el.dataset.i]); });
    });
    list._items = items;
}
function runCmdk(item) {
    if (!item) return;
    closeCmdK();
    if (item.kind === 'action') item.run();
    else if (item.kind === 'cat') switchCategory(item.cat);
    else if (item.kind === 'client') scrollToClient(item.clientId);
}
function openCmdK() {
    const m = document.getElementById('cmdk'); if (!m) return;
    m.classList.remove('hidden');
    const inp = document.getElementById('cmdk-input');
    inp.value = ''; cmdkIndex = 0; renderCmdk('');
    setTimeout(function () { inp.focus(); }, 30);
    document.body.style.overflow = 'hidden';
}
function closeCmdK() {
    document.getElementById('cmdk')?.classList.add('hidden');
    document.body.style.overflow = '';
}

// ── Stats dashboard ──
function openStats() {
    const grid = document.getElementById('stats-grid'); if (!grid) return;
    const counts = loadDlCounts();
    const totalDl = Object.values(counts).reduce((a, b) => a + b, 0);
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = topId ? allClients.find(c => c.id === topId) : null;
    const recents = loadRecent();
    const notesCount = Object.keys(loadNotes()).length;
    const items = [
        { i:'fa-star',              k:'Favorites',        v: favorites.size },
        { i:'fa-thumbtack',         k:'Pinned',           v: pinned.size },
        { i:'fa-download',          k:'Total downloads',  v: totalDl },
        { i:'fa-cube',              k:'Most downloaded',  v: top ? `${top.displayName} (${counts[topId]})` : '—' },
        { i:'fa-clock-rotate-left', k:'Recently viewed',  v: recents.length },
        { i:'fa-note-sticky',       k:'Notes saved',      v: notesCount },
        { i:'fa-magnifying-glass',  k:'Saved searches',   v: loadSearchHistory().length },
        { i:'fa-layer-group',       k:'Library size',     v: `${allClients.length} clients` },
    ];
    grid.innerHTML = items.map(it => `<div class="stat-card"><i class="fa-solid ${it.i}"></i><div class="stat-card-v">${it.v}</div><div class="stat-card-k">${it.k}</div></div>`).join('');
    document.getElementById('stats-modal').classList.add('active');
}
function closeStats() { document.getElementById('stats-modal')?.classList.remove('active'); }

// ── QR code share (public qrserver API) ──
function openQr(clientId, name) {
    const url = `${location.origin}${location.pathname}#client=${encodeURIComponent(clientId)}`;
    document.getElementById('qr-target').innerHTML = `<img alt="QR for ${name}" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}" width="240" height="240" loading="lazy">`;
    document.getElementById('qr-url').textContent = url;
    document.getElementById('qr-modal').classList.add('active');
}
function closeQr() { document.getElementById('qr-modal')?.classList.remove('active'); }

// ── Bulk actions on the currently-rendered set ──
function currentVisibleClients() {
    const ids = [...document.querySelectorAll('.client-block')].map(el => el.id.replace(/^block-/, ''));
    return allClients.filter(c => ids.indexOf(c.id) !== -1);
}
function updateBulkBar() {
    const bar = document.getElementById('bulk-bar'); if (!bar) return;
    const ops = window._lastSearchOps || { tag:[], version:[], has:[] };
    const opsActive = ops.tag.length + ops.version.length + ops.has.length > 0;
    const hasFilter = !!currentQuery || prefs.tagFilters.length > 0 || opsActive;
    const list = currentVisibleClients();
    if (hasFilter && list.length > 1) {
        bar.classList.remove('hidden');
        document.getElementById('bulk-count').textContent = `${list.length} shown`;
    } else bar.classList.add('hidden');
}
function bulkFavoriteAll() {
    const list = currentVisibleClients();
    list.forEach(c => favorites.add(c.id));
    saveFavorites();
    renderTabs();
    document.querySelectorAll('[data-fav-id]').forEach(el => el.classList.toggle('active', favorites.has(el.dataset.favId)));
    toast(`${list.length} favorited`, 'star');
}
function bulkOpenAll() {
    const list = currentVisibleClients();
    const urls = list.flatMap(c => [...c.files, ...c.extensions].map(f => getMonetizedUrl(f.url)));
    if (urls.length > 8 && !confirm(`Open ${urls.length} downloads?`)) return;
    urls.forEach((u, i) => setTimeout(() => window.open(u, '_blank', 'noopener'), i * 80));
}
function bulkCopyLinks() {
    const list = currentVisibleClients();
    const urls = list.flatMap(c => [...c.files, ...c.extensions].map(f => getMonetizedUrl(f.url)));
    copyText(urls.join('\n'), `Copied ${urls.length} links`);
}

// ── Konami code → party mode ──
let _konamiBuf = '';
const _KONAMI = 'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba';
function partyMode() {
    const keys = Object.keys(ACCENT_COLORS);
    let idx = 0;
    const id = setInterval(() => { setAccent(keys[idx++ % keys.length]); }, 250);
    setTimeout(() => clearInterval(id), 4000);
    const colors = ['#6c5ce7', '#3b82f6', '#14b8a6', '#f43f5e', '#f59e0b', '#10b981'];
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'confetti';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDelay = (Math.random() * 0.6) + 's';
        el.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }
    toast('Party mode!', 'champagne-glasses');
}

// ── Global key + input wiring ──
document.addEventListener('keydown', (e) => {
    if (!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        _konamiBuf = (_konamiBuf + e.key).slice(-_KONAMI.length);
        if (_konamiBuf === _KONAMI) { _konamiBuf = ''; partyMode(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdK(); return; }

    const m = document.getElementById('cmdk');
    if (m && !m.classList.contains('hidden')) {
        const list = document.getElementById('cmdk-list');
        const items = (list && list._items) || [];
        if (e.key === 'Escape') { e.preventDefault(); closeCmdK(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); cmdkIndex = Math.min(cmdkIndex + 1, items.length - 1); renderCmdk(document.getElementById('cmdk-input').value); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); cmdkIndex = Math.max(cmdkIndex - 1, 0); renderCmdk(document.getElementById('cmdk-input').value); }
        else if (e.key === 'Enter')     { e.preventDefault(); runCmdk(items[cmdkIndex]); }
        return;
    }

    if (e.key === '.' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        if (!document.querySelector('.help-modal.active')) { e.preventDefault(); openStats(); }
    }
    if (e.key === 'Escape') {
        if (document.getElementById('stats-modal')?.classList.contains('active')) closeStats();
        if (document.getElementById('qr-modal')?.classList.contains('active')) closeQr();
    }
});
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'cmdk-input') renderCmdk(e.target.value);
});

// ── Inject extra actions (pin/note/qr) into each client header ──
function decorateClientActions() {
    document.querySelectorAll('.client-actions[data-client-id]').forEach(actions => {
        if (actions.dataset.qolv3) return;
        actions.dataset.qolv3 = '1';
        const id = actions.dataset.clientId;
        const block = document.getElementById('block-' + id);
        const nameEl = block?.querySelector('.client-name');
        const name = nameEl ? nameEl.textContent.replace(/\s*\d+$/, '').trim() : id;
        const safe = (name || '').replace(/'/g, "\\'");
        const isPin = pinned.has(id);
        const hasNote = !!getNote(id);
        const html = `
            <button class="action-icon pin-btn ${isPin ? 'active' : ''}" data-pin-id="${id}" onclick="togglePin('${id}','${safe}')" title="Pin to top"><i class="fa-solid fa-thumbtack"></i></button>
            <button class="action-icon note-btn ${hasNote ? 'has-note' : ''}" data-note-id="${id}" onclick="openNote('${id}','${safe}')" title="Personal note"><i class="fa-solid fa-note-sticky"></i></button>
            <button class="action-icon qr-btn" onclick="openQr('${id}','${safe}')" title="QR code"><i class="fa-solid fa-qrcode"></i></button>
        `;
        // insert before the share button (icon link)
        const shareBtn = actions.querySelector('button[onclick^="shareClient"]');
        if (shareBtn) shareBtn.insertAdjacentHTML('beforebegin', html);
        else actions.insertAdjacentHTML('afterbegin', html);
    });

    // Inject "Similar" strip into open details when they have a similar-section placeholder
    document.querySelectorAll('.details-inner').forEach(panel => {
        if (panel.dataset.simInjected) return;
        const block = panel.closest('.client-block');
        const id = block?.id?.replace(/^block-/, ''); if (!id) return;
        const client = allClients.find(c => c.id === id); if (!client) return;
        const sims = similarClients(client, 5);
        if (sims.length === 0) return;
        panel.dataset.simInjected = '1';
        const html = `<div class="similar-strip"><span class="similar-label"><i class="fa-solid fa-shuffle"></i> Similar clients</span><div class="similar-list">${sims.map(s => `<button class="similar-chip" onclick="scrollToClient('${s.id}')">${s.iconUrl?`<img src="${s.iconUrl}" alt="" loading="lazy">`:'<i class="fa-solid fa-cube"></i>'}<span>${s.displayName}</span></button>`).join('')}</div></div>`;
        panel.insertAdjacentHTML('beforeend', html);
    });

    // Sort: pinned clients first within their category
    if (pinned.size > 0) {
        document.querySelectorAll('.category-group').forEach(group => {
            const blocks = [...group.querySelectorAll('.client-block')];
            blocks.sort((a, b) => {
                const ap = pinned.has(a.id.replace(/^block-/,'')) ? 0 : 1;
                const bp = pinned.has(b.id.replace(/^block-/,'')) ? 0 : 1;
                return ap - bp;
            });
            blocks.forEach(el => group.appendChild(el));
        });
    }

    // Inline note display
    Object.entries(loadNotes()).forEach(([id, text]) => {
        const block = document.getElementById('block-' + id); if (!block) return;
        if (block.querySelector('.client-note-inline')) return;
        const body = block.querySelector('.client-body-inner');
        if (body) body.insertAdjacentHTML('afterbegin', `<div class="client-note-inline"><i class="fa-solid fa-note-sticky"></i><span>${text.replace(/</g,'&lt;')}</span><button class="note-edit" onclick="openNote('${id}','')"><i class="fa-solid fa-pen"></i></button></div>`);
    });
}

// ── Patch renderClients to also run decorators + bulk bar + smart-search ──
(function patchRender() {
    const originalRender = window.renderClients;
    if (!originalRender) return;
    let lastQuery = '';
    window.renderClients = function (query) {
        // Strip operator tokens from text before delegating
        const parsed = parseSearch(query || '');
        window._lastSearchOps = parsed.ops;
        const r = originalRender(parsed.text);
        // Apply ops filter after the fact: hide non-matching blocks
        if (parsed.ops.tag.length + parsed.ops.version.length + parsed.ops.has.length > 0) {
            document.querySelectorAll('.client-block').forEach(el => {
                const id = el.id.replace(/^block-/, '');
                const c = allClients.find(x => x.id === id);
                if (c && !matchesOps(c, parsed.ops)) el.remove();
            });
            // Remove now-empty groups
            document.querySelectorAll('.category-group').forEach(g => { if (!g.querySelector('.client-block')) g.remove(); });
        }
        decorateClientActions();
        updateBulkBar();
        return r;
    };
})();

// Re-decorate after init paints (delay a tick after main becomes visible)
const _origInit = window.init;
if (typeof _origInit === 'function') {
    // can't easily wrap async init that's already running; use mutation observer instead
    const mo = new MutationObserver(() => { decorateClientActions(); updateBulkBar(); });
    document.addEventListener('DOMContentLoaded', () => {
        const c = document.getElementById('client-container');
        if (c) mo.observe(c, { childList: true });
    });
}
