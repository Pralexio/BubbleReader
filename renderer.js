const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Variables globales
let currentManga = null;
let currentChapter = null;
let currentImages = [];

// Stockage local des chapitres avec leur date de dernière mise à jour
let chaptersCache = {};

// Fonction pour charger la liste des mangas depuis le fichier JSON
function loadMangaList() {
    try {
        const filePath = path.join(__dirname, 'manga-list.json');
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data).mangas;
    } catch (error) {
        console.error('Erreur lors du chargement de la liste:', error);
        return [];
    }
}

// Fonction pour afficher la liste des mangas
function displayMangaList(mangas) {
    const mangaListElement = document.getElementById('manga-list');
    mangaListElement.innerHTML = '';

    mangas.forEach(manga => {
        const mangaElement = createMangaElement(manga);
        mangaListElement.appendChild(mangaElement);
    });
}

function createMangaElement(manga) {
    const mangaElement = document.createElement('div');
    mangaElement.className = 'manga-item';
    mangaElement.setAttribute('data-slug', manga.slug);
    
    const coverElement = document.createElement('img');
    coverElement.className = 'manga-cover';
    coverElement.src = manga.cover || 'placeholder.jpg';
    coverElement.alt = `${manga.title} cover`;
    
    const infoElement = document.createElement('div');
    infoElement.className = 'manga-info';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'manga-title';
    titleElement.textContent = manga.title;
    
    infoElement.appendChild(titleElement);
    
    mangaElement.appendChild(coverElement);
    mangaElement.appendChild(infoElement);
    
    mangaElement.addEventListener('click', () => {
        selectManga(manga);
    });
    
    return mangaElement;
}

