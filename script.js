const GITHUB_ORG = 'Indigo-Tools';
const REPO_NAME = 'ClientLibrary';
const BRANCH = 'main';
const BASE_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_ORG}/${REPO_NAME}/${BRANCH}`;

const USE_MONETIZATION = true; 
const LINKVERTISE_USER_ID = 499358;

let libraryTree = [];
let allClients = [];
let currentCategory = "ALL";
let allExpanded = true;
let dropdownIndex = -1;
const CATEGORY_ORDER = ["ALL", "Popular Clients", "Creators", "Optifine Packs"];
const TAG_ICONS = { working: 'fa-check-circle', legacy: 'fa-history', trash: 'fa-trash' };

let currentScreenshots = [];
let currentScreenshotIndex = 0;
let isZoomed = false;

// ── QoL: Preferences & favorites ──
const PREFS_KEY = 'nyxora_prefs_v1';
const FAVS_KEY = 'nyxora_favs_v1';
const DEFAULT_PREFS = {
    theme: 'auto', sort: 'name-asc', tagFilters: [], category: 'ALL',
    language: 'en', accent: 'violet', density: 'cozy', motion: 'auto',
    recentlyViewed: [], searchHistory: [],
};
const RECENT_KEY = 'nyxora_recent_v1';
const SEARCH_HIST_KEY = 'nyxora_searches_v1';
const ACCENT_COLORS = {
    violet: { name: 'Violet', main: '#6c5ce7', light: '#7c6df0' },
    blue:   { name: 'Blue',   main: '#3b82f6', light: '#60a5fa' },
    teal:   { name: 'Teal',   main: '#14b8a6', light: '#2dd4bf' },
    rose:   { name: 'Rose',   main: '#f43f5e', light: '#fb7185' },
    amber:  { name: 'Amber',  main: '#f59e0b', light: '#fbbf24' },
    emerald:{ name: 'Emerald',main: '#10b981', light: '#34d399' },
};
let prefs = loadPrefs();
let favorites = loadFavorites();
let currentQuery = '';
let kbFocusIndex = -1;

const SORT_OPTIONS = [
    { id: 'name-asc',          tKey: 'sort_name_asc',     icon: 'fa-arrow-down-a-z' },
    { id: 'name-desc',         tKey: 'sort_name_desc',    icon: 'fa-arrow-down-z-a' },
    { id: 'files-desc',        tKey: 'sort_files',        icon: 'fa-file-arrow-down' },
    { id: 'screenshots-desc',  tKey: 'sort_screenshots',  icon: 'fa-images' },
    { id: 'extensions-desc',   tKey: 'sort_extensions',   icon: 'fa-puzzle-piece' },
];

const TAG_FILTERS = [
    { id: 'favorites',       tKey: 'favorites',       icon: 'fa-star' },
    { id: 'popular',         tKey: 'popular',         icon: 'fa-star' },
    { id: 'optifine',        tKey: 'optifine',        icon: 'fa-bolt' },
    { id: 'working',         tKey: 'working',         icon: 'fa-check-circle' },
    { id: 'legacy',          tKey: 'legacy',          icon: 'fa-history' },
    { id: 'trash',           tKey: 'trash',           icon: 'fa-trash' },
    { id: 'has-screenshots', tKey: 'has_screenshots', icon: 'fa-images' },
    { id: 'has-extensions',  tKey: 'has_extensions',  icon: 'fa-puzzle-piece' },
];

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
        if (!saved) {
            const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
            const defaults = { ...DEFAULT_PREFS };
            if (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[browserLang]) defaults.language = browserLang;
            return defaults;
        }
        return { ...DEFAULT_PREFS, ...saved };
    } catch { return { ...DEFAULT_PREFS }; }
}

// ── QoL: i18n ──
function t(key, params) {
    const dict = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[prefs.language]) ? TRANSLATIONS[prefs.language] : (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS.en : null);
    let s = (dict && dict[key]) || (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS.en && TRANSLATIONS.en[key]) || key;
    if (params) for (const k in params) s = s.replace('{' + k + '}', params[k]);
    return s;
}
function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-attr]').forEach(el => {
        const [attr, key] = el.dataset.tAttr.split('|');
        el.setAttribute(attr, t(key));
    });
    const si = document.getElementById('search-input');
    if (si) si.placeholder = t('search_placeholder');
}
function setLanguage(code) {
    if (!TRANSLATIONS[code]) return;
    prefs.language = code;
    savePrefs();
    applyTranslations();
    if (allClients.length > 0) {
        renderTabs();
        renderStats();
        renderFilterChips();
        renderClients(currentQuery);
        renderRecentlyViewed();
    }
}

// ── QoL: Recently viewed ──
function loadRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(arr) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, 10))); } catch {} }
function trackRecentlyViewed(clientId) {
    let arr = loadRecent().filter(id => id !== clientId);
    arr.unshift(clientId);
    saveRecent(arr);
    renderRecentlyViewed();
}
function renderRecentlyViewed() {
    let el = document.getElementById('recently-viewed');
    const ids = loadRecent();
    const main = document.getElementById('main-content');
    if (!main) return;
    const items = ids.map(id => allClients.find(c => c.id === id)).filter(Boolean).slice(0, 10);
    if (items.length === 0) {
        el?.remove();
        return;
    }
    if (!el) {
        el = document.createElement('div');
        el.id = 'recently-viewed';
        el.className = 'recently-viewed';
        const target = document.getElementById('client-container');
        target.parentNode.insertBefore(el, target);
    }
    el.innerHTML = `<span class="recently-viewed-label"><i class="fa-solid fa-clock-rotate-left"></i> ${t('recently_viewed')}</span>
        <div class="recently-viewed-strip">${items.map(c => `
            <button class="recently-chip" onclick="scrollToClient('${c.id}')">
                ${c.iconUrl ? `<img src="${c.iconUrl}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></span>'">` : `<span class="icon-placeholder"><i class="fa-solid fa-cube"></i></span>`}
                <span>${c.displayName}</span>
            </button>`).join('')}</div>`;
}

// ── QoL: Search history ──
function loadSearchHistory() { try { return JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || '[]'); } catch { return []; } }
function saveSearchHistory(arr) { try { localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(arr.slice(0, 5))); } catch {} }
function recordSearch(q) {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    let arr = loadSearchHistory().filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    arr.unshift(trimmed);
    saveSearchHistory(arr);
}
function clearSearchHistory() {
    saveSearchHistory([]);
    const si = document.getElementById('search-input');
    if (si && !si.value) {
        const dd = document.getElementById('search-dropdown');
        dd.classList.add('hidden');
    }
    toast(t('toast_filters_cleared'), 'broom');
}
function renderSearchHistory() {
    const dropdown = document.getElementById('search-dropdown');
    const hist = loadSearchHistory();
    if (hist.length === 0) return false;
    dropdown.innerHTML = `<div class="search-history-header">
        <span><i class="fa-solid fa-clock-rotate-left"></i> ${t('recently_viewed')}</span>
        <button class="search-history-clear" onclick="event.stopPropagation();clearSearchHistory()">${t('clear_all')}</button>
    </div>` + hist.map(q => `
        <div class="search-history-item" onclick="useHistoryQuery('${escapeAttr(q)}')">
            <i class="fa-solid fa-clock-rotate-left"></i><span>${q}</span>
        </div>`).join('');
    dropdown.classList.remove('hidden');
    return true;
}
function useHistoryQuery(q) {
    const si = document.getElementById('search-input');
    si.value = q;
    si.dispatchEvent(new Event('input'));
    si.focus();
}

// ── QoL: Accent / density / motion ──
function applyAccent() {
    const c = ACCENT_COLORS[prefs.accent] || ACCENT_COLORS.violet;
    const root = document.documentElement.style;
    root.setProperty('--accent', c.main);
    root.setProperty('--accent-light', c.light);
    root.setProperty('--accent-dim', hexToRgba(c.main, 0.12));
    root.setProperty('--accent-glow', hexToRgba(c.main, 0.35));
    root.setProperty('--border-hover', hexToRgba(c.main, 0.3));
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = c.main;
}
function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function setAccent(key) {
    if (!ACCENT_COLORS[key]) return;
    prefs.accent = key;
    savePrefs();
    applyAccent();
    renderAccentSwatches();
}
function applyDensity() { document.documentElement.dataset.density = prefs.density; }
function setDensity(d) { prefs.density = d; savePrefs(); applyDensity(); renderSettingsSegmented(); }
function applyMotion() {
    if (prefs.motion === 'reduce') document.documentElement.dataset.motion = 'reduce';
    else if (prefs.motion === 'full') document.documentElement.dataset.motion = 'full';
    else document.documentElement.removeAttribute('data-motion');
}
function toggleReducedMotion() {
    prefs.motion = (prefs.motion === 'reduce') ? 'auto' : 'reduce';
    savePrefs();
    applyMotion();
    document.getElementById('setting-motion')?.classList.toggle('on', prefs.motion === 'reduce');
}

// ── QoL: Settings modal renderers ──
function renderLanguageSelect() {
    const sel = document.getElementById('setting-language');
    if (!sel) return;
    sel.innerHTML = LANGUAGE_LIST.map(l => `<option value="${l.code}" ${l.code === prefs.language ? 'selected' : ''}>${l.name}</option>`).join('');
}
function renderAccentSwatches() {
    const wrap = document.getElementById('setting-accent');
    if (!wrap) return;
    wrap.innerHTML = Object.entries(ACCENT_COLORS).map(([k, c]) =>
        `<button class="accent-swatch ${k === prefs.accent ? 'active' : ''}" style="background:${c.main}" onclick="setAccent('${k}')" aria-label="${c.name}" title="${c.name}"></button>`
    ).join('');
}
function renderSettingsSegmented() {
    const themes = [['auto', t('theme_auto')], ['dark', t('theme_dark')], ['light', t('theme_light')]];
    const densities = [['cozy', t('density_cozy')], ['compact', t('density_compact')]];
    const th = document.getElementById('setting-theme');
    const de = document.getElementById('setting-density');
    if (th) th.innerHTML = themes.map(([v, lbl]) => `<button onclick="setThemePref('${v}')" class="${prefs.theme === v ? 'active' : ''}">${lbl}</button>`).join('');
    if (de) de.innerHTML = densities.map(([v, lbl]) => `<button onclick="setDensity('${v}')" class="${prefs.density === v ? 'active' : ''}">${lbl}</button>`).join('');
    document.getElementById('setting-motion')?.classList.toggle('on', prefs.motion === 'reduce');
}
function setThemePref(v) { prefs.theme = v; savePrefs(); applyTheme(); renderSettingsSegmented(); }
function openSettings() {
    renderLanguageSelect();
    renderAccentSwatches();
    renderSettingsSegmented();
    document.getElementById('settings-modal').classList.add('active');
}
function closeSettings() { document.getElementById('settings-modal').classList.remove('active'); }

// ── QoL: Export / import favorites ──
function exportFavorites() {
    const data = { version: 1, favorites: [...favorites], exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nyxora-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(t('toast_favs_exported'), 'file-export');
}
function importFavorites(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            const list = Array.isArray(data) ? data : (data.favorites || []);
            if (!Array.isArray(list)) throw new Error('bad format');
            list.forEach(id => favorites.add(id));
            saveFavorites();
            renderTabs();
            if (currentCategory === '__favorites__') renderClients(currentQuery);
            document.querySelectorAll('[data-fav-id]').forEach(el => el.classList.toggle('active', favorites.has(el.dataset.favId)));
            toast(t('toast_favs_imported'), 'file-import');
        } catch {
            toast(t('toast_import_failed'), 'triangle-exclamation');
        }
    };
    reader.readAsText(file);
}

// ── QoL: Markdown renderer (minimal but safe) ──
function renderMarkdown(text) {
    if (!text) return '';
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = esc(text).split('\n');
    const out = [];
    let inList = false;
    for (let raw of lines) {
        let l = raw.trimEnd();
        const hMatch = l.match(/^(#{1,3})\s+(.*)$/);
        if (hMatch) {
            if (inList) { out.push('</ul>'); inList = false; }
            const n = hMatch[1].length;
            out.push(`<h${n}>${formatInline(hMatch[2])}</h${n}>`);
            continue;
        }
        if (/^[-*]\s+/.test(l)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${formatInline(l.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }
        if (inList) { out.push('</ul>'); inList = false; }
        if (l.trim() === '') { out.push(''); continue; }
        out.push(`<p>${formatInline(l)}</p>`);
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
}
function formatInline(s) {
    return s
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/(?<!["=>])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// ── QoL: Open all downloads ──
function openAllDownloads(urlsJson) {
    let urls;
    try { urls = JSON.parse(decodeURIComponent(urlsJson)); } catch { return; }
    if (!Array.isArray(urls) || urls.length === 0) return;
    if (urls.length > 6 && !confirm(`Open ${urls.length} downloads in new tabs?`)) return;
    urls.forEach((u, i) => setTimeout(() => window.open(u, '_blank', 'noopener'), i * 120));
}

// ── QoL: Animated counters ──
function animateCount(el, to, durationMs = 700) {
    const from = 0;
    const start = performance.now();
    el.classList.add('counting');
    const tick = (now) => {
        const p = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
        else { el.textContent = to; el.classList.remove('counting'); }
    };
    requestAnimationFrame(tick);
}

// ── QoL: Touch swipe on screenshot modal ──
function attachSwipeOnScreenshots() {
    const target = document.querySelector('#screenshots-modal .screenshot-main-container');
    if (!target) return;
    let sx = 0, sy = 0, active = false;
    target.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { active = false; return; }
        sx = e.touches[0].clientX; sy = e.touches[0].clientY; active = true;
    }, { passive: true });
    target.addEventListener('touchend', (e) => {
        if (!active) return;
        const dx = (e.changedTouches[0].clientX - sx);
        const dy = (e.changedTouches[0].clientY - sy);
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) nextScreenshot(); else prevScreenshot();
        }
        active = false;
    }, { passive: true });
}
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }
function loadFavorites() {
    try { return new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]')); }
    catch { return new Set(); }
}
function saveFavorites() { try { localStorage.setItem(FAVS_KEY, JSON.stringify([...favorites])); } catch {} }

// ── QoL: Theme ──
function applyTheme() {
    const mode = prefs.theme === 'auto'
        ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : prefs.theme;
    document.documentElement.dataset.theme = mode;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const icons = { auto: 'fa-circle-half-stroke', dark: 'fa-moon', light: 'fa-sun' };
        btn.innerHTML = `<i class="fa-solid ${icons[prefs.theme]}"></i>`;
        btn.title = `Theme: ${prefs.theme} (T to cycle)`;
    }
}
function cycleTheme() {
    const order = ['auto', 'dark', 'light'];
    prefs.theme = order[(order.indexOf(prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
    const label = { auto: t('theme_auto'), dark: t('theme_dark'), light: t('theme_light') }[prefs.theme];
    toast(`${t('toast_theme')}: ${label}`, 'palette');
    renderSettingsSegmented();
}

// ── QoL: Toast ──
function toast(message, icon = 'circle-check') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${message}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 250);
    }, 2200);
}

// ── QoL: Copy + share ──
async function copyText(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        toast(label || t('toast_copied'), 'copy');
    } catch {
        toast('Copy failed', 'triangle-exclamation');
    }
}
function copyFilename(name) { copyText(name, `${t('toast_copied')}: ${name}`); }
function copyDownload(url) { copyText(url, t('toast_link_copied')); }
function shareClient(clientId, name) {
    const url = `${location.origin}${location.pathname}#client=${encodeURIComponent(clientId)}`;
    copyText(url, t('toast_link_copied'));
}

