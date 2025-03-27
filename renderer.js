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
        
        // Simuler un navigateur web
        const response = await fetch(chapterUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/html'
            },
            credentials: 'omit'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const images = [];

        // Chercher directement dans le HTML
        $('img').each((index, element) => {
            const $img = $(element);
            let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
            
            if (src && src.includes('api.phenix-scans.com/uploads/manga/')) {
                // Nettoyer l'URL
                src = src.trim();
                if (!src.startsWith('http')) {
                    src = `https:${src}`;
                }
                
                // Ajouter le paramètre de largeur pour une meilleure qualité
                if (!src.includes('width=')) {
                    src = `${src}${src.includes('?') ? '&' : '?'}width=1080`;
                }

                console.log(`Image ${index + 1} trouvée:`, src);
                images.push({
                    url: src,
                    pageNumber: index + 1
                });
            }
        });

        // Si aucune image n'a été trouvée, chercher dans les scripts
        if (images.length === 0) {
            const scriptContent = $('script:contains("chapter_data")').html();
            if (scriptContent) {
                const match = scriptContent.match(/chapter_data\s*=\s*(\[.*?\])/s);
                if (match) {
                    try {
                        const chapterData = JSON.parse(match[1].replace(/'/g, '"'));
                        chapterData.forEach((src, index) => {
                            if (typeof src === 'string' && src.includes('api.phenix-scans.com/uploads/manga/')) {
                                src = src.trim();
                                if (!src.startsWith('http')) {
                                    src = `https:${src}`;
                                }
                                
                                if (!src.includes('width=')) {
                                    src = `${src}${src.includes('?') ? '&' : '?'}width=1080`;
                                }

                                console.log(`Image ${index + 1} trouvée dans script:`, src);
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

// Fonction pour afficher un chapitre
function displayChapter(images, chapterNumber, manga) {
    try {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            throw new Error('Element content-area non trouvé');
        }

        if (!chaptersCache[manga.slug]) {
            throw new Error('Cache des chapitres non trouvé pour ce manga');
        }
        
        // Créer la structure du lecteur avec navigation minimaliste
        contentArea.innerHTML = `
            <div class="chapter-reader">
                <div class="chapter-content">
                    ${images.map((image, index) => `
                        <div class="page-container">
                            <div class="page-number">${index + 1} / ${images.length}</div>
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
                    <button onclick="window.navigateChapter(1)" class="nav-button" title="Chapitre Précédent">←</button>
                    <select id="chapter-select" onchange="window.loadChapter(currentManga, parseInt(this.value))">
                        ${chaptersCache[manga.slug].chapters.map(chapter => `
                            <option value="${chapter.number}" ${chapter.number === chapterNumber ? 'selected' : ''}>
                                ${chapter.number}
                            </option>
                        `).join('')}
                    </select>
                    <button onclick="window.navigateChapter(-1)" class="nav-button" title="Chapitre Suivant">→</button>
                </div>
            </div>
        `;

        // Faire défiler vers le haut
        window.scrollTo(0, 0);
        
        // Mettre à jour le titre de la page
        document.title = `${manga.title} - Chapitre ${chapterNumber}`;
    } catch (error) {
        console.error('Erreur lors de l\'affichage du chapitre:', error);
        if (contentArea) {
            contentArea.innerHTML = `<div class="error">Erreur lors de l'affichage du chapitre: ${error.message}</div>`;
        }
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
    
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < chapters.length) {
        const newChapter = chapters[newIndex];
        loadChapter(currentManga, newChapter.number);
    }
}

// Fonction de recherche
function searchManga(query) {
    const mangas = loadMangaList();
    if (!query) {
        displayMangaList(mangas);
        return;
    }

    const searchTerm = query.toLowerCase();
    const filteredMangas = mangas.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm) ||
        manga.genres.some(genre => genre.toLowerCase().includes(searchTerm))
    );

    displayMangaList(filteredMangas);
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
    
    // Filtrer les mangas qui ont un historique
    const mangasWithHistory = mangas.filter(manga => lastReadChapters[manga.slug]);
    
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

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Charger le cache au démarrage
        const savedCache = localStorage.getItem('chaptersCache');
        if (savedCache) {
            chaptersCache = JSON.parse(savedCache);
        }

        // Charger et afficher la liste initiale des mangas
        const mangas = loadMangaList();
        displayMangaList(mangas);

        // Configurer la recherche
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchManga(e.target.value);
            });
        }

        // Ajouter l'écouteur d'événement pour la recherche
        document.getElementById('search-input').addEventListener('input', (e) => {
            filterMangas(e.target.value);
        });

        // Ajouter le bouton d'historique
        const historyButton = document.createElement('button');
        historyButton.className = 'history-button';
        historyButton.innerHTML = '📖';
        historyButton.onclick = showHistoryPopup;
        document.body.appendChild(historyButton);

        // Fermer la popup quand on clique sur l'overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('overlay')) {
                hideHistoryPopup();
            }
        });

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