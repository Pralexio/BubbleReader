// Bloquer l'accès à la console de développement
(function() {
    try {
        // Redéfinir les méthodes de la console
        const noOp = function() {};
        const originalConsole = window.console;
        
        // Sauvegarder les fonctions console originales pour le débogage interne
        const _console = {
            log: originalConsole.log,
            warn: originalConsole.warn,
            error: originalConsole.error,
            info: originalConsole.info,
            debug: originalConsole.debug
        };
        
        // Remplacer les méthodes de la console par des fonctions vides
        window.console = {
            log: noOp,
            warn: noOp,
            error: noOp,
            info: noOp,
            debug: noOp,
            clear: noOp,
            dir: noOp,
            dirxml: noOp,
            trace: noOp,
            group: noOp,
            groupCollapsed: noOp,
            groupEnd: noOp,
            time: noOp,
            timeEnd: noOp,
            timeStamp: noOp,
            table: noOp,
            count: noOp,
            assert: noOp,
            profile: noOp,
            profileEnd: noOp
        };
        
        // Détecter l'ouverture des outils de développement
        const detectDevTools = function() {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            
            if (widthThreshold || heightThreshold) {
                document.body.innerHTML = `
                    <div style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;background:#1a1a2e;color:white;font-family:sans-serif;">
                        <img src="assets/logo.png" alt="BubbleReader Logo" style="width:100px;margin-bottom:20px;">
                        <h1 style="color:#ff69b4;margin-bottom:10px;">Accès non autorisé</h1>
                        <p style="text-align:center;max-width:500px;margin-bottom:20px;">L'utilisation des outils de développement n'est pas autorisée dans cette application.</p>
                        <button onclick="location.reload()" style="background:#ff69b4;border:none;color:white;padding:10px 20px;border-radius:5px;cursor:pointer;">Recharger l'application</button>
                    </div>
                `;
            }
        };
        
        // Surveiller l'ouverture des outils de développement
        window.addEventListener('resize', detectDevTools);
        setInterval(detectDevTools, 1000);
        
        // Désactiver les raccourcis clavier des outils de développement
        window.addEventListener('keydown', function(e) {
            // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            if (
                e.keyCode === 123 || 
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))
            ) {
                e.preventDefault();
            }
        });
        
        // Fonction interne pour le logging sécurisé (utilisée par le code de l'application)
        window._log = function(message) {
            // Cette fonction peut être utilisée en interne par l'application
            // pour enregistrer des messages importants
            if (typeof message === 'string' && message.startsWith('SYSTÈME:')) {
                _console.log(message);
            }
        };
    } catch (e) {
        // Silencieux en cas d'erreur
    }
})();

// Désactiver clic droit
document.addEventListener('contextmenu', event => event.preventDefault());

// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = null;

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans main-renderer.js');
  
  // Récupérer l'ipcRenderer de manière sécurisée
  if (window.electron.ipcRenderer) {
    ipcRenderer = window.electron.ipcRenderer;
  }
  
  // Récupérer l'URL de l'API
  apiUrl = window.electron.getApiUrl();
  console.log('API URL récupérée:', apiUrl);
} else {
  console.warn('window.electron n\'est pas disponible, utilisation de l\'URL par défaut');
  // Ne pas hardcoder l'URL mais lever une erreur si window.electron n'est pas disponible
  throw new Error('window.electron n\'est pas disponible, impossible de récupérer l\'URL de l\'API');
}

// Gestionnaires d'événements pour la barre de titre
document.addEventListener('DOMContentLoaded', () => {
  // Bouton minimiser
  const minimizeButton = document.getElementById('minimize-button');
  if (minimizeButton && ipcRenderer) {
    minimizeButton.addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
  }

  // Bouton maximiser
  const maximizeButton = document.getElementById('maximize-button');
  if (maximizeButton && ipcRenderer) {
    maximizeButton.addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });
  }

  // Bouton fermer
  const closeButton = document.getElementById('close-button');
  if (closeButton && ipcRenderer) {
    closeButton.addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }
});

// Configuration pour les requêtes API
const headers = {
  'Content-Type': 'application/json'
};