// ── QoL: Favorites ──
function toggleFavorite(clientId, name) {
    if (favorites.has(clientId)) {
        favorites.delete(clientId);
        toast(`${name}: ${t('toast_removed_fav')}`, 'star-half-stroke');
    } else {
        favorites.add(clientId);
        toast(`${name}: ${t('toast_added_fav')}`, 'star');
    }
    saveFavorites();
    document.querySelectorAll(`[data-fav-id="${clientId}"]`).forEach(el => {
        el.classList.toggle('active', favorites.has(clientId));
    });
    renderTabs();
    if (currentCategory === '__favorites__') renderClients(currentQuery);
}

// ── QoL: Random ──
function randomClient() {
    if (allClients.length === 0) return;
    const c = allClients[Math.floor(Math.random() * allClients.length)];
    scrollToClient(c.id);
    toast(`${t('toast_random')}: ${c.displayName}`, 'shuffle');
}

// ── QoL: Sort + filter ──
function applySortFilter(clients) {
    const tagFilters = prefs.tagFilters;
    let arr = clients;
    if (tagFilters.length > 0) {
        arr = arr.filter(c => tagFilters.every(t => {
            if (t === 'favorites')       return favorites.has(c.id);
            if (t === 'popular')         return c.isPopular;
            if (t === 'optifine')        return c.isOptifine;
            if (t === 'has-screenshots') return c.screenshots && c.screenshots.length > 0;
            if (t === 'has-extensions')  return c.extensions && c.extensions.length > 0;
            return c.tags.includes(t);
        }));
    }
    const sortFn = {
        'name-asc':         (a, b) => a.displayName.localeCompare(b.displayName),
        'name-desc':        (a, b) => b.displayName.localeCompare(a.displayName),
        'files-desc':       (a, b) => (b.files.length + b.extensions.length) - (a.files.length + a.extensions.length),
        'screenshots-desc': (a, b) => (b.screenshots?.length || 0) - (a.screenshots?.length || 0),
        'extensions-desc':  (a, b) => b.extensions.length - a.extensions.length,
    }[prefs.sort] || ((a, b) => a.displayName.localeCompare(b.displayName));
    return [...arr].sort(sortFn);
}

