const GITHUB_ORG = 'Indigo-Tools';
const REPO_NAME = 'ClientLibrary';
const BRANCH = 'main';
const BASE_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_ORG}/${REPO_NAME}/${BRANCH}`;
const BASE_MEDIA_URL = `https://media.githubusercontent.com/media/${GITHUB_ORG}/${REPO_NAME}/${BRANCH}`;
const LFS_EXTENSIONS = /\.(mcpack|mcaddon|zip)$/i;

const LINKVERTISE_USER_ID = 499358;
function isMonetizationOn() { return true; }

const GEMINI_PROXY_URL = 'https://nyxora-ai.pepeoncloudeflare.workers.dev';

const SITE_URL = 'https://mca.glacierclient.xyz';
const slugMap = {};
function slugify(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, ''); }
function clientUrl(c) { return `${SITE_URL}/${c.slug || slugify(c.displayName)}`; }
function findClientByRef(ref) {
    if (!ref) return null;
    try { ref = decodeURIComponent(ref); } catch {}
    let c = allClients.find(x => x.id === ref);
    if (c) return c;
    const slug = slugify(ref);
    const id = slugMap[slug];
    if (id) c = allClients.find(x => x.id === id);
    return c || allClients.find(x => x.slug === slug) || null;
}

const DL_COUNTS_KEY = 'nyxora_dl_counts_v1';
function loadDlCounts() { try { return JSON.parse(localStorage.getItem(DL_COUNTS_KEY) || '{}'); } catch { return {}; } }
function saveDlCounts(o) { try { localStorage.setItem(DL_COUNTS_KEY, JSON.stringify(o)); } catch {} }
function bumpDlCount(clientId) {
    if (!clientId) return;
    const o = loadDlCounts();
    o[clientId] = (o[clientId] || 0) + 1;
    saveDlCounts(o);
}

const DL_COUNTER_BASE = 'https://nyxora-counter.pepeoncloudeflare.workers.dev';
const DL_COUNTER_NS   = 'nyxora-library';
const DL_GLOBAL_KEY = 'nyxora_dl_global_v1';
const DL_GLOBAL_TTL = 10 * 60 * 1000;
function counterKey(c) { return (c && (c.slug || slugify(c.displayName))) || ''; }
function loadGlobalDl() { try { return JSON.parse(localStorage.getItem(DL_GLOBAL_KEY) || '{}'); } catch { return {}; } }
function setGlobalDl(key, n) {
    if (!key) return;
    const o = loadGlobalDl();
    o[key] = { n, t: Date.now() };
    try { localStorage.setItem(DL_GLOBAL_KEY, JSON.stringify(o)); } catch {}
}
function fmtCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}
async function fetchGlobalDl(key) {
    if (!key) return null;
    try {
        const r = await fetch(`${DL_COUNTER_BASE}/get/${encodeURIComponent(DL_COUNTER_NS)}/${encodeURIComponent(key)}`);
        if (!r.ok) return 0;
        const j = await r.json();
        return typeof j.value === 'number' ? j.value : 0;
    } catch { return null; }
}
async function hitGlobalDl(key) {
    if (!key) return null;
    try {
        const r = await fetch(`${DL_COUNTER_BASE}/hit/${encodeURIComponent(DL_COUNTER_NS)}/${encodeURIComponent(key)}`);
        if (!r.ok) return null;
        const j = await r.json();
        return typeof j.value === 'number' ? j.value : null;
    } catch { return null; }
}
function updateDlBadges(key, n) {
    if (n == null) return;
    allClients.filter(c => counterKey(c) === key).forEach(c => {
        const badge = document.getElementById(`dl-badge-${c.id}`);
        if (badge) {
            badge.querySelector('.dl-count-n') ? (badge.querySelector('.dl-count-n').textContent = fmtCount(n))
                : (badge.innerHTML = `<i class="fa-solid fa-download"></i><span class="dl-count-n">${fmtCount(n)}</span>`);
            badge.classList.toggle('hidden', !n);
        }
    });
}
function recordGlobalDownload(clientId) {
    const c = allClients.find(x => x.id === clientId);
    if (!c) return;
    const key = counterKey(c);
    hitGlobalDl(key).then(n => { if (n != null) { setGlobalDl(key, n); updateDlBadges(key, n); } });
}
let _dlObserver = null;
function ensureDlObserver() {
    if (_dlObserver) return _dlObserver;
    _dlObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            _dlObserver.unobserve(e.target);
            const id = e.target.id.replace(/^block-/, '');
            const c = allClients.find(x => x.id === id);
            if (!c) return;
            const key = counterKey(c);
            const cached = loadGlobalDl()[key];
            if (cached) updateDlBadges(key, cached.n);
            if (!cached || (Date.now() - cached.t) > DL_GLOBAL_TTL) {
                fetchGlobalDl(key).then(n => { if (n != null) { setGlobalDl(key, n); updateDlBadges(key, n); } });
            }
        });
    }, { rootMargin: '300px' });
    return _dlObserver;
}

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

const PREFS_KEY = 'nyxora_prefs_v1';
const FAVS_KEY = 'nyxora_favs_v1';
const DEFAULT_PREFS = {
    theme: 'auto', sort: 'name-asc', tagFilters: [], category: 'ALL',
    language: 'en', accent: 'violet', density: 'cozy', motion: 'auto',
    highContrast: false, textScale: 100, dataSaver: false, effect: 'none',
    recentlyViewed: [], searchHistory: [],
    aiSimilar: false,
};
const REPORT_DISCORD_URL = 'https://discord.glacierclient.xyz';
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
    { id: 'recent-desc',       tKey: 'sort_recent',       icon: 'fa-clock-rotate-left' },
    { id: 'size-desc',         tKey: 'sort_size',         icon: 'fa-weight-scale' },
    { id: 'files-desc',        tKey: 'sort_files',        icon: 'fa-file-arrow-down' },
    { id: 'screenshots-desc',  tKey: 'sort_screenshots',  icon: 'fa-images' },
    { id: 'extensions-desc',   tKey: 'sort_extensions',   icon: 'fa-puzzle-piece' },
];

const TAG_FILTERS = [
    { id: 'favorites',       tKey: 'favorites',       icon: 'fa-star' },
    { id: 'new',             tKey: 'new',             icon: 'fa-sparkles' },
    { id: 'popular',         tKey: 'popular',         icon: 'fa-star' },
    { id: 'optifine',        tKey: 'optifine',        icon: 'fa-bolt' },
    { id: 'working',         tKey: 'working',         icon: 'fa-check-circle' },
    { id: 'legacy',          tKey: 'legacy',          icon: 'fa-history' },
    { id: 'trash',           tKey: 'trash',           icon: 'fa-trash' },
    { id: 'has-screenshots', tKey: 'has_screenshots', icon: 'fa-images' },
    { id: 'has-video',       tKey: 'has_video',       icon: 'fa-video' },
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

function loadRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(arr) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, 10))); } catch {} }
function trackRecentlyViewed(clientId) {
    let arr = loadRecent().filter(id => id !== clientId);
    arr.unshift(clientId);
    saveRecent(arr);
    renderRecentlyViewed();
}
function clearRecentlyViewed() {
    saveRecent([]);
    document.getElementById('recently-viewed')?.remove();
    try { toast(t('toast_filters_cleared') || 'Cleared', 'broom'); } catch {}
}
window.clearRecentlyViewed = clearRecentlyViewed;
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
            <button class="recently-chip" onclick="scrollToClient(${jsArg(c.id)})">
                ${c.iconUrl ? `<img src="${c.iconUrl}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></span>'">` : `<span class="icon-placeholder"><i class="fa-solid fa-cube"></i></span>`}
                <span>${escapeHtml(c.displayName)}</span>
            </button>`).join('')}</div>
        <button class="recently-clear" onclick="clearRecentlyViewed()" title="${t('clear_all')}" aria-label="${t('clear_all')}">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
}

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
const SEARCH_OPERATOR_HINTS = [
    { op: 'tag:working',      icon: 'fa-check-circle' },
    { op: 'version:1.21',     icon: 'fa-code-branch' },
    { op: 'has:screenshots',  icon: 'fa-images' },
    { op: 'has:favorites',    icon: 'fa-star' },
];
function renderSearchHistory() {
    const dropdown = document.getElementById('search-dropdown');
    const hist = loadSearchHistory();
    let html = '';
    if (hist.length > 0) {
        html += `<div class="search-history-header">
            <span><i class="fa-solid fa-clock-rotate-left"></i> ${t('recent_searches')}</span>
            <button class="search-history-clear" onclick="event.stopPropagation();clearSearchHistory()">${t('clear_all')}</button>
        </div>` + hist.map(q => `
            <div class="search-history-item" onclick="useHistoryQuery(${jsArg(q)})">
                <i class="fa-solid fa-clock-rotate-left"></i><span>${escapeHtml(q)}</span>
            </div>`).join('');
    }
    html += `<div class="search-ops">
        <span class="search-ops-label"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('try_operators')}</span>
        <div class="search-ops-chips">${SEARCH_OPERATOR_HINTS.map(o => `<button class="search-op-chip" onclick="useHistoryQuery(${jsArg(o.op)})"><i class="fa-solid ${o.icon}"></i>${escapeHtml(o.op)}</button>`).join('')}</div>
    </div>`;
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    return true;
}
function useHistoryQuery(q) {
    const si = document.getElementById('search-input');
    si.value = q;
    si.dispatchEvent(new Event('input'));
    si.focus();
}

function lightenHex(hex, pct) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const f = (v) => Math.min(255, Math.round(v + (255 - v) * pct)).toString(16).padStart(2,'0');
    return '#' + f(r) + f(g) + f(b);
}
function applyAccent() {
    let c;
    if (prefs.accent === 'custom' && prefs.customAccent) {
        c = { main: prefs.customAccent, light: lightenHex(prefs.customAccent, 0.18) };
    } else {
        c = ACCENT_COLORS[prefs.accent] || ACCENT_COLORS.violet;
    }
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
function setCustomAccent(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    prefs.accent = 'custom';
    prefs.customAccent = hex;
    savePrefs();
    applyAccent();
    renderAccentSwatches();
    const hx = document.getElementById('setting-accent-hex');
    if (hx) hx.textContent = hex;
    const sw = document.getElementById('setting-accent-swatch');
    if (sw) sw.style.background = hex;
}

const ACCENT_RECENTS_KEY = 'nyxora_accent_recents_v1';
function loadAccentRecents() { try { return JSON.parse(localStorage.getItem(ACCENT_RECENTS_KEY) || '[]'); } catch { return []; } }
function recordAccentRecent(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    hex = hex.toLowerCase();
    const arr = [hex, ...loadAccentRecents().filter(c => c.toLowerCase() !== hex)].slice(0, 8);
    try { localStorage.setItem(ACCENT_RECENTS_KEY, JSON.stringify(arr)); } catch {}
    renderAccentRecents();
}
function renderAccentRecents() {
    const wrap = document.getElementById('accent-recents');
    if (!wrap) return;
    const current = (prefs.accent === 'custom' && prefs.customAccent || '').toLowerCase();
    wrap.innerHTML = loadAccentRecents().map(c =>
        `<button class="accent-swatch ${c === current ? 'active' : ''}" style="background:${escapeAttr(c)}" onclick="setCustomAccent('${escapeAttr(c)}');recordAccentRecent('${escapeAttr(c)}')" title="${escapeAttr(c)}" aria-label="${escapeAttr(c)}"></button>`
    ).join('');
}
function randomAccent() {
    const hex = _hsvToHex(Math.floor(Math.random() * 360), 55 + Math.random() * 30, 75 + Math.random() * 20);
    setCustomAccent(hex);
    recordAccentRecent(hex);
    const rgb = _hexToRgb(hex);
    if (rgb) { const hsv = _rgbToHsv(rgb.r, rgb.g, rgb.b); CP.h = hsv.h; CP.s = hsv.s; CP.v = hsv.v; _renderCp(); }
    toast(t('toast_random'), 'dice');
}
window.randomAccent = randomAccent;
window.recordAccentRecent = recordAccentRecent;

const CP = { h: 264, s: 60, v: 91, _bound: false };

function _hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function _rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60; if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
function _hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)      { r = c; g = x; }
    else if (h < 120){ r = x; g = c; }
    else if (h < 180){ g = c; b = x; }
    else if (h < 240){ g = x; b = c; }
    else if (h < 300){ r = x; b = c; }
    else             { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function _hsvToHex(h, s, v) { const { r, g, b } = _hsvToRgb(h, s, v); return _rgbToHex(r, g, b); }

function _renderCpPresets() {
    const wrap = document.getElementById('cp-presets'); if (!wrap) return;
    const presets = Object.values(ACCENT_COLORS || {}).map(c => c.main).filter(Boolean);
    const fallback = ['#6c5ce7','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
    const list = presets.length ? presets : fallback;
    wrap.innerHTML = list.map(c => `<button type="button" class="cp-preset" style="background:${c}" data-hex="${c}" title="${c}" aria-label="${c}"></button>`).join('');
    wrap.querySelectorAll('.cp-preset').forEach(b => {
        b.addEventListener('click', () => {
            const hex = b.dataset.hex;
            const rgb = _hexToRgb(hex); if (!rgb) return;
            const hsv = _rgbToHsv(rgb.r, rgb.g, rgb.b);
            CP.h = hsv.h; CP.s = hsv.s; CP.v = hsv.v;
            _renderCp(); setCustomAccent(hex);
        });
    });
}

function _renderCp() {
    const sv = document.getElementById('cp-sv');
    const svHandle = document.getElementById('cp-sv-handle');
    const hueHandle = document.getElementById('cp-hue-handle');
    const hexInput = document.getElementById('cp-hex');
    const preview = document.getElementById('cp-preview');
    if (!sv) return;
    const hueOnlyHex = _hsvToHex(CP.h, 100, 100);
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueOnlyHex})`;
    svHandle.style.left = CP.s + '%';
    svHandle.style.top = (100 - CP.v) + '%';
    hueHandle.style.left = (CP.h / 360 * 100) + '%';
    const hex = _hsvToHex(CP.h, CP.s, CP.v);
    if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.replace('#','');
    if (preview) preview.style.background = hex;
}