// Fonction pour sélectionner un manga
async function selectManga(manga) {
    // Retirer la classe selected de l'ancien manga sélectionné
    const previousSelected = document.querySelector('.manga-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }

    // Ajouter la classe selected au nouveau manga
    const selectedManga = document.querySelector(`.manga-item[data-slug="${manga.slug}"]`);
    if (selectedManga) {
        selectedManga.classList.add('selected');
    }

    currentManga = manga;
    await displayMangaDetails(manga);
}

// Fonction pour vérifier si une mise à jour est nécessaire
function needsUpdate(mangaSlug) {
    const cached = chaptersCache[mangaSlug];
    if (!cached) return true;
    
    const lastUpdate = new Date(cached.lastUpdate);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    return hoursSinceUpdate >= 24;
}

// Fonction pour extraire les chapitres d'une page
async function extractChapters(html) {
    const $ = cheerio.load(html);
    const chapters = [];
    
    // Trouver tous les éléments de chapitre
    $('.chapters-list a, a[href*="/chapitre/"]').each((_, element) => {
        const $element = $(element);
        const href = $element.attr('href');
        const text = $element.text().trim();
        
        // Vérifier si c'est un lien de chapitre
        const chapterMatch = text.match(/Chapitre\s+(\d+)/i) || href.match(/chapitre\/(\d+)/);
        if (chapterMatch) {
            const number = parseInt(chapterMatch[1]);
            chapters.push({
                number: number,
                url: href.startsWith('http') ? href : `https://phenix-scans.com${href}`
            });
        }
    });
    
    // Trier les chapitres par numéro (décroissant)
    return chapters.sort((a, b) => b.number - a.number);
}

// Fonction pour récupérer les images d'un chapitre
async function fetchChapterImages(chapterUrl) {
    try {
        console.log('Chargement du chapitre:', chapterUrl);
        
        const response = await fetch(chapterUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const images = [];

        // Chercher les images dans le HTML
        $('img').each((index, element) => {
            const $img = $(element);
            let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
            
            if (src && (src.includes('/uploads/manga/') || src.includes('api.phenix-scans.com'))) {
                src = src.trim();
                if (!src.startsWith('http')) {
                    src = src.startsWith('//') ? `https:${src}` : `https://${src}`;
                }
                
                // Ajouter le paramètre de largeur pour une meilleure qualité
                if (!src.includes('width=')) {
                    src = `${src}${src.includes('?') ? '&' : '?'}width=1080`;
                }

                images.push({
                    url: src,
                    pageNumber: index + 1
                });
            }
        });

        // Si aucune image n'est trouvée, chercher dans les scripts
        if (images.length === 0) {
            const scriptContent = $('script:contains("chapter_data")').html();
            if (scriptContent) {
                const match = scriptContent.match(/chapter_data\s*=\s*(\[.*?\])/s);
                if (match) {
                    try {
                        const chapterData = JSON.parse(match[1].replace(/'/g, '"'));
                        chapterData.forEach((src, index) => {
                            if (typeof src === 'string') {
                                src = src.trim();
                                if (!src.startsWith('http')) {
                                    src = src.startsWith('//') ? `https:${src}` : `https://${src}`;
                                }
                                
                                if (!src.includes('width=')) {
                                    src = `${src}${src.includes('?') ? '&' : '?'}width=1080`;
                                }

                                images.push({
                                    url: src,
                                    pageNumber: index + 1
                                });
                            }
                        });
                    } catch (e) {
                        console.error('Erreur parsing JSON:', e);
                    }
                }
            }
        }

        if (images.length === 0) {
            throw new Error('Aucune image trouvée dans ce chapitre');
        }

        // Trier les images par numéro de page
        images.sort((a, b) => a.pageNumber - b.pageNumber);
        
        console.log(`Total des images trouvées: ${images.length}`);
        return images;
    } catch (error) {
        console.error('Erreur lors de la récupération des images:', error);
        throw error;
    }
}

// Fonction principale pour mettre à jour les chapitres d'un manga
async function updateMangaChapters(manga) {
    try {
        console.log(`Mise à jour des chapitres pour ${manga.title}...`);
        
        const response = await fetch(`https://phenix-scans.com/manga/${manga.slug}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const chapters = [];

        // Chercher tous les liens de chapitres
        $('a[href*="/chapitre/"]').each((_, element) => {
            const href = $(element).attr('href');
            const chapterMatch = href.match(/chapitre\/(\d+)/);
            
            if (chapterMatch) {
                const number = parseInt(chapterMatch[1]);
                chapters.push({
                    number: number,
                    title: `Chapitre ${number}`,
                    url: manga.chapterUrlPattern.replace('{chapter}', number)
                });
            }
        });

        if (chapters.length === 0) {
            throw new Error('Aucun chapitre trouvé');
        }

        // Trier les chapitres par numéro
        chapters.sort((a, b) => b.number - a.number);
        
        // Mettre à jour le cache
        chaptersCache[manga.slug] = {
            chapters: chapters,
            lastUpdate: new Date().toISOString()
        };

        // Sauvegarder dans le stockage local
        localStorage.setItem('chaptersCache', JSON.stringify(chaptersCache));
        
        return chapters;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des chapitres:', error);
        return [];
    }
}

// Fonction pour sauvegarder le dernier chapitre lu
function saveLastReadChapter(mangaSlug, chapterNumber) {
    let lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    lastReadChapters[mangaSlug] = chapterNumber;
    localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters));
}

// Fonction pour récupérer le dernier chapitre lu
function getLastReadChapter(mangaSlug) {
    let lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    return lastReadChapters[mangaSlug] || 1; // Retourne 1 si aucun chapitre n'a été lu
}

// Fonction pour afficher les détails d'un manga
async function displayMangaDetails(manga) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading">Chargement des chapitres...</div>';

    try {
        let chapters;
        
        if (needsUpdate(manga.slug)) {
            chapters = await updateMangaChapters(manga);
        } else {
            chapters = chaptersCache[manga.slug].chapters;
        }

        if (chapters.length === 0) {
            contentArea.innerHTML = '<div class="error">Aucun chapitre trouvé</div>';
            return;
        }

        // Récupérer le dernier chapitre lu
        const lastReadChapter = getLastReadChapter(manga.slug);

        contentArea.innerHTML = `
            <div class="manga-reader">
                <div class="manga-header">
                    <h2>${manga.title}</h2>
                    <div class="chapter-selector">
                        <select id="chapter-select" onchange="window.loadChapter(currentManga, parseInt(this.value))">
                            ${chapters.map(chapter => `
                                <option value="${chapter.number}" ${chapter.number === lastReadChapter ? 'selected' : ''}>
                                    Chapitre ${chapter.number}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div id="chapter-content">
                    <div class="loading">Chargement du chapitre ${lastReadChapter}...</div>
                </div>
            </div>
        `;

        // Mettre à jour la variable globale
        currentManga = manga;
        
        // Charger le dernier chapitre lu
        await loadChapter(manga, lastReadChapter);
    } catch (error) {
        console.error('Erreur lors de l\'affichage des chapitres:', error);
        contentArea.innerHTML = '<div class="error">Erreur lors du chargement des chapitres</div>';
    }
}

// Fonction pour charger un chapitre spécifique
async function loadChapter(manga, chapterNumber) {
    try {
        if (!manga || !manga.slug || !chapterNumber) {
            throw new Error('Paramètres invalides pour le chargement du chapitre');
        }

        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            throw new Error('Element content-area non trouvé');
        }

        // Afficher un message de chargement
        contentArea.innerHTML = '<div class="loading">Chargement du chapitre...</div>';

        // Construire l'URL du chapitre
        const chapterUrl = `https://phenix-scans.com/manga/${manga.slug}/chapitre/${chapterNumber}`;
        console.log('Chargement du chapitre:', chapterUrl);
        
        // Récupérer les images du chapitre
        const images = await fetchChapterImages(chapterUrl);
        
        if (!images || images.length === 0) {
            throw new Error('Aucune image trouvée dans ce chapitre');
        }

        // Afficher le chapitre
        await displayChapter(images, chapterNumber, manga);

        // Sauvegarder le dernier chapitre lu
        saveLastReadChapter(manga.slug, chapterNumber);

        // Mettre à jour les variables globales
        currentManga = manga;
        currentChapter = chapterNumber;
        currentImages = images;

    } catch (error) {
        console.error('Erreur lors du chargement du chapitre:', error);
        if (contentArea) {
            contentArea.innerHTML = `<div class="error">Erreur lors du chargement du chapitre: ${error.message}</div>`;
        }
    }
}

// Fonction pour afficher le chapitre
async function displayChapter(images, chapterNumber, manga) {
    try {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            throw new Error('Element content-area non trouvé');
        }

        if (!chaptersCache[manga.slug]) {
            throw new Error('Cache des chapitres non trouvé pour ce manga');
        }
        
        contentArea.innerHTML = `
            <div class="chapter-reader">
                <div class="chapter-content">
                    ${images.map((image, index) => `
                        <div class="page-container">
                            <img 
                                src="${image.url}" 
                                alt="Page ${index + 1}"
                                class="chapter-image"
                                loading="lazy"
                                onerror="this.onerror=null; this.src=this.src.replace('width=1080', 'width=720')"
                            >
                        </div>
                    `).join('')}
                </div>
                
                <div class="chapter-navigation">
                    <button onclick="navigateChapter(-1)" class="nav-button">◀</button>
                    <select id="chapter-select" onchange="loadChapter(currentManga, parseInt(this.value))">
                        ${chaptersCache[manga.slug].chapters.map(chapter => `
                            <option value="${chapter.number}" ${chapter.number === chapterNumber ? 'selected' : ''}>
                                Chap-${chapter.number}
                            </option>
                        `).join('')}
                    </select>
                    <button onclick="navigateChapter(1)" class="nav-button">▶</button>
                </div>
            </div>
        `;
        
        // Sauvegarder le dernier chapitre lu
        saveLastReadChapter(manga.slug, chapterNumber);
        
    } catch (error) {
        console.error('Erreur lors de l\'affichage du chapitre:', error);
        contentArea.innerHTML = '<div class="error">Erreur lors du chargement du chapitre</div>';
    }
}

// Fonction pour basculer la liste des chapitres
function toggleChaptersList() {
    const dropdown = document.querySelector('.chapters-dropdown');
    dropdown.classList.toggle('active');
}

// Fonction pour naviguer entre les chapitres
async function navigateChapter(delta) {
    if (!currentManga || !currentChapter) return;
    
    const chapters = chaptersCache[currentManga.slug].chapters;
    const currentIndex = chapters.findIndex(ch => ch.number === currentChapter);
    
    if (currentIndex === -1) return;
    
    // Inverser le delta car les chapitres sont triés du plus récent au plus ancien
    const newIndex = currentIndex - delta;
    if (newIndex >= 0 && newIndex < chapters.length) {
        const newChapter = chapters[newIndex];
        loadChapter(currentManga, newChapter.number);
    }
}

// Fonction de recherche simplifiée
function searchManga(query) {
    const mangas = loadMangaList();
    const searchTerm = query.toLowerCase().trim();
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    
    const filteredMangas = mangas.filter(manga => {
        const matchesSearch = !searchTerm || 
            manga.title.toLowerCase().includes(searchTerm) ||
            manga.slug.toLowerCase().includes(searchTerm);
            
        const matchesStatus = statusFilter === 'all' || manga.status === statusFilter;
        const matchesType = typeFilter === 'all' || manga.type === typeFilter;
        
        return matchesSearch && matchesStatus && matchesType;
    });

    displayMangaList(filteredMangas);
}

// Fonction pour supprimer les doublons
function removeDuplicates(mangas) {
    const seen = new Map();
    return mangas.filter(manga => {
        if (seen.has(manga.slug)) {
            return false;
        }
        seen.set(manga.slug, true);
        return true;
    });
}

// Fonction pour mettre à jour les compteurs de filtres
function updateFilterCounts(mangas) {
    const counts = {
        status: {
            'EN COURS': 0,
            'TERMINÉ': 0
        },
        type: {
            'MANHWA': 0,
            'MANGA': 0,
            'MANHUA': 0
        }
    };

    mangas.forEach(manga => {
        if (manga.status) counts.status[manga.status]++;
        if (manga.type) counts.type[manga.type]++;
    });

    // Mettre à jour l'interface utilisateur avec les compteurs
    updateFilterUI(counts);
}

// Fonction pour créer les filtres dans l'interface
function createFilters() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    
    // Filtres de statut
    const statusFilter = document.createElement('div');
    statusFilter.className = 'filter-group';
    statusFilter.innerHTML = `
        <h3>Statut</h3>
        <label>
            <input type="checkbox" data-filter="status" value="EN COURS"> En cours
            <span class="count" id="count-en-cours"></span>
        </label>
        <label>
            <input type="checkbox" data-filter="status" value="TERMINÉ"> Terminé
            <span class="count" id="count-termine"></span>
        </label>
    `;

    // Filtres de type
    const typeFilter = document.createElement('div');
    typeFilter.className = 'filter-group';
    typeFilter.innerHTML = `
        <h3>Type</h3>
        <label>
            <input type="checkbox" data-filter="type" value="MANHWA"> Manhwa
            <span class="count" id="count-manhwa"></span>
        </label>
        <label>
            <input type="checkbox" data-filter="type" value="MANGA"> Manga
            <span class="count" id="count-manga"></span>
        </label>
        <label>
            <input type="checkbox" data-filter="type" value="MANHUA"> Manhua
            <span class="count" id="count-manhua"></span>
        </label>
    `;

    filterContainer.appendChild(statusFilter);
    filterContainer.appendChild(typeFilter);

    // Ajouter les écouteurs d'événements pour les filtres
    filterContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            applyFilters();
        }
    });

    return filterContainer;
}

// Fonction pour appliquer les filtres
function applyFilters() {
    const filters = {
        status: [],
        type: []
    };

    // Collecter les filtres actifs
    document.querySelectorAll('input[data-filter]:checked').forEach(checkbox => {
        const filterType = checkbox.dataset.filter;
        const value = checkbox.value;
        filters[filterType].push(value);
    });

    // Appliquer les filtres
    let mangas = loadMangaList();
    mangas = removeDuplicates(mangas);

    if (filters.status.length > 0) {
        mangas = mangas.filter(manga => filters.status.includes(manga.status));
    }
    if (filters.type.length > 0) {
        mangas = mangas.filter(manga => filters.type.includes(manga.type));
    }

    // Appliquer la recherche textuelle si elle existe
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        mangas = mangas.filter(manga => {
            const title = manga.title.toLowerCase();
            const slug = manga.slug.toLowerCase();
            return title.includes(searchTerm) || slug.includes(searchTerm);
        });
    }

    displayMangaList(mangas);
    updateFilterCounts(mangas);
}