// ── QoL: Toolbar menus ──
function renderSortMenu() {
    const menu = document.getElementById('sort-menu');
    if (!menu) return;
    menu.innerHTML = SORT_OPTIONS.map(o => `
        <button onclick="setSort('${o.id}')" class="${prefs.sort === o.id ? 'active' : ''}" role="menuitem">
            <i class="fa-solid ${o.icon}"></i><span>${t(o.tKey)}</span><i class="fa-solid fa-check"></i>
        </button>`).join('');
}
function toggleSortMenu(e) {
    e?.stopPropagation();
    const menu = document.getElementById('sort-menu');
    renderSortMenu();
    menu.classList.toggle('hidden');
}
function setSort(id) {
    prefs.sort = id;
    savePrefs();
    document.getElementById('sort-menu').classList.add('hidden');
    renderClients(currentQuery);
}

function renderFilterChips() {
    const wrap = document.getElementById('filter-chips');
    if (!wrap) return;
    wrap.innerHTML = TAG_FILTERS.map(f => {
        const active = prefs.tagFilters.includes(f.id);
        return `<button class="filter-chip ${active ? 'active' : ''}" onclick="toggleTagFilter('${f.id}')"><i class="fa-solid ${f.icon}"></i>${t(f.tKey)}</button>`;
    }).join('');
    const badge = document.getElementById('filter-badge');
    const clear = document.getElementById('clear-filters');
    if (prefs.tagFilters.length > 0) {
        badge.textContent = prefs.tagFilters.length;
        badge.classList.remove('hidden');
        clear.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
        clear.classList.add('hidden');
    }
}
function toggleFilterPanel() {
    document.getElementById('filter-panel').classList.toggle('hidden');
}
function toggleTagFilter(id) {
    const i = prefs.tagFilters.indexOf(id);
    if (i >= 0) prefs.tagFilters.splice(i, 1);
    else prefs.tagFilters.push(id);
    savePrefs();
    renderFilterChips();
    renderClients(currentQuery);
}
function toggleTagFilterFromTag(tag) {
    document.getElementById('filter-panel')?.classList.remove('hidden');
    toggleTagFilter(tag);
}
function clearAllFilters() {
    prefs.tagFilters = [];
    savePrefs();
    renderFilterChips();
    renderClients(currentQuery);
    toast(t('toast_filters_cleared'), 'broom');
}

// ── QoL: Help modal ──
function openHelp() { document.getElementById('help-modal').classList.add('active'); }
function closeHelp() { document.getElementById('help-modal').classList.remove('active'); }

// ── QoL: Hash routing ──
function applyHashOnce() {
    const hash = location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const cat = params.get('cat');
    const client = params.get('client');
    if (cat && libraryTree.some(c => c.name === cat)) {
        switchCategory(cat);
    }
    if (client) {
        setTimeout(() => scrollToClient(client), 350);
    }
}

// ── QoL: Keyboard navigation across cards ──
function moveKbFocus(delta) {
    const blocks = Array.from(document.querySelectorAll('.client-block'));
    if (blocks.length === 0) return;
    kbFocusIndex = Math.max(0, Math.min(blocks.length - 1, (kbFocusIndex < 0 ? 0 : kbFocusIndex + delta)));
    blocks.forEach((b, i) => b.classList.toggle('kb-focused', i === kbFocusIndex));
    blocks[kbFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getMonetizedUrl(targetUrl) {
    if (!USE_MONETIZATION || !LINKVERTISE_USER_ID) return targetUrl;
    try {
        const encoded = encodeURIComponent(btoa(encodeURI(targetUrl)));
        const random = Math.random() * 1000;
        return `https://link-to.net/${LINKVERTISE_USER_ID}/${random}/dynamic/?r=${encoded}`;
    } catch (e) {
        console.error("Monetization failed for:", targetUrl, e);
        return targetUrl;
    }
}

function formatName(name) {
    if (!name) return "";
    return name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function formatFileSize(bytes) {
    if (!bytes) return null;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// ── Toggle helpers (no full re-render) ──

function toggleClientCollapse(clientId) {
    const body = document.getElementById(`body-${clientId}`);
    if (!body) return;
    body.classList.toggle('collapsed');
    const btn = document.getElementById(`collapse-btn-${clientId}`);
    if (btn) {
        const c = body.classList.contains('collapsed');
        const lbl = c ? (typeof t === 'function' ? t('expand_all').replace(/\s.+/, '') : 'Expand') : (typeof t === 'function' ? t('collapse_all').replace(/\s.+/, '') : 'Collapse');
        btn.innerHTML = `<i class="fa-solid fa-chevron-${c ? 'down' : 'up'}"></i><span class="hide-mobile">${lbl}</span>`;
    }
}

function toggleDescription(clientId) {
    const panel = document.getElementById(`details-${clientId}`);
    const btn = document.getElementById(`details-btn-${clientId}`);
    if (!panel || !btn) return;
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    btn.classList.toggle('open');
    btn.innerHTML = `${opening ? t('hide_details') : t('show_details')} <i class="fa-solid fa-chevron-down"></i>`;
}

function toggleDropdown(clientId) {
    const header = document.getElementById(`ext-header-${clientId}`);
    const body = document.getElementById(`ext-body-${clientId}`);
    if (!header || !body) return;
    header.classList.toggle('open');
    body.classList.toggle('open');
}

function toggleFileList(clientId) {
    const hidden = document.querySelectorAll(`.file-hidden-${clientId}`);
    const btn = document.getElementById(`more-btn-${clientId}`);
    if (!btn) return;
    const showing = hidden[0]?.style.display !== 'none';
    hidden.forEach(el => el.style.display = showing ? 'none' : '');
    btn.innerHTML = showing
        ? `<i class="fa-solid fa-angles-down"></i>${t('show_more', { n: hidden.length })}`
        : `<i class="fa-solid fa-angles-up"></i>${t('show_less')}`;
}

function expandCollapseAll() {
    const bodies = document.querySelectorAll('.client-body');
    const btn = document.getElementById('expand-all-btn');
    if (allExpanded) {
        bodies.forEach(b => b.classList.add('collapsed'));
        document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
            b.innerHTML = `<i class="fa-solid fa-chevron-down"></i><span class="hide-mobile">${t('expand_all').replace(/\s.+/, '')}</span>`;
        });
        btn.innerHTML = `<i class="fa-solid fa-angles-up"></i><span>${t('collapse_all')}</span>`;
    } else {
        bodies.forEach(b => b.classList.remove('collapsed'));
        document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
            b.innerHTML = `<i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">${t('collapse_all').replace(/\s.+/, '')}</span>`;
        });
        btn.innerHTML = `<i class="fa-solid fa-angles-down"></i><span>${t('expand_all')}</span>`;
    }
    allExpanded = !allExpanded;
}