// Éléments DOM
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutButton = document.getElementById('logoutButton');
const alertContainer = document.getElementById('alertContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const libraryContainer = document.getElementById('libraryContainer');
const serverIndicator = document.getElementById('serverIndicator');
const serverStatusText = document.getElementById('serverStatusText');

// Éléments DOM pour la recherche
const searchButton = document.getElementById('searchButton');
const searchModal = document.getElementById('searchModal');
const closeSearchButton = document.getElementById('closeSearchButton');
const searchInput = document.getElementById('searchInput');
const searchSubmit = document.getElementById('searchSubmit');
const searchResults = document.getElementById('searchResults');
const searchOptions = document.querySelectorAll('.search-option');

// Élément DOM pour le forum
const forumButton = document.getElementById('forumButton');

// Variable pour stocker le type de recherche actif
let activeSearchType = 'title';

// Variable globale pour stocker les mangas
let allMangas = [];
let filteredMangas = [];
let toReadList = []; // Liste des mangas "À lire"

// Variables globales pour l'historique
let readingHistory = [];
const HISTORY_LIMIT = 5; // Nombre de mangas à afficher dans la section "Reprendre la lecture"

// Sélecteurs
const mangaListContainer = document.getElementById('mangaList');

// Fonction pour afficher les alertes
function showAlert(message, type = 'info') {
    console.log(`🔔 Affichage alerte (${type}):`, message);
    
    const alertEl = document.getElementById('alert');
    if (!alertEl) {
        console.error('❌ Élément alerte non trouvé dans le DOM');
        return;
    }
    
    // Réinitialiser l'animation en retirant et réappliquant la classe visible
    alertEl.classList.remove('visible');
    
    // Force un reflow pour réinitialiser l'animation
    void alertEl.offsetWidth;
    
    // Mettre à jour le contenu et le style
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    
    // Ajouter la classe visible pour déclencher l'animation
    alertEl.classList.add('visible');
    
    // Masquer l'alerte après 3 secondes
    setTimeout(() => {
        alertEl.classList.remove('visible');
    }, 3000);
}

// Fonction pour ouvrir la popup de recherche
function openSearchModal() {
  searchModal.classList.add('active');
  searchInput.focus();
  // Désactiver le défilement du corps
  document.body.style.overflow = 'hidden';
}

// Fonction pour fermer la popup de recherche
function closeSearchModal() {
  searchModal.classList.remove('active');
  // Réactiver le défilement du corps
  document.body.style.overflow = '';
  // Réinitialiser le champ de recherche et les résultats
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchResults.classList.add('hidden');
}

// Fonction pour changer le type de recherche
function changeSearchType(type) {
  activeSearchType = type;
  
  // Mettre à jour l'UI pour refléter le type de recherche actif
  searchOptions.forEach(option => {
    if (option.dataset.type === type) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  
  // Mettre à jour le placeholder de l'input en fonction du type de recherche
  switch (type) {
    case 'title':
      searchInput.placeholder = 'Entrez un titre de manga...';
      break;
    case 'type':
      searchInput.placeholder = 'Entrez un type (MANGA, MANHWA, etc.)...';
      break;
    case 'status':
      searchInput.placeholder = 'Entrez un statut (EN COURS, TERMINÉ)...';
      break;
    default:
      searchInput.placeholder = 'Entrez votre recherche...';
  }
}

// Fonction pour afficher la liste des mangas
function displayMangaList(mangas) {
    const mangaListElement = document.getElementById('mangaList');
    if (!mangaListElement) {
        console.error('❌ Container mangaList non trouvé');
        return;
    }
    mangaListElement.innerHTML = '';

    mangas.forEach(manga => {
        const mangaCard = document.createElement('div');
        mangaCard.className = 'manga-card';
        mangaCard.setAttribute('data-manga-slug', manga.slug);

        mangaCard.innerHTML = `
            <div class="manga-cover">
                <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
            </div>
            <div class="manga-info">
                <h3>${manga.title}</h3>
                <div class="manga-status ${manga.status.toLowerCase()}">${manga.status}</div>
                <div class="manga-chapters">Chapitres: ${manga.chapterCount || 0}</div>
            </div>
        `;

        // Ajouter le gestionnaire de clic sur la carte
        mangaCard.addEventListener('click', () => {
            const slug = mangaCard.getAttribute('data-manga-slug');
            if (slug) {
                openMangaDetails(slug);
            }
        });

        mangaListElement.appendChild(mangaCard);
    });
}

function positionBubble(e, bubble) {
    const iconRect = e.target.getBoundingClientRect();
    const bubbleWidth = 350;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculer la position initiale (à droite de l'icône)
    let leftPosition = iconRect.right + 10;
    let topPosition = iconRect.top;

    // Ajuster horizontalement si trop près du bord droit
    if (leftPosition + bubbleWidth > viewportWidth - 20) {
        leftPosition = iconRect.left - bubbleWidth - 10;
    }

    // Ajuster verticalement si trop près du bas
    const bubbleHeight = bubble.offsetHeight;
    if (topPosition + bubbleHeight > viewportHeight - 20) {
        topPosition = Math.max(20, viewportHeight - bubbleHeight - 20);
    }

    // Ajuster verticalement si trop près du haut
    if (topPosition < 20) {
        topPosition = 20;
    }

    bubble.style.left = `${leftPosition}px`;
    bubble.style.top = `${topPosition}px`;
}

// Fonction pour charger et afficher la liste des mangas
async function loadMangaList() {
  const mangaContainer = document.getElementById('mangaList');
  if (!mangaContainer) {
    console.error('❌ Container mangaList non trouvé');
    return;
  }
  
  try {
    mangaContainer.innerHTML = '<div class="loading-spinner"></div>';
    console.log('📚 Chargement de la liste des mangas depuis l\'API...');
    
    // Vérifier d'abord si le serveur est disponible
    try {
      console.log('🔍 Vérification de la santé du serveur...');
      const healthCheck = await fetchApi('/health');
      console.log('✅ Réponse du health check:', healthCheck);
      
      if (!healthCheck.success) {
        throw new Error('Serveur non disponible');
      }
      console.log('✅ Serveur disponible');
    } catch (error) {
      console.error('❌ Serveur non disponible:', error);
      mangaContainer.innerHTML = `
        <div class="error-message">
          Le serveur est actuellement indisponible. 
          <br>
          Veuillez réessayer plus tard.
          <br>
          <small>${error.message}</small>
        </div>
      `;
      return;
    }

    // Charger la liste des mangas
    console.log('📥 Envoi de la requête GET /mangas...');
    const response = await fetchApi('/mangas');
    console.log('📦 Données reçues de l\'API:', response);
    
    // Vérifier si les données sont valides
    if (!response || !response.mangas || !Array.isArray(response.mangas)) {
      console.error('❌ Les données reçues ne sont pas valides:', response);
      throw new Error('Format de données invalide');
    }
    
    // Stocker les mangas dans la variable globale
    allMangas = response.mangas.map(manga => ({
      ...manga,
      synopsis: manga.synopsis || 'Synopsis en cours de chargement...'
    }));
    
    console.log(`✨ ${allMangas.length} mangas chargés avec succès`);
    console.log('📝 Exemple de manga avec synopsis:', allMangas[0]);
    
    // Afficher les mangas
    console.log('🎨 Affichage des mangas...');
    await displayMangaList(allMangas);
    console.log('✅ Affichage terminé');
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement des mangas:', error);
    let errorMessage = 'Une erreur est survenue lors du chargement des mangas.';
    
    if (error.status === 503) {
      errorMessage = 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet.';
    } else if (error.status === 408) {
      errorMessage = 'Le serveur met trop de temps à répondre. Veuillez réessayer plus tard.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    mangaContainer.innerHTML = `
      <div class="error-message">
        ${errorMessage}
        <br>
        <button onclick="loadMangaList()" class="retry-button">
          Réessayer
        </button>
      </div>
    `;
  }
}

// Fonction pour mettre à jour le nombre de chapitres d'un manga
async function updateMangaChapters(slug) {
    try {
        const response = await fetchApi(`/mangas/${slug}/update-chapters`);
        if (response.success) {
            return response.data.chapterCount;
        }
        return null;
    } catch (error) {
        console.error(`Erreur lors de la mise à jour des chapitres pour ${slug}:`, error);
        return null;
    }
}

// Fonction pour rechercher des mangas (côté client)
function searchMangas(query) {
  console.log('🔍 Recherche locale pour:', query);
  
  if (!query) {
    displayMangaList(allMangas);
    return;
  }

  // Convertir la requête en minuscules pour une recherche insensible à la casse
  query = query.toLowerCase();

  // Filtrer les mangas
  const filteredMangas = allMangas.filter(manga => {
    const title = (manga.title || '').toLowerCase();
    const type = (manga.type || '').toLowerCase();
    const status = (manga.status || '').toLowerCase();
    
    return title.includes(query) || 
           type.includes(query) || 
           status.includes(query);
  });

  console.log(`📚 ${filteredMangas.length} mangas trouvés`);

  if (filteredMangas.length === 0) {
    const mangaContainer = document.getElementById('mangaList');
    mangaContainer.innerHTML = `
      <div class="no-results">
        <h2>Aucun résultat trouvé pour "${query}"</h2>
      </div>
    `;
    return;
  }

  // Afficher les résultats filtrés
  displayMangaList(filteredMangas);
}

// Fonction pour afficher les résultats de recherche
function displaySearchResults(mangaList) {
  if (!mangaList || mangaList.length === 0) {
    searchResults.innerHTML = '<p class="no-results">Aucun résultat trouvé.</p>';
    return;
  }

  // Calculer le nombre optimal de colonnes en fonction du nombre de mangas
  // Plus il y a de mangas, plus on a besoin de petites cartes pour tout afficher
  const containerWidth = document.querySelector('.search-container').offsetWidth;
  const numberOfColumns = Math.min(Math.max(4, Math.ceil(mangaList.length / 2)), 6);
  const cardWidth = Math.floor((containerWidth - 100) / numberOfColumns);

  // Ajuster la hauteur du conteneur en fonction du nombre de mangas
  // Garantir qu'on voit au moins 2 rangées complètes
  const modalHeight = Math.min(95, Math.max(70, 55 + (Math.ceil(mangaList.length / numberOfColumns) * 10)));
  document.querySelector('.search-container').style.maxHeight = `${modalHeight}vh`;

  let resultsHTML = `
    <div class="results-header">
      <div class="results-count">${mangaList.length} manga${mangaList.length > 1 ? 's' : ''} trouvé${mangaList.length > 1 ? 's' : ''}</div>
    </div>
    <div class="manga-grid search-grid" style="grid-template-columns: repeat(${numberOfColumns}, 1fr);">
  `;
  
  mangaList.forEach(manga => {
    // Utiliser l'URL de couverture du manga ou une image par défaut
    const coverUrl = manga.cover || `data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%22300%22%3E%3Crect%20fill%3D%22%2316213E%22%20width%3D%22200%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%23FF2E63%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20dy%3D%22.3em%22%20x%3D%22100%22%20y%3D%22150%22%20text-anchor%3D%22middle%22%3E${manga.title}%3C%2Ftext%3E%3C%2Fsvg%3E`;
    
    // Déterminer la progression (pour le moment, utiliser une valeur aléatoire)
    const progress = manga.progress || Math.floor(Math.random() * 100);
    
    resultsHTML += `
      <div class="manga-card" data-slug="${manga.slug || ''}">
        <img src="${coverUrl}" alt="${manga.title}" class="manga-cover" loading="lazy" onerror="this.src='assets/images/default-cover.jpg'">
        <div class="manga-info">
          <div class="manga-title">${manga.title}</div>
          <div class="manga-meta">
            <span class="manga-type">${manga.type || 'MANGA'}</span>
            <span class="manga-status">${manga.status || 'EN COURS'}</span>
          </div>
          <div class="manga-progress">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
        </div>
      </div>
    `;
  });
  
  resultsHTML += '</div>';
  searchResults.innerHTML = resultsHTML;
  
  // Ajouter des styles spécifiques pour la grille de recherche
  const searchStyle = document.createElement('style');
  searchStyle.textContent = `
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding: 0 0.5rem;
    }
    
    .results-count {
      font-size: 0.9rem;
      color: #A0A0A0;
    }
    
    .no-results {
      text-align: center;
      padding: 2rem;
      color: #A0A0A0;
      font-size: 1.1rem;
    }
    
    .manga-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 0.5rem;
    }
  `;
  
  // Ajouter le style s'il n'existe pas déjà
  if (!document.getElementById('search-results-style')) {
    searchStyle.id = 'search-results-style';
    document.head.appendChild(searchStyle);
  }
  
  // Ajouter des écouteurs d'événements aux cartes de manga
  document.querySelectorAll('.search-grid .manga-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      if (slug) {
        // Fermer la modal de recherche
        closeSearchModal();
        
        // Naviguer vers la page de détails du manga
        console.log(`Ouverture du manga: ${slug}`);
        openMangaDetails(slug);
      }
    });
  });
}

// Fonction pour vérifier si un chapitre existe
function isValidChapter(mangaSlug, chapterNumber) {
    const manga = allMangas.find(m => m.slug === mangaSlug);
    if (!manga) return false;
    return chapterNumber > 0 && chapterNumber <= manga.chapterCount;
}

// Fonction pour ouvrir les détails d'un manga
function openMangaDetails(slug) {
    const manga = allMangas.find(m => m.slug === slug);
    if (!manga) {
        console.error('Manga non trouvé:', slug);
        return;
    }
    
    showMangaDetailsPopup(manga);
}

// Fonction pour afficher la popup de détails d'un manga
function showMangaDetailsPopup(mangaOrSlug) {
    console.log('showMangaDetailsPopup appelé avec:', mangaOrSlug);
    
    // Déterminer si on a reçu un slug ou un objet manga
    let manga;
    if (typeof mangaOrSlug === 'string') {
        console.log('Recherche du manga avec le slug:', mangaOrSlug);
        manga = allMangas.find(m => m.slug === mangaOrSlug);
        if (!manga) {
            console.error('Manga non trouvé avec le slug:', mangaOrSlug);
            return;
        }
    } else {
        manga = mangaOrSlug;
    }
    
    console.log('Affichage des détails pour le manga:', manga.title);
    
    // Créer l'élément de la popup
    const popupOverlay = document.createElement('div');
    popupOverlay.className = 'manga-details-overlay';
    
    const popupContent = document.createElement('div');
    popupContent.className = 'manga-details-popup';
    
    // Définir la variable CSS pour l'image d'arrière-plan
    popupContent.style.setProperty('--cover-image', `url('${manga.cover}')`);
    
    // Structure de la popup
    popupContent.innerHTML = `
        <button class="close-popup-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95 1.414-1.414 4.95 4.95z" fill="currentColor"/>
            </svg>
        </button>
        <div class="manga-details-container">
            <div class="manga-details-cover">
                <img src="${manga.cover}" alt="${manga.title}">
            </div>
            <div class="manga-details-info">
                <h2>${manga.title}</h2>
                <div class="manga-details-status ${manga.status.toLowerCase()}">${manga.status}</div>
                
                <div class="manga-details-section">
                    <h3>Synopsis</h3>
                    <p>${manga.synopsis || 'Aucun synopsis disponible.'}</p>
                </div>
                
                <div class="manga-details-metadata">
                    <div class="metadata-item">
                        <span class="metadata-label">Auteur:</span>
                        <span class="metadata-value">${manga.author || 'Inconnu'}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Artiste:</span>
                        <span class="metadata-value">${manga.artist || 'Inconnu'}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Type:</span>
                        <span class="metadata-value">${manga.type || 'Inconnu'}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="metadata-label">Chapitres:</span>
                        <span class="metadata-value">${manga.chapterCount || 0}</span>
                    </div>
                </div>
                
                <div class="manga-details-actions">
                    <button class="btn btn-secondary toggle-to-read-btn" data-manga-slug="${manga.slug}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" class="btn-icon">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1zm13 2H6v15.432l6-3.761 6 3.761V4z" fill="currentColor"/>
                        </svg>
                        <span class="btn-text">Ajouter à ma liste</span>
                    </button>
                    <button class="btn btn-primary read-manga-btn" data-manga-slug="${manga.slug}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" class="btn-icon">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M19.376 12.416L8.777 19.482A.5.5 0 0 1 8 19.066V4.934a.5.5 0 0 1 .777-.416l10.599 7.066a.5.5 0 0 1 0 .832z" fill="currentColor"/>
                        </svg>
                        Lire
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter la popup au DOM
    popupOverlay.appendChild(popupContent);
    document.body.appendChild(popupOverlay);
    
    // Empêcher le défilement du corps pendant que la popup est active
    document.body.style.overflow = 'hidden';
    
    // Ajouter le gestionnaire pour fermer la popup
    const closeBtn = popupContent.querySelector('.close-popup-btn');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(popupOverlay);
        document.body.style.overflow = '';
    });
    
    // Ajouter le gestionnaire pour le bouton Lire
    const readBtn = popupContent.querySelector('.read-manga-btn');
    readBtn.addEventListener('click', () => {
        document.body.removeChild(popupOverlay);
        document.body.style.overflow = '';
        
        // Vérifier si nous avons une progression de lecture pour ce manga
        const progress = readingHistory.find(h => h.mangaSlug === manga.slug);
        
        if (progress) {
            // Rediriger vers le reader avec le dernier chapitre lu
            window.location.href = `reader.html?slug=${manga.slug}&chapter=${progress.chapter}`;
        } else {
            // Rediriger vers le reader avec le premier chapitre
            window.location.href = `reader.html?slug=${manga.slug}&chapter=1`;
        }
    });
    
    // Ajouter le gestionnaire pour le bouton Ajouter/Retirer de ma liste
    const toReadBtn = popupContent.querySelector('.toggle-to-read-btn');
    toReadBtn.addEventListener('click', () => {
        toggleToReadManga(manga.slug);
        updateToReadButton(toReadBtn, manga.slug);
    });
    
    // Mettre à jour l'état initial du bouton À lire
    updateToReadButton(toReadBtn, manga.slug);
    
    // Fermer la popup lorsqu'on clique en dehors du contenu
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            document.body.removeChild(popupOverlay);
            document.body.style.overflow = '';
        }
    });
}

