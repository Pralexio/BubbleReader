// Variables globales
let mangaSlug = '';
let chapterNumber = '';
let allMangas = [];

// Fonction pour initialiser la page
async function initReader() {
    try {
        // Récupérer les paramètres de l'URL
        const urlParams = new URLSearchParams(window.location.search);
        mangaSlug = urlParams.get('slug');
        chapterNumber = urlParams.get('chapter');

        if (!mangaSlug || !chapterNumber) {
            showAlert('Paramètres manquants dans l\'URL', 'error');
            return;
        }

        // Récupérer la liste des mangas
        const response = await fetch('/api/mangas');
        const data = await response.json();
        if (data.success) {
            allMangas = data.data;
            await loadChapter();
            initializeChapterSelect();
        } else {
            showAlert('Erreur lors du chargement des mangas', 'error');
        }

        // Ajouter les gestionnaires d'événements pour la navigation
        document.addEventListener('keydown', handleKeyNavigation);
        
        // Gestionnaires pour les boutons de navigation
        const prevBtn = document.querySelector('#prevChapterBtn');
        const nextBtn = document.querySelector('#nextChapterBtn');
        const saveBtn = document.querySelector('#saveProgressBtn');
        const chapterSelect = document.querySelector('#chapterSelect');
        
        if (prevBtn) prevBtn.addEventListener('click', () => navigateToChapter('prev'));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateToChapter('next'));
        if (saveBtn) saveBtn.addEventListener('click', () => {
            saveReadingProgress();
            showAlert('Progression sauvegardée', 'success');
        });
        if (chapterSelect) {
            chapterSelect.addEventListener('change', (e) => {
                const chapter = e.target.value;
                if (chapter !== chapterNumber) {
                    window.location.href = `reader.html?slug=${mangaSlug}&chapter=${chapter}`;
                }
            });
        }

    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showAlert('Erreur lors de l\'initialisation', 'error');
    }
}

// Fonction pour initialiser la liste des chapitres
function initializeChapterSelect() {
    const manga = allMangas.find(m => m.slug === mangaSlug);
    if (!manga) return;

    const chapterSelect = document.querySelector('#chapterSelect');
    if (!chapterSelect) return;

    // Vider la liste
    chapterSelect.innerHTML = '';

    // Ajouter les options
    for (let i = 1; i <= manga.chapterCount; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Chapitre ${i}`;
        if (i === parseInt(chapterNumber)) {
            option.selected = true;
        }
        chapterSelect.appendChild(option);
    }
}

// Fonction pour gérer la navigation au clavier
function handleKeyNavigation(e) {
    if (e.key === 'ArrowLeft') {
        navigateToChapter('prev');
    } else if (e.key === 'ArrowRight') {
        navigateToChapter('next');
    }
}

// Fonction pour sauvegarder la progression
async function saveReadingProgress() {
    try {
        const token = localStorage.getItem('userToken');
        if (!token) {
            showAlert('Vous devez être connecté pour sauvegarder votre progression', 'warning');
            return;
        }

        const response = await fetch('/api/users/mangas/reading-progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mangaSlug,
                currentChapter: parseInt(chapterNumber)
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }

    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showAlert('Erreur lors de la sauvegarde de la progression', 'error');
    }
}

// Fonction pour vérifier si un chapitre existe
function isValidChapter(mangaSlug, chapterNumber) {
    const manga = allMangas.find(m => m.slug === mangaSlug);
    if (!manga) return false;
    return chapterNumber > 0 && chapterNumber <= manga.chapterCount;
}

// Fonction pour naviguer vers un chapitre
function navigateToChapter(direction) {
    const currentChapter = parseInt(chapterNumber);
    const nextChapter = direction === 'next' ? currentChapter + 1 : currentChapter - 1;
    
    if (!isValidChapter(mangaSlug, nextChapter)) {
        showAlert(`Le chapitre ${nextChapter} n'existe pas.`, 'warning');
        return;
    }
    
    window.location.href = `reader.html?slug=${mangaSlug}&chapter=${nextChapter}`;
}

// Fonction pour générer la liste des chapitres
function generateChapterList(manga) {
    const chapterListContainer = document.createElement('div');
    chapterListContainer.className = 'chapter-list-container';
    chapterListContainer.innerHTML = `
        <div class="chapter-list-header">
            <button id="toggleChapterList" class="btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/>
                </svg>
                Chapitres
            </button>
            <button id="manualSave" class="btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Sauvegarder
            </button>
        </div>
        <div id="chapterListPanel" class="chapter-list-panel">
            <div class="chapter-list-scroll">
                ${Array.from({ length: manga.chapterCount }, (_, i) => i + 1)
                    .map(num => `
                        <div class="chapter-item ${num === parseInt(chapterNumber) ? 'active' : ''}" 
                             data-chapter="${num}">
                            Chapitre ${num}
                        </div>
                    `).join('')}
            </div>
        </div>
    `;

    // Ajouter au DOM dans le header-right
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        // Insérer avant le premier élément du header-right
        headerRight.insertBefore(chapterListContainer, headerRight.firstChild);
    }

    // Gestionnaires d'événements
    const toggleBtn = document.getElementById('toggleChapterList');
    const chapterPanel = document.getElementById('chapterListPanel');
    const saveBtn = document.getElementById('manualSave');

    toggleBtn.addEventListener('click', () => {
        chapterPanel.classList.toggle('show');
    });

    saveBtn.addEventListener('click', () => {
        saveReadingProgress();
        showAlert('Progression sauvegardée', 'success');
    });

    // Gestionnaire pour les chapitres
    document.querySelectorAll('.chapter-item').forEach(item => {
        item.addEventListener('click', () => {
            const chapter = item.dataset.chapter;
            if (chapter !== chapterNumber) {
                window.location.href = `reader.html?slug=${mangaSlug}&chapter=${chapter}`;
            }
        });
    });
}

// Fonction pour afficher une alerte
function showAlert(message, type = 'info') {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    document.body.appendChild(alertElement);

    // Rendre l'alerte visible
    setTimeout(() => alertElement.classList.add('visible'), 100);

    // Supprimer l'alerte après 3 secondes
    setTimeout(() => {
        alertElement.classList.remove('visible');
        setTimeout(() => alertElement.remove(), 300);
    }, 3000);
}

// Fonction pour charger un chapitre spécifique
async function loadChapter() {
    try {
        const manga = allMangas.find(m => m.slug === mangaSlug);
        if (!manga) {
            showAlert('Manga non trouvé', 'error');
            return;
        }

        // Générer la liste des chapitres
        generateChapterList(manga);

        if (!isValidChapter(mangaSlug, chapterNumber)) {
            showAlert(`Redirection vers le dernier chapitre disponible (${manga.chapterCount})`, 'info');
            window.location.href = `reader.html?slug=${mangaSlug}&chapter=${manga.chapterCount}`;
        }
        
        // ... existing code for loading chapter ...
    } catch (error) {
        console.error('Erreur lors du chargement du chapitre:', error);
        showAlert('Erreur lors du chargement du chapitre', 'error');
    }
}

// Initialiser la page au chargement
document.addEventListener('DOMContentLoaded', initReader); 