// ── Search (single-pass for both results + count) ──

function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) + '<span class="search-highlight">' + text.slice(idx, idx + query.length) + '</span>' + text.slice(idx + query.length);
}

function searchClients(query, limit) {
    const q = query.toLowerCase().trim();
    if (!q) return { results: [], total: 0 };

    const results = [];
    let total = 0;

    for (const cat of libraryTree) {
        for (const client of cat.clients) {
            if (client._search.includes(q)) {
                total++;
                if (results.length < limit) {
                    results.push({
                        id: client.id,
                        name: client.displayName,
                        icon: client.iconUrl,
                        category: cat.displayName,
                        fileCount: client.files.length + client.extensions.length,
                        tags: client.tags,
                        isPopular: client.isPopular,
                        isOptifine: client.isOptifine
                    });
                }
            }
        }
    }
    return { results, total };
}

function renderSearchDropdown(query) {
    const dropdown = document.getElementById('search-dropdown');
    const clearBtn = document.getElementById('search-clear');
    const countEl = document.getElementById('search-results-count');
    const q = query.trim();

    if (!q) {
        dropdown.classList.add('hidden');
        clearBtn.classList.add('hidden');
        countEl.classList.add('hidden');
        dropdownIndex = -1;
        return;
    }

    clearBtn.classList.remove('hidden');

    const { results, total } = searchClients(q, 8);

    if (total > 0) {
        countEl.textContent = `${total} found`;
        countEl.classList.remove('hidden');
    } else {
        countEl.classList.add('hidden');
    }

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-hint"><i class="fa-solid fa-search" style="margin-right:0.4rem"></i>No clients match your search</div>';
        dropdown.classList.remove('hidden');
        dropdownIndex = -1;
        return;
    }

    dropdown.innerHTML = results.map((r, i) => `
        <div class="search-dropdown-item${i === dropdownIndex ? ' focused' : ''}" data-client-id="${r.id}" onclick="scrollToClient('${r.id}')">
            ${r.icon
                ? `<img src="${r.icon}" class="search-dropdown-icon" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'search-dropdown-icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></div>'">`
                : '<div class="search-dropdown-icon-placeholder"><i class="fa-solid fa-cube"></i></div>'
            }
            <div class="search-dropdown-info">
                <div class="search-dropdown-name">${highlightMatch(r.name, q)}</div>
                <div class="search-dropdown-meta">
                    <span>${r.category}</span>
                    <span>${r.fileCount} file${r.fileCount !== 1 ? 's' : ''}</span>
                    ${r.isPopular ? '<span class="search-dropdown-badge" style="color:#fbbf24;background:rgba(251,191,36,0.1)">Popular</span>' : ''}
                    ${r.isOptifine ? '<span class="search-dropdown-badge" style="color:#34d399;background:rgba(52,211,153,0.1)">Optifine</span>' : ''}
                </div>
            </div>
            <i class="fa-solid fa-arrow-right" style="color:var(--text-dim);font-size:0.6875rem;flex-shrink:0"></i>
        </div>
    `).join('') + (total > results.length ? `<div class="search-dropdown-hint">Showing ${results.length} of ${total} results — type to narrow down</div>` : '');

    dropdown.classList.remove('hidden');
}

function scrollToClient(clientId) {
    trackRecentlyViewed(clientId);
    const el = document.getElementById(`block-${clientId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--accent)';
        el.style.outlineOffset = '4px';
        el.style.borderRadius = 'var(--radius)';
        el.style.transition = 'outline-color 1.5s ease';
        setTimeout(() => {
            el.style.outlineColor = 'transparent';
            setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 500);
        }, 800);
    }
    const body = document.getElementById(`body-${clientId}`);
    if (body?.classList.contains('collapsed')) toggleClientCollapse(clientId);

    document.getElementById('search-dropdown').classList.add('hidden');
    document.getElementById('search-input').blur();
}

function clearSearch() {
    const input = document.getElementById('search-input');
    input.value = '';
    input.focus();
    document.getElementById('search-dropdown').classList.add('hidden');
    document.getElementById('search-clear').classList.add('hidden');
    document.getElementById('search-results-count').classList.add('hidden');
    dropdownIndex = -1;
    renderClients();
}

// ── Screenshots ──

function renderScreenshotMedia(item) {
    const mainImg = document.getElementById('screenshot-main');
    const mainVid = document.getElementById('screenshot-video');
    mainVid.pause();
    if (item.type === 'video') {
        mainImg.hidden = true;
        mainImg.removeAttribute('src');
        mainImg.classList.remove('zoomed');
        mainVid.hidden = false;
        mainVid.src = item.url;
    } else {
        mainVid.hidden = true;
        mainVid.removeAttribute('src');
        mainVid.load();
        mainImg.hidden = false;
        mainImg.src = item.url;
        mainImg.classList.remove('zoomed');
    }
}

function thumbnailMarkup(s, i, activeIndex) {
    const activeClass = i === activeIndex ? 'active' : '';
    if (s.type === 'video') {
        return `<div class="screenshot-thumbnail screenshot-thumbnail-video ${activeClass}" onclick="showScreenshot(${i})" role="button" aria-label="Video ${i+1}"><video src="${s.url}" muted playsinline preload="metadata"></video><span class="screenshot-thumb-play"><i class="fa-solid fa-play"></i></span></div>`;
    }
    return `<img src="${s.url}" class="screenshot-thumbnail ${activeClass}" onclick="showScreenshot(${i})" alt="Thumbnail ${i+1}" loading="lazy">`;
}