// Fonction pour mettre à jour l'indicateur d'état du serveur
function updateServerIndicator(status) {
  if (!serverIndicator || !serverStatusText) return;
  
  serverIndicator.className = 'server-indicator';
  
  switch (status) {
    case 'online':
      serverIndicator.classList.add('online');
      serverStatusText.textContent = 'Serveur en ligne';
      break;
    case 'offline':
      serverIndicator.classList.add('offline');
      serverStatusText.textContent = 'Serveur hors ligne';
      break;
    case 'connecting':
      serverIndicator.classList.add('connecting');
      serverStatusText.textContent = 'Connexion...';
      break;
    default:
      serverIndicator.classList.add('offline');
      serverStatusText.textContent = 'Statut inconnu';
  }
}

// Fonction pour vérifier si le serveur est disponible
async function checkServerAvailability() {
    const serverStatus = document.getElementById('serverStatus');
    if (!serverStatus) return false;
    
    const statusDot = serverStatus.querySelector('.status-dot');
    const statusText = serverStatus.querySelector('.status-text');
    
    // Indiquer que nous sommes en train de nous connecter
    serverStatus.className = 'server-status connecting';
    statusText.textContent = 'Connexion au serveur...';
    
    try {
        console.log('🔍 Test de connexion au serveur...');
        console.log('URL de l\'API:', apiUrl);
        console.log('URL complète:', `${apiUrl}/health`);
        
        // Utiliser un AbortController pour limiter le temps d'attente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const options = {
            signal: controller.signal,
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        
        console.log('Options de la requête:', options);
        
        const response = await fetch(`${apiUrl}/health`, options);
        clearTimeout(timeoutId);
        
        console.log('Réponse du serveur:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Serveur en ligne:', data);
            serverStatus.className = 'server-status online';
            statusText.textContent = 'Serveur en ligne';
            return true;
        } else {
            console.error('❌ Serveur en ligne mais erreur:', response.status, response.statusText);
            serverStatus.className = 'server-status offline';
            statusText.textContent = 'Erreur serveur';
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur détaillée de connexion au serveur:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        serverStatus.className = 'server-status offline';
        statusText.textContent = 'Serveur hors ligne';
        return false;
    }
}

