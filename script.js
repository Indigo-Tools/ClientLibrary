const GITHUB_ORG = 'Indigo-Tools';
const REPO_NAME = 'ClientLibrary';
const BRANCH = 'main';
const BASE_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_ORG}/${REPO_NAME}/${BRANCH}`;

let libraryTree = [];
let currentCategory = "ALL";
let CATEGORY_ORDER = ["ALL", "Popular Clients", "Creators", "Optifine Packs"]; 

const expandedDescriptions = new Set();
const expandedExtensions = new Set();
const expandedFiles = new Set();
const collapsedClients = new Set();

const TAG_COLORS = {
    'working': { bg: 'from-emerald-500/20 to-green-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', icon: 'fa-check-circle' },
    'legacy': { bg: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-300', border: 'border-amber-500/30', icon: 'fa-history' },
    'trash': { bg: 'from-rose-500/20 to-red-500/20', text: 'text-rose-300', border: 'border-rose-500/30', icon: 'fa-trash' }
};

// Screenshots state
let currentScreenshots = [];
let currentScreenshotIndex = 0;
let currentClientId = '';
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
        const response = await fetch(url, { method: 'HEAD' });
        const size = response.headers.get('content-length');
        return size ? parseInt(size) : null;
    } catch {
        return null;
    }
}

function toggleDropdown(id) {
    if (expandedExtensions.has(id)) {
        expandedExtensions.delete(id);
    } else {
        expandedExtensions.add(id);
    }
    renderClients(document.getElementById('search-input').value);
}

function toggleFileList(clientId) {
    if (expandedFiles.has(clientId)) expandedFiles.delete(clientId);
    else expandedFiles.add(clientId);
    renderClients(document.getElementById('search-input').value);
}

function toggleClientCollapse(clientId) {
    if (collapsedClients.has(clientId)) collapsedClients.delete(clientId);
    else collapsedClients.add(clientId);
    renderClients(document.getElementById('search-input').value);
}

function toggleDescription(clientId) {
    if (expandedDescriptions.has(clientId)) expandedDescriptions.delete(clientId);
    else expandedDescriptions.add(clientId);
    renderClients(document.getElementById('search-input').value);
}

// Screenshots functions
function openScreenshots(clientId, screenshots, index = 0) {
    currentScreenshots = screenshots;
    currentScreenshotIndex = index;
    currentClientId = clientId;
    isZoomed = false;

    const modal = document.getElementById('screenshots-modal');
    const mainImg = document.getElementById('screenshot-main');
    const counter = document.getElementById('screenshot-counter');
    const thumbnails = document.getElementById('screenshot-thumbnails');

    if (screenshots.length > 0) {
        mainImg.src = screenshots[index].url;
        mainImg.classList.remove('zoomed');
        counter.textContent = `${index + 1} / ${screenshots.length}`;

        // Create thumbnails
        thumbnails.innerHTML = screenshots.map((screenshot, i) => `
                <img src="${screenshot.url}" 
                     class="screenshot-thumbnail ${i === index ? 'active' : ''}" 
                     onclick="showScreenshot(${i})"
                     alt="Thumbnail ${i + 1}"
                     loading="lazy">
            `).join('');

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeScreenshots() {
    const modal = document.getElementById('screenshots-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentScreenshots = [];
    currentScreenshotIndex = 0;
    currentClientId = '';
    isZoomed = false;
}

function showScreenshot(index) {
    if (index >= 0 && index < currentScreenshots.length) {
        currentScreenshotIndex = index;
        isZoomed = false;

        const mainImg = document.getElementById('screenshot-main');
        const counter = document.getElementById('screenshot-counter');
        const thumbnails = document.querySelectorAll('.screenshot-thumbnail');

        mainImg.src = currentScreenshots[index].url;
        mainImg.classList.remove('zoomed');
        counter.textContent = `${index + 1} / ${currentScreenshots.length}`;

        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }
}

function toggleZoom() {
    const mainImg = document.getElementById('screenshot-main');
    isZoomed = !isZoomed;
    mainImg.classList.toggle('zoomed', isZoomed);
}

function nextScreenshot() {
    const nextIndex = (currentScreenshotIndex + 1) % currentScreenshots.length;
    showScreenshot(nextIndex);
}

function prevScreenshot() {
    const prevIndex = currentScreenshotIndex === 0 ? currentScreenshots.length - 1 : currentScreenshotIndex - 1;
    showScreenshot(prevIndex);
}

const smartSort = (a, b) => {
    return a.rawName.localeCompare(b.rawName, undefined, {
        numeric: true,
        sensitivity: 'base'
    });
};

function isOptifinePack(clientName, description) {
    const nameLower = clientName.toLowerCase();
    const descLower = description ? description.toLowerCase() : '';

    const optifineKeywords = ['opti', 'fps', 'performance', 'boost', 'optimize', 'optimization'];

    return optifineKeywords.some(keyword =>
        nameLower.includes(keyword) || descLower.includes(keyword)
    );
}

function detectTags(parts) {
    const tags = [];
    const tagFiles = ['working', 'legacy', 'trash'];

    tagFiles.forEach(tag => {
        if (parts.some(part => part.toLowerCase() === tag)) {
            tags.push(tag);
        }
    });

    return tags;
}

function isDiscordLink(str) {
    if (!str) return false;
    const lowerStr = str.toLowerCase();
    return lowerStr.includes('discord.gg/') ||
        lowerStr.includes('discord.com/invite/') ||
        lowerStr.includes('discord.com/invite') ||
        lowerStr.includes('discord.glacierclient.xyz') ||
        (lowerStr.includes('discord') && lowerStr.includes('.'));
}

function formatDiscordLink(discordStr) {
    if (!discordStr) return '';

    const trimmed = discordStr.trim();

    if (isDiscordLink(trimmed)) {
        let url = trimmed;
        if (!url.startsWith('http')) {
            if (url.includes('discord.gg/') || url.includes('discord.com/invite/')) {
                url = 'https://' + url;
            } else if (url.includes('discord.glacierclient.xyz')) {
                url = 'https://' + url;
            } else if (url.match(/^[a-zA-Z0-9]+$/)) {
                url = 'https://discord.gg/' + url;
            }
        }
        return `<a href="${url}" target="_blank" class="text-[#347ccb] hover:underline transition-colors">${trimmed.replace(/^https?:\/\//, '').replace('discord.gg/', '')}</a>`;
    }

    return `<span class="text-gray-300">${trimmed}</span>`;
}

