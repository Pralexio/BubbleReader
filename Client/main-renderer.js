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

// Fonction pour échapper les caractères spéciaux HTML
function sanitizeHTML(text) {
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent;
}

// Fonction pour les appels API
async function fetchApi(endpoint, method = 'GET', data = null, timeout = 10000) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
    console.log(`🌐 Envoi d'une requête à: ${url}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // Ajouter le token d'authentification si disponible (d'abord chercher dans sessionStorage)
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      // Si le token est trouvé dans localStorage mais pas dans sessionStorage, le migrer
      if (!sessionStorage.getItem('userToken') && localStorage.getItem('userToken')) {
        sessionStorage.setItem('userToken', localStorage.getItem('userToken'));
        // Optionnel: supprimer le token de localStorage
        // localStorage.removeItem('userToken');
      }
    }

    // Ajouter le corps de la requête pour POST/PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    // Utiliser un AbortController pour gérer le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    // Pour les requêtes DELETE qui retournent 204
    if (response.status === 204) {
      return { success: true };
    }

    // Gérer les erreurs HTTP
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Erreur HTTP: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('❌ Erreur API:', error);
    throw error;
  }
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
  
  // Vérifier l'état du serveur au chargement
  checkServerAvailability();
});

// Fonction pour mettre à jour l'apparence du bouton de mode développement
function updateDevModeButton(isDevMode) {
  const devModeToggle = document.getElementById('dev-mode-toggle');
  if (!devModeToggle) return;
  
  if (isDevMode) {
    devModeToggle.classList.add('active');
    devModeToggle.title = 'Désactiver le mode développement';
  } else {
    devModeToggle.classList.remove('active');
    devModeToggle.title = 'Activer le mode développement';
  }
}

// Fonction pour afficher une alerte
function showAlert(message, type = 'info', duration = 3000) {
  // Sanitizer le message
  const sanitizedMessage = sanitizeHTML(message);
  
  // Créer l'élément d'alerte s'il n'existe pas
  let alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    document.body.appendChild(alertContainer);
  }
  
  // Créer l'alerte
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = sanitizedMessage;
  
  // Ajouter l'alerte au conteneur
  alertContainer.appendChild(alert);
  
  // Animer l'entrée
  setTimeout(() => {
    alert.classList.add('show');
  }, 10);
  
  // Supprimer l'alerte après la durée spécifiée
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => {
      alert.remove();
    }, 300);
  }, duration);
}

// Configuration pour les requêtes API
const headers = {
  'Content-Type': 'application/json'
};

// Éléments DOM
const usernameDisplay = document.getElementById('username');
const logoutButton = document.getElementById('logoutBtn'); // Update this to match the actual ID in HTML
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
    
    // Sanitizer le message
    const sanitizedMessage = sanitizeHTML(message);
    
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
    alertEl.textContent = sanitizedMessage;
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
        // Sanitizer les données avant de les afficher
        const safeTitle = sanitizeHTML(manga.title || '');
        const safeStatus = sanitizeHTML(manga.status || '');
        const safeSlug = sanitizeHTML(manga.slug || '');
        const safeCover = sanitizeHTML(manga.cover || '');
        const safeChapterCount = manga.chapterCount || 0;

        const mangaCard = document.createElement('div');
        mangaCard.className = 'manga-card';
        mangaCard.setAttribute('data-manga-slug', safeSlug);

        mangaCard.innerHTML = `
            <div class="manga-cover">
                <img src="${safeCover}" alt="${safeTitle}" loading="lazy">
            </div>
            <div class="manga-info">
                <h3>${safeTitle}</h3>
                <div class="manga-chapters">Chapitres: ${safeChapterCount}</div>
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
      
      // Charger la liste des mangas depuis le serveur
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
    } catch (error) {
      console.warn('⚠️ Serveur non disponible, utilisation de données de test:', error);
      
      // Utiliser des données de test pour le développement
      allMangas = [
        {
          id: 1,
          title: "One Piece (Test)",
          slug: "one-piece",
          cover: "https://m.media-amazon.com/images/I/51TJbz6RnBL._SY445_SX342_.jpg",
          author: "Eiichiro Oda",
          status: "En cours",
          genres: ["Action", "Aventure", "Comédie"],
          synopsis: "Monkey D. Luffy rêve de retrouver le trésor du légendaire Roi des Pirates, Gold Roger, et de devenir le nouveau Roi des Pirates.",
          chapters: 1090
        },
        {
          id: 2,
          title: "Naruto (Test)",
          slug: "naruto",
          cover: "https://m.media-amazon.com/images/I/51jbIXWnK3L._SY445_SX342_.jpg",
          author: "Masashi Kishimoto",
          status: "Terminé",
          genres: ["Action", "Aventure", "Fantasy"],
          synopsis: "Naruto Uzumaki, un jeune ninja hyperactif, rêve de devenir Hokage, le ninja le plus puissant de son village.",
          chapters: 700
        },
        {
          id: 3,
          title: "Demon Slayer (Test)",
          slug: "demon-slayer",
          cover: "https://m.media-amazon.com/images/I/51QZoVQiCLL._SY445_SX342_.jpg",
          author: "Koyoharu Gotouge",
          status: "Terminé",
          genres: ["Action", "Aventure", "Surnaturel"],
          synopsis: "Tanjiro Kamado voit sa vie basculer après le massacre de sa famille par un démon. Sa sœur Nezuko est la seule survivante, mais elle a été transformée en démon.",
          chapters: 205
        }
      ];
      
      // Afficher un message d'avertissement dans l'interface
      showAlert("Mode développement : serveur indisponible, données de test chargées", "warning");
    }
    
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
  
  // Récupérer les sections à cacher/afficher
  const recentUpdatesSection = document.getElementById('recentUpdatesSection');
  const continueReadingSection = document.getElementById('continueReadingSection');
  
  if (!query) {
    displayMangaList(allMangas);
    // Réafficher les sections avec animation quand la recherche est vide
    if (recentUpdatesSection) {
      recentUpdatesSection.classList.remove('section-hidden');
      recentUpdatesSection.classList.add('section-visible');
    }
    if (continueReadingSection) {
      continueReadingSection.classList.remove('section-hidden');
      continueReadingSection.classList.add('section-visible');
    }
    return;
  }

  // Cacher les sections avec animation pendant la recherche
  if (recentUpdatesSection) {
    recentUpdatesSection.classList.remove('section-visible');
    recentUpdatesSection.classList.add('section-hidden');
  }
  if (continueReadingSection) {
    continueReadingSection.classList.remove('section-visible');
    continueReadingSection.classList.add('section-hidden');
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1zm13 2H6v15.432l6-3.761 6 3.761V4z" fill="currentColor"/>
                        </svg>
                        <span class="btn-text">Ajouter à ma liste</span>
                    </button>
                    <button class="btn btn-primary read-manga-btn" data-manga-slug="${manga.slug}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M19.376 12.416L8.777 19.482A.5.5 0 0 1 8 19.066V4.934a.5.5 0 0 1 .777-.416l10.599 7.066a.5.5 0 0 1 0 .832z" fill="currentColor"/>
                        </svg>
                        <span>Lire</span>
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
    
    // Mode développement - forcer le serveur à être considéré comme disponible
    const devMode = localStorage.getItem('devMode') === 'true';
    if (devMode) {
        console.log('🛠️ Mode développement activé : ignorer la vérification du serveur');
        serverStatus.className = 'server-status dev-mode';
        statusText.textContent = 'Mode développement';
        return true;
    }
    
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
        
        // Tester d'abord avec fetch
        try {
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
                throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            }
        } catch (fetchError) {
            console.error('❌ Erreur fetch:', fetchError);
            
            // Si fetch échoue, essayer avec XMLHttpRequest comme fallback
            return new Promise((resolve) => {
                console.log('🔄 Tentative avec XMLHttpRequest...');
                const xhr = new XMLHttpRequest();
                xhr.open('GET', `${apiUrl}/health`);
                xhr.timeout = 5000;
                xhr.setRequestHeader('Accept', 'application/json');
                
                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log('✅ Serveur en ligne (XHR):', xhr.responseText);
                        serverStatus.className = 'server-status online';
                        statusText.textContent = 'Serveur en ligne';
                        resolve(true);
                    } else {
                        console.error('❌ Serveur en ligne mais erreur (XHR):', xhr.status, xhr.statusText);
                        serverStatus.className = 'server-status offline';
                        statusText.textContent = 'Serveur hors ligne';
                        resolve(false);
                    }
                };
                
                xhr.onerror = function() {
                    console.error('❌ Erreur XHR:', xhr.statusText);
                    serverStatus.className = 'server-status offline';
                    statusText.textContent = 'Serveur hors ligne';
                    resolve(false);
                };
                
                xhr.ontimeout = function() {
                    console.error('⏱️ Timeout XHR');
                    serverStatus.className = 'server-status offline';
                    statusText.textContent = 'Serveur hors ligne';
                    resolve(false);
                };
                
                xhr.send();
            });
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
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="currentColor"/>
                        </svg>
                    </div>
                    <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-info">
                    <h3>${manga.title}</h3>
                    <div class="manga-chapters">Chapitres: ${historyItem.chapter || 1}</div>
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
        
        // Vérifier que le slug est valide
        if (!slug || typeof slug !== 'string') {
            throw new Error('Slug de manga invalide');
        }
        
        // Appel à l'API pour supprimer la progression de lecture
        const response = await fetchApi(`/users/mangas/reading-progress/${slug}`, 'DELETE');
        
        // Si l'API retourne un statut 204, c'est une réussite (pas de contenu)
        if (response && response.success !== false) {
            // Mettre à jour l'historique local
            readingHistory = readingHistory.filter(item => item.mangaSlug !== slug);
            
            // Rafraîchir l'affichage
            displayContinueReading();
            
            showAlert('Entrée d\'historique supprimée avec succès', 'success');
        } else {
            throw new Error(response.message || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la suppression de l\'historique:', error);
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
        
        .close-confirmation-btn svg {
            width: 20px;
            height: 20px;
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
            box-shadow: 0 3px 8px rgba(255, 0, 0, 0.3);
        }
        
        .btn-confirm:active {
            transform: translateY(0);
            box-shadow: 0 1px 3px rgba(255, 0, 0, 0.3);
        }
    `;
    
    // Ajouter le style au document
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

// Variables pour contrôler la fréquence des rechargements
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 30000; // 30 secondes (30000 ms) entre les rechargements

// Fonction pour recharger la progression quand on revient à l'accueil
async function refreshReadingProgress() {
    console.log('Rafraîchissement de la progression de lecture...');
    
    try {
        // Montrer une indication visuelle de chargement
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.classList.add('loading');
        }
        
        // Vérifier d'abord si le serveur est disponible
        const serverAvailable = await checkServerAvailability();
        if (!serverAvailable) {
            console.log('Serveur indisponible, rechargement annulé');
            showAlert('Serveur indisponible, impossible de rafraîchir les données', 'warning');
            return;
        }
        
        // Mettre à jour la variable lastRefreshTime
        lastRefreshTime = Date.now();
        
        // Si l'utilisateur est connecté, charger l'historique de lecture
        if (isLoggedIn()) {
            try {
                const response = await fetchApi('/users/mangas/reading-progress');
                if (response && Array.isArray(response)) {
                    readingHistory = response.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead));
                    console.log('Historique de lecture rechargé:', readingHistory.length, 'entrées');
                    
                    // Mettre à jour l'affichage de l'historique
                    const continueReadingContainer = document.getElementById('continueReadingList');
                    if (continueReadingContainer) {
                        // Mettre à jour l'affichage de la section "Reprendre la lecture"
                        await displayContinueReading();
                        showAlert('Historique de lecture mis à jour', 'success');
                    }
                }
            } catch (error) {
                console.error('Erreur lors du rechargement de l\'historique:', error);
                showAlert('Erreur lors de la mise à jour de l\'historique', 'error');
            }
        } else {
            console.log('Utilisateur non connecté, pas d\'historique à charger');
        }
    } catch (error) {
        console.error('Erreur lors du rafraîchissement de la progression:', error);
        showAlert('Erreur lors du rafraîchissement des données', 'error');
    } finally {
        // Enlever l'indication de chargement
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.classList.remove('loading');
        }
    }
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
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
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
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="currentColor"/>
                        </svg>
                    </div>
                    <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="manga-info">
                    <h3>${manga.title}</h3>
                    <div class="manga-chapters">Chapitres: ${historyItem.chapter || 1}</div>
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
                <div class="manga-chapters">Chapitres: ${manga.chapterCount || 0}</div>
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

// Variables pour contrôler l'état et les rechargements
let lastServerCheckTime = 0;
const SERVER_CHECK_COOLDOWN = 30000; // 30 secondes

// Vérification du statut serveur optimisée
async function checkServerStatusOptimized() {
    const currentTime = Date.now();
    
    // Vérifier si suffisamment de temps s'est écoulé depuis la dernière vérification
    if (currentTime - lastServerCheckTime < SERVER_CHECK_COOLDOWN) {
        console.log('Vérification serveur ignorée - trop rapprochée de la précédente');
        return;
    }
    
    lastServerCheckTime = currentTime;
    await checkServerAvailability();
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de la page');
    debugLocalStorage(); // Ajouter le débogage

    // Vérifier explicitement si un token est présent sans nom d'utilisateur et définir "Pralexio"
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
    if (token) {
        console.log('💡 Token trouvé, vérification du profil utilisateur');
        
        const userString = localStorage.getItem('user');
        let needsUpdate = false;
        
        try {
            if (!userString || userString === '{}') {
                needsUpdate = true;
            } else {
                const userData = JSON.parse(userString);
                if (!userData.username) {
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                console.log('💡 Données utilisateur manquantes ou incomplètes, tentative de récupération depuis le serveur');
                
                // Laisser fetchUserInfo s'occuper de la récupération des informations
                // Il tentera d'abord de récupérer depuis le localStorage, puis depuis le serveur si nécessaire
                const userInfo = await fetchUserInfo();
                
                // Mise à jour directe de l'élément dans le DOM si des informations ont été récupérées
                if (userInfo && userInfo.username) {
                    const usernameElement = document.getElementById('username');
                    if (usernameElement) {
                        console.log('💡 Mise à jour directe de l\'élément dans le DOM avec:', userInfo.username);
                        usernameElement.textContent = userInfo.username;
                    }
                }
            }
        } catch (error) {
            console.error('💡 Erreur lors de la vérification de l\'utilisateur:', error);
            // Ne rien définir en dur, laisser fetchUserInfo gérer cela
        }
    }
    
    try {
        // Vérifier l'état du serveur
        await checkServerAvailability();
        lastServerCheckTime = Date.now();
        
        // Charger d'abord la liste des mangas
        console.log('Chargement de la liste des mangas...');
        await loadMangaList();
        console.log('Liste des mangas chargée:', allMangas ? allMangas.length : 0, 'mangas');
        
        // Charger les dernières mises à jour
        console.log('Chargement des dernières mises à jour...');
        await loadRecentUpdates();
        
        // Puis charger l'historique si l'utilisateur est connecté
        if (isLoggedIn()) {
            console.log('Chargement de l\'historique de lecture...');
            await loadReadingHistory();
            lastRefreshTime = Date.now();
        }

        // Gestionnaire d'événement pour le bouton "Voir toutes les mises à jour"
        const showAllUpdatesBtn = document.getElementById('showAllUpdatesBtn');
        if (showAllUpdatesBtn) {
            showAllUpdatesBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Empêcher le comportement par défaut du bouton
                showAllRecentUpdates(e); // Passer l'événement à la fonction
            });
            console.log('✅ Gestionnaire d\'événement ajouté au bouton "Voir toutes les mises à jour"');
        } else {
            console.error('❌ Bouton "Voir toutes les mises à jour" non trouvé dans le DOM');
        }
        
        // Ajouter un bouton de rafraîchissement à l'interface
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            const refreshButton = document.createElement('button');
            refreshButton.id = 'refreshButton';
            refreshButton.className = 'btn-icon refresh-btn';
            refreshButton.title = 'Rafraîchir la progression';
            refreshButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="none" d="M0 0h24v24H0z"/>
                    <path d="M5.463 4.433A9.961 9.961 0 0 1 12 2c5.523 0 10 4.477 10 10 0 2.136-.67 4.116-1.81 5.74L17 12h3A8 8 0 0 0 6.46 6.228l-.997-1.795zm13.074 15.134A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.136.67-4.116 1.81-5.74L7 12H4a8 8 0 0 0 13.54 5.772l.997 1.795z" fill="currentColor"/>
                </svg>
            `;
            
            // Ajouter le bouton avant le bouton À lire
            const toReadListBtn = document.getElementById('toReadListBtn');
            if (toReadListBtn) {
                headerRight.insertBefore(refreshButton, toReadListBtn);
            } else {
                headerRight.appendChild(refreshButton);
            }
            
            // Ajouter un gestionnaire d'événement au bouton
            refreshButton.addEventListener('click', () => {
                // Éviter de lancer plusieurs rafraîchissements en même temps
                if (refreshButton.classList.contains('loading') || refreshButton.classList.contains('rotating')) {
                    return;
                }
                refreshButton.classList.add('rotating');
                // Rafraîchir la page entière au lieu de la progression
                window.location.reload();
            });
            
            // Ajouter des styles pour le bouton
            const style = document.createElement('style');
            style.textContent = `
                .refresh-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background-color: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: var(--text-secondary);
                    cursor: pointer;
                    margin-right: 10px;
                    transition: all 0.2s ease;
                }
                
                .refresh-btn:hover {
                    background-color: rgba(255, 105, 180, 0.1);
                    border-color: #ff69b4;
                    color: #ff69b4;
                }
                
                .refresh-btn.rotating svg {
                    animation: rotate 1s linear;
                }
                
                .refresh-btn.loading {
                    background-color: rgba(255, 105, 180, 0.2);
                    border-color: #ff69b4;
                    color: #ff69b4;
                    pointer-events: none;
                }
                
                .refresh-btn.loading svg {
                    animation: rotate 1.5s linear infinite;
                }
                
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Vérifier périodiquement l'état du serveur (toutes les 60 secondes)
        setInterval(checkServerStatusOptimized, 60000);
        
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
                    searchMangas(''); // Utiliser la fonction searchMangas pour gérer l'affichage/masquage des sections
                }
            });
        }
        
        // Gérer la déconnexion
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                logout();
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
        
        // Fonction pour afficher le nom d'utilisateur
        async function displayUsername() {
          try {
            console.log('Tentative d\'affichage du nom d\'utilisateur...');
            
            const usernameElement = document.getElementById('username');
            if (!usernameElement) {
              console.error('❌ Élément username non trouvé dans le DOM');
              return;
            }
            
            console.log('Élément username trouvé dans le DOM:', usernameElement);
            
            // Récupérer les informations utilisateur depuis le localStorage
            const userInfo = await fetchUserInfo();
            
            if (userInfo && userInfo.username) {
              // Si on a réussi à récupérer les informations
              console.log('✅ Nom d\'utilisateur disponible, mise à jour du DOM avec:', userInfo.username);
              usernameElement.textContent = userInfo.username;
              
              // Pour le débogage, vérifier si la mise à jour a fonctionné
              setTimeout(() => {
                console.log('Contenu actuel de l\'élément username après mise à jour:', 
                  usernameElement.textContent || '(vide)');
              }, 100);
            } else {
              // Si aucun nom d'utilisateur n'est disponible
              const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
              if (token) {
                console.log('Token présent mais aucun nom d\'utilisateur, affichage de "Non trouvé"');
                usernameElement.textContent = 'Non trouvé';
              } else {
                // Laisser le texte par défaut "Utilisateur" défini dans le HTML
                console.log('Aucun nom d\'utilisateur et aucun token, utilisation du texte par défaut "Utilisateur"');
              }
            }
          } catch (error) {
            console.error('Erreur lors de l\'affichage du nom d\'utilisateur:', error);
          }
        }

        // Appeler la fonction au chargement de la page
        displayUsername();
        
        // Vérifier périodiquement si les informations utilisateur ont changé
        // (toutes les 2 minutes)
        setInterval(displayUsername, 120000);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showAlert('error', 'Erreur lors de l\'initialisation de l\'application');
    }
});

// Fonction pour récupérer les informations de l'utilisateur depuis le serveur
async function fetchUserInfo() {
  try {
    debugLocalStorage(); // Afficher le contenu du localStorage pour débogage

    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
    if (!token) {
      console.log('Aucun token d\'utilisateur trouvé');
      return null;
    }

    // Si le token existe uniquement dans localStorage, le copier dans sessionStorage pour cette session
    if (!sessionStorage.getItem('userToken') && localStorage.getItem('userToken')) {
      console.log('Token trouvé dans localStorage mais pas dans sessionStorage, copie en cours...');
      sessionStorage.setItem('userToken', localStorage.getItem('userToken'));
    }

    // Toujours essayer de récupérer le profil depuis le serveur en premier
    if (token) {
      try {
        console.log('Tentative de récupération du profil utilisateur depuis le serveur...');
        const response = await fetch(`${apiUrl}/users/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.user && data.user.username) {
            console.log('Profil utilisateur récupéré depuis le serveur:', data.user.username);
            
            // Sauvegarder dans localStorage pour les prochaines utilisations
            localStorage.setItem('user', JSON.stringify({
              username: data.user.username,
              id: data.user._id,
              email: data.user.email
            }));
            
            return { username: data.user.username };
          }
        } else {
          console.warn('Impossible de récupérer le profil utilisateur depuis le serveur, utilisation des données en cache');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du profil depuis le serveur:', error);
        console.log('Utilisation des données en cache suite à l\'erreur');
      }
    }

    // Si la récupération depuis le serveur échoue, essayer depuis le localStorage
    const userString = localStorage.getItem('user');
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        console.log('Données utilisateur récupérées depuis localStorage:', userData);
        
        // Vérifier si le nom d'utilisateur est défini
        if (userData.username) {
          console.log('Nom d\'utilisateur trouvé dans cache:', userData.username);
          return { username: userData.username };
        } else {
          console.warn('Le nom d\'utilisateur est undefined ou vide dans les données utilisateur');
        }
      } catch (error) {
        console.error('Erreur lors du parsing des données utilisateur:', error);
      }
    } else {
      console.warn('Aucune donnée utilisateur trouvée dans localStorage');
    }
    
    // Tenter de récupérer le nom d'utilisateur depuis d'autres sources si disponible
    const userName = localStorage.getItem('userName');
    if (userName) {
      console.log('Nom d\'utilisateur trouvé dans localStorage.userName:', userName);
      
      // Créer un objet utilisateur avec le nom récupéré
      const defaultUser = {
        username: userName
      };
      
      console.log('Sauvegarde des informations utilisateur dans localStorage');
      localStorage.setItem('user', JSON.stringify(defaultUser));
      return defaultUser;
    }
    
    // Si toujours pas de nom d'utilisateur, utiliser "Non trouvé"
    console.log('Aucun nom d\'utilisateur trouvé malgré le token, utilisation de "Non trouvé"');
    return { username: "Non trouvé" };
  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error);
    return null;
  }
}