// Fonction simplifiée pour faire des requêtes API avec fetch
async function fetchApi(endpoint, method = 'GET', data = null, timeout = 10000) {
  try {
    // Enlever le /api au début de l'endpoint s'il existe
    const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    // Construire l'URL complète
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${apiUrl}/${cleanEndpoint}`;
    console.log('URL construite:', fullUrl);
    console.log('🌐 Envoi d\'une requête à:', fullUrl);
    console.log('📤 Méthode:', method);
    
    // Préparer les options de la requête
    const options = {
      method: method.toUpperCase(), // S'assurer que la méthode est en majuscules
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Ajouter le token d'authentification si disponible
    const token = localStorage.getItem('userToken');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Ajouter le corps de la requête pour POST et PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    // Envoyer la requête avec un timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;
    
    const response = await fetch(fullUrl, options);
    clearTimeout(timeoutId);
    
    console.log(`📥 Réponse reçue (${response.status}):`, response.statusText);
    
    // Traiter les réponses d'erreur HTTP
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // Si la réponse n'est pas du JSON, utiliser le texte brut
        const errorText = await response.text();
        errorData = { message: errorText };
      }
      
      console.error('❌ Erreur de réponse:', errorData);
      throw { 
        status: response.status,
        message: errorData.message || 'Erreur serveur',
        data: errorData
      };
    }
    
    // Pour les requêtes DELETE qui retournent 204 No Content
    if (response.status === 204) {
      return { success: true };
    }
    
    // Convertir la réponse en JSON
    const responseData = await response.json();
    console.log('📦 Données reçues:', responseData);
    return responseData;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ La requête a été interrompue (timeout)');
      throw { 
        status: 408,
        message: 'La requête a pris trop de temps à répondre'
      };
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('❌ Impossible de se connecter au serveur');
      throw {
        status: 503,
        message: 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet et que le serveur est bien en ligne.'
      };
    }
    
    console.error('❌ Erreur fetchApi:', error);
    throw error;
  }
}

// Fonction pour charger le profil utilisateur
async function loadUserProfile() {
  try {
    // Vérifier si on a un token dans le localStorage
    const token = localStorage.getItem('userToken');
    if (!token) {
      console.warn('Aucun token trouvé, redirection vers la page de connexion');
      window.location.href = 'login.html';
      return;
    }
    
    // Récupérer aussi les données utilisateur du localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const usernameElement = document.getElementById('username');
      if (usernameElement) {
        usernameElement.textContent = user.username;
      }
    }

      const response = await fetch(`${apiUrl}/users/profile`, {
        method: 'GET',
      credentials: 'include',
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const usernameElement = document.getElementById('username');
      if (usernameElement) {
        usernameElement.textContent = data.username;
      }
      // Mettre à jour les données utilisateur dans le localStorage
      localStorage.setItem('user', JSON.stringify({
        id: data._id,
        username: data.username,
        email: data.email
      }));
    } else if (response.status === 401) {
      // Token invalide ou expiré
      console.warn('Token invalide ou expiré');
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    } else {
      throw new Error('Erreur lors du chargement du profil');
    }
  } catch (error) {
    console.error('Erreur:', error);
    // En cas d'erreur, on supprime le token et on redirige
        localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }
}

// Fonction pour vérifier l'état du serveur
async function checkServerStatus() {
  try {
    const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      
    const serverStatus = document.getElementById('serverStatus');
    if (response.ok && data.success) {
      serverStatus.className = 'server-status online';
      serverStatus.innerHTML = `
        <div class="status-dot"></div>
        <span class="status-text">Serveur en ligne</span>
      `;
      } else {
      throw new Error('Serveur hors ligne');
    }
  } catch (error) {
    const serverStatus = document.getElementById('serverStatus');
    serverStatus.className = 'server-status offline';
    serverStatus.innerHTML = `
      <div class="status-dot"></div>
      <span class="status-text">Serveur hors ligne</span>
    `;
  }
}

// Fonction pour charger l'historique de lecture
async function loadReadingHistory() {
    try {
        const response = await fetchApi('/users/mangas/reading-progress');
        if (response && Array.isArray(response)) {
            readingHistory = response.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead));
            console.log('Historique de lecture chargé:', readingHistory);
            displayContinueReading();
      }
    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
    }
}

// Fonction pour récupérer les détails d'un manga
async function getMangaDetails(mangaId) {
    try {
        const response = await fetchApi(`/mangas/${mangaId}`);
        return response;
    } catch (error) {
        console.error(`Erreur lors de la récupération des détails du manga ${mangaId}:`, error);
        return null;
    }
}

// Fonction pour afficher la section "Reprendre la lecture"
async function displayContinueReading() {
    try {
        const response = await fetchApi('/users/mangas/reading-progress');
        
        const container = document.getElementById('continueReadingList');
        
        if (!container) {
            console.error('Container de lecture continue non trouvé');
            return;
        }

        if (!response || !Array.isArray(response) || response.length === 0) {
            container.innerHTML = '<p class="no-history">Aucun historique de lecture disponible</p>';
            return;
        }

        // Vider le contenu existant
        container.innerHTML = '';
        
        // Limiter à 5 entrées les plus récentes
        const recentHistory = response.slice(0, 5);

        // Créer directement les cartes dans le conteneur existant
        recentHistory.forEach(historyItem => {
            const manga = allMangas.find(m => m.slug === historyItem.mangaSlug);
            if (!manga) return;

            const mangaCard = document.createElement('div');
            mangaCard.className = 'manga-card';
            mangaCard.setAttribute('data-manga-slug', manga.slug);

            mangaCard.innerHTML = `
                <div class="manga-cover">
                    <div class="delete-icon" data-manga-slug="${manga.slug}" title="Supprimer de l'historique">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9.414l2.828-2.829 1.415 1.415L13.414 12l2.829 2.828-1.415 1.415L12 13.414l-2.828 2.829-1.415-1.415L10.586 12 7.757 9.172l1.415-1.415L12 10.586z" fill="currentColor"/>
                        </svg>
                    </div>
                    <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-info">
                    <h3>${manga.title}</h3>
                    <div class="manga-status ${manga.status.toLowerCase()}">Chapitre ${historyItem.chapter || 1}</div>
                </div>
            `;

            // Ajouter les événements
            const deleteIcon = mangaCard.querySelector('.delete-icon');

            // Ajouter le gestionnaire pour l'icône de suppression
            deleteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const slug = e.currentTarget.getAttribute('data-manga-slug');
                if (slug) {
                    showDeleteConfirmation(slug, manga.title);
                }
            });

            // Ajouter le gestionnaire de clic sur la carte
            mangaCard.addEventListener('click', () => {
                const slug = mangaCard.getAttribute('data-manga-slug');
                if (slug) {
                    showMangaDetailsPopup(slug);
                }
            });

            container.appendChild(mangaCard);
        });

    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
        showAlert('error', 'Erreur lors du chargement de l\'historique');
    }
}

// Fonction pour supprimer une entrée de l'historique de lecture
async function deleteReadingHistoryItem(slug) {
    try {
        console.log('🗑️ Suppression de l\'historique pour', slug);
        
        // Appel à l'API pour supprimer la progression de lecture
        await fetchApi(`/users/mangas/reading-progress/${slug}`, 'DELETE');
        
        // Mettre à jour l'historique local
        readingHistory = readingHistory.filter(item => item.mangaSlug !== slug);
        
        // Rafraîchir l'affichage
        displayContinueReading();
        
        showAlert('Entrée d\'historique supprimée avec succès', 'success');
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'historique:', error);
        showAlert('Erreur lors de la suppression de l\'historique', 'danger');
    }
}

// Fonction pour afficher la boîte de confirmation de suppression
function showDeleteConfirmation(slug, title) {
    // Créer la boîte de dialogue de confirmation
    const confirmationDialog = document.createElement('div');
    confirmationDialog.className = 'confirmation-dialog';
    
    // Structure HTML avec un style moderne qui correspond à l'application
    confirmationDialog.innerHTML = `
        <div class="confirmation-content">
            <div class="confirmation-header">
                <h3>Supprimer de l'historique</h3>
                <button class="close-confirmation-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="none" d="M0 0h24v24H0z"/>
                        <path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95 1.414-1.414 4.95 4.95z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="confirmation-body">
                <div class="warning-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                        <path fill="none" d="M0 0h24v24H0z"/>
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="var(--error-color)"/>
                    </svg>
                </div>
                <p>Êtes-vous sûr de vouloir supprimer <strong>${title}</strong> de votre historique de lecture ?</p>
                <p class="confirmation-note">Cette action supprimera définitivement votre progression sur ce manga.</p>
            </div>
            <div class="confirmation-buttons">
                <button class="btn btn-cancel">Annuler</button>
                <button class="btn btn-confirm">Supprimer</button>
            </div>
        </div>
    `;
    
    // Ajouter des styles spécifiques pour cette boîte de dialogue
    const dialogStyle = document.createElement('style');
    dialogStyle.textContent = `
        .confirmation-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            animation: fadeIn 0.3s ease forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .confirmation-content {
            background-color: var(--card-background);
            border-radius: 12px;
            width: 90%;
            max-width: 450px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            animation: scaleIn 0.3s ease;
        }
        
        @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        
        .confirmation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .confirmation-header h3 {
            margin: 0;
            font-size: 1.2rem;
            color: var(--primary-color);
        }
        
        .close-confirmation-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .close-confirmation-btn:hover {
            color: var(--error-color);
            transform: scale(1.1);
        }
        
        .confirmation-body {
            padding: 20px;
            text-align: center;
        }
        
        .warning-icon {
            margin: 0 auto 15px;
            width: 48px;
            height: 48px;
        }
        
        .confirmation-body p {
            margin: 10px 0;
            color: var(--text-primary);
        }
        
        .confirmation-note {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }
        
        .confirmation-buttons {
            display: flex;
            justify-content: flex-end;
            padding: 15px 20px;
            gap: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .btn-cancel {
            background-color: transparent;
            color: var(--text-secondary);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 10px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .btn-cancel:hover {
            background-color: rgba(255, 255, 255, 0.05);
            transform: translateY(-2px);
        }
        
        .btn-confirm {
            background-color: var(--error-color);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .btn-confirm:hover {
            background-color: #ff3333;
            transform: translateY(-2px);
        }
    `;
    
    // Ajouter les styles au document
    document.head.appendChild(dialogStyle);
    
    // Ajouter la boîte de dialogue au document
    document.body.appendChild(confirmationDialog);
    
    // Empêcher le défilement du corps pendant que la boîte de dialogue est active
    document.body.style.overflow = 'hidden';
    
    // Ajouter les gestionnaires d'événements pour les boutons
    const cancelButton = confirmationDialog.querySelector('.btn-cancel');
    const confirmButton = confirmationDialog.querySelector('.btn-confirm');
    const closeButton = confirmationDialog.querySelector('.close-confirmation-btn');
    
    // Fonction pour fermer la boîte de dialogue
    const closeDialog = () => {
        // Animation de fermeture
        confirmationDialog.style.animation = 'fadeOut 0.3s ease forwards';
        
        // Attendre la fin de l'animation avant de supprimer
        setTimeout(() => {
            document.body.removeChild(confirmationDialog);
            document.body.style.overflow = '';
            // Supprimer le style après utilisation
            if (dialogStyle.parentNode) {
                dialogStyle.parentNode.removeChild(dialogStyle);
            }
        }, 300);
    };
    
    // Ajouter les gestionnaires d'événements
    cancelButton.addEventListener('click', closeDialog);
    
    closeButton.addEventListener('click', closeDialog);
    
    confirmButton.addEventListener('click', async () => {
        // Désactiver le bouton pendant la suppression
        confirmButton.disabled = true;
        confirmButton.textContent = 'Suppression...';
        
        try {
            await deleteReadingHistoryItem(slug);
            closeDialog();
        } catch (error) {
            // Réactiver le bouton en cas d'erreur
            confirmButton.disabled = false;
            confirmButton.textContent = 'Supprimer';
            console.error('Erreur lors de la suppression:', error);
            showAlert('Erreur lors de la suppression', 'error');
        }
    });
    
    // Fermer la boîte de dialogue lorsqu'on clique en dehors du contenu
    confirmationDialog.addEventListener('click', (e) => {
        if (e.target === confirmationDialog) {
            closeDialog();
        }
    });
    
    // Ajouter une animation de fermeture
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(styleSheet);
}

// Fonction pour recharger la progression quand on revient à l'accueil
async function refreshReadingProgress() {
    console.log('Rafraîchissement de la progression de lecture...');
    await loadMangaList(); // Recharger d'abord la liste des mangas
    await loadReadingHistory(); // Puis charger l'historique
}

// Gestionnaire du modal d'historique
function displayHistoryModal() {
    const historyList = document.getElementById('historyList');
    if (!historyList || !readingHistory) {
        console.error('❌ Éléments manquants pour l\'affichage du modal d\'historique');
        return;
    }

    historyList.innerHTML = '';

    readingHistory.forEach(item => {
        if (!item || !item.mangaSlug) return;

        const manga = allMangas.find(m => m.slug === item.mangaSlug);
        if (!manga) return;

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.setAttribute('data-slug', manga.slug);
        
        const lastRead = new Date(item.lastRead).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        historyItem.innerHTML = `
            <img src="${manga.coverImage || ''}" alt="${manga.title}" loading="lazy">
            <h3>${manga.title}</h3>
            <p>Chapitre ${item.chapter || 1}</p>
            <p class="last-read">Lu le ${lastRead}</p>
        `;

        historyItem.addEventListener('click', () => {
            window.location.href = `reader.html?slug=${manga.slug}&chapter=${item.chapter || 1}`;
        });

        historyList.appendChild(historyItem);
    });

    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.classList.add('active');
    }
}

// Fonction pour vérifier si l'utilisateur est connecté
function isLoggedIn() {
    const token = localStorage.getItem('userToken');
    return !!token; // Convertit en booléen
}

// Fonction pour afficher tout l'historique de lecture
window.showFullHistory = function(e) {
    // Empêcher le comportement par défaut et la propagation de l'événement
    if (e && e.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log('Affichage de tout l\'historique de lecture');
    
    // Vérifier si l'historique existe et contient des éléments
    if (!readingHistory || readingHistory.length === 0) {
        showAlert('Aucun historique de lecture disponible', 'info');
        return;
    }
    
    // Si moins de 5 entrées, afficher un avertissement
    if (readingHistory.length <= 5) {
        showAlert('Tout l\'historique est déjà affiché', 'info');
        return;
    }
    
    // Référence à la section continue reading
    const continueReadingSection = document.getElementById('continueReadingSection');
    const continueReadingList = document.getElementById('continueReadingList');
    
    if (!continueReadingSection || !continueReadingList) {
        console.error('❌ Section de lecture continue non trouvée');
        return;
    }
    
    // Vérifier si l'historique complet est déjà affiché
    const isExpanded = continueReadingSection.classList.contains('expanded');
    
    if (isExpanded) {
        // Réduire l'historique (n'afficher que les 5 premiers)
        continueReadingSection.classList.remove('expanded');
        document.getElementById('showAllHistoryBtn').textContent = 'Voir tout l\'historique';
        
        // Recréer l'affichage avec seulement les 5 premiers éléments
        displayContinueReading();
    } else {
        // Étendre l'historique (afficher tous les mangas)
        continueReadingSection.classList.add('expanded');
        document.getElementById('showAllHistoryBtn').textContent = 'Réduire l\'historique';
        
        // Vider la liste actuelle
        continueReadingList.innerHTML = '';
        
        // Afficher toutes les entrées de l'historique directement dans continueReadingList
        // sans créer de conteneur supplémentaire
        readingHistory.forEach(historyItem => {
            const manga = allMangas.find(m => m.slug === historyItem.mangaSlug);
            if (!manga) return;
            
            const mangaCard = document.createElement('div');
            mangaCard.className = 'manga-card';
            mangaCard.setAttribute('data-manga-slug', manga.slug);
            
            mangaCard.innerHTML = `
                <div class="manga-cover">
                    <div class="delete-icon" data-manga-slug="${manga.slug}" title="Supprimer de l'historique">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9.414l2.828-2.829 1.415 1.415L13.414 12l2.829 2.828-1.415 1.415L12 13.414l-2.828 2.829-1.415-1.415L10.586 12 7.757 9.172l1.415-1.415L12 10.586z" fill="currentColor"/>
                        </svg>
                    </div>
                    <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-info">
                    <h3>${manga.title}</h3>
                    <div class="manga-status ${manga.status ? manga.status.toLowerCase() : ''}">Chapitre ${historyItem.chapter || 1}</div>
                </div>
            `;
            
            // Ajouter les gestionnaires d'événements
            const deleteIcon = mangaCard.querySelector('.delete-icon');
            deleteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const slug = e.currentTarget.getAttribute('data-manga-slug');
                if (slug) {
                    showDeleteConfirmation(slug, manga.title);
                }
            });
            
            mangaCard.addEventListener('click', () => {
                const slug = mangaCard.getAttribute('data-manga-slug');
                if (slug) {
                    showMangaDetailsPopup(slug);
                }
            });
            
            continueReadingList.appendChild(mangaCard);
        });
    }

    return false; // Empêcher la propagation de l'événement
};

// Fonction pour sauvegarder la liste "À lire" dans le localStorage
function saveToReadList() {
    localStorage.setItem('toReadList', JSON.stringify(toReadList));
}

// Fonction pour charger la liste "À lire" depuis le localStorage
function loadToReadList() {
    const saved = localStorage.getItem('toReadList');
    if (saved) {
        try {
            toReadList = JSON.parse(saved);
        } catch (error) {
            console.error('Erreur lors du chargement de la liste "À lire":', error);
            toReadList = [];
        }
    }
}

// Fonction pour vérifier si un manga est dans la liste "À lire"
function isInToReadList(slug) {
    return toReadList.includes(slug);
}

// Fonction pour ajouter ou retirer un manga de la liste "À lire"
function toggleToReadManga(slug) {
    const index = toReadList.indexOf(slug);
    
    if (index === -1) {
        // Ajouter à la liste
        toReadList.push(slug);
        showAlert('Ajouté à votre liste de lecture', 'success');
    } else {
        // Retirer de la liste
        toReadList.splice(index, 1);
        showAlert('Retiré de votre liste de lecture', 'success');
    }
    
    // Sauvegarder les changements
    saveToReadList();
    
    // Mettre à jour l'affichage si la modal est visible
    if (document.getElementById('toReadModal').style.display === 'block') {
        displayToReadList();
    }
}

// Fonction pour mettre à jour l'apparence du bouton "À lire"
function updateToReadButton(button, slug) {
    const isInList = isInToReadList(slug);
    const btnText = button.querySelector('.btn-text');
    
    if (isInList) {
        button.classList.add('active');
        btnText.textContent = 'Retirer de ma liste';
    } else {
        button.classList.remove('active');
        btnText.textContent = 'Ajouter à ma liste';
    }
}

// Fonction pour afficher la liste des mangas "À lire"
function displayToReadList() {
    const container = document.getElementById('toReadList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (toReadList.length === 0) {
        container.innerHTML = `
            <div class="empty-list">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                    <path fill="none" d="M0 0h24v24H0z"/>
                    <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1zm13 2H6v15.432l6-3.761 6 3.761V4z" fill="currentColor"/>
                </svg>
                <p>Votre liste de lecture est vide</p>
                <p class="empty-list-hint">Ajoutez des mangas à lire en cliquant sur le bouton "Ajouter à ma liste" dans les détails d'un manga</p>
            </div>
        `;
        return;
    }
    
    // Créer une carte pour chaque manga dans la liste
    toReadList.forEach(slug => {
        const manga = allMangas.find(m => m.slug === slug);
        if (!manga) return;
        
        const mangaCard = document.createElement('div');
        mangaCard.className = 'manga-card';
        mangaCard.setAttribute('data-manga-slug', manga.slug);
        
        mangaCard.innerHTML = `
            <div class="manga-cover">
                <div class="delete-icon" data-manga-slug="${manga.slug}" title="Retirer de la liste">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="none" d="M0 0h24v24H0z"/>
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="currentColor"/>
                    </svg>
                </div>
                <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
            </div>
            <div class="manga-info">
                <h3>${manga.title}</h3>
                <div class="manga-status ${manga.status.toLowerCase()}">${manga.status}</div>
            </div>
        `;
        
        // Ajouter les événements
        const deleteIcon = mangaCard.querySelector('.delete-icon');
        
        // Ajouter le gestionnaire pour l'icône de suppression
        deleteIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const slug = e.currentTarget.getAttribute('data-manga-slug');
            if (slug) {
                toggleToReadManga(slug);
            }
        });
        
        // Ajouter le gestionnaire de clic sur la carte
        mangaCard.addEventListener('click', () => {
            const slug = mangaCard.getAttribute('data-manga-slug');
            if (slug) {
                showMangaDetailsPopup(slug);
            }
        });
        
        container.appendChild(mangaCard);
    });
}

// Gérer l'ouverture et la fermeture de la modal "À lire"
function openToReadModal() {
    const modal = document.getElementById('toReadModal');
    if (!modal) return;
    
    displayToReadList();
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeToReadModal() {
    const modal = document.getElementById('toReadModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de la page');
    
    try {
        // Vérifier l'état du serveur
        await checkServerStatus();
        
        // Vérifier périodiquement l'état du serveur (toutes les 30 secondes)
        setInterval(checkServerStatus, 30000);
        
        // Charger le profil utilisateur
        await loadUserProfile();
        
        // Charger d'abord la liste des mangas
        console.log('Chargement de la liste des mangas...');
        await loadMangaList();
        console.log('Liste des mangas chargée:', allMangas ? allMangas.length : 0, 'mangas');
        
        // Puis charger l'historique si l'utilisateur est connecté
        if (isLoggedIn()) {
            console.log('Chargement de l\'historique de lecture...');
            await loadReadingHistory();
        }

        // Ajouter l'écouteur pour le focus de la fenêtre
        window.addEventListener('focus', refreshReadingProgress);
        
        // Gérer la recherche
        const searchForm = document.getElementById('searchForm');
        const searchInput = document.getElementById('searchInput');
        
        console.log('Éléments de recherche trouvés:', {
            searchForm: searchForm,
            searchInput: searchInput
        });
        
        if (searchForm && searchInput) {
            console.log('🔍 Initialisation des événements de recherche');
            
            // Empêcher la soumission par défaut du formulaire
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const query = searchInput.value.trim();
                if (query) {
                    console.log('Recherche lancée avec:', query);
                    searchMangas(query);
                }
            });

            // Gérer la recherche en temps réel
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                console.log('Saisie détectée:', query);
                
                if (query.length >= 2) {
                    searchTimeout = setTimeout(() => {
                        console.log('Recherche automatique lancée avec:', query);
                        searchMangas(query);
                    }, 300);
                } else if (query.length === 0) {
                    console.log('Réinitialisation de la liste');
                    displayMangaList(allMangas);
                }
            });
        }
        
        // Gérer la déconnexion
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Supprimer les données de session
                localStorage.removeItem('userToken');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('autoLogin');
                
                // Rediriger vers la page de connexion
            window.location.href = 'index.html';
            });
        }

        // Initialiser les gestionnaires d'événements pour l'historique
        const historyBtn = document.getElementById('historyBtn');
        const closeHistoryBtn = document.getElementById('closeHistoryBtn');
        const showAllHistoryBtn = document.getElementById('showAllHistoryBtn');
        const historyModal = document.getElementById('historyModal');

        if (historyBtn) historyBtn.addEventListener('click', displayHistoryModal);
        
        // Ajouter un gestionnaire d'événement pour le bouton "Voir tout l'historique"
        if (showAllHistoryBtn) {
            showAllHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Empêcher le comportement par défaut du bouton
                showFullHistory(e); // Passer l'événement à la fonction
            });
            console.log('✅ Gestionnaire d\'événement ajouté au bouton "Voir tout l\'historique"');
        } else {
            console.error('❌ Bouton "Voir tout l\'historique" non trouvé dans le DOM');
        }
        
        if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'none';
        });

        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    historyModal.style.display = 'none';
                }
            });
        }
        
        // Gestionnaires d'événements pour la fonctionnalité "À lire"
        const toReadListBtn = document.getElementById('toReadListBtn');
        const closeToReadBtn = document.getElementById('closeToReadBtn');
        const toReadModal = document.getElementById('toReadModal');
        
        if (toReadListBtn) {
            toReadListBtn.addEventListener('click', () => {
                openToReadModal();
            });
        }
        
        if (closeToReadBtn) {
            closeToReadBtn.addEventListener('click', () => {
                closeToReadModal();
            });
        }
        
        if (toReadModal) {
            toReadModal.addEventListener('click', (e) => {
                if (e.target === toReadModal) {
                    toReadModal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showAlert('error', 'Erreur lors de l\'initialisation de l\'application');
    }
});

// Ajouter le style CSS pour la recherche et la bulle d'information
const style = document.createElement('style');
style.textContent = `
    .no-results {
        text-align: center;
        padding: 2rem;
        color: #A0A0A0;
    }
    
    .no-results h2 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
    }
    
    .error-message {
        text-align: center;
        padding: 2rem;
        color: #FF6B6B;
        background: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
        margin: 1rem;
    }

    .manga-card {
        position: relative;
        cursor: pointer;
        transition: transform 0.2s ease;
        aspect-ratio: 2/3.2;
    }

    .manga-card:hover {
        transform: scale(1.02);
    }

    .manga-cover {
        position: relative;
        width: 100%;
        height: 75% !important;  /* Forcer la même hauteur */
    }

    .manga-info {
        height: 25% !important;  /* Forcer la même hauteur */
        padding: 0.6rem;
    }
    
    /* Style pour l'icône de suppression */
    .delete-icon {
        position: absolute;
        top: 8px;
        right: 8px;
        background-color: rgba(0, 0, 0, 0.6);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .delete-icon svg {
        width: 18px;
        height: 18px;
    }
    
    /* Afficher l'icône uniquement au survol de la carte */
    .manga-card:hover .delete-icon {
        opacity: 1;
    }
    
    /* Effet de survol sur l'icône elle-même */
    .delete-icon:hover {
        background-color: rgba(255, 0, 0, 0.8);
        transform: scale(1.1);
    }

    /* Uniformiser le style des cartes entre les sections */
    #manhwaSection .manga-card,
    #continueReadingList .manga-card {
        aspect-ratio: 2/3.2;
        width: 100%;
    }

    #manhwaSection .manga-cover,
    #continueReadingList .manga-cover {
        height: 75% !important;
    }

    #manhwaSection .manga-info,
    #continueReadingList .manga-info {
        height: 25% !important;
        padding: 0.6rem;
    }

    #manhwaSection .manga-info h3,
    #continueReadingList .manga-info h3 {
        font-size: 0.85rem;
        -webkit-line-clamp: 2;
        margin-bottom: 0.3rem;
    }

    /* Styles améliorés pour la popup de détails du manga */
    .manga-details-container {
        display: flex;
        flex-direction: row;
        height: 100%;
        max-height: 85vh;
        overflow: hidden;
    }

    .manga-details-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .manga-details-popup {
        background-color: var(--card-background);
        border-radius: 12px;
        max-width: 900px;
        width: 90%;
        max-height: 85vh;
        position: relative;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        animation: scaleIn 0.3s ease;
    }

    @keyframes scaleIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }

    .manga-details-cover {
        flex: 0 0 40%;
        max-width: 40%;
        overflow: hidden;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 0;
    }

    .manga-details-cover::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: var(--cover-image);
        background-size: cover;
        background-position: center;
        opacity: 0.15;
        filter: blur(10px);
        z-index: 0;
        transform: scale(1.1);
    }

    .manga-details-cover img {
        width: auto;
        height: auto;
        max-width: 85%;
        max-height: 85%;
        object-fit: contain;
        position: relative;
        z-index: 1;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
        border-radius: 8px;
        transition: transform 0.3s ease;
    }

    .manga-details-cover:hover img {
        transform: scale(1.03);
    }

    .manga-details-info {
        flex: 1;
        padding: 30px;
        overflow-y: auto;
        max-height: 85vh;
    }

    .info-bubble {
        display: none;
        position: fixed;
        background: rgba(30, 30, 30, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 20px;
        width: 350px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        color: white;
        pointer-events: auto;
        max-height: none;
    }

    .manga-card:hover .info-bubble {
        display: none;
    }

    .info-icon:hover + .info-bubble,
    .info-bubble:hover {
        display: block;
    }

    .info-bubble-content {
        font-size: 14px;
        width: 100%;
    }

    .info-bubble-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 15px;
        width: 100%;
        gap: 15px;
    }

    .info-bubble-header h3 {
        margin: 0;
        font-size: 16px;
        line-height: 1.4;
        flex: 1;
    }

    .info-bubble-status {
        flex-shrink: 0;
        padding: 4px 8px;
        margin-top: 2px;
    }

    .info-bubble-synopsis {
        margin: 15px 0;
        line-height: 1.6;
        color: #ddd;
        text-align: justify;
        overflow: visible;
        max-height: none;
        width: 100%;
        word-wrap: break-word;
        padding-right: 15px;
        box-sizing: border-box;
    }

    .info-bubble-details {
        margin-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 15px;
        width: 100%;
    }

    .info-bubble-synopsis::-webkit-scrollbar {
        width: 4px;
        position: absolute;
        right: 4px;
    }

    .info-bubble-synopsis::-webkit-scrollbar-track {
        background: transparent;
        margin: 4px;
        border-radius: 4px;
    }

    .info-bubble-synopsis::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .info-bubble-synopsis::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .info-detail {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 8px 0;
        gap: 15px;
    }

    .info-label {
        color: #888;
        flex-shrink: 0;
    }

    .info-value {
        color: #fff;
        text-align: right;
    }
    
    /* Styles pour la fonctionnalité "À lire" */
    .btn-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s ease;
        margin: 0 10px;
        height: 36px;
    }
    
    .btn-header:hover {
        background-color: var(--surface);
        border-color: var(--primary-color);
    }
    
    .btn-header svg {
        width: 18px;
        height: 18px;
    }

    .header-right {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 15px;
    }
    
    /* Amélioration des boutons primaires */
    .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: #ff69b4;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-primary:hover {
        background-color: #ff5ba7;
        transform: translateY(-1px);
        box-shadow: 0 3px 8px rgba(255, 105, 180, 0.3);
    }
    
    .btn-primary:active {
        transform: translateY(0);
        box-shadow: 0 1px 3px rgba(255, 105, 180, 0.3);
    }
    
    .btn-primary svg {
        width: 18px;
        height: 18px;
    }
    
    .header-right .btn-primary {
        height: 36px;
        padding: 0 16px;
    }
    
    .btn-secondary {
        background-color: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
    }
    
    .btn-secondary:hover {
        background-color: rgba(255, 255, 255, 0.05);
        border-color: var(--primary-color);
    }
    
    .btn-secondary.active {
        background-color: rgba(255, 105, 180, 0.2);
        color: #ff69b4;
        border-color: #ff69b4;
    }
    
    .btn-icon {
        flex-shrink: 0;
    }
    
    .empty-list {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: var(--text-secondary);
        text-align: center;
        padding: 0 20px;
    }
    
    .empty-list svg {
        opacity: 0.5;
        width: 64px;
        height: 64px;
        margin-bottom: 20px;
    }
    
    .empty-list p {
        margin: 8px 0;
        font-size: 1.1rem;
    }
    
    .empty-list-hint {
        font-size: 0.9rem !important;
        opacity: 0.7;
        max-width: 350px;
    }
    
    .to-read-list {
        padding: 20px;
    }
    
    /* Ajustements pour la modal */
    .modal-content {
        max-width: 900px;
        width: 90%;
        max-height: 85vh;
    }

    .manga-details-actions {
        display: flex;
        gap: 15px;
        margin-top: 20px;
    }
    
    .manga-details-actions button {
        padding: 10px 16px;
        border-radius: 6px;
        font-weight: 500;
        min-width: 120px;
        justify-content: center;
    }

    .manga-details-status {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 500;
        margin: 8px 0 15px;
    }
    
    .manga-details-status.terminé {
        background-color: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
    }
    
    .manga-details-status.en.cours {
        background-color: rgba(33, 150, 243, 0.2);
        color: #2196F3;
    }
    
    .manga-details-section {
        margin-bottom: 20px;
    }
    
    .manga-details-section h3 {
        font-size: 1.1rem;
        margin-bottom: 10px;
        color: #ff69b4;
    }
    
    .manga-details-metadata {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 20px 0;
        background-color: rgba(255, 255, 255, 0.05);
        padding: 15px;
        border-radius: 8px;
    }
    
    .metadata-item {
        display: flex;
        flex-direction: column;
    }
    
    .metadata-label {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 4px;
    }
    
    .metadata-value {
        font-size: 0.95rem;
        font-weight: 500;
    }

    /* Ajustements pour les modales */
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(5px);
        z-index: 9999;
        overflow: auto;
        padding: 20px;
    }
    
    .modal.active,
    .modal[style*="display: block"] {
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    }
    
    .modal-content {
        background-color: var(--card-background);
        border-radius: 12px;
        max-width: 900px;
        width: 90%;
        max-height: 85vh;
        position: relative;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        animation: scaleIn 0.3s ease;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #ff69b4;
    }
    
    .close-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
        background-color: rgba(255, 255, 255, 0.05);
    }
    
    .close-btn:hover {
        background-color: rgba(255, 105, 180, 0.2);
        color: #ff69b4;
    }
    
    .close-btn svg {
        width: 20px;
        height: 20px;
    }
    
    .history-list,
    .to-read-list {
        padding: 20px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
        max-height: calc(85vh - 70px);
        overflow-y: auto;
    }

    .search-box {
        position: relative;
        flex: 0 1 auto;
        margin: 0 10px;
    }
    
    .search-box form {
        display: flex;
        align-items: center;
    }
    
    .search-box input {
        background-color: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--text-primary);
        font-size: 0.9rem;
        width: 100%;
        transition: all 0.2s ease;
    }
    
    .search-box input:focus {
        border-color: #ff69b4;
        outline: none;
        box-shadow: 0 0 0 2px rgba(255, 105, 180, 0.2);
    }
    
    .search-box button {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0;
        font-size: 1.1rem;
    }
    
    .server-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        margin-right: 10px;
    }
    
    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #f44336;
    }
    
    .server-status.online .status-dot {
        background-color: #4CAF50;
    }
    
    .server-status.connecting .status-dot {
        background-color: #FFC107;
        animation: pulse 1.5s infinite;
    }
    
    .status-text {
        font-size: 0.85rem;
        color: var(--text-secondary);
    }
    
    @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
    }
    
    .user-menu {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
    }
    
    #username {
        font-weight: 500;
        color: #ff69b4;
    }
    
    #logoutBtn {
        background-color: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: var(--text-secondary);
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    #logoutBtn:hover {
        background-color: rgba(255, 105, 180, 0.1);
        border-color: #ff69b4;
        color: #ff69b4;
    }
`;

document.head.appendChild(style);