function extractVersion(categoryName) {
    // Check if category name matches pattern like "1_21", "1_20", "1_19", etc.
    const match = categoryName.match(/^(\d+)_(\d+)$/);
    if (match) {
        return {
            major: parseInt(match[1]),
            minor: parseInt(match[2]),
            string: categoryName
        };
    }
    return null;
}

function sortCategories(categories) {
    const versionCategories = categories.filter(cat => extractVersion(cat.name));
    const otherCategories = categories.filter(cat => !extractVersion(cat.name));
    
    // Sort versions descending (newest first)
    versionCategories.sort((a, b) => {
        const verA = extractVersion(a.name);
        const verB = extractVersion(b.name);
        if (verB.major !== verA.major) return verB.major - verA.major;
        return verB.minor - verA.minor;
    });
    
    // Sort other categories by predefined order, then alphabetically
    otherCategories.sort((a, b) => {
        const aIndex = CATEGORY_ORDER.indexOf(a.name);
        const bIndex = CATEGORY_ORDER.indexOf(b.name);
        
        // Both in predefined order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        // Only A in predefined order
        if (aIndex !== -1) return -1;
        // Only B in predefined order
        if (bIndex !== -1) return 1;
        // Neither in predefined order, sort alphabetically
        return a.name.localeCompare(b.name);
    });
    
    return [...otherCategories, ...versionCategories];
}