function _cpFromPointer(e, el, axisX, axisY) {
    const rect = el.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    if (axisX) {
        const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, t.clientY - rect.top));
        return { x: x / rect.width, y: y / rect.height };
    }
    const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
    return { x: x / rect.width };
}

function _bindCpOnce() {
    if (CP._bound) return; CP._bound = true;

    const sv = document.getElementById('cp-sv');
    const hue = document.getElementById('cp-hue');
    const hex = document.getElementById('cp-hex');
    const copyBtn = document.getElementById('cp-copy');

    const drag = (el, onMove) => {
        const start = (e) => {
            e.preventDefault();
            onMove(e);
            const move = (ev) => onMove(ev);
            const end = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', end);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
        };
        el.addEventListener('pointerdown', start);
    };

    drag(sv, (e) => {
        const p = _cpFromPointer(e, sv, true, true);
        CP.s = p.x * 100; CP.v = (1 - p.y) * 100;
        _renderCp(); setCustomAccent(_hsvToHex(CP.h, CP.s, CP.v));
    });
    drag(hue, (e) => {
        const p = _cpFromPointer(e, hue, true, false);
        CP.h = p.x * 360;
        _renderCp(); setCustomAccent(_hsvToHex(CP.h, CP.s, CP.v));
    });

    hex.addEventListener('input', () => {
        const v = '#' + hex.value.trim().replace(/^#/, '');
        const rgb = _hexToRgb(v); if (!rgb) return;
        const hsv = _rgbToHsv(rgb.r, rgb.g, rgb.b);
        CP.h = hsv.h; CP.s = hsv.s; CP.v = hsv.v;
        _renderCp(); setCustomAccent(v);
    });

    copyBtn.addEventListener('click', () => {
        const v = _hsvToHex(CP.h, CP.s, CP.v);
        try { copyText(v, 'Hex copied'); } catch { navigator.clipboard?.writeText(v); }
    });

    document.addEventListener('pointerdown', (e) => {
        const pop = document.getElementById('accent-picker-popover');
        const btn = document.getElementById('setting-accent-picker-btn');
        if (!pop || pop.classList.contains('hidden')) return;
        if (pop.contains(e.target) || btn?.contains(e.target)) return;
        closeAccentPicker();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const pop = document.getElementById('accent-picker-popover');
            if (pop && !pop.classList.contains('hidden')) closeAccentPicker();
        }
    });
}

function openAccentPicker(e) {
    e?.stopPropagation();
    const pop = document.getElementById('accent-picker-popover');
    const btn = document.getElementById('setting-accent-picker-btn');
    if (!pop) return;
    _bindCpOnce();
    _renderCpPresets();
    const cur = (prefs.customAccent || '#6c5ce7');
    const rgb = _hexToRgb(cur); if (rgb) {
        const hsv = _rgbToHsv(rgb.r, rgb.g, rgb.b);
        CP.h = hsv.h; CP.s = hsv.s; CP.v = hsv.v;
    }
    _renderCp();
    pop.classList.remove('hidden');
    btn?.setAttribute('aria-expanded', 'true');
}
function closeAccentPicker() {
    const pop = document.getElementById('accent-picker-popover');
    const btn = document.getElementById('setting-accent-picker-btn');
    pop?.classList.add('hidden');
    btn?.setAttribute('aria-expanded', 'false');
    if (prefs.accent === 'custom' && prefs.customAccent) recordAccentRecent(prefs.customAccent);
}
window.openAccentPicker = openAccentPicker;
window.closeAccentPicker = closeAccentPicker;
function applyNightShift() {
    const overlay = document.getElementById('night-shift-overlay');
    if (!overlay) return;
    if (prefs.nightShift) {
        overlay.classList.remove('hidden');
        overlay.style.opacity = ((prefs.nightShiftStrength || 30) / 100).toFixed(2);
    } else {
        overlay.classList.add('hidden');
    }
}
function setSwitchState(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
}
function toggleNightShift() {
    prefs.nightShift = !prefs.nightShift;
    if (prefs.nightShift && !prefs.nightShiftStrength) prefs.nightShiftStrength = 30;
    savePrefs();
    applyNightShift();
    setSwitchState('setting-nightshift', !!prefs.nightShift);
    document.getElementById('nightshift-strength-row').style.display = prefs.nightShift ? '' : 'none';
    const s = document.getElementById('setting-nightshift-strength');
    if (s) s.value = prefs.nightShiftStrength || 30;
    toast(prefs.nightShift ? 'Night Shift on' : 'Night Shift off', 'moon');
}
function setNightShiftStrength(v) {
    prefs.nightShiftStrength = +v;
    savePrefs();
    applyNightShift();
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
    applyEffect();
    setSwitchState('setting-motion', prefs.motion === 'reduce');
}

function applyCompactCards() {
    if (prefs.compactCards) document.documentElement.dataset.compactCards = 'on';
    else document.documentElement.removeAttribute('data-compact-cards');
}
function toggleCompactCards() {
    prefs.compactCards = !prefs.compactCards;
    savePrefs();
    applyCompactCards();
    setSwitchState('setting-compact-cards', !!prefs.compactCards);
}
function toggleAutoCollapse() {
    prefs.autoCollapse = !prefs.autoCollapse;
    savePrefs();
    setSwitchState('setting-auto-collapse', !!prefs.autoCollapse);
}

function applyHighContrast() {
    if (prefs.highContrast) document.documentElement.dataset.contrast = 'high';
    else document.documentElement.removeAttribute('data-contrast');
}
function toggleHighContrast() {
    prefs.highContrast = !prefs.highContrast;
    savePrefs();
    applyHighContrast();
    setSwitchState('setting-contrast', !!prefs.highContrast);
}
function applyTextScale() {
    const scale = Math.min(140, Math.max(85, prefs.textScale || 100));
    document.documentElement.style.fontSize = (scale === 100) ? '' : (scale / 100 * 16) + 'px';
    const lbl = document.getElementById('text-scale-label');
    if (lbl) lbl.textContent = scale + '%';
}
function setTextScale(v) {
    prefs.textScale = +v;
    savePrefs();
    applyTextScale();
}
function applyDataSaver() {
    if (prefs.dataSaver) document.documentElement.dataset.dataSaver = 'on';
    else document.documentElement.removeAttribute('data-data-saver');
}
function toggleDataSaver() {
    prefs.dataSaver = !prefs.dataSaver;
    savePrefs();
    applyDataSaver();
    applyEffect();
    setSwitchState('setting-data-saver', !!prefs.dataSaver);
    toast(prefs.dataSaver ? 'Data saver on — images hidden' : 'Data saver off', 'gauge-high');
}

