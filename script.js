const GITHUB_ORG = 'Indigo-Tools';
const REPO_NAME = 'ClientLibrary';
const BRANCH = 'main';
const BASE_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_ORG}/${REPO_NAME}/${BRANCH}`;

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

async function getFileSize(url) {
    try {
        const r = await fetch(url, { method: 'HEAD' });
        const s = r.headers.get('content-length');
        return s ? parseInt(s) : null;
    } catch { return null; }
}

// ── Toggle helpers (no full re-render) ──

function toggleClientCollapse(clientId) {
    const body = document.getElementById(`body-${clientId}`);
    if (!body) return;
    body.classList.toggle('collapsed');
    const btn = document.getElementById(`collapse-btn-${clientId}`);
    if (btn) {
        const c = body.classList.contains('collapsed');
        btn.innerHTML = `<i class="fa-solid fa-chevron-${c ? 'down' : 'up'}"></i><span class="hide-mobile">${c ? 'Expand' : 'Collapse'}</span>`;
    }
}

function toggleDescription(clientId) {
    const panel = document.getElementById(`details-${clientId}`);
    const btn = document.getElementById(`details-btn-${clientId}`);
    if (!panel || !btn) return;
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    btn.classList.toggle('open');
    btn.innerHTML = `${opening ? 'Hide Details' : 'Show Details'} <i class="fa-solid fa-chevron-down"></i>`;
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
        ? `<i class="fa-solid fa-angles-down"></i>Show ${hidden.length} more`
        : `<i class="fa-solid fa-angles-up"></i>Show Less`;
}

function expandCollapseAll() {
    const bodies = document.querySelectorAll('.client-body');
    const btn = document.getElementById('expand-all-btn');
    if (allExpanded) {
        bodies.forEach(b => b.classList.add('collapsed'));
        document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
            b.innerHTML = '<i class="fa-solid fa-chevron-down"></i><span class="hide-mobile">Expand</span>';
        });
        btn.innerHTML = '<i class="fa-solid fa-angles-up"></i><span>Collapse All</span>';
    } else {
        bodies.forEach(b => b.classList.remove('collapsed'));
        document.querySelectorAll('[id^="collapse-btn-"]').forEach(b => {
            b.innerHTML = '<i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">Collapse</span>';
        });
        btn.innerHTML = '<i class="fa-solid fa-angles-down"></i><span>Expand All</span>';
    }
    allExpanded = !allExpanded;
}

// ── Search dropdown ──

function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) + '<span class="search-highlight">' + text.slice(idx, idx + query.length) + '</span>' + text.slice(idx + query.length);
}

function getSearchResults(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const results = [];
    for (const cat of libraryTree) {
        for (const client of cat.clients) {
            const nameMatch = client.displayName.toLowerCase().includes(q);
            const descMatch = client.description?.toLowerCase().includes(q);
            const tagMatch = client.tags.some(t => t.includes(q));
            const fileMatch = client.files.some(f => f.display.toLowerCase().includes(q) || f.rawName.toLowerCase().includes(q));
            const extMatch = client.extensions.some(e => e.display.toLowerCase().includes(q) || e.rawName.toLowerCase().includes(q));

            if (nameMatch || descMatch || tagMatch || fileMatch || extMatch) {
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
            if (results.length >= 8) return results;
        }
    }
    return results;
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

    const results = getSearchResults(q);

    // Count total matches for the badge
    const totalMatches = countAllMatches(q);
    if (totalMatches > 0) {
        countEl.textContent = `${totalMatches} found`;
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
    `).join('') + (totalMatches > results.length ? `<div class="search-dropdown-hint">Showing ${results.length} of ${totalMatches} results — type to narrow down</div>` : '');

    dropdown.classList.remove('hidden');
}

function countAllMatches(query) {
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    let count = 0;
    for (const cat of libraryTree) {
        for (const client of cat.clients) {
            const nameMatch = client.displayName.toLowerCase().includes(q);
            const descMatch = client.description?.toLowerCase().includes(q);
            const tagMatch = client.tags.some(t => t.includes(q));
            const fileMatch = client.files.some(f => f.display.toLowerCase().includes(q) || f.rawName.toLowerCase().includes(q));
            const extMatch = client.extensions.some(e => e.display.toLowerCase().includes(q) || e.rawName.toLowerCase().includes(q));
            if (nameMatch || descMatch || tagMatch || fileMatch || extMatch) count++;
        }
    }
    return count;
}