function openScreenshots(clientId, screenshots, index = 0) {
    currentScreenshots = screenshots;
    currentScreenshotIndex = index;
    isZoomed = false;
    const modal = document.getElementById('screenshots-modal');
    if (screenshots.length > 0) {
        renderScreenshotMedia(screenshots[index]);
        document.getElementById('screenshot-counter').textContent = `${index + 1} / ${screenshots.length}`;
        document.getElementById('screenshot-thumbnails').innerHTML = screenshots.map((s, i) => thumbnailMarkup(s, i, index)).join('');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeScreenshots() {
    document.getElementById('screenshots-modal').classList.remove('active');
    document.body.style.overflow = '';
    const mainVid = document.getElementById('screenshot-video');
    mainVid.pause();
    mainVid.removeAttribute('src');
    mainVid.load();
    currentScreenshots = [];
    currentScreenshotIndex = 0;
    isZoomed = false;
}

function showScreenshot(index) {
    if (index < 0 || index >= currentScreenshots.length) return;
    currentScreenshotIndex = index;
    isZoomed = false;
    renderScreenshotMedia(currentScreenshots[index]);
    document.getElementById('screenshot-counter').textContent = `${index + 1} / ${currentScreenshots.length}`;
    document.querySelectorAll('.screenshot-thumbnail').forEach((t, i) => t.classList.toggle('active', i === index));
}

function toggleZoom() {
    if (currentScreenshots[currentScreenshotIndex]?.type === 'video') return;
    isZoomed = !isZoomed;
    document.getElementById('screenshot-main').classList.toggle('zoomed', isZoomed);
}

function nextScreenshot() { showScreenshot((currentScreenshotIndex + 1) % currentScreenshots.length); }
function prevScreenshot() { showScreenshot(currentScreenshotIndex === 0 ? currentScreenshots.length - 1 : currentScreenshotIndex - 1); }

// ── Helpers ──

const smartSort = (a, b) => a.rawName.localeCompare(b.rawName, undefined, { numeric: true, sensitivity: 'base' });

function isOptifinePack(name, desc) {
    const text = (name + ' ' + (desc || '')).toLowerCase();
    return ['opti', 'fps', 'performance', 'boost', 'optimize', 'optimization'].some(k => text.includes(k));
}

function detectTags(parts) {
    return ['working', 'legacy', 'trash'].filter(tag => parts.some(p => p.toLowerCase() === tag));
}

function detectVersionsFromFilename(filename) {
    const versions = new Set();
    const patterns = [
        /MCPE[- ]?(\d+)[._](\d+)/gi,
        /MC[- ]?(\d+)[._](\d+)/gi,
        /\b(\d+)[._](\d+)[._](\d+)\b/g,
        /\b(\d+)[._](\d{2})\b/g,
    ];
    for (const pat of patterns) {
        let m;
        while ((m = pat.exec(filename)) !== null) {
            const major = parseInt(m[1]), minor = parseInt(m[2]);
            if (major === 1 && minor >= 14 && minor <= 30) {
                versions.add(`${major}_${minor}`);
            }
        }
    }
    return versions;
}

function isDiscordLink(str) {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes('discord.gg/') || s.includes('discord.com/invite') || s.includes('discord.glacierclient.xyz');
}

function formatDiscordLink(str) {
    if (!str) return '';
    const t = str.trim();
    if (isDiscordLink(t)) {
        let url = t;
        if (!url.startsWith('http')) url = 'https://' + url;
        return `<a href="${url}" target="_blank">${t.replace(/^https?:\/\//, '')}</a>`;
    }
    return `<span>${t}</span>`;
}

function extractVersion(name) {
    const m = name.match(/^(\d+)_(\d+)$/);
    return m ? { major: parseInt(m[1]), minor: parseInt(m[2]) } : null;
}

function sortCategories(categories) {
    const versions = categories.filter(c => extractVersion(c.name));
    const others = categories.filter(c => !extractVersion(c.name));
    versions.sort((a, b) => {
        const va = extractVersion(a.name), vb = extractVersion(b.name);
        return vb.major !== va.major ? vb.major - va.major : vb.minor - va.minor;
    });
    others.sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.name), bi = CATEGORY_ORDER.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.name.localeCompare(b.name);
    });
    return [...others, ...versions];
}

function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Stats ──

function renderStats(animate = false) {
    const statsBar = document.getElementById('stats-bar');
    let totalClients = 0, totalFiles = 0, totalCategories = libraryTree.length;
    libraryTree.forEach(cat => {
        totalClients += cat.clients.length;
        cat.clients.forEach(c => { totalFiles += c.files.length + c.extensions.length; });
    });

    statsBar.innerHTML = `
        <span class="stat-chip"><i class="fa-solid fa-layer-group"></i><strong data-num="${totalCategories}">${animate ? 0 : totalCategories}</strong> ${t('categories')}</span>
        <span class="stat-chip"><i class="fa-solid fa-cube"></i><strong data-num="${totalClients}">${animate ? 0 : totalClients}</strong> ${t('clients')}</span>
        <span class="stat-chip"><i class="fa-solid fa-file-arrow-down"></i><strong data-num="${totalFiles}">${animate ? 0 : totalFiles}</strong> ${t('files')}</span>
    `;
    if (animate && prefs.motion !== 'reduce') {
        statsBar.querySelectorAll('strong[data-num]').forEach(el => animateCount(el, parseInt(el.dataset.num, 10)));
    }
}

// ── Build search string for a client (pre-computed, called once) ──

function buildSearchString(client) {
    let s = client.displayName.toLowerCase() + '\0';
    if (client.description) s += client.description.toLowerCase() + '\0';
    s += client.tags.join('\0') + '\0';
    if (client.compatVersions) s += client.compatVersions.map(v => v.replace('_', '.')).join('\0') + '\0';
    for (const f of client.files) s += f.display.toLowerCase() + '\0' + f.rawName.toLowerCase() + '\0';
    for (const e of client.extensions) s += e.display.toLowerCase() + '\0' + e.rawName.toLowerCase() + '\0';
    return s;
}

// ── Tab cycler ──

function updateTabScrollButtons() {
    const scrollContainer = document.getElementById('category-tabs');
    const leftBtn = document.getElementById('tab-scroll-left');
    const rightBtn = document.getElementById('tab-scroll-right');
    if (!scrollContainer || !leftBtn || !rightBtn) return;
    const canScroll = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (canScroll) {
        leftBtn.classList.add('visible');
        rightBtn.classList.add('visible');
        // Hide left button at start, right at end
        leftBtn.style.opacity = scrollContainer.scrollLeft <= 1 ? '0' : '1';
        rightBtn.style.opacity = scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 2 ? '0' : '1';
    } else {
        leftBtn.classList.remove('visible');
        rightBtn.classList.remove('visible');
    }
}

function scrollTabs(direction) {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
}

// ── Init ──