// Ajouter une fonction pour récupérer les informations de l'utilisateur depuis le localStorage
async function fetchAndDisplayUsername() {
  const usernameElement = document.getElementById('username');
  if (!usernameElement) {
    console.error('❌ Élément username non trouvé dans le DOM');
    return;
  }

  const userInfo = await fetchUserInfo();
  if (userInfo && userInfo.username) {
    usernameElement.textContent = userInfo.username;
    console.log('Nom d\'utilisateur affiché:', userInfo.username);
  } else {
    // Laisser le texte par défaut "Utilisateur" défini dans le HTML
    console.log('Aucun nom d\'utilisateur trouvé, utilisation du texte par défaut');
  }
}

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

// Fonction pour se déconnecter
function logout() {
  // Nettoyer toutes les données utilisateur du stockage
  clearUserData();
  
  // Rediriger vers la page de connexion
  window.location.href = 'index.html';
}

// Fonction pour nettoyer toutes les données utilisateur
function clearUserData() {
  console.log('Nettoyage de toutes les données utilisateur du stockage local');
  
  // Supprimer les tokens
  localStorage.removeItem('userToken');
  sessionStorage.removeItem('userToken');
  
  // Supprimer les données utilisateur
  localStorage.removeItem('user');
  localStorage.removeItem('userName'); // Anciennes clés
  localStorage.removeItem('userEmail');
  localStorage.removeItem('autoLogin');
  
  // Notifier le processus principal si disponible
  if (ipcRenderer && ipcRenderer.send) {
    ipcRenderer.send('logout');
  }
  
  console.log('Toutes les données utilisateur ont été supprimées');
}