async function init() {
    try {
        const response = await fetch(`${BASE_RAW_URL}/paths.json?t=${Date.now()}`);
        const rawPaths = await response.json();
        const structured = {};
        const descriptionPromises = [];
        const sizePromises = [];
        const detectedCategories = new Set();

        // First pass: Collect all data and identify Optifine packs
        rawPaths.forEach(path => {
            const parts = path.split('/');
            if (parts.length < 3) return;

            const category = parts[1];
            const fileName = parts[parts.length - 1];
            const clientName = parts[2];

            // Add category to detected categories
            detectedCategories.add(category);

            if (!structured[category]) structured[category] = {};
            if (!structured[category][clientName]) {
                structured[category][clientName] = {
                    icon: null,
                    banner: null,
                    description: null,
                    author: null,
                    tags: [],
                    screenshots: [],
                    files: [],
                    extensions: [],
                    isOptifine: false
                };
            }

            const encodedPath = path.split('/').map(p => encodeURIComponent(p)).join('/');
            const fullUrl = `${BASE_RAW_URL}/${encodedPath}`;
            const lowerName = fileName.toLowerCase();

            if (lowerName === 'pack_icon.png') {
                structured[category][clientName].icon = fullUrl;
            } else if (lowerName === 'pack_banner.png') {
                structured[category][clientName].banner = fullUrl;
            } else if (lowerName === 'description.txt' || lowerName === 'description.md') {
                const descPromise = fetch(fullUrl)
                    .then(res => res.ok ? res.text() : null)
                    .then(text => {
                        if (text) {
                            structured[category][clientName].description = text;
                            // Check if this is an Optifine pack based on description
                            if (!structured[category][clientName].isOptifine) {
                                structured[category][clientName].isOptifine = isOptifinePack(clientName, text);
                            }
                        }
                    })
                    .catch(() => { });
                descriptionPromises.push(descPromise);
            } else if (lowerName === 'author.json' || lowerName === 'creator.json') {
                const authorPromise = fetch(fullUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(author => {
                        if (author) {
                            structured[category][clientName].author = author;
                        }
                    })
                    .catch(() => { });
                descriptionPromises.push(authorPromise);
            } else if (lowerName.match(/\.(png|jpg|jpeg|gif|webp)$/) &&
                (parts.some(p => p.toLowerCase() === 'screenshots') ||
                    fileName.toLowerCase().includes('screenshot'))) {
                structured[category][clientName].screenshots.push({
                    url: fullUrl,
                    name: fileName
                });
            } else if (lowerName === 'working' || lowerName === 'legacy' || lowerName === 'trash') {
                const tag = lowerName;
                if (!structured[category][clientName].tags.includes(tag)) {
                    structured[category][clientName].tags.push(tag);
                }
            } else {
                const tags = detectTags(parts);
                tags.forEach(tag => {
                    if (!structured[category][clientName].tags.includes(tag)) {
                        structured[category][clientName].tags.push(tag);
                    }
                });

                const isExtension = parts.some(p => p.toLowerCase() === 'extensions');

                if (lowerName.match(/\.(zip|dll|so|apk|mcpack|mcaddon)$/)) {
                    const fileObj = {
                        display: formatName(fileName),
                        rawName: fileName,
                        url: fullUrl,
                        size: null
                    };

                    // Add file size fetch
                    const sizePromise = getFileSize(fullUrl).then(size => {
                        fileObj.size = formatFileSize(size);
                    }).catch(() => { });
                    sizePromises.push(sizePromise);

                    if (isExtension) {
                        structured[category][clientName].extensions.push(fileObj);
                    } else {
                        structured[category][clientName].files.push(fileObj);
                    }
                }
            }
        });

        await Promise.allSettled(descriptionPromises);
        await Promise.allSettled(sizePromises);

        // Second pass: Move Optifine packs to Optifine Packs category
        const optifineClients = {};

        Object.keys(structured).forEach(category => {
            if (category === "Optifine Packs") return;

            Object.entries(structured[category]).forEach(([clientName, data]) => {
                // Check if this is an Optifine pack
                const isOptifine = data.isOptifine || isOptifinePack(clientName, data.description);

                if (isOptifine) {
                    if (!optifineClients[clientName]) {
                        optifineClients[clientName] = {
                            icon: data.icon,
                            banner: data.banner,
                            description: data.description,
                            author: data.author,
                            tags: [...data.tags],
                            screenshots: [...data.screenshots],
                            files: [...data.files],
                            extensions: [...data.extensions],
                            originalCategory: category,
                            isOptifine: true
                        };
                    } else {
                        optifineClients[clientName].files.push(...data.files);
                        optifineClients[clientName].extensions.push(...data.extensions);
                        optifineClients[clientName].screenshots.push(...data.screenshots);
                        optifineClients[clientName].tags = [...new Set([...optifineClients[clientName].tags, ...data.tags])];
                    }

                    // Remove from original category
                    delete structured[category][clientName];
                }
            });
        });

        // Create Optifine Packs category if we have any
        if (Object.keys(optifineClients).length > 0) {
            structured["Optifine Packs"] = optifineClients;
        }

        // Remove empty categories
        Object.keys(structured).forEach(category => {
            if (Object.keys(structured[category]).length === 0) {
                delete structured[category];
                detectedCategories.delete(category);
            }
        });

        // Build the category order dynamically
        const allCategories = Array.from(detectedCategories);
        const sortedCategories = sortCategories(
            allCategories.map(catName => ({
                name: catName,
                displayName: extractVersion(catName) ? 
                    `Version: ${catName.replace('_', '.')}` : 
                    catName
            }))
        );

        libraryTree = sortedCategories
            .map(({ name: catName, displayName }) => {
                const clients = structured[catName];
                if (!clients) return null;

                const sortedClients = Object.entries(clients)
                    .map(([cliName, data]) => {
                        const clientData = {
                            id: 'client_' + cliName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + catName.replace(/[^a-zA-Z0-9]/g, '_'),
                            displayName: formatName(cliName),
                            rawName: cliName,
                            iconUrl: data.icon,
                            bannerUrl: data.banner,
                            description: data.description,
                            author: data.author,
                            tags: [...new Set(data.tags)].sort(),
                            screenshots: data.screenshots,
                            files: data.files.sort(smartSort),
                            extensions: data.extensions.sort(smartSort),
                            isPopular: catName === "Popular Clients",
                            isOptifine: catName === "Optifine Packs" || data.isOptifine,
                            originalCategory: data.originalCategory
                        };

                        if (clientData.isOptifine && data.originalCategory) {
                            clientData.displayName = formatName(cliName);
                        }

                        return clientData;
                    })
                    .filter(c => c.files.length > 0 || c.extensions.length > 0)
                    .sort((a, b) => a.displayName.localeCompare(b.displayName));

                return {
                    name: catName,
                    displayName: displayName,
                    clients: sortedClients
                };
            })
            .filter(cat => cat && cat.clients.length > 0);

        document.getElementById('status-container').style.opacity = '0';
        document.getElementById('status-container').style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            document.getElementById('status-container').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            renderTabs();
            switchCategory("ALL");

            const mainContent = document.getElementById('main-content');
            mainContent.style.opacity = '0';
            mainContent.style.transition = 'opacity 0.3s ease';
            mainContent.style.opacity = '1';
        }, 200);
    } catch (err) {
        console.error('Failed to load library:', err);
        document.getElementById('status-text').textContent = "Failed to load library. Please check connection.";
        document.getElementById('loader').classList.add('hidden');
    }
}