// Fonction pour mettre à jour l'interface des filtres
function updateFilterUI(counts) {
    // Mettre à jour les compteurs de statut
    document.getElementById('count-en-cours').textContent = `(${counts.status['EN COURS']})`;
    document.getElementById('count-termine').textContent = `(${counts.status['TERMINÉ']})`;
    
    // Mettre à jour les compteurs de type
    document.getElementById('count-manhwa').textContent = `(${counts.type['MANHWA']})`;
    document.getElementById('count-manga').textContent = `(${counts.type['MANGA']})`;
    document.getElementById('count-manhua').textContent = `(${counts.type['MANHUA']})`;
}

// Fonction pour filtrer les mangas
function filterMangas(searchTerm) {
    const mangas = loadMangaList();
    const filteredMangas = mangas.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    displayMangaList(filteredMangas);
}

// Fonction pour afficher la popup d'historique
function showHistoryPopup() {
    const lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    const mangas = loadMangaList();
    
    // Créer la popup si elle n'existe pas
    let popup = document.querySelector('.history-popup');
    let overlay = document.querySelector('.overlay');
    
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'history-popup';
        document.body.appendChild(popup);
    }
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'overlay';
        document.body.appendChild(overlay);
    }
    
    // Générer le contenu de la popup
    let historyContent = `
        <div class="history-popup-header">
            <h2>Historique de lecture</h2>
            <button class="close-popup" onclick="hideHistoryPopup()">×</button>
        </div>
        <div class="history-list">
    `;
    
    // Filtrer les mangas qui ont un historique et éviter les doublons
    const processedSlugs = new Set();
    const mangasWithHistory = mangas.filter(manga => {
        if (lastReadChapters[manga.slug] && !processedSlugs.has(manga.slug)) {
            processedSlugs.add(manga.slug);
            return true;
        }
        return false;
    });
    
    if (mangasWithHistory.length === 0) {
        historyContent += '<div class="history-item">Aucun historique de lecture</div>';
    } else {
        mangasWithHistory.forEach(manga => {
            const lastChapter = lastReadChapters[manga.slug];
            historyContent += `
                <div class="history-item" data-slug="${manga.slug}">
                    <div class="history-manga-info">
                        <div class="history-manga-title">${manga.title}</div>
                        <div class="history-chapter">Chapitre ${lastChapter}</div>
                    </div>
                    <div class="history-actions">
                        <button class="history-button-edit" onclick="editChapter('${manga.slug}', ${lastChapter})">
                            Modifier
                        </button>
                        <button class="history-button-reset" onclick="resetChapter('${manga.slug}')">
                            Reset
                        </button>
                        <button class="history-button-delete" onclick="deleteHistory('${manga.slug}')">
                            Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    historyContent += '</div>';
    popup.innerHTML = historyContent;
    
    // Afficher la popup et l'overlay
    popup.classList.add('active');
    overlay.classList.add('active');
}

// Fonction pour cacher la popup
function hideHistoryPopup() {
    const popup = document.querySelector('.history-popup');
    const overlay = document.querySelector('.overlay');
    if (popup) popup.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// Fonction pour éditer un chapitre
function editChapter(mangaSlug, currentChapter) {
    const item = document.querySelector(`.history-item[data-slug="${mangaSlug}"]`);
    const chapterDiv = item.querySelector('.history-chapter');
    
    // Créer l'input pour éditer le chapitre
    chapterDiv.innerHTML = `
        <input type="number" class="chapter-edit-input" value="${currentChapter}" min="1">
        <button onclick="saveChapterEdit('${mangaSlug}', this.previousElementSibling.value)">✓</button>
        <button onclick="cancelChapterEdit('${mangaSlug}', ${currentChapter})">✗</button>
    `;
}

// Fonction pour sauvegarder l'édition d'un chapitre
function saveChapterEdit(mangaSlug, newChapter) {
    newChapter = parseInt(newChapter);
    if (newChapter < 1) newChapter = 1;
    
    let lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    lastReadChapters[mangaSlug] = newChapter;
    localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters));
    
    // Rafraîchir l'affichage
    showHistoryPopup();
}

// Fonction pour annuler l'édition d'un chapitre
function cancelChapterEdit(mangaSlug, currentChapter) {
    const item = document.querySelector(`.history-item[data-slug="${mangaSlug}"]`);
    const chapterDiv = item.querySelector('.history-chapter');
    chapterDiv.textContent = `Chapitre ${currentChapter}`;
}

// Fonction pour réinitialiser un chapitre
function resetChapter(mangaSlug) {
    let lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    lastReadChapters[mangaSlug] = 1;
    localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters));
    
    // Rafraîchir l'affichage
    showHistoryPopup();
}

// Fonction pour supprimer l'historique d'un manga
function deleteHistory(mangaSlug) {
    let lastReadChapters = JSON.parse(localStorage.getItem('lastReadChapters') || '{}');
    delete lastReadChapters[mangaSlug];
    localStorage.setItem('lastReadChapters', JSON.stringify(lastReadChapters));
    
    // Rafraîchir l'affichage
    showHistoryPopup();
}

// Gestion de la sidebar
function initSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.getElementById('content-area');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        contentArea.classList.toggle('sidebar-active');
        overlay.classList.toggle('active');
        menuToggle.classList.toggle('active');
    }

    // Gestionnaire pour le bouton toggle
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    // Fermer la sidebar quand on clique sur l'overlay
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }

    // Fermer la sidebar quand on sélectionne un manga
    document.getElementById('manga-list').addEventListener('click', () => {
        sidebar.classList.remove('active');
        contentArea.classList.remove('sidebar-active');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
    });
}

// Mise à jour de l'initialisation
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialiser la sidebar
        initSidebar();

        // Charger le cache au démarrage
        const savedCache = localStorage.getItem('chaptersCache');
        if (savedCache) {
            chaptersCache = JSON.parse(savedCache);
        }

        // Charger et afficher la liste initiale des mangas
        const mangas = loadMangaList();
        displayMangaList(mangas);

        // Configurer la recherche et les filtres
        const searchInput = document.getElementById('search-input');
        const statusFilter = document.getElementById('status-filter');
        const typeFilter = document.getElementById('type-filter');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => searchManga(e.target.value));
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => searchManga(searchInput.value));
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', () => searchManga(searchInput.value));
        }

        // Ajouter le bouton d'historique
        const historyButton = document.createElement('button');
        historyButton.className = 'history-button';
        historyButton.innerHTML = '📖';
        historyButton.onclick = showHistoryPopup;
        document.body.appendChild(historyButton);

        console.log('Application initialisée avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
});

// Rendre les fonctions disponibles globalement
window.loadChapter = loadChapter;
window.navigateChapter = navigateChapter;
window.toggleChaptersList = toggleChaptersList;
window.selectManga = selectManga;
window.searchManga = searchManga;
window.showHistoryPopup = showHistoryPopup;
window.hideHistoryPopup = hideHistoryPopup;
window.editChapter = editChapter;
window.saveChapterEdit = saveChapterEdit;
window.cancelChapterEdit = cancelChapterEdit;
window.resetChapter = resetChapter;
window.deleteHistory = deleteHistory; 