// Fonction de débogage pour afficher le contenu du localStorage
function debugLocalStorage() {
  console.log('==== CONTENU DU LOCALSTORAGE ====');
  console.log('userToken:', localStorage.getItem('userToken') ? 'présent' : 'absent');
  console.log('autoLogin:', localStorage.getItem('autoLogin'));
  
  const userString = localStorage.getItem('user');
  if (userString) {
    try {
      const userData = JSON.parse(userString);
      console.log('user:', userData);
    } catch (error) {
      console.error('Erreur de parsing user:', error);
      console.log('user (brut):', userString);
    }
  } else {
    console.log('user: absent');
  }
  console.log('================================');
}

// Appeler la fonction de débogage au chargement de la page
document.addEventListener('DOMContentLoaded', debugLocalStorage);

// Variable pour stocker les dernières mises à jour
let recentUpdates = [];

// Fonction pour charger les dernières mises à jour (7 derniers jours)
async function loadRecentUpdates() {
  try {
    console.log('📚 Chargement des mises à jour récentes...');
    
    // Récupération de l'API URL
    const apiUrlEndpoint = window.electron ? window.electron.getApiUrl() : 'http://localhost:5000/api';
    
    // Faire la requête directement avec fetchApi
    const response = await fetchApi(`${apiUrlEndpoint}/mangas/recently-updated`);
    
    // DEBUG: Afficher la réponse complète
    console.log('📄 Réponse complète de l\'API /mangas/recently-updated:', response);
    
    if (!response || !Array.isArray(response)) {
      console.log('❌ Aucune mise à jour récente récupérée depuis l\'API - Type de réponse invalide:', typeof response);
      recentUpdates = [];
      displayRecentUpdates();
      return;
    }
    
    console.log(`✨ ${response.length} mangas récemment mis à jour récupérés depuis l'API`);
    
    // DEBUG: Vérifier si Solo Leveling est présent dans les résultats
    const soloLeveling = response.find(manga => manga.title === 'Solo Leveling');
    if (soloLeveling) {
      console.log('✅ Solo Leveling trouvé dans les résultats API avec:', {
        chapitres: soloLeveling.chapterCount,
        ancienChapitres: soloLeveling.lastChapterCount,
        slug: soloLeveling.slug
      });
    } else {
      console.log('❌ Solo Leveling non trouvé dans les résultats de l\'API');
    }
    
    // Stocker la réponse directement (elle est déjà filtrée et formatée par le serveur)
    recentUpdates = response;

    // Trier par date de mise à jour (plus récent d'abord)
    recentUpdates.sort((a, b) => {
      // Utiliser la plus récente des deux dates pour chaque manga
      const dateA = Math.max(
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
        a.lastChapterUpdate ? new Date(a.lastChapterUpdate).getTime() : 0
      );
      const dateB = Math.max(
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        b.lastChapterUpdate ? new Date(b.lastChapterUpdate).getTime() : 0
      );
      return dateB - dateA;
    });
    
    console.log('Dernières mises à jour chargées:', recentUpdates.length, 'mangas');
    
    // Afficher les dernières mises à jour
    displayRecentUpdates();
  } catch (error) {
    console.error('❌ Erreur lors du chargement des mises à jour récentes:', error);
    recentUpdates = [];
    displayRecentUpdates(); // Même en cas d'erreur, on affiche un message approprié
  }
}