let _fxRAF = null, _fxCanvas = null, _fxResize = null;
function stopEffect() {
    if (_fxRAF) { cancelAnimationFrame(_fxRAF); _fxRAF = null; }
    if (_fxResize) { window.removeEventListener('resize', _fxResize); _fxResize = null; }
    if (_fxCanvas) { _fxCanvas.remove(); _fxCanvas = null; }
}
function applyEffect() {
    stopEffect();
    const type = prefs.effect || 'none';
    if (type === 'none') return;
    if (prefs.motion === 'reduce' || prefs.dataSaver) return;
    startEffect(type);
}
function startEffect(type) {
    const c = document.createElement('canvas');
    c.className = 'weather-canvas';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    _fxCanvas = c;
    const ctx = c.getContext('2d');
    let w = 0, h = 0, parts = [];
    const SAKURA = type === 'sakura', RAIN = type === 'rain';

    function spawn() {
        if (RAIN) return { x: Math.random() * w, y: Math.random() * -h, len: 9 + Math.random() * 13, sp: 7 + Math.random() * 7 };
        return {
            x: Math.random() * w, y: Math.random() * -h,
            r: SAKURA ? 4 + Math.random() * 4 : 1 + Math.random() * 2.6,
            sp: SAKURA ? 1 + Math.random() * 1.6 : 0.6 + Math.random() * 1.4,
            ph: Math.random() * Math.PI * 2, amp: 0.4 + Math.random() * 1.1, rot: Math.random() * Math.PI
        };
    }
    function init() {
        const base = RAIN ? 5.5 : (SAKURA ? 14 : 9);
        const count = Math.min(RAIN ? 240 : 170, Math.max(30, Math.floor(w / base)));
        parts = Array.from({ length: count }, spawn);
    }
    function resize() { w = c.width = innerWidth; h = c.height = innerHeight; init(); }
    function frame() {
        ctx.clearRect(0, 0, w, h);
        if (RAIN) {
            ctx.strokeStyle = 'rgba(174, 200, 255, 0.45)';
            ctx.lineWidth = 1.1;
            for (const p of parts) {
                p.y += p.sp; p.x += 1.4;
                if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1.4 * (p.len / p.sp), p.y - p.len); ctx.stroke();
            }
        } else {
            for (const p of parts) {
                p.ph += 0.012; p.y += p.sp; p.x += Math.sin(p.ph) * p.amp; p.rot += 0.01;
                if (p.y > h + 8) { p.y = -8; p.x = Math.random() * w; }
                if (p.x > w + 8) p.x = -8; else if (p.x < -8) p.x = w + 8;
                if (SAKURA) {
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.fillStyle = 'rgba(255, 183, 206, 0.85)';
                    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        _fxRAF = requestAnimationFrame(frame);
    }
    _fxResize = resize;
    window.addEventListener('resize', resize);
    resize();
    frame();
}
function setEffect(v) {
    prefs.effect = v;
    savePrefs();
    applyEffect();
}

function resetAllPrefs() {
    if (!confirm('Reset all preferences (favorites, theme, filters, history)?')) return;
    [PREFS_KEY, FAVS_KEY, RECENT_KEY, SEARCH_HIST_KEY, DL_COUNTS_KEY].forEach(k => localStorage.removeItem(k));
    location.reload();
}

function copyAllLinks(urlsJson) {
    let urls;
    try { urls = JSON.parse(decodeURIComponent(urlsJson)); } catch { return; }
    if (!Array.isArray(urls) || !urls.length) return;
    copyText(urls.join('\n'), `Copied ${urls.length} link${urls.length>1?'s':''}`);
}

function updateScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = p + '%';
}

function showNetIndicator(online) {
    const el = document.getElementById('net-indicator');
    if (!el) return;
    el.classList.remove('hidden', 'online', 'offline');
    el.classList.add(online ? 'online' : 'offline');
    el.innerHTML = online
        ? '<i class="fa-solid fa-wifi"></i>Back online'
        : '<i class="fa-solid fa-plane"></i>You\'re offline';
    clearTimeout(showNetIndicator._t);
    showNetIndicator._t = setTimeout(() => el.classList.add('hidden'), 2400);
}

let _deferredInstallPrompt = null;
function installPwa() {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.finally(() => {
        _deferredInstallPrompt = null;
        document.getElementById('pwa-install')?.classList.add('hidden');
    });
}

function renderLanguageSelect() {
    const sel = document.getElementById('setting-language');
    if (!sel) return;
    sel.innerHTML = LANGUAGE_LIST.map(l => `<option value="${escapeAttr(l.code)}" ${l.code === prefs.language ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');
}
function renderAccentSwatches() {
    const wrap = document.getElementById('setting-accent');
    if (!wrap) return;
    wrap.innerHTML = Object.entries(ACCENT_COLORS).map(([k, c]) =>
        `<button class="accent-swatch ${k === prefs.accent ? 'active' : ''}" style="background:${c.main}" onclick="setAccent('${k}')" aria-label="${c.name}" title="${c.name}"></button>`
    ).join('');
}
function renderSettingsSegmented() {
    const themes = [['auto', t('theme_auto')], ['dark', t('theme_dark')], ['light', t('theme_light')], ['schedule', 'Schedule']];
    const th = document.getElementById('setting-theme');
    if (th) th.innerHTML = themes.map(([v, lbl]) => `<button onclick="setThemePref('${v}')" class="${prefs.theme === v ? 'active' : ''}">${escapeHtml(lbl)}</button>`).join('');
    const ds = document.getElementById('setting-density-select'); if (ds) ds.value = prefs.density || 'cozy';
    setSwitchState('setting-motion', prefs.motion === 'reduce');
    setSwitchState('setting-ai-similar', !!prefs.aiSimilar);
}
function setThemePref(v) { prefs.theme = v; savePrefs(); applyTheme(); renderSettingsSegmented(); }
function openSettings() {
    renderLanguageSelect();
    renderAccentSwatches();
    renderAccentRecents();
    renderSettingsSegmented();
    setSwitchState('setting-compact-cards', !!prefs.compactCards);
    setSwitchState('setting-auto-collapse', !!prefs.autoCollapse);
    setSwitchState('setting-nightshift', !!prefs.nightShift);
    setSwitchState('setting-contrast', !!prefs.highContrast);
    setSwitchState('setting-data-saver', !!prefs.dataSaver);
    const tsr = document.getElementById('setting-text-scale'); if (tsr) tsr.value = prefs.textScale || 100;
    const efx = document.getElementById('setting-effect'); if (efx) efx.value = prefs.effect || 'none';
    applyTextScale();
    const ns = document.getElementById('nightshift-strength-row'); if (ns) ns.style.display = prefs.nightShift ? '' : 'none';
    const nss = document.getElementById('setting-nightshift-strength'); if (nss) nss.value = prefs.nightShiftStrength || 30;
    const pk = document.getElementById('setting-accent-picker');
    const cur = (prefs.accent === 'custom' && prefs.customAccent) ? prefs.customAccent : (ACCENT_COLORS[prefs.accent]?.main || '#6c5ce7');
    if (pk) pk.value = cur;
    const hx = document.getElementById('setting-accent-hex'); if (hx) hx.textContent = cur;
    const ds = document.getElementById('setting-density-select'); if (ds) ds.value = prefs.density || 'cozy';
    switchSettingsTab(prefs._settingsTab || 'appearance');
    const _sm = document.getElementById('settings-modal');
    _sm.classList.remove('hidden');
    _sm.classList.add('active');
}
function closeSettings() { document.getElementById('settings-modal').classList.remove('active'); }

function switchSettingsTab(tab) {
    const valid = ['appearance', 'behavior', 'tools'];
    if (!valid.includes(tab)) tab = 'appearance';
    prefs._settingsTab = tab;
    document.querySelectorAll('.settings-nav-btn').forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.settings-panel').forEach(p => {
        const on = p.dataset.panel === tab;
        p.classList.toggle('active', on);
        if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    const sel = document.getElementById('settings-nav-select');
    if (sel && sel.value !== tab) sel.value = tab;
}

function toggleSettingDesc(btn) {
    const item = btn.closest('.settings-item');
    if (!item) return;
    const desc = item.querySelector('.settings-desc');
    if (!desc) return;
    const open = desc.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

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

function renderMarkdown(text) {
    if (!text) return '';
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = esc(text).split('\n');
    const out = [];
    let inList = false;
    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
    const isTableSep = (s) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(s);
    const splitRow = (s) => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i].trimEnd();
        if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
            closeList();
            const headers = splitRow(l);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
            i--;
            out.push('<table class="md-table"><thead><tr>'
                + headers.map(h => `<th>${formatInline(h)}</th>`).join('')
                + '</tr></thead><tbody>'
                + rows.map(r => '<tr>' + headers.map((_, ci) => `<td>${formatInline(r[ci] || '')}</td>`).join('') + '</tr>').join('')
                + '</tbody></table>');
            continue;
        }
        const hMatch = l.match(/^(#{1,3})\s+(.*)$/);
        if (hMatch) {
            closeList();
            const n = hMatch[1].length;
            out.push(`<h${n}>${formatInline(hMatch[2])}</h${n}>`);
            continue;
        }
        if (/^[-*]\s+/.test(l)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${formatInline(l.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }
        closeList();
        if (l.trim() === '') { out.push(''); continue; }
        out.push(`<p>${formatInline(l)}</p>`);
    }
    closeList();
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

function openAllDownloads(urlsJson) {
    let urls;
    try { urls = JSON.parse(decodeURIComponent(urlsJson)); } catch { return; }
    if (!Array.isArray(urls) || urls.length === 0) return;
    if (urls.length > 6 && !confirm(`Open ${urls.length} downloads in new tabs?`)) return;
    urls.forEach((u, i) => setTimeout(() => window.open(u, '_blank', 'noopener'), i * 120));
}

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

function applyTheme() {
    let mode;
    if (prefs.theme === 'auto')        mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    else if (prefs.theme === 'schedule') { const h = new Date().getHours(); mode = (h >= 18 || h < 6) ? 'dark' : 'light'; }
    else mode = prefs.theme;
    document.documentElement.dataset.theme = mode;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const icons = { auto: 'fa-circle-half-stroke', dark: 'fa-moon', light: 'fa-sun', schedule: 'fa-clock' };
        btn.innerHTML = `<i class="fa-solid ${icons[prefs.theme]||'fa-circle-half-stroke'}"></i>`;
        btn.title = `Theme: ${prefs.theme} (T to cycle)`;
    }
}
function cycleTheme() {
    const order = ['auto', 'dark', 'light', 'schedule'];
    prefs.theme = order[(order.indexOf(prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
    const label = { auto: t('theme_auto'), dark: t('theme_dark'), light: t('theme_light'), schedule: 'Schedule' }[prefs.theme];
    toast(`${t('toast_theme')}: ${label}`, 'palette');
    renderSettingsSegmented();
}

function toast(message, icon = 'circle-check') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const safeIcon = String(icon).replace(/[^a-z0-9-]/gi, '') || 'circle-check';
    el.innerHTML = `<i class="fa-solid fa-${safeIcon}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 250);
    }, 2200);
}

async function copyText(text, label) {
    let ok = false;
    try {
        await navigator.clipboard.writeText(text);
        ok = true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            ok = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch { ok = false; }
    }
    toast(ok ? (label || t('toast_copied')) : 'Copy failed', ok ? 'copy' : 'triangle-exclamation');
}
function copyFilename(name) { copyText(name, `${t('toast_copied')}: ${name}`); }
function copyDownload(url) { copyText(url, t('toast_link_copied')); }
function shareClient(clientId, name) {
    const c = allClients.find(x => x.id === clientId);
    const url = c ? clientUrl(c) : `${location.origin}${location.pathname}#client=${encodeURIComponent(clientId)}`;
    const title = `${name || (c && c.displayName) || 'Nyxora Library'} · Nyxora Library`;
    if (navigator.share) {
        try {
            const p = navigator.share({ title, url });
            if (p && typeof p.then === 'function') {
                p.catch(err => {
                    if (err && err.name === 'AbortError') return;
                    copyText(url, t('toast_link_copied'));
                });
            }
            return;
        } catch { }
    }
    copyText(url, t('toast_link_copied'));
}

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

function randomClient() {
    if (allClients.length === 0) return;
    const c = allClients[Math.floor(Math.random() * allClients.length)];
    scrollToClient(c.id);
    toast(`${t('toast_random')}: ${c.displayName}`, 'shuffle');
}

function applySortFilter(clients) {
    const tagFilters = prefs.tagFilters;
    let arr = clients;
    if (tagFilters.length > 0) {
        arr = arr.filter(c => tagFilters.every(t => {
            if (t === 'favorites')       return favorites.has(c.id);
            if (t === 'new')             return isNewClient(c);
            if (t === 'popular')         return c.isPopular;
            if (t === 'optifine')        return c.isOptifine;
            if (t === 'has-screenshots') return c.screenshots && c.screenshots.length > 0;
            if (t === 'has-video')       return c.screenshots && c.screenshots.some(s => s.type === 'video');
            if (t === 'has-extensions')  return c.extensions && c.extensions.length > 0;
            return c.tags.includes(t);
        }));
    }
    const sortFn = {
        'name-asc':         (a, b) => a.displayName.localeCompare(b.displayName),
        'name-desc':        (a, b) => b.displayName.localeCompare(a.displayName),
        'recent-desc':      (a, b) => (b.addedAt || 0) - (a.addedAt || 0) || a.displayName.localeCompare(b.displayName),
        'size-desc':        (a, b) => (b.totalBytes || 0) - (a.totalBytes || 0) || a.displayName.localeCompare(b.displayName),
        'files-desc':       (a, b) => (b.files.length + b.extensions.length) - (a.files.length + a.extensions.length),
        'screenshots-desc': (a, b) => (b.screenshots?.length || 0) - (a.screenshots?.length || 0),
        'extensions-desc':  (a, b) => b.extensions.length - a.extensions.length,
    }[prefs.sort] || ((a, b) => a.displayName.localeCompare(b.displayName));
    return [...arr].sort(sortFn);
}