async function init() {
    try {
        const response = await fetch(`${BASE_RAW_URL}/paths.json?t=${Date.now()}`);
        const rawEntries = await response.json();
        const structured = {};
        const detectedCategories = new Set();

        // Support both old format (array of strings) and new format (array of objects)
        const isNewFormat = rawEntries.length > 0 && typeof rawEntries[0] === 'object';

        rawEntries.forEach(entry => {
            const path = isNewFormat ? entry.path : entry;
            const parts = path.split('/');
            if (parts.length < 3) return;
            const category = parts[1], clientName = parts[2], fileName = parts[parts.length - 1];
            detectedCategories.add(category);
            if (!structured[category]) structured[category] = {};
            if (!structured[category][clientName]) {
                structured[category][clientName] = { icon: null, banner: null, description: null, author: null, tags: [], screenshots: [], files: [], extensions: [], isOptifine: false, compatVersions: new Set() };
            }
            const encodedPath = parts.map(p => encodeURIComponent(p)).join('/');
            const fullUrl = `${BASE_RAW_URL}/${encodedPath}`;
            const lowerName = fileName.toLowerCase();
            const client = structured[category][clientName];

            if (extractVersion(category)) client.compatVersions.add(category);
            detectVersionsFromFilename(fileName).forEach(v => client.compatVersions.add(v));

            if (lowerName === 'pack_icon.png') { client.icon = fullUrl; }
            else if (lowerName === 'pack_banner.png') { client.banner = fullUrl; }
            else if (lowerName === 'description.txt' || lowerName === 'description.md') {
                if (isNewFormat && entry.content != null) {
                    client.description = entry.content;
                    if (!client.isOptifine) client.isOptifine = isOptifinePack(clientName, entry.content);
                }
            } else if (lowerName === 'author.json' || lowerName === 'creator.json') {
                if (isNewFormat && entry.content != null) {
                    client.author = entry.content;
                }
            } else if (lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/) && (parts.some(p => p.toLowerCase() === 'screenshots') || lowerName.includes('screenshot'))) {
                client.screenshots.push({ url: fullUrl, name: fileName, type: 'image' });
            } else if (lowerName.match(/\.(mp4|webm|mov|m4v|ogv)$/) && (parts.some(p => p.toLowerCase() === 'screenshots') || lowerName.includes('screenshot'))) {
                client.screenshots.push({ url: fullUrl, name: fileName, type: 'video' });
            } else if (['working','legacy','trash','popular'].includes(lowerName)) {
                if (!client.tags.includes(lowerName)) client.tags.push(lowerName);
            } else {
                detectTags(parts).forEach(t => { if (!client.tags.includes(t)) client.tags.push(t); });
                if (lowerName.match(/\.(zip|dll|so|apk|mcpack|mcaddon)$/)) {
                    const isExt = parts.some(p => p.toLowerCase() === 'extensions');
                    const fileObj = {
                        display: formatName(fileName),
                        rawName: fileName,
                        url: fullUrl,
                        size: (isNewFormat && entry.size) ? formatFileSize(entry.size) : null
                    };
                    (isExt ? client.extensions : client.files).push(fileObj);
                }
            }
        });

        const optifineClients = {};
        Object.keys(structured).forEach(cat => {
            if (cat === "Optifine Packs") return;
            Object.entries(structured[cat]).forEach(([name, data]) => {
                if (data.isOptifine || isOptifinePack(name, data.description)) {
                    if (!optifineClients[name]) { optifineClients[name] = { ...data, originalCategory: cat, isOptifine: true }; }
                    else {
                        optifineClients[name].files.push(...data.files);
                        optifineClients[name].extensions.push(...data.extensions);
                        optifineClients[name].screenshots.push(...data.screenshots);
                        optifineClients[name].tags = [...new Set([...optifineClients[name].tags, ...data.tags])];
                        data.compatVersions.forEach(v => optifineClients[name].compatVersions.add(v));
                    }
                    delete structured[cat][name];
                }
            });
        });
        if (Object.keys(optifineClients).length > 0) {
            structured["Optifine Packs"] = optifineClients;
            detectedCategories.add("Optifine Packs");
        }
        Object.keys(structured).forEach(cat => { if (Object.keys(structured[cat]).length === 0) { delete structured[cat]; detectedCategories.delete(cat); } });

        const sorted = sortCategories(Array.from(detectedCategories).map(name => ({
            name, displayName: extractVersion(name) ? `Version: ${name.replace('_', '.')}` : name
        })));

        libraryTree = sorted.map(({ name, displayName }) => {
            const clients = structured[name];
            if (!clients) return null;
            const list = Object.entries(clients).map(([cName, data]) => {
                const compatVersions = [...(data.compatVersions || [])].sort((a, b) => {
                    const va = extractVersion(a), vb = extractVersion(b);
                    if (!va || !vb) return 0;
                    return va.major !== vb.major ? va.major - vb.major : va.minor - vb.minor;
                });
                const c = {
                    id: 'c_' + cName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + name.replace(/[^a-zA-Z0-9]/g, '_'),
                    displayName: formatName(cName), rawName: cName,
                    iconUrl: data.icon, bannerUrl: data.banner, description: data.description,
                    author: data.author, tags: [...new Set(data.tags)].filter(t => t !== 'popular').sort(),
                    screenshots: data.screenshots, files: data.files.sort(smartSort), extensions: data.extensions.sort(smartSort),
                    isPopular: name === "Popular Clients" || (data.tags || []).includes('popular'), isOptifine: name === "Optifine Packs" || data.isOptifine,
                    originalCategory: data.originalCategory,
                    compatVersions,
                    _search: ''
                };
                c._search = buildSearchString(c);
                return c;
            }).filter(c => c.files.length > 0 || c.extensions.length > 0).sort((a, b) => a.displayName.localeCompare(b.displayName));
            return { name, displayName, clients: list };
        }).filter(c => c && c.clients.length > 0);

        allClients = [];
        libraryTree.forEach(cat => cat.clients.forEach(c => allClients.push(c)));

        const status = document.getElementById('status-container');
        status.style.transition = 'opacity 0.3s ease';
        status.style.opacity = '0';
        setTimeout(() => {
            status.classList.add('hidden');
            const main = document.getElementById('main-content');
            main.classList.remove('hidden');
            main.style.opacity = '0';
            main.style.transition = 'opacity 0.4s ease';
            renderTabs();
            renderStats(true);
            renderFilterChips();
            renderRecentlyViewed();
            const targetCat = (prefs.category && (prefs.category === 'ALL' || prefs.category === '__favorites__' || libraryTree.some(c => c.name === prefs.category)))
                ? prefs.category : 'ALL';
            switchCategory(targetCat);
            applyHashOnce();
            attachSwipeOnScreenshots();
            // Set up tab cycler
            const scrollContainer = document.getElementById('category-tabs');
            if (scrollContainer) {
                scrollContainer.addEventListener('scroll', updateTabScrollButtons);
                window.addEventListener('resize', updateTabScrollButtons);
                document.getElementById('tab-scroll-left').addEventListener('click', () => scrollTabs('left'));
                document.getElementById('tab-scroll-right').addEventListener('click', () => scrollTabs('right'));
                // initial check
                setTimeout(updateTabScrollButtons, 50);
            }
            requestAnimationFrame(() => { main.style.opacity = '1'; });
        }, 250);
    } catch (err) {
        console.error('Failed to load library:', err);
        document.getElementById('status-text').textContent = t('failed_load');
        document.querySelector('.spinner')?.classList.add('hidden');
    }
}

function renderTabs() {
    const container = document.getElementById('category-tabs');
    const tabs = ["ALL", ...libraryTree.map(c => c.name)];
    const favCount = favorites.size;
    const countFor = (name) => {
        if (name === 'ALL') return allClients.length;
        if (name === '__favorites__') return favCount;
        const cat = libraryTree.find(c => c.name === name);
        return cat ? cat.clients.length : 0;
    };
    const buttons = tabs.map(name => {
        const cat = libraryTree.find(c => c.name === name);
        const label = name === "ALL" ? t('all') : (cat ? cat.displayName : (name.startsWith('1_') ? `Version: ${name.replace('_','.')}` : name));
        return `<button onclick="switchCategory('${name}')" id="tab-${name}" class="tab-btn">${label}<span class="tab-count">${countFor(name)}</span></button>`;
    });
    if (favCount > 0) {
        buttons.splice(1, 0, `<button onclick="switchCategory('__favorites__')" id="tab-__favorites__" class="tab-btn"><i class="fa-solid fa-star" style="color:#fbbf24;margin-right:0.3rem"></i>${t('favorites')}<span class="tab-count">${favCount}</span></button>`);
    }
    container.innerHTML = buttons.join('');
    document.getElementById(`tab-${currentCategory}`)?.classList.add('active');
    setTimeout(updateTabScrollButtons, 10);
}