function scrollToClient(clientId) {
    const el = document.getElementById(`block-${clientId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Briefly highlight
        el.style.outline = '2px solid var(--accent)';
        el.style.outlineOffset = '4px';
        el.style.borderRadius = 'var(--radius)';
        el.style.transition = 'outline-color 1.5s ease';
        setTimeout(() => {
            el.style.outlineColor = 'transparent';
            setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 500);
        }, 800);
    }
    // Ensure it's not collapsed
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

function openScreenshots(clientId, screenshots, index = 0) {
    currentScreenshots = screenshots;
    currentScreenshotIndex = index;
    isZoomed = false;
    const modal = document.getElementById('screenshots-modal');
    const mainImg = document.getElementById('screenshot-main');
    if (screenshots.length > 0) {
        mainImg.src = screenshots[index].url;
        mainImg.classList.remove('zoomed');
        document.getElementById('screenshot-counter').textContent = `${index + 1} / ${screenshots.length}`;
        document.getElementById('screenshot-thumbnails').innerHTML = screenshots.map((s, i) =>
            `<img src="${s.url}" class="screenshot-thumbnail ${i === index ? 'active' : ''}" onclick="showScreenshot(${i})" alt="Thumbnail ${i+1}" loading="lazy">`
        ).join('');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeScreenshots() {
    document.getElementById('screenshots-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentScreenshots = [];
    currentScreenshotIndex = 0;
    isZoomed = false;
}

function showScreenshot(index) {
    if (index < 0 || index >= currentScreenshots.length) return;
    currentScreenshotIndex = index;
    isZoomed = false;
    const mainImg = document.getElementById('screenshot-main');
    mainImg.src = currentScreenshots[index].url;
    mainImg.classList.remove('zoomed');
    document.getElementById('screenshot-counter').textContent = `${index + 1} / ${currentScreenshots.length}`;
    document.querySelectorAll('.screenshot-thumbnail').forEach((t, i) => t.classList.toggle('active', i === index));
}

function toggleZoom() {
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

function renderStats() {
    const statsBar = document.getElementById('stats-bar');
    let totalClients = 0, totalFiles = 0, totalCategories = libraryTree.length;
    libraryTree.forEach(cat => {
        totalClients += cat.clients.length;
        cat.clients.forEach(c => { totalFiles += c.files.length + c.extensions.length; });
    });

    statsBar.innerHTML = `
        <span class="stat-chip"><i class="fa-solid fa-layer-group"></i><strong>${totalCategories}</strong> categories</span>
        <span class="stat-chip"><i class="fa-solid fa-cube"></i><strong>${totalClients}</strong> clients</span>
        <span class="stat-chip"><i class="fa-solid fa-file-arrow-down"></i><strong>${totalFiles}</strong> files</span>
    `;
}

// ── Init ──

async function init() {
    try {
        const response = await fetch(`${BASE_RAW_URL}/paths.json?t=${Date.now()}`);
        const rawPaths = await response.json();
        const structured = {};
        const asyncJobs = [];
        const sizeJobs = [];
        const detectedCategories = new Set();

        rawPaths.forEach(path => {
            const parts = path.split('/');
            if (parts.length < 3) return;
            const category = parts[1], clientName = parts[2], fileName = parts[parts.length - 1];
            detectedCategories.add(category);
            if (!structured[category]) structured[category] = {};
            if (!structured[category][clientName]) {
                structured[category][clientName] = { icon: null, banner: null, description: null, author: null, tags: [], screenshots: [], files: [], extensions: [], isOptifine: false };
            }
            const encodedPath = parts.map(p => encodeURIComponent(p)).join('/');
            const fullUrl = `${BASE_RAW_URL}/${encodedPath}`;
            const lowerName = fileName.toLowerCase();
            const client = structured[category][clientName];

            if (lowerName === 'pack_icon.png') { client.icon = fullUrl; }
            else if (lowerName === 'pack_banner.png') { client.banner = fullUrl; }
            else if (lowerName === 'description.txt' || lowerName === 'description.md') {
                asyncJobs.push(fetch(fullUrl).then(r => r.ok ? r.text() : null).then(text => {
                    if (text) { client.description = text; if (!client.isOptifine) client.isOptifine = isOptifinePack(clientName, text); }
                }).catch(() => {}));
            } else if (lowerName === 'author.json' || lowerName === 'creator.json') {
                asyncJobs.push(fetch(fullUrl).then(r => r.ok ? r.json() : null).then(a => { if (a) client.author = a; }).catch(() => {}));
            } else if (lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/) && (parts.some(p => p.toLowerCase() === 'screenshots') || lowerName.includes('screenshot'))) {
                client.screenshots.push({ url: fullUrl, name: fileName });
            } else if (['working','legacy','trash'].includes(lowerName)) {
                if (!client.tags.includes(lowerName)) client.tags.push(lowerName);
            } else {
                detectTags(parts).forEach(t => { if (!client.tags.includes(t)) client.tags.push(t); });
                if (lowerName.match(/\.(zip|dll|so|apk|mcpack|mcaddon)$/)) {
                    const isExt = parts.some(p => p.toLowerCase() === 'extensions');
                    const fileObj = { display: formatName(fileName), rawName: fileName, url: fullUrl, size: null };
                    sizeJobs.push(getFileSize(fullUrl).then(s => { fileObj.size = formatFileSize(s); }).catch(() => {}));
                    (isExt ? client.extensions : client.files).push(fileObj);
                }
            }
        });

        await Promise.allSettled(asyncJobs);
        await Promise.allSettled(sizeJobs);

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
                    }
                    delete structured[cat][name];
                }
            });
        });
        if (Object.keys(optifineClients).length > 0) structured["Optifine Packs"] = optifineClients;
        Object.keys(structured).forEach(cat => { if (Object.keys(structured[cat]).length === 0) { delete structured[cat]; detectedCategories.delete(cat); } });

        const sorted = sortCategories(Array.from(detectedCategories).map(name => ({
            name, displayName: extractVersion(name) ? `Version: ${name.replace('_', '.')}` : name
        })));

        libraryTree = sorted.map(({ name, displayName }) => {
            const clients = structured[name];
            if (!clients) return null;
            const list = Object.entries(clients).map(([cName, data]) => ({
                id: 'c_' + cName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + name.replace(/[^a-zA-Z0-9]/g, '_'),
                displayName: formatName(cName), rawName: cName,
                iconUrl: data.icon, bannerUrl: data.banner, description: data.description,
                author: data.author, tags: [...new Set(data.tags)].sort(),
                screenshots: data.screenshots, files: data.files.sort(smartSort), extensions: data.extensions.sort(smartSort),
                isPopular: name === "Popular Clients", isOptifine: name === "Optifine Packs" || data.isOptifine,
                originalCategory: data.originalCategory
            })).filter(c => c.files.length > 0 || c.extensions.length > 0).sort((a, b) => a.displayName.localeCompare(b.displayName));
            return { name, displayName, clients: list };
        }).filter(c => c && c.clients.length > 0);

        // Build flat client list for search
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
            renderStats();
            switchCategory("ALL");
            requestAnimationFrame(() => { main.style.opacity = '1'; });
        }, 250);
    } catch (err) {
        console.error('Failed to load library:', err);
        document.getElementById('status-text').textContent = "Failed to load library. Please check connection.";
        document.querySelector('.spinner')?.classList.add('hidden');
    }
}

function renderTabs() {
    const container = document.getElementById('category-tabs');
    const tabs = ["ALL", ...libraryTree.map(c => c.name)];
    container.innerHTML = tabs.map(t => {
        const cat = libraryTree.find(c => c.name === t);
        const label = t === "ALL" ? "All" : (cat ? cat.displayName : (t.startsWith('1_') ? `Version: ${t.replace('_','.')}` : t));
        return `<button onclick="switchCategory('${t}')" id="tab-${t}" class="tab-btn">${label}</button>`;
    }).join('');
}

function switchCategory(name) {
    currentCategory = name;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    renderClients();
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Render ──

function renderClients(query = '') {
    const container = document.getElementById('client-container');
    const q = query.toLowerCase().trim();
    const toShow = currentCategory === "ALL" ? libraryTree : libraryTree.filter(c => c.name === currentCategory);

    if (toShow.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-search"></i></div><div class="empty-title">No content available</div><div class="empty-desc">This category is empty</div></div>`;
        return;
    }

    let html = '';

    toShow.forEach(cat => {
        const filtered = cat.clients.map(client => {
            const cm = client.displayName.toLowerCase().includes(q);
            const dm = client.description?.toLowerCase().includes(q);
            const am = client.author && [client.author.name, client.author.website, client.author.discord, client.author.github].some(v => v?.toLowerCase().includes(q));
            const tm = client.tags.some(t => t.toLowerCase().includes(q));
            const fm = client.files.some(f => f.display.toLowerCase().includes(q) || f.rawName.toLowerCase().includes(q));
            const em = client.extensions.some(e => e.display.toLowerCase().includes(q) || e.rawName.toLowerCase().includes(q));
            if (cm || dm || am || tm || fm || em || !q) {
                const broad = cm || dm || am || tm;
                return { ...client,
                    matchingFiles: q ? client.files.filter(f => broad || f.display.toLowerCase().includes(q) || f.rawName.toLowerCase().includes(q)) : client.files,
                    matchingExtensions: q ? client.extensions.filter(e => broad || e.display.toLowerCase().includes(q) || e.rawName.toLowerCase().includes(q)) : client.extensions
                };
            }
            return null;
        }).filter(Boolean);

        if (filtered.length === 0) return;

        html += `<div class="category-group"><div class="section-label"><span>${cat.displayName}</span></div>`;

        filtered.forEach(client => {
            const hasDesc = client.description?.trim().length > 0;
            const hasAuthor = client.author && Object.keys(client.author).length > 0;
            const hasSS = client.screenshots?.length > 0;
            const hasDetails = hasDesc || hasAuthor || hasSS;
            const manyFiles = client.matchingFiles.length > 5;
            const ssJson = escapeAttr(JSON.stringify(client.screenshots));

            html += `<div class="client-block" id="block-${client.id}">`;

            html += `<div class="client-header">
                <div class="client-info">
                    ${client.iconUrl ? `<img src="${client.iconUrl}" class="client-icon" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
                    <div class="client-meta">
                        <div class="client-name">${client.displayName}</div>
                        <div class="tag-row">
                            ${client.isPopular ? '<span class="tag tag-popular"><i class="fa-solid fa-star"></i>Popular</span>' : ''}
                            ${client.isOptifine ? '<span class="tag tag-optifine"><i class="fa-solid fa-bolt"></i>Optifine</span>' : ''}
                            ${client.originalCategory && client.isOptifine ? `<span class="tag tag-category"><i class="fa-solid fa-layer-group"></i>${client.originalCategory}</span>` : ''}
                            ${client.tags.map(t => `<span class="tag tag-${t}"><i class="fa-solid ${TAG_ICONS[t]||'fa-tag'}"></i>${t.charAt(0).toUpperCase()+t.slice(1)}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <button id="collapse-btn-${client.id}" onclick="toggleClientCollapse('${client.id}')" class="collapse-btn">
                    <i class="fa-solid fa-chevron-up"></i><span class="hide-mobile">Collapse</span>
                </button>
            </div>`;

            html += `<div id="body-${client.id}" class="client-body"><div class="client-body-inner">`;

            if (hasDetails) {
                html += `<div id="details-${client.id}" class="details-panel"><div class="details-panel-inner"><div class="details-inner">`;

                if (hasSS) {
                    html += `<div style="margin-bottom:1rem">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
                            <span style="display:flex;align-items:center;gap:0.4rem;font-weight:600;color:var(--white)"><i class="fa-solid fa-images" style="color:var(--accent)"></i>Screenshots (${client.screenshots.length})</span>
                            <button onclick="openScreenshots('${client.id}',${ssJson})" style="background:none;border:none;color:var(--accent);font-size:0.8125rem;font-weight:600;cursor:pointer">View All</button>
                        </div>
                        <div class="ss-grid">${client.screenshots.slice(0,6).map((ss, i) =>
                            `<div class="ss-thumb" onclick="openScreenshots('${client.id}',${ssJson},${i})"><img src="${ss.url}" alt="Screenshot ${i+1}" loading="lazy"><div class="ss-thumb-overlay"><span class="ss-badge">${i+1}</span></div></div>`
                        ).join('')}</div>
                    </div>`;
                }

                if (hasDesc) {
                    html += `<div style="margin-bottom:0.75rem">${client.description.split('\n').map(l => `<p style="margin-bottom:0.4rem">${l}</p>`).join('')}</div>`;
                }

                if (hasAuthor) {
                    html += `<div class="author-block">
                        <div class="author-name"><i class="fa-solid fa-user"></i>${client.author.name||'Unknown'}</div>
                        ${client.author.website ? `<div class="author-link"><i class="fa-solid fa-globe"></i><a href="${client.author.website}" target="_blank" rel="noopener">${client.author.website.replace(/^https?:\/\//,'')}</a></div>` : ''}
                        ${client.author.discord ? `<div class="author-link"><i class="fa-brands fa-discord"></i>${formatDiscordLink(client.author.discord)}</div>` : ''}
                        ${client.author.github ? `<div class="author-link"><i class="fa-brands fa-github"></i><a href="https://github.com/${client.author.github}" target="_blank" rel="noopener">@${client.author.github}</a></div>` : ''}
                    </div>`;
                }

                html += `</div></div></div>`;
                html += `<button id="details-btn-${client.id}" onclick="toggleDescription('${client.id}')" class="details-toggle">Show Details <i class="fa-solid fa-chevron-down"></i></button>`;
            }

            if (client.matchingFiles.length > 0) {
                html += `<div class="file-grid">`;
                client.matchingFiles.forEach((file, idx) => {
                    const hiddenClass = (!q && manyFiles && idx >= 5) ? `file-hidden-${client.id}` : '';
                    const hiddenStyle = (!q && manyFiles && idx >= 5) ? ' style="display:none"' : '';
                    html += `<div class="file-card ${hiddenClass}"${hiddenStyle}>
                        ${client.bannerUrl ? `<img src="${client.bannerUrl}" class="file-card-banner" loading="lazy" alt=""><div class="file-card-overlay"></div>` : ''}
                        <div class="file-card-body">
                            <div class="file-info">
                                <div class="file-name"><i class="fa-solid fa-file-arrow-down"></i>${file.display}</div>
                                <div class="file-raw">${file.rawName}</div>
                                ${file.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${file.size}</div>` : ''}
                            </div>
                            <a href="${file.url}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>Download</a>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            }

            if (!q && manyFiles) {
                html += `<button id="more-btn-${client.id}" onclick="toggleFileList('${client.id}')" class="show-more-btn"><i class="fa-solid fa-angles-down"></i>Show ${client.matchingFiles.length - 5} more</button>`;
            }

            if (client.matchingExtensions.length > 0) {
                html += `<div class="ext-section">
                    <button id="ext-header-${client.id}" onclick="toggleDropdown('${client.id}')" class="ext-header">
                        <span><i class="fa-solid fa-puzzle-piece" style="margin-right:0.4rem;color:var(--text-dim)"></i>Extensions (${client.matchingExtensions.length})</span>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </button>
                    <div id="ext-body-${client.id}" class="ext-body"><div class="ext-body-inner">
                        ${client.matchingExtensions.map(ext => `
                            <div class="ext-row">
                                <div class="file-info">
                                    <div class="file-name" style="font-size:0.8125rem">${ext.display}</div>
                                    <div class="file-raw">${ext.rawName}</div>
                                    ${ext.size ? `<div class="file-size"><i class="fa-solid fa-weight-scale"></i>${ext.size}</div>` : ''}
                                </div>
                                <a href="${ext.url}" target="_blank" rel="noopener" class="btn-dl"><i class="fa-solid fa-download"></i>Download</a>
                            </div>
                        `).join('')}
                    </div></div>
                </div>`;
            }

            html += `</div></div>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    container.innerHTML = html || `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-search"></i></div><div class="empty-title">No results found</div><div class="empty-desc">Try a different search term or browse the categories above</div></div>`;
}

// ── Events ──

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
});

searchClear.addEventListener('click', clearSearch);

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('search-wrapper');
    if (!wrapper.contains(e.target)) {
        document.getElementById('search-dropdown').classList.add('hidden');
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    // Screenshot modal keys
    if (document.getElementById('screenshots-modal').classList.contains('active')) {
        if (e.key === 'Escape') closeScreenshots();
        else if (e.key === 'ArrowLeft') prevScreenshot();
        else if (e.key === 'ArrowRight') nextScreenshot();
        else if (e.key === 'z' || e.key === 'Z') toggleZoom();
        return;
    }

    // "/" to focus search
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        return;
    }

    // Escape to clear search or close dropdown
    if (e.key === 'Escape') {
        if (searchInput.value) {
            clearSearch();
        } else {
            searchInput.blur();
            document.getElementById('search-dropdown').classList.add('hidden');
        }
        return;
    }

    // Arrow keys in dropdown
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

// Back to top
window.addEventListener('scroll', () => {
    document.getElementById('back-to-top').classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

document.addEventListener('DOMContentLoaded', () => init());