function renderSortMenu() {
    const menu = document.getElementById('sort-menu');
    if (!menu) return;
    menu.innerHTML = SORT_OPTIONS.map(o => `
        <button onclick="setSort('${o.id}')" class="${prefs.sort === o.id ? 'active' : ''}" role="menuitem">
            <i class="fa-solid ${o.icon}"></i><span>${t(o.tKey)}</span><i class="fa-solid fa-check"></i>
        </button>`).join('');
}
function isMobile() { return window.matchMedia('(max-width: 640px)').matches; }
function openSortSheet() {
    const menu = document.getElementById('sort-menu');
    renderSortMenu();
    menu.classList.remove('hidden');
    if (isMobile()) {
        // Portal the sheet to <body> so it escapes the sticky toolbar's
        // stacking context — otherwise z-index 200 is trapped under the
        // toolbar (z-index 35) and renders behind the backdrop blur.
        document.body.appendChild(menu);
        document.getElementById('sheet-backdrop')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}
function closeSortSheet() {
    const menu = document.getElementById('sort-menu');
    if (menu) {
        menu.classList.add('hidden');
        // Restore into the toolbar wrapper so the desktop dropdown anchors correctly.
        const wrapper = document.getElementById('sort-btn')?.parentElement;
        if (wrapper && menu.parentElement !== wrapper) wrapper.appendChild(menu);
    }
    document.getElementById('sheet-backdrop')?.classList.add('hidden');
    document.body.style.overflow = '';
}
function toggleSortMenu(e) {
    e?.stopPropagation();
    const menu = document.getElementById('sort-menu');
    if (!menu.classList.contains('hidden')) closeSortSheet();
    else openSortSheet();
}
function setSort(id) {
    prefs.sort = id;
    savePrefs();
    closeSortSheet();
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
function filterByVersion(versionStr) {
    const ver = String(versionStr).replace('_', '.');
    const si = document.getElementById('search-input');
    if (!si) return;
    si.value = `version:${ver}`;
    si.dispatchEvent(new Event('input'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(`${t('filter')}: ${formatVersionDisplay(versionStr)}`, 'code-branch');
}
window.filterByVersion = filterByVersion;
function clearAllFilters() {
    prefs.tagFilters = [];
    savePrefs();
    renderFilterChips();
    renderClients(currentQuery);
    toast(t('toast_filters_cleared'), 'broom');
}

function openHelp() { document.getElementById('help-modal').classList.add('active'); }
function closeHelp() { document.getElementById('help-modal').classList.remove('active'); }
function openTakedownRequest() { document.getElementById('takedown-modal')?.classList.add('active'); }
function closeTakedownRequest() { document.getElementById('takedown-modal')?.classList.remove('active'); }

function applyHashOnce() {
    const hash = location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const cat = params.get('cat');
    let clientRef = params.get('client');
    if (!clientRef && !hash.includes('=') && !hash.includes('&')) clientRef = hash;
    if (cat && libraryTree.some(c => c.name === cat)) {
        switchCategory(cat);
    }
    if (clientRef) {
        const c = findClientByRef(clientRef);
        if (c) setTimeout(() => scrollToClient(c.id), 350);
    }
}

function moveKbFocus(delta) {
    const blocks = Array.from(document.querySelectorAll('.client-block'));
    if (blocks.length === 0) return;
    kbFocusIndex = Math.max(0, Math.min(blocks.length - 1, (kbFocusIndex < 0 ? 0 : kbFocusIndex + delta)));
    blocks.forEach((b, i) => b.classList.toggle('kb-focused', i === kbFocusIndex));
    blocks[kbFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getMonetizedUrl(targetUrl) {
    if (!isMonetizationOn() || !LINKVERTISE_USER_ID) return targetUrl;
    try {
        const encoded = encodeURIComponent(btoa(targetUrl));
        const random = Math.random() * 1000;
        return `https://link-to.net/${LINKVERTISE_USER_ID}/${random}/dynamic/?r=${encoded}`;
    } catch (e) {
        return targetUrl;
    }
}

function formatName(name) {
    if (!name) return "";
    return name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function formatFileSize(bytes) {
    if (bytes == null) return null;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

const NEW_WINDOW_DAYS = 14;
function isNewClient(c) {
    if (!c || !c.addedAt) return false;
    return (Date.now() / 1000 - c.addedAt) < NEW_WINDOW_DAYS * 86400;
}
function relativeTime(unixSeconds) {
    if (!unixSeconds) return '';
    const diff = Date.now() / 1000 - unixSeconds;
    if (diff < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
        const n = Math.floor(diff / secs);
        if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
    return 'just now';
}
function libraryLastUpdated() {
    let max = 0;
    for (const c of allClients) if ((c.addedAt || 0) > max) max = c.addedAt;
    return max;
}
function libraryTotalBytes() {
    return allClients.reduce((sum, c) => sum + (c.totalBytes || 0), 0);
}

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
        btn.innerHTML = `<i class="fa-solid fa-angles-down"></i><span>${t('expand_all')}</span>`;
    } else {
        bodies.forEach(b => b.classList.remove('collapsed'));
        document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
            b.innerHTML = `<i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">${t('collapse_all').replace(/\s.+/, '')}</span>`;
        });
        btn.innerHTML = `<i class="fa-solid fa-angles-up"></i><span>${t('collapse_all')}</span>`;
    }
    allExpanded = !allExpanded;
}

function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx)) + '<span class="search-highlight">' + escapeHtml(text.slice(idx, idx + query.length)) + '</span>' + escapeHtml(text.slice(idx + query.length));
}

function fuzzySubseq(needle, haystack) {
    let i = 0;
    for (let h = 0; h < haystack.length && i < needle.length; h++) {
        if (haystack[h] === needle[i]) i++;
    }
    return i === needle.length;
}

function searchClients(query, limit) {
    const q = query.toLowerCase().trim();
    if (!q) return { results: [], total: 0 };

    const results = [];
    let total = 0;
    const useFuzzy = q.length >= 3;

    for (const cat of libraryTree) {
        for (const client of cat.clients) {
            if (client._search.includes(q) || (useFuzzy && fuzzySubseq(q, client.displayName.toLowerCase()))) {
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
    const raw = query.trim();
    const parsed = parseSearch(raw);
    const q = parsed.text.trim();
    const opsActive = parsed.ops.tag.length + parsed.ops.version.length + parsed.ops.has.length > 0;

    if (!raw) {
        dropdown.classList.add('hidden');
        clearBtn.classList.add('hidden');
        countEl.classList.add('hidden');
        dropdownIndex = -1;
        return;
    }

    clearBtn.classList.remove('hidden');

    if (!q && opsActive) {
        countEl.classList.add('hidden');
        dropdown.classList.add('hidden');
        dropdownIndex = -1;
        return;
    }

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
        <div class="search-dropdown-item${i === dropdownIndex ? ' focused' : ''}" data-client-id="${escapeAttr(r.id)}" onclick="scrollToClient(${jsArg(r.id)})">
            ${r.icon
                ? `<img src="${r.icon}" class="search-dropdown-icon" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'search-dropdown-icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></div>'">`
                : '<div class="search-dropdown-icon-placeholder"><i class="fa-solid fa-cube"></i></div>'
            }
            <div class="search-dropdown-info">
                <div class="search-dropdown-name">${highlightMatch(r.name, q)}</div>
                <div class="search-dropdown-meta">
                    <span>${escapeHtml(r.category)}</span>
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

function setMeta(prop, value, attr) {
    attr = attr || 'property';
    let el = document.head.querySelector(`meta[${attr}="${prop}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, prop); document.head.appendChild(el); }
    el.setAttribute('content', value);
}
function updateClientMeta(client) {
    if (!client) {
        document.title = 'Nyxora Library';
        setMeta('og:title', 'Nyxora Library (Client Library)');
        setMeta('og:url', SITE_URL);
        return;
    }
    const parts = [];
    if (client.compatVersions && client.compatVersions.length) parts.push(formatVersionDisplay(client.compatVersions[0]));
    if (client.totalBytes) parts.push(formatFileSize(client.totalBytes));
    const desc = (client.description || '').replace(/\s+/g, ' ').trim().slice(0, 160)
        || `${client.displayName} — Minecraft Bedrock client${parts.length ? ' (' + parts.join(', ') + ')' : ''} on Nyxora Library.`;
    document.title = `${client.displayName} · Nyxora Library`;
    setMeta('description', desc, 'name');
    setMeta('og:title', `${client.displayName} · Nyxora Library`);
    setMeta('og:description', desc);
    setMeta('og:url', clientUrl(client));
    if (client.bannerUrl || client.iconUrl) setMeta('og:image', client.bannerUrl || client.iconUrl);
}

function scrollToClient(clientId) {
    trackRecentlyViewed(clientId);
    const c = allClients.find(x => x.id === clientId);
    if (c) { updateClientMeta(c); try { history.replaceState(null, '', '/' + (c.slug || clientId)); } catch {} }
    const searchInput = document.getElementById('search-input');
    let el = document.getElementById(`block-${clientId}`);
    if (!el) {
        if (searchInput) searchInput.value = '';
        if (currentCategory !== 'ALL') switchCategory('ALL');
        renderClients('');
        el = document.getElementById(`block-${clientId}`);
    }
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
    if (searchInput) searchInput.blur();
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

const smartSort = (a, b) => a.rawName.localeCompare(b.rawName, undefined, { numeric: true, sensitivity: 'base' });

function isOptifinePack(name, desc) {
    const n = (name || '').toLowerCase();
    const d = (desc || '').toLowerCase();
    if (/opti\s*-?\s*fine/.test(n) || /opti\s*-?\s*fine/.test(d)) return true;
    return ['opti', 'fps'].some(k => n.includes(k));
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
        /(?<![.\d])(\d+)[._](\d{2})\b/g
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
        return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(t.replace(/^https?:\/\//, ''))}</a>`;
    }
    return `<span>${escapeHtml(t)}</span>`;
}

function extractVersion(name) {
    const m = name.match(/^(\d+)_(\d+)$/);
    return m ? { major: parseInt(m[1]), minor: parseInt(m[2]) } : null;
}

function formatVersionDisplay(versionStr) {
    const m = versionStr.match(/^(\d+)_(\d+)$/);
    if (m) {
        const major = parseInt(m[1], 10), minor = parseInt(m[2], 10);
        return (major === 1 && minor >= 22) ? 'v' + minor : major + '.' + minor;
    }
    return versionStr.replace('_', '.');
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
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function jsArg(value) {
    return escapeAttr(JSON.stringify(String(value)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
}

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
        ${(()=>{const u=libraryLastUpdated();return u?`<span class="stat-chip stat-chip-muted" title="Library last updated ${escapeAttr(new Date(u*1000).toLocaleString())}"><i class="fa-solid fa-calendar-check"></i>${escapeHtml(relativeTime(u))}</span>`:'';})()}
    `;
    if (animate && prefs.motion !== 'reduce') {
        statsBar.querySelectorAll('strong[data-num]').forEach(el => animateCount(el, parseInt(el.dataset.num, 10)));
    }
}

function buildSearchString(client) {
    let s = client.displayName.toLowerCase() + '\0';
    if (client.description) s += client.description.toLowerCase() + '\0';
    s += client.tags.join('\0') + '\0';
    if (client.compatVersions) s += client.compatVersions.map(v => v.replace('_', '.')).join('\0') + '\0';
    for (const f of client.files) s += f.display.toLowerCase() + '\0' + f.rawName.toLowerCase() + '\0';
    for (const e of client.extensions) s += e.display.toLowerCase() + '\0' + e.rawName.toLowerCase() + '\0';
    return s;
}

function updateTabScrollButtons() {
    const scrollContainer = document.getElementById('category-tabs');
    const leftBtn = document.getElementById('tab-scroll-left');
    const rightBtn = document.getElementById('tab-scroll-right');
    if (!scrollContainer || !leftBtn || !rightBtn) return;
    const canScroll = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (canScroll) {
        leftBtn.classList.add('visible');
        rightBtn.classList.add('visible');
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

async function init() {
    try {
        const cacheBust = Date.now();
        let response = await fetch(`paths.json?t=${cacheBust}`, { cache: 'no-store' });
        if (!response.ok) {
            response = await fetch(`${BASE_RAW_URL}/paths.json?t=${cacheBust}`, { cache: 'no-store' });
        }
        if (!response.ok) throw new Error(`paths.json returned ${response.status}`);
        const rawEntries = await response.json();
        const structured = {};
        const detectedCategories = new Set();

        const isNewFormat = rawEntries.length > 0 && typeof rawEntries[0] === 'object';

        rawEntries.forEach(entry => {
            const path = isNewFormat ? entry.path : entry;
            const parts = path.split('/');
            if (parts.length < 3) return;
            const category = parts[1], clientName = parts[2], fileName = parts[parts.length - 1];
            detectedCategories.add(category);
            if (!structured[category]) structured[category] = {};
            if (!structured[category][clientName]) {
                structured[category][clientName] = { icon: null, banner: null, description: null, author: null, tags: [], screenshots: [], files: [], extensions: [], isOptifine: false, compatVersions: new Set(), addedAt: 0, totalBytes: 0 };
            }
            const encodedPath = parts.map(p => encodeURIComponent(p)).join('/');
            const fullUrl = `${BASE_RAW_URL}/${encodedPath}`;
            const downloadUrl = LFS_EXTENSIONS.test(fileName) ? `${BASE_MEDIA_URL}/${encodedPath}` : fullUrl;
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
            } else if (!lowerName.includes('.') && !['readme','license'].includes(lowerName)) {
                if (!client.tags.includes(lowerName)) client.tags.push(lowerName);
            } else {
                detectTags(parts).forEach(t => { if (!client.tags.includes(t)) client.tags.push(t); });
                if (lowerName.match(/\.(zip|dll|so|apk|mcpack|mcaddon)$/)) {
                    const isExt = parts.some(p => p.toLowerCase() === 'extensions');
                    const bytes = (isNewFormat && entry.size) ? entry.size : 0;
                    const fileObj = {
                        display: formatName(fileName),
                        rawName: fileName,
                        url: downloadUrl,
                        size: bytes ? formatFileSize(bytes) : null,
                        sizeBytes: bytes
                    };
                    client.totalBytes += bytes;
                    if (isNewFormat && entry.mtime && entry.mtime > client.addedAt) client.addedAt = entry.mtime;
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
                        optifineClients[name].totalBytes = (optifineClients[name].totalBytes || 0) + (data.totalBytes || 0);
                        if ((data.addedAt || 0) > (optifineClients[name].addedAt || 0)) optifineClients[name].addedAt = data.addedAt;
                    }
                    delete structured[cat][name];
                }
            });
        });
        if (Object.keys(optifineClients).length > 0) {
            structured["Optifine Packs"] = optifineClients;
            detectedCategories.add("Optifine Packs");
        }

        const popularClients = {};
        Object.keys(structured).forEach(cat => {
            if (cat === "Popular Clients") return;
            Object.entries(structured[cat]).forEach(([name, data]) => {
                if ((data.tags || []).includes('popular')) {
                    popularClients[name] = { ...data, originalCategory: cat };
                    delete structured[cat][name];
                }
            });
        });
        if (Object.keys(popularClients).length > 0) {
            structured["Popular Clients"] = popularClients;
            detectedCategories.add("Popular Clients");
        }
        Object.keys(structured).forEach(cat => { if (Object.keys(structured[cat]).length === 0) { delete structured[cat]; detectedCategories.delete(cat); } });

        const sorted = sortCategories(Array.from(detectedCategories).map(name => ({
            name,
            displayName: extractVersion(name)
                ? `Version: ${formatVersionDisplay(name)}`
                : name
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
                    addedAt: data.addedAt || 0,
                    totalBytes: data.totalBytes || 0,
                    _search: ''
                };
                c._search = buildSearchString(c);
                return c;
            }).filter(c => c.files.length > 0 || c.extensions.length > 0).sort((a, b) => a.displayName.localeCompare(b.displayName));
            return { name, displayName, clients: list };
        }).filter(c => c && c.clients.length > 0);

        allClients = [];
        libraryTree.forEach(cat => cat.clients.forEach(c => allClients.push(c)));
        allClients.forEach(c => {
            const base = slugify(c.displayName) || c.id.toLowerCase();
            c.slug = base;
            if (!slugMap[base]) slugMap[base] = c.id;
        });

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
            const scrollContainer = document.getElementById('category-tabs');
            if (scrollContainer) {
                scrollContainer.addEventListener('scroll', updateTabScrollButtons);
                window.addEventListener('resize', updateTabScrollButtons);
                document.getElementById('tab-scroll-left').addEventListener('click', () => scrollTabs('left'));
                document.getElementById('tab-scroll-right').addEventListener('click', () => scrollTabs('right'));
                setTimeout(updateTabScrollButtons, 50);
            }
            requestAnimationFrame(() => { main.style.opacity = '1'; });
        }, 250);
    } catch (err) {
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
        const label = name === "ALL"
            ? t('all')
            : (cat ? cat.displayName : (extractVersion(name) ? `Version: ${formatVersionDisplay(name)}` : name));
        return `<button onclick="switchCategory(${jsArg(name)})" id="tab-${escapeAttr(name)}" class="tab-btn">${escapeHtml(label)}<span class="tab-count">${countFor(name)}</span></button>`;
    });
    if (favCount > 0) {
        buttons.splice(1, 0, `<button onclick="switchCategory('__favorites__')" id="tab-__favorites__" class="tab-btn"><i class="fa-solid fa-star" style="color:#fbbf24;margin-right:0.3rem"></i>${escapeHtml(t('favorites'))}<span class="tab-count">${favCount}</span></button>`);
    }
    container.innerHTML = buttons.join('');
    document.getElementById(`tab-${currentCategory}`)?.classList.add('active');
    setTimeout(updateTabScrollButtons, 10);
}

function switchCategory(name) {
    currentCategory = name;
    prefs.category = name;
    savePrefs();
    updateClientMeta(null);
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    kbFocusIndex = -1;
    renderClients(currentQuery);
    if (prefs.autoCollapse) {
        setTimeout(() => {
            document.querySelectorAll('.client-body').forEach(b => b.classList.add('collapsed'));
            document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
                b.innerHTML = `<i class="fa-solid fa-chevron-down"></i><span class="hide-mobile">${t('expand_all').replace(/\s.+/, '')}</span>`;
            });
            allExpanded = false;
            const eb = document.getElementById('expand-all-btn');
            if (eb) eb.innerHTML = `<i class="fa-solid fa-angles-down"></i><span>${t('expand_all')}</span>`;
        }, 0);
    }
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
}

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

        parts.push(`<div class="category-group"><div class="section-label"><span>${escapeHtml(cat.displayName)}</span></div>`);

        filtered.forEach(client => {
            const hasDesc = client.description?.trim().length > 0;
            const hasAuthor = client.author && Object.keys(client.author).length > 0;
            const hasSS = client.screenshots?.length > 0;
            const hasDetails = hasDesc || hasAuthor || hasSS;
            const manyFiles = client.matchingFiles.length > 5;
            const ssJson = escapeAttr(JSON.stringify(client.screenshots));

            parts.push(`<div class="client-block" id="block-${escapeAttr(client.id)}" style="content-visibility:auto;contain-intrinsic-size:auto 300px">`);

            const isFav = favorites.has(client.id);
            const safeName = jsArg(client.displayName);
            const safeId = jsArg(client.id);
            const iconHtml = client.iconUrl
                ? `<img src="${escapeAttr(client.iconUrl)}" class="client-icon" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'client-icon icon-placeholder\\'><i class=\\'fa-solid fa-cube\\'></i></div>'">`
                : `<div class="client-icon icon-placeholder"><i class="fa-solid fa-cube"></i></div>`;
            parts.push(`<div class="client-header">
                <div class="client-info">
                    ${iconHtml}
                    <div class="client-meta">
                        <div class="client-name" onclick="shareClient(${safeId}, ${safeName})" title="${escapeAttr(t('share'))}">${escapeHtml(client.displayName)}${isNewClient(client) ? `<span class="new-badge" title="Added ${escapeAttr(relativeTime(client.addedAt))}"><i class="fa-solid fa-sparkles"></i>NEW</span>` : ''}${(()=>{const key=client.slug||slugify(client.displayName);const g=loadGlobalDl()[key];const n=g?g.n:0;return `<span id="dl-badge-${escapeAttr(client.id)}" class="dl-count-badge${n?'':' hidden'}" title="Total downloads"><i class="fa-solid fa-download"></i><span class="dl-count-n">${fmtCount(n)}</span></span>`;})()}</div>
                        <div class="tag-row">
                            ${client.isPopular ? `<button class="tag tag-popular clickable" onclick="event.stopPropagation();toggleTagFilterFromTag('popular')"><i class="fa-solid fa-star"></i>${escapeHtml(t('popular'))}</button>` : ''}
                            ${client.isOptifine ? `<button class="tag tag-optifine clickable" onclick="event.stopPropagation();toggleTagFilterFromTag('optifine')"><i class="fa-solid fa-bolt"></i>${escapeHtml(t('optifine'))}</button>` : ''}
                            ${client.originalCategory && client.isOptifine ? `<span class="tag tag-category"><i class="fa-solid fa-layer-group"></i>${escapeHtml(client.originalCategory)}</span>` : ''}
                            ${client.tags.map(tg => { const label = t(tg) || tg; return `<button class="tag tag-${escapeAttr(tg)} clickable" onclick="event.stopPropagation();toggleTagFilterFromTag(${jsArg(tg)})" title="${escapeAttr(t('filter'))}: ${escapeAttr(label)}"><i class="fa-solid ${TAG_ICONS[tg]||'fa-tag'}"></i>${escapeHtml(label.charAt(0).toUpperCase()+label.slice(1))}</button>`; }).join('')}
                            ${(client.compatVersions && client.compatVersions.length > 0) ? client.compatVersions.map(v => `<button class="tag tag-version clickable" onclick="event.stopPropagation();filterByVersion(${jsArg(v)})" title="${escapeAttr(t('filter'))}: ${escapeAttr(formatVersionDisplay(v))}"><i class="fa-solid fa-code-branch"></i>${formatVersionDisplay(v)}</button>`).join('') : ''}
                            ${client.totalBytes ? `<span class="tag tag-size" title="Total download size"><i class="fa-solid fa-weight-scale"></i>${escapeHtml(formatFileSize(client.totalBytes))}</span>` : ''}
                            ${client.addedAt ? `<span class="tag tag-date" title="Last updated ${escapeAttr(new Date(client.addedAt*1000).toLocaleDateString())}"><i class="fa-solid fa-clock-rotate-left"></i>${escapeHtml(relativeTime(client.addedAt))}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="client-actions" data-client-id="${escapeAttr(client.id)}">
                    ${(client.files.length + client.extensions.length) > 1 ? `<button class="action-icon copy-all-btn" onclick="copyAllLinks('${escapeAttr(encodeURIComponent(JSON.stringify([...client.files, ...client.extensions].map(f => getMonetizedUrl(f.url)))))}')" aria-label="Copy all links" title="Copy all links"><i class="fa-solid fa-clipboard-list"></i></button>` : ''}
                    ${(client.files.length + client.extensions.length) > 1 ? `<button class="action-icon" onclick="openAllDownloads('${escapeAttr(encodeURIComponent(JSON.stringify([...client.files, ...client.extensions].map(f => getMonetizedUrl(f.url)))))}')" aria-label="${escapeAttr(t('open_all'))}" title="${escapeAttr(t('open_all'))}"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>` : ''}
                    <button class="action-icon fav-btn ${isFav ? 'active' : ''}" data-fav-id="${escapeAttr(client.id)}" onclick="toggleFavorite(${safeId}, ${safeName})" aria-label="${escapeAttr(t('favorites'))}" title="${escapeAttr(t('favorites'))}"><i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i></button>
                    <button class="action-icon" onclick="shareClient(${safeId}, ${safeName})" aria-label="${escapeAttr(t('share'))}" title="${escapeAttr(t('share'))}"><i class="fa-solid fa-link"></i></button>
                    <button id="collapse-btn-${escapeAttr(client.id)}" onclick="toggleClientCollapse(${safeId})" class="collapse-btn">
                        <i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">${escapeHtml(t('collapse_all').replace(/\s.+/, ''))}</span>
                    </button>
                </div>
            </div>`);

            parts.push(`<div id="body-${escapeAttr(client.id)}" class="client-body"><div class="client-body-inner">`);

            if (hasDetails) {
                parts.push(`<div id="details-${escapeAttr(client.id)}" class="details-panel"><div class="details-panel-inner"><div class="details-inner">`);

                if (hasSS) {
                    parts.push(`<div style="margin-bottom:1rem">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
                            <span style="display:flex;align-items:center;gap:0.4rem;font-weight:600;color:var(--white)"><i class="fa-solid fa-images" style="color:var(--accent)"></i>${escapeHtml(t('screenshots'))} (${client.screenshots.length})</span>
                            <button onclick="openScreenshots(${safeId},${ssJson})" style="background:none;border:none;color:var(--accent);font-size:0.8125rem;font-weight:600;cursor:pointer">${escapeHtml(t('view_all'))}</button>
                        </div>
                        <div class="ss-grid">${client.screenshots.slice(0,6).map((ss, i) => {
                            const media = ss.type === 'video'
                                ? `<video src="${ss.url}" muted playsinline preload="metadata"></video><span class="ss-thumb-play"><i class="fa-solid fa-play"></i></span>`
                                : `<img src="${ss.url}" alt="Screenshot ${i+1}" loading="lazy">`;
                            return `<div class="ss-thumb" onclick="openScreenshots(${safeId},${ssJson},${i})">${media}<div class="ss-thumb-overlay"><span class="ss-badge">${i+1}</span></div></div>`;
                        }).join('')}</div>
                    </div>`);
                }

                if (hasDesc) {
                    parts.push(`<div class="md" style="margin-bottom:0.75rem">${renderMarkdown(client.description)}</div>`);
                }

                if (hasAuthor) {
                    parts.push(`<div class="author-block">
                        <div class="author-name"><i class="fa-solid fa-user"></i>${escapeHtml(client.author.name||'Unknown')}</div>
                        ${client.author.website ? `<div class="author-link"><i class="fa-solid fa-globe"></i><a href="${escapeAttr(client.author.website)}" target="_blank" rel="noopener">${escapeHtml(client.author.website.replace(/^https?:\/\//,''))}</a></div>` : ''}
                        ${client.author.discord ? `<div class="author-link"><i class="fa-brands fa-discord"></i>${formatDiscordLink(client.author.discord)}</div>` : ''}
                        ${client.author.github ? `<div class="author-link"><i class="fa-brands fa-github"></i><a href="https://github.com/${escapeAttr(client.author.github)}" target="_blank" rel="noopener">@${escapeHtml(client.author.github)}</a></div>` : ''}
                    </div>`);
                }

                parts.push(`</div></div></div>`);
                parts.push(`<button id="details-btn-${escapeAttr(client.id)}" onclick="toggleDescription(${safeId})" class="details-toggle">${escapeHtml(t('show_details'))} <i class="fa-solid fa-chevron-down"></i></button>`);
            }

            if (client.matchingFiles.length > 0) {
                parts.push(`<div class="file-grid">`);
                client.matchingFiles.forEach((file, idx) => {
                    const hiddenClass = (!q && manyFiles && idx >= 5) ? `file-hidden-${client.id}` : '';
                    const hiddenStyle = (!q && manyFiles && idx >= 5) ? ' style="display:none"' : '';
                    const downloadUrl = getMonetizedUrl(file.url);
                    parts.push(`<div class="file-card ${escapeAttr(hiddenClass)}"${hiddenStyle}>
                        ${client.bannerUrl ? `<img src="${escapeAttr(client.bannerUrl)}" class="file-card-banner" loading="lazy" alt="" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='none')"><div class="file-card-overlay"></div>` : ''}
                        <div class="file-card-body">
                            <div class="file-info">
                                <div class="file-name"><i class="fa-solid fa-file-arrow-down"></i>${escapeHtml(file.display)}<span class="file-actions"><button class="file-icon-btn" onclick="copyFilename(${jsArg(file.rawName)})" title="${escapeAttr(t('copy_filename'))}" aria-label="${escapeAttr(t('copy_filename'))}"><i class="fa-solid fa-copy"></i></button><button class="file-icon-btn" onclick="copyDownload(${jsArg(downloadUrl)})" title="${escapeAttr(t('copy_link'))}" aria-label="${escapeAttr(t('copy_link'))}"><i class="fa-solid fa-link"></i></button></span></div>
                                <div class="file-raw">${escapeHtml(file.rawName)}</div>
                                ${file.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${escapeHtml(file.size)}</div>` : ''}
                            </div>
                            <a href="${escapeAttr(downloadUrl)}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>${escapeHtml(t('download'))}</a>
                        </div>
                    </div>`);
                });
                parts.push(`</div>`);
            }

            if (!q && manyFiles) {
                parts.push(`<button id="more-btn-${escapeAttr(client.id)}" onclick="toggleFileList(${safeId})" class="show-more-btn"><i class="fa-solid fa-angles-down"></i>${escapeHtml(t('show_more', { n: client.matchingFiles.length - 5 }))}</button>`);
            }

            if (client.matchingExtensions.length > 0) {
                parts.push(`<div class="ext-section">
                    <button id="ext-header-${escapeAttr(client.id)}" onclick="toggleDropdown(${safeId})" class="ext-header">
                        <span><i class="fa-solid fa-puzzle-piece" style="margin-right:0.4rem;color:var(--text-dim)"></i>${escapeHtml(t('extensions'))} (${client.matchingExtensions.length})</span>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </button>
                    <div id="ext-body-${escapeAttr(client.id)}" class="ext-body"><div class="ext-body-inner">
                        ${client.matchingExtensions.map(ext => {
                            const extDownloadUrl = getMonetizedUrl(ext.url);
                            return `
                            <div class="ext-row">
                                <div class="file-info">
                                    <div class="file-name" style="font-size:0.8125rem">${escapeHtml(ext.display)}<span class="file-actions"><button class="file-icon-btn" onclick="copyFilename(${jsArg(ext.rawName)})" title="${escapeAttr(t('copy_filename'))}" aria-label="${escapeAttr(t('copy_filename'))}"><i class="fa-solid fa-copy"></i></button><button class="file-icon-btn" onclick="copyDownload(${jsArg(extDownloadUrl)})" title="${escapeAttr(t('copy_link'))}" aria-label="${escapeAttr(t('copy_link'))}"><i class="fa-solid fa-link"></i></button></span></div>
                                    <div class="file-raw">${escapeHtml(ext.rawName)}</div>
                                    ${ext.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${escapeHtml(ext.size)}</div>` : ''}
                                </div>
                                <a href="${escapeAttr(extDownloadUrl)}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>${escapeHtml(t('download'))}</a>
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

document.addEventListener('DOMContentLoaded', () => {
    applyAccent();
    applyDensity();
    applyMotion();
    applyCompactCards();
    applyNightShift();
    applyHighContrast();
    applyTextScale();
    applyDataSaver();
    applyEffect();
    applyTheme();
    applyTranslations();

    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();

    window.addEventListener('online',  () => showNetIndicator(true));
    window.addEventListener('offline', () => showNetIndicator(false));

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        _deferredInstallPrompt = e;
        document.getElementById('pwa-install')?.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a.btn-dl');
        if (!a) return;
        const owner = a.closest('[data-client-id], .client-block');
        const id = owner?.dataset?.clientId || owner?.id?.replace(/^block-/, '');
        if (id) { bumpDlCount(id); recordGlobalDownload(id); }
    }, true);

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
        const sortWrap = document.getElementById('sort-btn')?.parentElement;
        const sortMenu = document.getElementById('sort-menu');
        if (sortMenu && !sortMenu.classList.contains('hidden') && sortWrap &&
            !sortWrap.contains(e.target) && !sortMenu.contains(e.target)) {
            closeSortSheet();
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
        if (document.getElementById('takedown-modal')?.classList.contains('active')) {
            if (e.key === 'Escape') closeTakedownRequest();
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
                closeSortSheet();
            }
            return;
        }

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
            if (e.key === 'b' || e.key === 'B') { e.preventDefault(); openTagBrowser(); return; }
            if (e.key === 'c' || e.key === 'C') { e.preventDefault(); compareSet.size >= 2 ? openCompare() : toast('Select 2+ clients to compare (⚖ icon)', 'circle-info'); return; }
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

});

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

function similarClients(client, limit = 6) {
    const activeKey = (client.rawName || client.displayName || client.id).toLowerCase();
    const seen = new Set([activeKey]);

    const clientTags = new Set([
        ...(client.tags || []),
        client.isOptifine ? 'optifine' : '',
        client.isPopular ? 'popular' : ''
    ].filter(Boolean));

    const clientVersions = new Set(client.compatVersions || []);
    const clientAuthor = (client.author && client.author.name || '').trim().toLowerCase();

    return allClients
        .filter(c => c.id !== client.id)
        .map(c => {
            const otherTags = new Set([
                ...(c.tags || []),
                c.isOptifine ? 'optifine' : '',
                c.isPopular ? 'popular' : ''
            ].filter(Boolean));

            const intersection = [...clientTags].filter(t => otherTags.has(t));
            const union = new Set([...clientTags, ...otherTags]);
            const tagScore = union.size ? (intersection.length / union.size) * 3 : 0;

            let versionScore = 0;
            for (const v of client.compatVersions || []) {
                if ((c.compatVersions || []).includes(v)) {
                    versionScore = 2.5;
                    break;
                }
            }
            if (versionScore === 0) {
                const families = new Set(
                    (client.compatVersions || []).map(v => v.replace(/_\d+$/, ''))
                );
                const otherFamilies = new Set(
                    (c.compatVersions || []).map(v => v.replace(/_\d+$/, ''))
                );
                if ([...families].some(f => otherFamilies.has(f))) {
                    versionScore = 1.0;
                }
            }

            const otherAuthor = (c.author && c.author.name || '').trim().toLowerCase();
            const authorScore = (clientAuthor && otherAuthor && clientAuthor === otherAuthor) ? 5.0 : 0;

            const catScore = (client.originalCategory && c.originalCategory && client.originalCategory === c.originalCategory) ? 2.0 : 0;

            const score = tagScore + versionScore + authorScore + catScore;
            return { c, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .filter(x => {
            const key = (x.c.rawName || x.c.displayName || x.c.id).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, limit)
        .map(x => x.c);
}

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
        { id:'a:tags',     label:'Browse by tag',         icon:'fa-tags',         run:openTagBrowser },
        { id:'a:csv',      label:'Export catalogue (CSV)',icon:'fa-file-csv',     run:exportCatalogCsv },
        { id:'a:compare',  label:'Compare selected',      icon:'fa-table-columns',run:openCompare },
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

function openStats() {
    const grid = document.getElementById('stats-grid'); if (!grid) return;
    const counts = loadDlCounts();
    const totalDl = Object.values(counts).reduce((a, b) => a + b, 0);
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = topId ? allClients.find(c => c.id === topId) : null;
    const recents = loadRecent();
    const notesCount = Object.keys(loadNotes()).length;
    const totalBytes = libraryTotalBytes();
    const updated = libraryLastUpdated();
    const newCount = allClients.filter(isNewClient).length;
    const items = [
        { i:'fa-star',              k:'Favorites',        v: favorites.size },
        { i:'fa-thumbtack',         k:'Pinned',           v: pinned.size },
        { i:'fa-download',          k:'Your downloads',   v: totalDl },
        { i:'fa-cube',              k:'Most downloaded',  v: top ? `${top.displayName} (${counts[topId]})` : '—' },
        { i:'fa-clock-rotate-left', k:'Recently viewed',  v: recents.length },
        { i:'fa-note-sticky',       k:'Notes saved',      v: notesCount },
        { i:'fa-layer-group',       k:'Clients',          v: allClients.length },
        { i:'fa-sparkles',          k:`New (${NEW_WINDOW_DAYS}d)`, v: newCount },
        { i:'fa-hard-drive',        k:'Total size',       v: totalBytes ? formatFileSize(totalBytes) : '—' },
        { i:'fa-calendar-check',    k:'Last updated',     v: updated ? relativeTime(updated) : '—' },
    ];
    grid.innerHTML = items.map(it => `<div class="stat-card"><i class="fa-solid ${it.i}"></i><div class="stat-card-v">${it.v}</div><div class="stat-card-k">${it.k}</div></div>`).join('');
    document.getElementById('stats-modal').classList.add('active');
}
function closeStats() { document.getElementById('stats-modal')?.classList.remove('active'); }

function openQr(clientId, name) {
    const url = `${location.origin}${location.pathname}#client=${encodeURIComponent(clientId)}`;
    document.getElementById('qr-target').innerHTML = `<img alt="QR for ${escapeAttr(name)}" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}" width="240" height="240" loading="lazy">`;
    document.getElementById('qr-url').textContent = url;
    document.getElementById('qr-modal').classList.add('active');
}
function closeQr() { document.getElementById('qr-modal')?.classList.remove('active'); }

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
        if (document.getElementById('compare-modal')?.classList.contains('active')) closeCompare();
        if (document.getElementById('tags-modal')?.classList.contains('active')) closeTagBrowser();
    }
});
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'cmdk-input') renderCmdk(e.target.value);
});

function decorateClientActions() {
    document.querySelectorAll('.client-actions[data-client-id]').forEach(actions => {
        if (actions.dataset.qolv3) return;
        actions.dataset.qolv3 = '1';
        const id = actions.dataset.clientId;
        const block = document.getElementById('block-' + id);
        const nameEl = block?.querySelector('.client-name');
        const name = nameEl ? nameEl.textContent.replace(/\s*\d+$/, '').trim() : id;
        const safeId = jsArg(id);
        const safeName = jsArg(name || '');
        const isPin = pinned.has(id);
        const hasNote = !!getNote(id);
        const isCmp = compareSet.has(id);
        const html = `
            <button class="action-icon cmp-btn ${isCmp ? 'active' : ''}" data-compare-id="${escapeAttr(id)}" onclick="toggleCompare(${safeId},${safeName})" title="Add to compare" aria-label="Add to compare"><i class="fa-solid fa-scale-balanced"></i></button>
            <button class="action-icon pin-btn ${isPin ? 'active' : ''}" data-pin-id="${escapeAttr(id)}" onclick="togglePin(${safeId},${safeName})" title="Pin to top" aria-label="Pin to top"><i class="fa-solid fa-thumbtack"></i></button>
            <button class="action-icon note-btn ${hasNote ? 'has-note' : ''}" data-note-id="${escapeAttr(id)}" onclick="openNote(${safeId},${safeName})" title="Personal note" aria-label="Personal note"><i class="fa-solid fa-note-sticky"></i></button>
            <button class="action-icon md-btn" onclick="copyClientMarkdown(${safeId})" title="Copy as Markdown" aria-label="Copy as Markdown"><i class="fa-brands fa-markdown"></i></button>
            <button class="action-icon qr-btn" onclick="openQr(${safeId},${safeName})" title="QR code" aria-label="QR code"><i class="fa-solid fa-qrcode"></i></button>
            <button class="action-icon report-btn" onclick="reportClient(${safeId},${safeName})" title="Report broken link" aria-label="Report broken link"><i class="fa-solid fa-flag"></i></button>
        `;
        const shareBtn = actions.querySelector('button[onclick^="shareClient"]');
        if (shareBtn) shareBtn.insertAdjacentHTML('beforebegin', html);
        else actions.insertAdjacentHTML('afterbegin', html);
    });

    document.querySelectorAll('.client-block').forEach(block => {
        if (!block.dataset.dlObs) { block.dataset.dlObs = '1'; ensureDlObserver().observe(block); }
        if (block.dataset.simInjected) return;
        const id = block.id.replace(/^block-/, ''); if (!id) return;
        const client = allClients.find(c => c.id === id); if (!client) return;

        const sims = prefs.aiSimilar ? [] : similarClients(client, 5);
        const stripContainerId = `sim-strip-${id}`;
        const stripHtml = `<div class="similar-strip" id="${stripContainerId}">
            <span class="similar-label"><i class="fa-solid fa-shuffle"></i> Similar clients</span>
            <div class="similar-list" id="${stripContainerId}-list">
                ${sims.length ? sims.map(s => `<button class="similar-chip" onclick="scrollToClient(${jsArg(s.id)})">${s.iconUrl?`<img src="${escapeAttr(s.iconUrl)}" alt="" loading="lazy">`:'<i class="fa-solid fa-cube"></i>'}<span>${escapeHtml(s.displayName)}</span></button>`).join('') : (prefs.aiSimilar ? '<span class="similar-loading">Loading…</span>' : '<span class="similar-empty">No similar clients found</span>')}
            </div>
        </div>`;

        block.dataset.simInjected = '1';

        const existingDetails = block.querySelector('.details-inner');
        if (existingDetails) {
            existingDetails.insertAdjacentHTML('beforeend', stripHtml);
        } else {
            const bodyInner = block.querySelector('.client-body-inner');
            if (!bodyInner) return;
            const panelHtml = `<div id="details-${escapeAttr(id)}" class="details-panel"><div class="details-panel-inner"><div class="details-inner">${stripHtml}</div></div></div>`
                + `<button id="details-btn-${escapeAttr(id)}" onclick="toggleDescription(${jsArg(id)})" class="details-toggle">${escapeHtml(t('show_details'))} <i class="fa-solid fa-chevron-down"></i></button>`;
            bodyInner.insertAdjacentHTML('afterbegin', panelHtml);
        }

        if (prefs.aiSimilar) {
            fetchAISimilarClients(client, 5).then(aiSims => {
                const listEl = document.getElementById(`${stripContainerId}-list`);
                if (!listEl) return;
                if (aiSims.length === 0) {
                    listEl.innerHTML = '<span class="similar-empty">No similar clients found</span>';
                    return;
                }
                listEl.innerHTML = aiSims.map(s => `<button class="similar-chip" onclick="scrollToClient(${jsArg(s.id)})">${s.iconUrl?`<img src="${escapeAttr(s.iconUrl)}" alt="" loading="lazy">`:'<i class="fa-solid fa-cube"></i>'}<span>${escapeHtml(s.displayName)}</span></button>`).join('');
            });
        }
    });

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

    Object.entries(loadNotes()).forEach(([id, text]) => {
        const block = document.getElementById('block-' + id); if (!block) return;
        if (block.querySelector('.client-note-inline')) return;
        const body = block.querySelector('.client-body-inner');
        if (body) body.insertAdjacentHTML('afterbegin', `<div class="client-note-inline"><i class="fa-solid fa-note-sticky"></i><span>${escapeHtml(text)}</span><button class="note-edit" onclick="openNote(${jsArg(id)},'')" aria-label="Edit note"><i class="fa-solid fa-pen"></i></button></div>`);
    });
}

(function patchRender() {
    const originalRender = window.renderClients;
    if (!originalRender) return;
    window.renderClients = function (query) {
        const parsed = parseSearch(query || '');
        window._lastSearchOps = parsed.ops;
        originalRender(parsed.text);
        if (parsed.ops.tag.length + parsed.ops.version.length + parsed.ops.has.length > 0) {
            document.querySelectorAll('.client-block').forEach(el => {
                const id = el.id.replace(/^block-/, '');
                const c = allClients.find(x => x.id === id);
                if (c && !matchesOps(c, parsed.ops)) el.remove();
            });
            document.querySelectorAll('.category-group').forEach(g => { if (!g.querySelector('.client-block')) g.remove(); });
        }
        decorateClientActions();
        updateBulkBar();
    };
})();

const mo = new MutationObserver(() => { decorateClientActions(); updateBulkBar(); });
document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('client-container');
    if (c) mo.observe(c, { childList: true });
});

const AI_HISTORY_KEY = 'nyxora_ai_history_v1';
let aiHistory = [];
let aiBusy = false;

function loadAiHistory() { try { return JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]'); } catch { return []; } }
function saveAiHistory() { try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory.slice(-30))); } catch {} }