function switchCategory(name) {
    currentCategory = name;
    prefs.category = name;
    savePrefs();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    kbFocusIndex = -1;
    renderClients(currentQuery);
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Render ──

function renderClients(query = '') {
    currentQuery = query;
    const container = document.getElementById('client-container');
    const q = query.toLowerCase().trim();
    let toShow;
    if (currentCategory === '__favorites__') {
        const favClients = allClients.filter(c => favorites.has(c.id));
        if (favClients.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-regular fa-star"></i></div><div class="empty-title">${t('no_favorites')}</div><div class="empty-desc">${t('tap_star')}</div></div>`;
            return;
        }
        toShow = [{ name: '__favorites__', displayName: t('favorites'), clients: favClients }];
    } else {
        toShow = currentCategory === "ALL" ? libraryTree : libraryTree.filter(c => c.name === currentCategory);
    }

    if (toShow.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-search"></i></div><div class="empty-title">${t('no_results')}</div><div class="empty-desc">${t('try_different')}</div></div>`;
        return;
    }

    const parts = [];

    toShow.forEach(cat => {
        const filtered = [];
        const orderedClients = applySortFilter(cat.clients);
        for (const client of orderedClients) {
            if (!q || client._search.includes(q)) {
                const broad = !q || client.displayName.toLowerCase().includes(q) || client.description?.toLowerCase().includes(q) || client.tags.some(t => t.includes(q));
                filtered.push({
                    ...client,
                    matchingFiles: q && !broad ? client.files.filter(f => f.display.toLowerCase().includes(q) || f.rawName.toLowerCase().includes(q)) : client.files,
                    matchingExtensions: q && !broad ? client.extensions.filter(e => e.display.toLowerCase().includes(q) || e.rawName.toLowerCase().includes(q)) : client.extensions
                });
            }
        }

        if (filtered.length === 0) return;

        parts.push(`<div class="category-group"><div class="section-label"><span>${cat.displayName}</span></div>`);

        filtered.forEach(client => {
            const hasDesc = client.description?.trim().length > 0;
            const hasAuthor = client.author && Object.keys(client.author).length > 0;
            const hasSS = client.screenshots?.length > 0;
            const hasDetails = hasDesc || hasAuthor || hasSS;
            const manyFiles = client.matchingFiles.length > 5;
            const ssJson = escapeAttr(JSON.stringify(client.screenshots));

            parts.push(`<div class="client-block" id="block-${client.id}" style="content-visibility:auto;contain-intrinsic-size:auto 300px">`);

            const isFav = favorites.has(client.id);
            const safeName = escapeAttr(client.displayName);
            const iconHtml = client.iconUrl
                ? `<img src="${client.iconUrl}" class="client-icon" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'client-icon icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></div>'">`
                : `<div class="client-icon icon-placeholder"><i class="fa-solid fa-cube"></i></div>`;
            parts.push(`<div class="client-header">
                <div class="client-info">
                    ${iconHtml}
                    <div class="client-meta">
                        <div class="client-name">${client.displayName}</div>
                        <div class="tag-row">
                            ${client.isPopular ? `<button class="tag tag-popular clickable" onclick="event.stopPropagation();toggleTagFilterFromTag('popular')"><i class="fa-solid fa-star"></i>${t('popular')}</button>` : ''}
                            ${client.isOptifine ? `<button class="tag tag-optifine clickable" onclick="event.stopPropagation();toggleTagFilterFromTag('optifine')"><i class="fa-solid fa-bolt"></i>${t('optifine')}</button>` : ''}
                            ${client.originalCategory && client.isOptifine ? `<span class="tag tag-category"><i class="fa-solid fa-layer-group"></i>${client.originalCategory}</span>` : ''}
                            ${client.tags.map(tg => `<button class="tag tag-${tg} clickable" onclick="event.stopPropagation();toggleTagFilterFromTag('${tg}')" title="${t('filter')}: ${t(tg) || tg}"><i class="fa-solid ${TAG_ICONS[tg]||'fa-tag'}"></i>${(t(tg) || tg).charAt(0).toUpperCase()+(t(tg) || tg).slice(1)}</button>`).join('')}
                            ${(client.compatVersions && client.compatVersions.length > 0) ? client.compatVersions.map(v => `<span class="tag tag-version"><i class="fa-solid fa-code-branch"></i>${v.replace('_','.')}</span>`).join('') : ''}
                        </div>
                    </div>
                </div>
                <div class="client-actions">
                    ${(client.files.length + client.extensions.length) > 1 ? `<button class="action-icon" onclick="openAllDownloads('${escapeAttr(encodeURIComponent(JSON.stringify([...client.files, ...client.extensions].map(f => getMonetizedUrl(f.url)))))}')" aria-label="${t('open_all')}" title="${t('open_all')}"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>` : ''}
                    <button class="action-icon fav-btn ${isFav ? 'active' : ''}" data-fav-id="${client.id}" onclick="toggleFavorite('${client.id}', '${safeName}')" aria-label="${t('favorites')}" title="${t('favorites')}"><i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i></button>
                    <button class="action-icon" onclick="shareClient('${client.id}', '${safeName}')" aria-label="${t('share')}" title="${t('share')}"><i class="fa-solid fa-link"></i></button>
                    <button id="collapse-btn-${client.id}" onclick="toggleClientCollapse('${client.id}')" class="collapse-btn">
                        <i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">${t('collapse_all').replace(/\s.+/, '')}</span>
                    </button>
                </div>
            </div>`);

            parts.push(`<div id="body-${client.id}" class="client-body"><div class="client-body-inner">`);

            if (hasDetails) {
                parts.push(`<div id="details-${client.id}" class="details-panel"><div class="details-panel-inner"><div class="details-inner">`);

                if (hasSS) {
                    parts.push(`<div style="margin-bottom:1rem">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
                            <span style="display:flex;align-items:center;gap:0.4rem;font-weight:600;color:var(--white)"><i class="fa-solid fa-images" style="color:var(--accent)"></i>${t('screenshots')} (${client.screenshots.length})</span>
                            <button onclick="openScreenshots('${client.id}',${ssJson})" style="background:none;border:none;color:var(--accent);font-size:0.8125rem;font-weight:600;cursor:pointer">${t('view_all')}</button>
                        </div>
                        <div class="ss-grid">${client.screenshots.slice(0,6).map((ss, i) => {
                            const media = ss.type === 'video'
                                ? `<video src="${ss.url}" muted playsinline preload="metadata"></video><span class="ss-thumb-play"><i class="fa-solid fa-play"></i></span>`
                                : `<img src="${ss.url}" alt="Screenshot ${i+1}" loading="lazy">`;
                            return `<div class="ss-thumb" onclick="openScreenshots('${client.id}',${ssJson},${i})">${media}<div class="ss-thumb-overlay"><span class="ss-badge">${i+1}</span></div></div>`;
                        }).join('')}</div>
                    </div>`);
                }

                if (hasDesc) {
                    parts.push(`<div class="md" style="margin-bottom:0.75rem">${renderMarkdown(client.description)}</div>`);
                }

                if (hasAuthor) {
                    parts.push(`<div class="author-block">
                        <div class="author-name"><i class="fa-solid fa-user"></i>${client.author.name||'Unknown'}</div>
                        ${client.author.website ? `<div class="author-link"><i class="fa-solid fa-globe"></i><a href="${client.author.website}" target="_blank" rel="noopener">${client.author.website.replace(/^https?:\/\//,'')}</a></div>` : ''}
                        ${client.author.discord ? `<div class="author-link"><i class="fa-brands fa-discord"></i>${formatDiscordLink(client.author.discord)}</div>` : ''}
                        ${client.author.github ? `<div class="author-link"><i class="fa-brands fa-github"></i><a href="https://github.com/${client.author.github}" target="_blank" rel="noopener">@${client.author.github}</a></div>` : ''}
                    </div>`);
                }

                parts.push(`</div></div></div>`);
                parts.push(`<button id="details-btn-${client.id}" onclick="toggleDescription('${client.id}')" class="details-toggle">${t('show_details')} <i class="fa-solid fa-chevron-down"></i></button>`);
            }

            if (client.matchingFiles.length > 0) {
                parts.push(`<div class="file-grid">`);
                client.matchingFiles.forEach((file, idx) => {
                    const hiddenClass = (!q && manyFiles && idx >= 5) ? `file-hidden-${client.id}` : '';
                    const hiddenStyle = (!q && manyFiles && idx >= 5) ? ' style="display:none"' : '';
                    const downloadUrl = getMonetizedUrl(file.url);
                    const fNameAttr = escapeAttr(file.rawName);
                    const fUrlAttr = escapeAttr(file.url);
                    parts.push(`<div class="file-card ${hiddenClass}"${hiddenStyle}>
                        ${client.bannerUrl ? `<img src="${client.bannerUrl}" class="file-card-banner" loading="lazy" alt="" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='none')"><div class="file-card-overlay"></div>` : ''}
                        <div class="file-card-body">
                            <div class="file-info">
                                <div class="file-name"><i class="fa-solid fa-file-arrow-down"></i>${file.display}<span class="file-actions"><button class="file-icon-btn" onclick="copyFilename('${fNameAttr}')" title="${t('copy_filename')}" aria-label="${t('copy_filename')}"><i class="fa-solid fa-copy"></i></button><button class="file-icon-btn" onclick="copyDownload('${fUrlAttr}')" title="${t('copy_link')}" aria-label="${t('copy_link')}"><i class="fa-solid fa-link"></i></button></span></div>
                                <div class="file-raw">${file.rawName}</div>
                                ${file.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${file.size}</div>` : ''}
                            </div>
                            <a href="${downloadUrl}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>${t('download')}</a>
                        </div>
                    </div>`);
                });
                parts.push(`</div>`);
            }

            if (!q && manyFiles) {
                parts.push(`<button id="more-btn-${client.id}" onclick="toggleFileList('${client.id}')" class="show-more-btn"><i class="fa-solid fa-angles-down"></i>${t('show_more', { n: client.matchingFiles.length - 5 })}</button>`);
            }

            if (client.matchingExtensions.length > 0) {
                parts.push(`<div class="ext-section">
                    <button id="ext-header-${client.id}" onclick="toggleDropdown('${client.id}')" class="ext-header">
                        <span><i class="fa-solid fa-puzzle-piece" style="margin-right:0.4rem;color:var(--text-dim)"></i>${t('extensions')} (${client.matchingExtensions.length})</span>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </button>
                    <div id="ext-body-${client.id}" class="ext-body"><div class="ext-body-inner">
                        ${client.matchingExtensions.map(ext => {
                            const extDownloadUrl = getMonetizedUrl(ext.url);
                            const eName = escapeAttr(ext.rawName);
                            const eUrl = escapeAttr(ext.url);
                            return `
                            <div class="ext-row">
                                <div class="file-info">
                                    <div class="file-name" style="font-size:0.8125rem">${ext.display}<span class="file-actions"><button class="file-icon-btn" onclick="copyFilename('${eName}')" title="${t('copy_filename')}" aria-label="${t('copy_filename')}"><i class="fa-solid fa-copy"></i></button><button class="file-icon-btn" onclick="copyDownload('${eUrl}')" title="${t('copy_link')}" aria-label="${t('copy_link')}"><i class="fa-solid fa-link"></i></button></span></div>
                                    <div class="file-raw">${ext.rawName}</div>
                                    ${ext.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${ext.size}</div>` : ''}
                                </div>
                                <a href="${extDownloadUrl}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>Download</a>
                            </div>
                        `}).join('')}
                    </div></div>
                </div>`);
            }

            parts.push(`</div></div>`);
            parts.push(`</div>`);
        });

        parts.push(`</div>`);
    });

    if (parts.length === 0) {
        const hasFilters = prefs.tagFilters.length > 0;
        container.innerHTML = `<div class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-search"></i></div>
            <div class="empty-title">${t('no_results')}</div>
            <div class="empty-desc">${hasFilters ? t('try_filters') : t('try_different')}</div>
            ${hasFilters ? `<button class="clear-filters" style="margin-top:1rem" onclick="clearAllFilters()"><i class="fa-solid fa-xmark"></i> ${t('clear_all')}</button>` : ''}
        </div>`;
    } else {
        container.innerHTML = parts.join('');
    }
}

// ── Events ──

document.addEventListener('DOMContentLoaded', () => {
    applyAccent();
    applyDensity();
    applyMotion();
    applyTheme();
    applyTranslations();
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (prefs.theme === 'auto') applyTheme(); });

    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearTimeout(searchDebounce);
        renderSearchDropdown(val);
        searchDebounce = setTimeout(() => renderClients(val), 200);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) renderSearchDropdown(searchInput.value);
        else renderSearchHistory();
    });
    searchInput.addEventListener('change', () => recordSearch(searchInput.value));
    searchInput.addEventListener('blur', () => { setTimeout(() => recordSearch(searchInput.value), 50); });

    searchClear.addEventListener('click', clearSearch);

    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('search-wrapper');
        if (!wrapper.contains(e.target)) {
            document.getElementById('search-dropdown').classList.add('hidden');
        }
        // Dismiss sort menu when clicking outside
        const sortWrap = document.getElementById('sort-btn')?.parentElement;
        const sortMenu = document.getElementById('sort-menu');
        if (sortMenu && sortWrap && !sortWrap.contains(e.target)) {
            sortMenu.classList.add('hidden');
        }
    });

    window.addEventListener('hashchange', applyHashOnce);

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('screenshots-modal').classList.contains('active')) {
            if (e.key === 'Escape') closeScreenshots();
            else if (e.key === 'ArrowLeft') prevScreenshot();
            else if (e.key === 'ArrowRight') nextScreenshot();
            else if (e.key === 'z' || e.key === 'Z') toggleZoom();
            return;
        }
        if (document.getElementById('help-modal').classList.contains('active')) {
            if (e.key === 'Escape') closeHelp();
            return;
        }
        if (document.getElementById('settings-modal').classList.contains('active')) {
            if (e.key === 'Escape') closeSettings();
            return;
        }

        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
            return;
        }

        if (e.key === 'Escape') {
            if (searchInput.value) {
                clearSearch();
            } else {
                searchInput.blur();
                document.getElementById('search-dropdown').classList.add('hidden');
                document.getElementById('sort-menu')?.classList.add('hidden');
            }
            return;
        }

        // Global single-key shortcuts (not while typing)
        const typing = document.activeElement === searchInput || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
        if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key === '?') { e.preventDefault(); openHelp(); return; }
            if (e.key === 'j') { e.preventDefault(); moveKbFocus(+1); return; }
            if (e.key === 'k') { e.preventDefault(); moveKbFocus(-1); return; }
            if (e.key === 'g') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            if (e.key === 'G') { e.preventDefault(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return; }
            if (e.key === 'r' || e.key === 'R') { e.preventDefault(); randomClient(); return; }
            if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleTheme(); return; }
            if (e.key === 's' || e.key === 'S') { e.preventDefault(); openSettings(); return; }
        }

        if (document.activeElement === searchInput) {
            const dropdown = document.getElementById('search-dropdown');
            const items = dropdown.querySelectorAll('.search-dropdown-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                dropdownIndex = Math.min(dropdownIndex + 1, items.length - 1);
                items.forEach((el, i) => el.classList.toggle('focused', i === dropdownIndex));
                items[dropdownIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                dropdownIndex = Math.max(dropdownIndex - 1, 0);
                items.forEach((el, i) => el.classList.toggle('focused', i === dropdownIndex));
                items[dropdownIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && dropdownIndex >= 0 && items[dropdownIndex]) {
                e.preventDefault();
                const clientId = items[dropdownIndex].dataset.clientId;
                if (clientId) scrollToClient(clientId);
            }
        }
    });

    window.addEventListener('scroll', () => {
        document.getElementById('back-to-top').classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    init();
});