function renderTabs() {
    const container = document.getElementById('category-tabs');
    const tabs = ["ALL", ...libraryTree.map(c => c.name)];

    container.innerHTML = tabs.map(t => {
        let label = t === "ALL" ? "All" : t;
        
        // Find the category display name from libraryTree
        const category = libraryTree.find(c => c.name === t);
        const displayName = category ? category.displayName : 
                          t.startsWith('1_') ? `Version: ${t.replace('_', '.')}` : t;

        return `
                <button onclick="switchCategory('${t}')" 
                        id="tab-${t}" 
                        class="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200 whitespace-nowrap px-3 sm:px-4 performance-optimized">
                    ${displayName}
                </button>
            `;
    }).join('');
}

function switchCategory(name) {
    currentCategory = name;

    document.querySelectorAll('#category-tabs button').forEach(btn => {
        btn.classList.remove('tab-active');
    });

    const activeTab = document.getElementById(`tab-${name}`);
    if (activeTab) {
        activeTab.classList.add('tab-active');
    }

    renderClients();

    // Smooth scroll for mobile
    if (window.innerWidth < 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function renderClients(query = '') {
    const container = document.getElementById('client-container');
    const q = query.toLowerCase().trim();
    const toShow = currentCategory === "ALL" ? libraryTree : libraryTree.filter(c => c.name === currentCategory);

    if (toShow.length === 0) {
        container.innerHTML = `
                <div class="text-center py-12 animate-fadeIn">
                    <div class="inline-flex p-4 rounded-xl bg-gradient-to-br from-[#347ccb]/10 to-transparent mb-4">
                        <i class="fa-solid fa-search text-[#347ccb] text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-white mb-2">No content available</h3>
                    <p class="text-gray-500 text-sm">This category is empty</p>
                </div>
            `;
        return;
    }

    let html = '';

    toShow.forEach(cat => {
        const filteredClients = cat.clients.map(client => {
            const clientMatch = client.displayName.toLowerCase().includes(q);
            const descriptionMatch = client.description && client.description.toLowerCase().includes(q);
            const authorMatch = client.author && (
                (client.author.name && client.author.name.toLowerCase().includes(q)) ||
                (client.author.website && client.author.website.toLowerCase().includes(q)) ||
                (client.author.discord && client.author.discord.toLowerCase().includes(q)) ||
                (client.author.github && client.author.github.toLowerCase().includes(q))
            );
            const tagMatch = client.tags.some(tag => tag.toLowerCase().includes(q));
            const fileMatch = client.files.some(f =>
                f.display.toLowerCase().includes(q) ||
                f.rawName.toLowerCase().includes(q)
            );
            const extensionMatch = client.extensions.some(e =>
                e.display.toLowerCase().includes(q) ||
                e.rawName.toLowerCase().includes(q)
            );

            if (clientMatch || descriptionMatch || authorMatch || tagMatch || fileMatch || extensionMatch || !q) {
                const matchingFiles = q ? client.files.filter(f =>
                    f.display.toLowerCase().includes(q) ||
                    f.rawName.toLowerCase().includes(q) ||
                    clientMatch ||
                    descriptionMatch ||
                    authorMatch ||
                    tagMatch
                ) : client.files;

                const matchingExtensions = q ? client.extensions.filter(e =>
                    e.display.toLowerCase().includes(q) ||
                    e.rawName.toLowerCase().includes(q) ||
                    clientMatch ||
                    descriptionMatch ||
                    authorMatch ||
                    tagMatch
                ) : client.extensions;

                return { ...client, matchingFiles, matchingExtensions };
            }
            return null;
        }).filter(c => c !== null);

        if (filteredClients.length > 0) {
            html += `
                <div class="space-y-6">
                    <div class="section-divider">
                        <span class="text-sm font-semibold uppercase tracking-wider text-gray-500">
                            ${cat.displayName}
                        </span>
                    </div>
                    
                    ${filteredClients.map(client => {
                const isSearching = !!q;
                const isCollapsed = collapsedClients.has(client.id);
                const hasManyFiles = client.matchingFiles.length > 5;
                const isFilesExpanded = expandedFiles.has(client.id) || isSearching;
                const filesToDisplay = isFilesExpanded ? client.matchingFiles : client.matchingFiles.slice(0, 5);
                const isDescriptionExpanded = expandedDescriptions.has(client.id);
                const hasDescription = client.description && client.description.trim().length > 0;
                const hasAuthor = client.author && Object.keys(client.author).length > 0;
                const hasScreenshots = client.screenshots && client.screenshots.length > 0;
                const hasDetails = hasDescription || hasAuthor || hasScreenshots;
                const areExtensionsExpanded = expandedExtensions.has(client.id);

                return `
                        <div class="space-y-4 animate-fadeIn">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3 max-w-[70%]">
                                    ${client.iconUrl ? `
                                        <div class="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                                            <img src="${client.iconUrl}" 
                                                 class="w-full h-full rounded-lg object-cover border border-white/5 relative z-10 performance-optimized"
                                                 alt="${client.displayName} icon"
                                                 loading="lazy"
                                                 onerror="this.style.display='none'">
                                        </div>
                                    ` : ''}
                                    <div class="min-w-0">
                                        <h2 class="text-lg sm:text-xl font-semibold text-white truncate">
                                            ${client.displayName}
                                        </h2>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                            ${client.isPopular ? `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                                                    <i class="fa-solid fa-star mr-1 text-xs"></i>Popular
                                                </span>
                                            ` : ''}
                                            ${client.isOptifine ? `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                                    <i class="fa-solid fa-bolt mr-1 text-xs"></i>Optifine
                                                </span>
                                            ` : ''}
                                            ${client.originalCategory && client.isOptifine ? `
                                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                    <i class="fa-solid fa-layer-group mr-1 text-xs"></i>${client.originalCategory}
                                                </span>
                                            ` : ''}
                                            ${client.tags.map(tag => {
                    const tagConfig = TAG_COLORS[tag] || { bg: 'from-gray-500/10 to-gray-500/10', text: 'text-gray-300', border: 'border-gray-500/20', icon: 'fa-tag' };
                    return `
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r ${tagConfig.bg} ${tagConfig.text} border ${tagConfig.border}">
                                                        <i class="fa-solid ${tagConfig.icon} mr-1 text-xs"></i>${tag.charAt(0).toUpperCase() + tag.slice(1)}
                                                    </span>
                                                `;
                }).join('')}
                                        </div>
                                    </div>
                                </div>
                                
                                <button onclick="toggleClientCollapse('${client.id}')" 
                                        class="client-collapse-btn performance-optimized"
                                        aria-label="${isCollapsed ? 'Expand client' : 'Collapse client'}">
                                    ${isCollapsed ?
                        '<i class="fa-solid fa-chevron-down mr-1 sm:mr-2"></i><span class="hidden sm:inline">Expand</span>' :
                        '<i class="fa-solid fa-chevron-up mr-1 sm:mr-2"></i><span class="hidden sm:inline">Collapse</span>'
                    }
                                </button>
                            </div>

                            <!-- Combined Description, Screenshots, and Author Panel -->
                            ${hasDetails && !isCollapsed ? `
                                <div class="description-panel ${isDescriptionExpanded ? 'expanded' : ''}">
                                    <div class="description-content performance-optimized">
                                        ${hasScreenshots ? `
                                            <div class="mb-6">
                                                <div class="flex items-center justify-between mb-3">
                                                    <div class="flex items-center gap-2">
                                                        <i class="fa-solid fa-images text-[#347ccb]"></i>
                                                        <span class="font-medium text-white">Screenshots (${client.screenshots.length})</span>
                                                    </div>
                                                    <button onclick="openScreenshots('${client.id}', ${JSON.stringify(client.screenshots)})" 
                                                            class="text-sm text-[#347ccb] hover:underline transition-colors">
                                                        View All
                                                    </button>
                                                </div>
                                                <div class="screenshot-grid">
                                                    ${client.screenshots.slice(0, 6).map((screenshot, idx) => `
                                                        <div class="screenshot-item performance-optimized" 
                                                             onclick="openScreenshots('${client.id}', ${JSON.stringify(client.screenshots)}, ${idx})"
                                                             aria-label="View screenshot ${idx + 1}">
                                                            <img src="${screenshot.url}" 
                                                                 alt="Screenshot ${idx + 1}"
                                                                 loading="lazy">
                                                            <div class="screenshot-overlay">
                                                                <span class="screenshot-number">${idx + 1}</span>
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        ${hasDescription ? `
                                            <div class="mb-4">
                                                ${client.description.split('\n').map(line => `<p class="mb-2 last:mb-0">${line}</p>`).join('')}
                                            </div>
                                        ` : ''}
                                        ${hasAuthor ? `
                                            <div class="author-info">
                                                <div class="flex items-start gap-3">
                                                    <div class="flex-1">
                                                        <div class="flex items-center gap-2 mb-2">
                                                            <i class="fa-solid fa-user text-[#347ccb]"></i>
                                                            <span class="font-medium text-white">${client.author.name || 'Unknown Author'}</span>
                                                        </div>
                                                        ${client.author.website ? `
                                                            <div class="flex items-center gap-2 text-sm">
                                                                <i class="fa-solid fa-globe text-gray-500"></i>
                                                                <a href="${client.author.website}" target="_blank" rel="noopener noreferrer" class="text-[#347ccb] hover:underline truncate transition-colors">
                                                                    ${client.author.website.replace(/^https?:\/\//, '')}
                                                                </a>
                                                            </div>
                                                        ` : ''}
                                                        ${client.author.discord ? `
                                                            <div class="flex items-center gap-2 text-sm mt-1">
                                                                <i class="fa-brands fa-discord text-gray-500"></i>
                                                                ${formatDiscordLink(client.author.discord)}
                                                            </div>
                                                        ` : ''}
                                                        ${client.author.github ? `
                                                            <div class="flex items-center gap-2 text-sm mt-1">
                                                                <i class="fa-brands fa-github text-gray-500"></i>
                                                                <a href="https://github.com/${client.author.github}" target="_blank" rel="noopener noreferrer" class="text-[#347ccb] hover:underline transition-colors">
                                                                    @${client.author.github}
                                                                </a>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <button onclick="toggleDescription('${client.id}')" 
                                        class="description-toggle-btn ${isDescriptionExpanded ? 'expanded' : ''} performance-optimized"
                                        aria-label="${isDescriptionExpanded ? 'Hide details' : 'Show details'}">
                                    ${isDescriptionExpanded ? 'Hide Details' : 'Show Details'}
                                    <i class="fa-solid fa-chevron-down text-xs"></i>
                                </button>
                            ` : ''}

                            <div class="${isCollapsed ? 'hidden' : ''} space-y-4">
                                ${client.matchingFiles.length > 0 ? `
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        ${filesToDisplay.map((file, index) => {
                        const cardClass = client.bannerUrl ? 'banner-card' : 'glass-card';
                        const isMobile = window.innerWidth < 768;

                        return `
                                            <div class="${cardClass} performance-optimized" style="animation-delay: ${index * 50}ms">
                                                ${client.bannerUrl ? `
                                                    <img src="${client.bannerUrl}" class="banner-img" alt="${client.displayName} banner" loading="lazy">
                                                    <div class="banner-gradient"></div>
                                                ` : ''}
                                                <div class="card-content flex ${isMobile ? 'flex-col items-start' : 'items-center justify-between'} gap-3 p-4 sm:p-6">
                                                    <div class="min-w-0 ${isMobile ? 'w-full' : 'pr-4'}">
                                                        <div class="text-white font-semibold text-sm sm:text-base truncate flex items-center">
                                                            <i class="fa-solid fa-file-arrow-down mr-2 text-gray-500"></i>
                                                            ${file.display}
                                                        </div>
                                                        <div class="text-xs text-gray-400 font-mono mt-0.5 truncate">
                                                            ${file.rawName}
                                                        </div>
                                                        ${file.size ? `
                                                            <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                                <i class="fa-solid fa-weight-scale"></i>
                                                                <span>${file.size}</span>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    <a href="${file.url}" 
                                                       target="_blank" 
                                                       rel="noopener noreferrer"
                                                       class="btn-download text-white text-sm font-semibold py-2 px-4 rounded-lg inline-flex items-center justify-center ${isMobile ? 'w-full mt-3' : ''} performance-optimized">
                                                        <i class="fa-solid fa-download mr-1.5"></i>Download
                                                    </a>
                                                </div>
                                            </div>
                                        `}).join('')}
                                    </div>
                                ` : ''}

                                ${hasManyFiles && !isSearching && client.matchingFiles.length > 5 ? `
                                    <button onclick="toggleFileList('${client.id}')" 
                                            class="show-more-btn performance-optimized"
                                            aria-label="${isFilesExpanded ? 'Show less files' : 'Show more files'}">
                                        ${isFilesExpanded ?
                            '<i class="fa-solid fa-angles-up"></i> <span>Show Less</span>' :
                            `<i class="fa-solid fa-angles-down"></i> <span>Show ${client.matchingFiles.length - 5} more</span>`
                        }
                                    </button>
                                ` : ''}

                                ${client.matchingExtensions.length > 0 ? `
                                    <div class="extension-container performance-optimized">
                                        <div class="section-divider">
                                            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                Extensions & Add-ons (${client.matchingExtensions.length})
                                            </span>
                                        </div>
                                        <button onclick="toggleDropdown('${client.id}')" 
                                                class="w-full glass-card p-3 sm:p-4 flex items-center justify-between extension-btn ${areExtensionsExpanded ? 'open' : ''} performance-optimized"
                                                aria-label="${areExtensionsExpanded ? 'Hide extensions' : 'Show extensions'}">
                                            <div class="flex items-center text-sm font-semibold text-[#347ccb]">
                                                <i class="fa-solid fa-puzzle-piece mr-2 text-gray-500"></i>
                                                Extensions (${client.matchingExtensions.length})
                                            </div>
                                            <i class="fa-solid fa-chevron-down text-gray-600 transition-transform duration-300"></i>
                                        </button>
                                        <div class="extension-dropdown ${areExtensionsExpanded ? 'open' : ''}">
                                            ${client.matchingExtensions.map((ext, index) => {
                            const isMobile = window.innerWidth < 768;
                            return `
                                                <div class="extension-row performance-optimized" style="animation-delay: ${index * 50}ms">
                                                    ${client.bannerUrl ? `
                                                        <img src="${client.bannerUrl}" class="banner-img opacity-20" loading="lazy">
                                                        <div class="banner-gradient"></div>
                                                    ` : ''}
                                                    <div class="card-content flex ${isMobile ? 'flex-col items-start' : 'items-center justify-between'} w-full gap-3">
                                                        <div class="min-w-0 ${isMobile ? 'w-full' : 'pr-4'}">
                                                            <div class="text-sm font-semibold text-gray-200 truncate">
                                                                ${ext.display}
                                                            </div>
                                                            <div class="text-xs text-gray-400 font-mono truncate">
                                                                ${ext.rawName}
                                                            </div>
                                                            ${ext.size ? `
                                                                <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                                    <i class="fa-solid fa-weight-scale"></i>
                                                                    <span>${ext.size}</span>
                                                                </div>
                                                            ` : ''}
                                                        </div>
                                                        <a href="${ext.url}" 
                                                           target="_blank" 
                                                           rel="noopener noreferrer"
                                                           class="btn-download text-white text-sm font-semibold py-2 px-4 rounded-lg inline-flex items-center justify-center ${isMobile ? 'w-full mt-2' : ''} performance-optimized">
                                                            <i class="fa-solid fa-download mr-1.5"></i>Download
                                                        </a>
                                                    </div>
                                                </div>
                                            `}).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
            }).join('')}
                </div>`;
        }
    });

    container.innerHTML = html || `
            <div class="text-center py-12 animate-fadeIn">
                <div class="inline-flex p-4 rounded-xl bg-gradient-to-br from-[#347ccb]/10 to-transparent mb-4">
                    <i class="fa-solid fa-search text-[#347ccb] text-2xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">No results found</h3>
                <p class="text-gray-500 text-sm">Try a different search term or browse the categories above</p>
            </div>
        `;
}

// Debounced search
let searchDebounce;
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        renderClients(e.target.value);
    }, 150);
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScreenshots();
    }
});

// Keyboard navigation for screenshots
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('screenshots-modal');
    if (modal.classList.contains('active')) {
        if (e.key === 'ArrowLeft') {
            prevScreenshot();
        } else if (e.key === 'ArrowRight') {
            nextScreenshot();
        } else if (e.key === 'z' || e.key === 'Z') {
            toggleZoom();
        }
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
            .animate-fadeIn {
                animation: fadeIn 0.4s ease-out forwards;
            }
            @keyframes fadeIn {
                from { 
                    opacity: 0; 
                    transform: translateY(10px);
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0);
                }
            }
        `;
    document.head.appendChild(style);

    // Initialize the library
    init();
});

// Touch improvements
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// Performance: debounce resize events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        renderClients(document.getElementById('search-input').value);
    }, 250);
});