function aiCatalog() {
    const seen = new Set();
    const lines = [];
    for (const c of allClients) {
        const slug = c.slug || slugify(c.displayName);
        if (seen.has(slug)) continue;
        seen.add(slug);
        const v = (c.compatVersions || []).map(formatVersionDisplay).join('/');
        const tags = [...(c.tags || []), c.isOptifine ? 'optifine' : '', c.isPopular ? 'popular' : ''].filter(Boolean).join(',');
        const files = c.files.length + c.extensions.length;
        const by = c.author && c.author.name ? ` | by:${c.author.name}` : '';
        const about = c.description ? ` | about:${c.description.replace(/\s+/g, ' ').trim().slice(0, 500)}` : '';
        lines.push(`- ${c.displayName} | url:${SITE_URL}/${slug}${v ? ` | versions:${v}` : ''}${tags ? ` | tags:${tags}` : ''} | files:${files}${c.screenshots && c.screenshots.length ? ' | screenshots' : ''}${by}${about}`);
        if (lines.length >= 250) break;
    }
    return lines.join('\n');
}
function aiSystemPrompt() {
    return `You are Nyxora AI, the assistant for the Nyxora Library (${SITE_URL}) — an archive of Minecraft Bedrock (MCPE) clients and texture packs.

Rules:
- Be concise, friendly, and accurate. Only recommend clients that appear in the catalog below; if something isn't there, say so briefly.
- ALWAYS turn a client's name into a Markdown link using its url, e.g. [Glacier Client](${SITE_URL}/glacier-client).
- When comparing two or more clients, respond with a Markdown table, e.g. | Client | Versions | Tags | Notes |.
- Use light Markdown (bold, bullet lists, tables). Keep answers focused and skimmable.
- Version naming: "1.21" and below use the legacy scheme; "v26" and up use Minecraft's new year-based scheme.

Catalog (name | url | versions | tags | files):
${aiCatalog()}`;
}