// Fonction pour afficher les dernières mises à jour
function displayRecentUpdates() {
  try {
    const container = document.getElementById('recentUpdatesList');
    const showAllUpdatesBtn = document.getElementById('showAllUpdatesBtn');
    
    if (!container) {
      console.log('Container des dernières mises à jour non trouvé');
      return;
    }

    // Vider le contenu existant
    container.innerHTML = '';

    if (!recentUpdates || recentUpdates.length === 0) {
      console.log('Aucune mise à jour récente à afficher');
      
      // Ajouter un bouton de rechargement en cas d'échec
      container.innerHTML = `
        <p class="no-updates">Aucune mise à jour récente disponible</p>
        <button id="reloadUpdatesBtn" class="btn btn-primary">
          Recharger les mises à jour
        </button>
      `;
      
      // Ajouter l'événement de rechargement
      const reloadBtn = document.getElementById('reloadUpdatesBtn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', async () => {
          try {
            reloadBtn.disabled = true;
            reloadBtn.textContent = 'Rechargement...';
            await loadRecentUpdates();
            reloadBtn.disabled = false;
            reloadBtn.textContent = 'Recharger les mises à jour';
          } catch (error) {
            console.error('Erreur lors du rechargement:', error);
            reloadBtn.disabled = false;
            reloadBtn.textContent = 'Réessayer';
          }
        });
      }
      
      // Rendre le bouton Voir tout inactif mais toujours visible
      if (showAllUpdatesBtn) {
        showAllUpdatesBtn.disabled = true;
        showAllUpdatesBtn.classList.add('disabled');
      }
      return;
    }
    
    // Filtrer les mangas qui ont réellement reçu des mises à jour (nouveaux chapitres)
    const updatedMangas = recentUpdates.filter(manga => {
      if (manga.lastChapterCount !== undefined && manga.chapterCount !== undefined) {
        const difference = manga.chapterCount - manga.lastChapterCount;
        return difference > 0;
      }
      return false;
    });
    
    // Obtenir la date précise la plus récente pour chaque manga
    const mangasWithTimestamp = updatedMangas.map(manga => {
      const lastChapterDate = manga.lastChapterUpdate ? new Date(manga.lastChapterUpdate).getTime() : 0;
      const updatedDate = manga.updatedAt ? new Date(manga.updatedAt).getTime() : 0;
      
      // Utiliser le timestamp le plus récent
      const latestTimestamp = Math.max(lastChapterDate, updatedDate);
      
      return {
        ...manga,
        latestTimestamp
      };
    });
    
    // Trier par timestamp du plus récent au plus ancien
    mangasWithTimestamp.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    
    // Regrouper par date (jour)
    const mangasByDay = {};
    mangasWithTimestamp.forEach(manga => {
      // Créer une clé pour chaque jour (YYYY-MM-DD)
      const date = new Date(manga.latestTimestamp);
      const dayKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      
      if (!mangasByDay[dayKey]) {
        mangasByDay[dayKey] = [];
      }
      
      mangasByDay[dayKey].push(manga);
    });
    
    // Pour chaque jour, ne garder que le manga le plus récent (déjà trié)
    const mostRecentByDay = Object.values(mangasByDay).map(dayMangas => dayMangas[0]);
    
    console.log(`Affichage de ${mostRecentByDay.length} mangas (le plus récent par jour):`, 
      mostRecentByDay.map(m => `${m.title} (${new Date(m.latestTimestamp).toLocaleString()})`));
    
    // Si aucun manga n'a réellement reçu de mise à jour
    if (mostRecentByDay.length === 0) {
      container.innerHTML = `
        <p class="no-updates">Aucun manga n'a reçu de nouveaux chapitres récemment</p>
        <button id="reloadUpdatesBtn" class="btn btn-primary">
          Recharger les mises à jour
        </button>
      `;
      
      // Ajouter l'événement de rechargement
      const reloadBtn = document.getElementById('reloadUpdatesBtn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', async () => {
          try {
            reloadBtn.disabled = true;
            reloadBtn.textContent = 'Rechargement...';
            await loadRecentUpdates();
            reloadBtn.disabled = false;
            reloadBtn.textContent = 'Recharger les mises à jour';
          } catch (error) {
            console.error('Erreur lors du rechargement:', error);
            reloadBtn.disabled = false;
            reloadBtn.textContent = 'Réessayer';
          }
        });
      }
      
      // Rendre le bouton Voir tout inactif mais toujours visible
      if (showAllUpdatesBtn) {
        showAllUpdatesBtn.disabled = true;
        showAllUpdatesBtn.classList.add('disabled');
      }
      return;
    }
    
    // Réactiver le bouton s'il y a des mises à jour
    if (showAllUpdatesBtn) {
      showAllUpdatesBtn.disabled = false;
      showAllUpdatesBtn.classList.remove('disabled');
      showAllUpdatesBtn.style.display = 'block';
    }

    // Limiter à 5 entrées les plus récentes par défaut
    const recentItems = mostRecentByDay.slice(0, 5);

    // Créer les cartes pour chaque manga
    recentItems.forEach(manga => {
      const mangaCard = document.createElement('div');
      mangaCard.className = 'manga-card';
      mangaCard.setAttribute('data-manga-slug', manga.slug);

      // Utiliser la date précise pour l'affichage
      const displayDate = new Date(manga.latestTimestamp);
      
      // Formater la date et l'heure en français
      const formattedDate = displayDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Calculer à partir de maintenant (aujourd'hui, hier, etc.)
      const timeAgo = getRelativeTimeString(displayDate);
      
      // Créer une info de mise à jour qui montre le changement de chapitres
      let updateInfo = '';
      const difference = manga.chapterCount - manga.lastChapterCount;
      if (difference > 0) {
        updateInfo = `<span class="chapter-update-badge">+${difference} ${difference > 1 ? 'chapitres' : 'chapitre'}</span>`;
      }

      mangaCard.innerHTML = `
        <div class="manga-cover">
          <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
          ${updateInfo}
        </div>
        <div class="manga-info">
          <h3>${manga.title}</h3>
          <div class="manga-chapters">Chapitres: ${manga.chapterCount}</div>
        </div>
      `;

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
    console.error('Problème d\'affichage des mises à jour:', error);
    
    // En cas d'erreur, afficher un message simple avec un bouton de rechargement
    const container = document.getElementById('recentUpdatesList');
    const showAllUpdatesBtn = document.getElementById('showAllUpdatesBtn');
    
    if (container) {
      container.innerHTML = `
        <p class="no-updates">Erreur lors du chargement des mises à jour</p>
        <button id="reloadUpdatesBtn" class="btn btn-primary">
          Réessayer
        </button>
      `;
      
      // Ajouter l'événement de rechargement
      const reloadBtn = document.getElementById('reloadUpdatesBtn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => loadRecentUpdates());
      }
    }
    
    // Rendre le bouton inactif mais toujours visible
    if (showAllUpdatesBtn) {
      showAllUpdatesBtn.disabled = true;
      showAllUpdatesBtn.classList.add('disabled');
    }
  }
}

// Fonction pour obtenir une chaîne de temps relative (aujourd'hui, hier, etc.)
function getRelativeTimeString(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "aujourd'hui";
  } else if (diffDays === 1) {
    return "hier";
  } else if (diffDays < 7) {
    return `il y a ${diffDays} jours`;
  } else {
    return `le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  }
}

// Fonction pour afficher toutes les mises à jour récentes
window.showAllRecentUpdates = function(e) {
  // Empêcher le comportement par défaut et la propagation de l'événement
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  console.log('Affichage de toutes les mises à jour récentes');
  
  // Filtrer les mangas qui ont réellement reçu des mises à jour (nouveaux chapitres)
  const updatedMangas = recentUpdates.filter(manga => {
    if (manga.lastChapterCount !== undefined && manga.chapterCount !== undefined) {
      const difference = manga.chapterCount - manga.lastChapterCount;
      return difference > 0;
    }
    return false;
  });
  
  // Obtenir la date précise la plus récente pour chaque manga
  const mangasWithTimestamp = updatedMangas.map(manga => {
    const lastChapterDate = manga.lastChapterUpdate ? new Date(manga.lastChapterUpdate).getTime() : 0;
    const updatedDate = manga.updatedAt ? new Date(manga.updatedAt).getTime() : 0;
    
    // Utiliser le timestamp le plus récent
    const latestTimestamp = Math.max(lastChapterDate, updatedDate);
    
    return {
      ...manga,
      latestTimestamp
    };
  });
  
  // Trier par timestamp du plus récent au plus ancien
  mangasWithTimestamp.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  
  // Regrouper par date (jour)
  const mangasByDay = {};
  mangasWithTimestamp.forEach(manga => {
    // Créer une clé pour chaque jour (YYYY-MM-DD)
    const date = new Date(manga.latestTimestamp);
    const dayKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    if (!mangasByDay[dayKey]) {
      mangasByDay[dayKey] = [];
    }
    
    mangasByDay[dayKey].push(manga);
  });
  
  // Pour chaque jour, ne garder que le manga le plus récent (déjà trié)
  const mostRecentByDay = Object.values(mangasByDay).map(dayMangas => dayMangas[0]);
  
  // Vérifier si des mises à jour existent et contiennent des éléments
  if (!mostRecentByDay || mostRecentByDay.length === 0) {
    showAlert('Aucun manga n\'a reçu de nouveaux chapitres récemment', 'info');
    return;
  }
  
  // Si moins de 5 entrées, afficher un avertissement
  if (mostRecentByDay.length <= 5) {
    showAlert('Toutes les mises à jour sont déjà affichées', 'info');
    return;
  }
  
  // Référence à la section des mises à jour récentes
  const recentUpdatesSection = document.getElementById('recentUpdatesSection');
  const recentUpdatesList = document.getElementById('recentUpdatesList');
  
  if (!recentUpdatesSection || !recentUpdatesList) {
    console.error('❌ Section des mises à jour récentes non trouvée');
    return;
  }
  
  // Vérifier si la liste complète est déjà affichée
  const isExpanded = recentUpdatesSection.classList.contains('expanded');
  
  if (isExpanded) {
    // Réduire la liste (n'afficher que les 5 premiers)
    recentUpdatesSection.classList.remove('expanded');
    document.getElementById('showAllUpdatesBtn').textContent = 'Voir toutes les mises à jour';
    
    // Recréer l'affichage avec seulement les 5 premiers éléments
    displayRecentUpdates();
  } else {
    // Étendre la liste (afficher tous les mangas)
    recentUpdatesSection.classList.add('expanded');
    document.getElementById('showAllUpdatesBtn').textContent = 'Réduire la liste';
    
    // Vider la liste actuelle
    recentUpdatesList.innerHTML = '';
    
    // Afficher toutes les entrées des mises à jour récentes
    mostRecentByDay.forEach(manga => {
      const mangaCard = document.createElement('div');
      mangaCard.className = 'manga-card';
      mangaCard.setAttribute('data-manga-slug', manga.slug);

      // Utiliser la date précise pour l'affichage
      const displayDate = new Date(manga.latestTimestamp);
      
      // Formater la date en français avec l'heure précise
      const updateDate = displayDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Créer une info de mise à jour qui montre le changement de chapitres
      let updateInfo = '';
      const difference = manga.chapterCount - manga.lastChapterCount;
      if (difference > 0) {
        updateInfo = `<span class="chapter-update-badge">+${difference} ${difference > 1 ? 'chapitres' : 'chapitre'}</span>`;
      }

      mangaCard.innerHTML = `
        <div class="manga-cover">
          <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
          ${updateInfo}
        </div>
        <div class="manga-info">
          <h3>${manga.title}</h3>
          <div class="manga-chapters">Chapitres: ${manga.chapterCount}</div>
        </div>
      `;

      // Ajouter le gestionnaire de clic sur la carte
      mangaCard.addEventListener('click', () => {
        const slug = mangaCard.getAttribute('data-manga-slug');
        if (slug) {
          showMangaDetailsPopup(slug);
        }
      });

      recentUpdatesList.appendChild(mangaCard);
    });
  }
  
  return false; // Empêcher la propagation de l'événement
};

// Fonction d'initialisation de l'application
async function initApp() {
  console.log('🚀 Initialisation de l\'application...');
  
  // Charger la liste des mangas
  await loadMangaList();
  
  // Forcer un rechargement des mises à jour récentes
  await loadRecentUpdates();
  
  // Récupérer l'historique de lecture depuis localStorage
  loadReadingHistory();
  // La fonction correcte est displayContinueReading()
  // displayReadingHistory() n'existe pas
  
  // Charger la liste "À lire"
  loadToReadList();
  displayToReadList();
  
  console.log('✅ Initialisation terminée');
}

// Exécuter l'initialisation au chargement du document
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 Document chargé, initialisation de l\'application...');
  
  // Initialiser les classes d'animation pour les sections
  const recentUpdatesSection = document.getElementById('recentUpdatesSection');
  const continueReadingSection = document.getElementById('continueReadingSection');
  
  if (recentUpdatesSection) recentUpdatesSection.classList.add('section-visible');
  if (continueReadingSection) continueReadingSection.classList.add('section-visible');
  
  initApp();
});