function toggleAiChat() {
    const el = document.getElementById('ai-chat');
    if (!el) return;
    if (el.classList.contains('hidden')) openAiChat(); else closeAiChat();
}
function openAiChat() {
    const el = document.getElementById('ai-chat');
    if (!el) return;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('open'));
    document.body.style.overflow = 'hidden';
    renderAiMessages();
    renderAiSuggestions();
    setTimeout(() => document.getElementById('ai-input')?.focus(), 120);
}
function closeAiChat() {
    const el = document.getElementById('ai-chat');
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => el.classList.add('hidden'), 250);
}
function clearAiChat() {
    aiHistory = [];
    saveAiHistory();
    renderAiMessages();
    renderAiSuggestions();
}

function renderAiMessages() {
    const box = document.getElementById('ai-messages');
    if (!box) return;
    if (aiHistory.length === 0) {
        box.innerHTML = `<div class="ai-empty">
            <span class="ai-empty-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
            <h3>Nyxora AI</h3>
            <p>Ask me to recommend a client, compare packs, or find something for your Minecraft version.</p>
        </div>`;
        return;
    }
    box.innerHTML = aiHistory.map((m, i) => {
        const isUser = m.role === 'user';
        const inner = isUser
            ? escapeHtml(m.text)
            : (m.text ? renderMarkdown(m.text) : '<span class="ai-typing"><i></i><i></i><i></i></span>');
        return `<div class="ai-msg ai-msg-${isUser ? 'user' : 'bot'}">
            ${isUser ? '' : '<span class="ai-msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></span>'}
            <div class="ai-bubble md" id="ai-bubble-${i}">${inner}</div>
        </div>`;
    }).join('');
    enhanceAiClientLinks(box);
    box.scrollTop = box.scrollHeight;
}
function enhanceAiClientLinks(scope) {
    if (!scope) return;
    scope.querySelectorAll('a:not([data-icon])').forEach(a => {
        let u; try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
        const sameSite = u.hostname === location.hostname || u.hostname.endsWith('glacierclient.xyz');
        if (!sameSite) return;
        const ref = u.hash ? u.hash.replace(/^#(client=)?/, '') : u.pathname.replace(/^\/+/, '');
        const c = findClientByRef(ref);
        if (!c) return;
        a.dataset.icon = '1';
        a.classList.add('ai-client-link');
        const icon = c.iconUrl
            ? `<img src="${escapeAttr(c.iconUrl)}" class="ai-link-icon" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'ai-link-icon ai-link-icon-ph\\'><i class=\\'fa-solid fa-cube\\'></i></span>'">`
            : `<span class="ai-link-icon ai-link-icon-ph"><i class="fa-solid fa-cube"></i></span>`;
        a.insertAdjacentHTML('afterbegin', icon);
    });
}
function updateAiBubble(i, html) {
    const el = document.getElementById('ai-bubble-' + i);
    if (el) { el.innerHTML = html; enhanceAiClientLinks(el); }
    const box = document.getElementById('ai-messages');
    if (box) box.scrollTop = box.scrollHeight;
}
function renderAiSuggestions() {
    const wrap = document.getElementById('ai-suggestions');
    if (!wrap) return;
    if (aiHistory.length > 0) { wrap.innerHTML = ''; return; }
    const s = ['Best client for v26?', 'Show me Optifine packs', 'A lightweight client for 1.19', 'What is popular right now?'];
    wrap.innerHTML = s.map(q => `<button class="ai-suggestion" onclick="aiQuick(${jsArg(q)})">${escapeHtml(q)}</button>`).join('');
}
function aiQuick(q) {
    const i = document.getElementById('ai-input');
    if (i) i.value = q;
    sendAiMessage();
}
function setAiBusy(b) {
    aiBusy = b;
    const s = document.getElementById('ai-send');
    if (s) { s.disabled = b; s.innerHTML = b ? '<i class="fa-solid fa-spinner fa-spin"></i>' : '<i class="fa-solid fa-arrow-up"></i>'; }
}
function autoGrowAi(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

async function sendAiMessage() {
    const input = document.getElementById('ai-input');
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text || aiBusy) return;
    input.value = '';
    autoGrowAi(input);
    aiHistory.push({ role: 'user', text });
    renderAiMessages();
    renderAiSuggestions();
    saveAiHistory();

    if (!GEMINI_PROXY_URL) {
        aiHistory.push({ role: 'model', text: "⚙️ The AI assistant isn't configured. Set **GEMINI_PROXY_URL** in `script.js` to your Cloudflare Worker endpoint and I'll come to life." });
        renderAiMessages();
        saveAiHistory();
        return;
    }

    setAiBusy(true);
    const botIndex = aiHistory.push({ role: 'model', text: '' }) - 1;
    renderAiMessages();

    try {
        const res = await fetch(GEMINI_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: aiSystemPrompt(),
                messages: aiHistory.slice(0, -1).map(m => ({ role: m.role, text: m.text }))
            })
        });
        if (!res.ok) throw new Error('Proxy returned ' + res.status);
        const ct = res.headers.get('content-type') || '';
        let full = '';
        if (res.body && ct.includes('text/event-stream')) {
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop();
                for (const line of lines) {
                    const tline = line.trim();
                    if (!tline.startsWith('data:')) continue;
                    const payload = tline.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const j = JSON.parse(payload);
                        const piece = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
                        if (piece) { full += piece; aiHistory[botIndex].text = full; updateAiBubble(botIndex, renderMarkdown(full)); }
                    } catch {}
                }
            }
        } else {
            const data = await res.json().catch(() => null);
            full = data?.text || data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || data?.error || '';
        }
        if (!full) full = '(no response)';
        aiHistory[botIndex].text = full;
        updateAiBubble(botIndex, renderMarkdown(full));
    } catch (e) {
        aiHistory[botIndex].text = '⚠️ ' + (e.message || 'Request failed');
        updateAiBubble(botIndex, escapeHtml(aiHistory[botIndex].text));
    } finally {
        setAiBusy(false);
        saveAiHistory();
        const box = document.getElementById('ai-messages');
        if (box) box.scrollTop = box.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    aiHistory = loadAiHistory();
    const input = document.getElementById('ai-input');
    if (input) {
        input.addEventListener('input', () => autoGrowAi(input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const el = document.getElementById('ai-chat');
            if (el && el.classList.contains('open')) closeAiChat();
        }
    });
    const msgs = document.getElementById('ai-messages');
    if (msgs) {
        msgs.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            let u; try { u = new URL(href, location.href); } catch { return; }
            const sameSite = u.hostname === location.hostname || u.hostname.endsWith('glacierclient.xyz');
            if (!sameSite) return;
            const ref = u.hash ? u.hash.replace(/^#(client=)?/, '') : u.pathname.replace(/^\/+/, '');
            const c = findClientByRef(ref);
            if (c) { e.preventDefault(); closeAiChat(); setTimeout(() => scrollToClient(c.id), 260); }
        });
    }
});


function ensureModal(id, closeFn) {
    let m = document.getElementById(id);
    if (m) return m;
    m = document.createElement('div');
    m.id = id;
    m.className = 'help-modal';
    m.addEventListener('click', closeFn);
    m.innerHTML = `<div class="help-content" onclick="event.stopPropagation()"></div>`;
    document.body.appendChild(m);
    return m;
}

function clientCategoryLabel(c) {
    const raw = c.originalCategory || (libraryTree.find(cat => cat.clients.includes(c)) || {}).name || '';
    if (!raw) return '—';
    return extractVersion(raw) ? `Version: ${formatVersionDisplay(raw)}` : raw;
}

let compareSet = new Set();
const COMPARE_MAX = 4;
function isComparing(id) { return compareSet.has(id); }
function toggleCompare(id, name) {
    if (compareSet.has(id)) {
        compareSet.delete(id);
    } else {
        if (compareSet.size >= COMPARE_MAX) { toast(`Compare holds up to ${COMPARE_MAX}`, 'circle-info'); return; }
        compareSet.add(id);
        if (name) toast(`Added to compare`, 'scale-balanced');
    }
    document.querySelectorAll(`[data-compare-id="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('active', compareSet.has(id)));
    updateCompareBar();
}
function clearCompare() {
    compareSet.clear();
    document.querySelectorAll('[data-compare-id]').forEach(el => el.classList.remove('active'));
    updateCompareBar();
}
function updateCompareBar() {
    let bar = document.getElementById('compare-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'compare-bar';
        bar.className = 'compare-bar hidden';
        document.body.appendChild(bar);
    }
    if (compareSet.size === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `<span class="compare-count"><i class="fa-solid fa-scale-balanced"></i> ${compareSet.size} selected</span>` +
        `<button class="toolbar-btn" onclick="openCompare()" ${compareSet.size < 2 ? 'disabled' : ''}><i class="fa-solid fa-table-columns"></i>Compare</button>` +
        `<button class="toolbar-btn" onclick="clearCompare()"><i class="fa-solid fa-xmark"></i>Clear</button>`;
}
function openCompare() {
    const clients = [...compareSet].map(id => allClients.find(c => c.id === id)).filter(Boolean);
    if (clients.length < 2) { toast('Pick at least 2 clients', 'circle-info'); return; }
    const m = ensureModal('compare-modal', closeCompare);
    const rows = [
        ['Category', c => escapeHtml(clientCategoryLabel(c))],
        ['Versions', c => (c.compatVersions || []).map(v => formatVersionDisplay(v)).join(', ') || '—'],
        ['Author', c => c.author?.name ? escapeHtml(c.author.name) : '—'],
        ['Files', c => String(c.files.length)],
        ['Extensions', c => String(c.extensions.length)],
        ['Screenshots', c => String(c.screenshots?.length || 0)],
        ['Total size', c => c.totalBytes ? escapeHtml(formatFileSize(c.totalBytes)) : '—'],
        ['Added', c => c.addedAt ? escapeHtml(relativeTime(c.addedAt)) : '—'],
        ['Tags', c => (c.tags && c.tags.length) ? c.tags.map(escapeHtml).join(', ') : '—'],
    ];
    const head = `<th></th>` + clients.map(c => `<th><div class="cmp-head">${c.iconUrl ? `<img src="${escapeAttr(c.iconUrl)}" alt="" loading="lazy">` : '<i class="fa-solid fa-cube"></i>'}<button class="cmp-name" onclick="closeCompare();scrollToClient(${jsArg(c.id)})">${escapeHtml(c.displayName)}</button></div></th>`).join('');
    const body = rows.map(([label, fn]) => `<tr><td class="cmp-label">${label}</td>${clients.map(c => `<td>${fn(c)}</td>`).join('')}</tr>`).join('');
    m.querySelector('.help-content').innerHTML =
        `<button class="help-close" onclick="closeCompare()" aria-label="Close"><i class="fa-solid fa-times"></i></button>` +
        `<h2 class="help-title"><i class="fa-solid fa-table-columns"></i> Compare clients</h2>` +
        `<div class="cmp-scroll"><table class="cmp-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    m.classList.add('active');
}
function closeCompare() { document.getElementById('compare-modal')?.classList.remove('active'); }

function collectTags() {
    const counts = {};
    allClients.forEach(c => {
        const tags = new Set([...(c.tags || []), c.isOptifine ? 'optifine' : null, c.isPopular ? 'popular' : null].filter(Boolean));
        tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
function openTagBrowser() {
    const m = ensureModal('tags-modal', closeTagBrowser);
    const tags = collectTags();
    const max = tags.length ? tags[0][1] : 1;
    const cloud = tags.map(([tag, n]) => {
        const scale = 0.85 + (n / max) * 0.9;
        return `<button class="tag-cloud-item" style="font-size:${scale.toFixed(2)}rem" onclick="tagBrowseSelect(${jsArg(tag)})">${escapeHtml(tag)}<span class="tag-cloud-n">${n}</span></button>`;
    }).join('');
    m.querySelector('.help-content').innerHTML =
        `<button class="help-close" onclick="closeTagBrowser()" aria-label="Close"><i class="fa-solid fa-times"></i></button>` +
        `<h2 class="help-title"><i class="fa-solid fa-tags"></i> Browse by tag</h2>` +
        `<div class="tag-cloud">${cloud || '<p style="color:var(--text-muted)">No tags found.</p>'}</div>`;
    m.classList.add('active');
}
function closeTagBrowser() { document.getElementById('tags-modal')?.classList.remove('active'); }
function tagBrowseSelect(tag) {
    closeTagBrowser();
    const si = document.getElementById('search-input');
    if (si) { si.value = `tag:${tag}`; si.dispatchEvent(new Event('input')); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    toast(`${t('filter')}: ${tag}`, 'tags');
}

function csvCell(v) {
    v = (v == null) ? '' : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function exportCatalogCsv() {
    const header = ['Name', 'Category', 'Versions', 'Files', 'Extensions', 'Screenshots', 'TotalSize', 'AddedAt', 'Tags', 'URL'];
    const lines = [header.join(',')];
    allClients.forEach(c => {
        lines.push([
            c.displayName,
            clientCategoryLabel(c),
            (c.compatVersions || []).map(v => formatVersionDisplay(v)).join(' '),
            c.files.length,
            c.extensions.length,
            c.screenshots?.length || 0,
            c.totalBytes ? formatFileSize(c.totalBytes) : '',
            c.addedAt ? new Date(c.addedAt * 1000).toISOString().slice(0, 10) : '',
            (c.tags || []).join(' '),
            clientUrl(c),
        ].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nyxora-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported ${allClients.length} clients`, 'file-csv');
}

function copyClientMarkdown(clientId) {
    const c = allClients.find(x => x.id === clientId);
    if (!c) return;
    const lines = [`## [${c.displayName}](${clientUrl(c)})`];
    if (c.compatVersions && c.compatVersions.length) lines.push(`*Versions: ${c.compatVersions.map(v => formatVersionDisplay(v)).join(', ')}*`);
    if (c.description) lines.push('', c.description.trim());
    const files = [...c.files, ...c.extensions];
    if (files.length) {
        lines.push('', '**Downloads:**');
        files.forEach(f => lines.push(`- [${f.display}](${getMonetizedUrl(f.url)})${f.size ? ` (${f.size})` : ''}`));
    }
    copyText(lines.join('\n'), 'Copied as Markdown');
}

function reportClient(clientId, name) {
    const c = allClients.find(x => x.id === clientId);
    const label = c ? c.displayName : name;
    toast(`Opening Discord to report "${label}"`, 'triangle-exclamation');
    window.open(REPORT_DISCORD_URL, '_blank', 'noopener');
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
            reg.addEventListener('updatefound', () => {
                const installing = reg.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(reg);
                    }
                });
            });
        }).catch(() => {});
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            location.reload();
        });
    });
}
function showUpdateToast(reg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast toast-action';
    el.innerHTML = `<i class="fa-solid fa-rotate"></i><span>New version available</span>` +
        `<button class="toast-btn">Refresh</button>`;
    el.querySelector('.toast-btn').addEventListener('click', () => {
        reg.waiting ? reg.waiting.postMessage('skipWaiting') : location.reload();
    });
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
}
registerServiceWorker();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
