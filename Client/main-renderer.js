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

// Variables globales pour l'historique
let readingHistory = [];
const HISTORY_LIMIT = 5; // Nombre de mangas à afficher dans la section "Reprendre la lecture"

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

    // Créer un conteneur pour la bulle d'info qui sera unique et en dehors des cartes
    const infoBubbleContainer = document.createElement('div');
    infoBubbleContainer.id = 'globalInfoBubble';
    infoBubbleContainer.className = 'info-bubble';
    document.body.appendChild(infoBubbleContainer);

    mangas.forEach(manga => {
        const mangaCard = document.createElement('div');
        mangaCard.className = 'manga-card';
        mangaCard.setAttribute('data-manga-slug', manga.slug);

        mangaCard.innerHTML = `
            <div class="manga-cover">
                <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                <div class="info-icon" data-manga-id="${manga.slug}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="none" d="M0 0h24v24H0z"/>
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM11 7h2v2h-2V7zm0 4h2v6h-2v-6z" fill="currentColor"/>
                    </svg>
                </div>
            </div>
            <div class="manga-info">
                <h3>${manga.title}</h3>
                <div class="manga-status ${manga.status.toLowerCase()}">${manga.status}</div>
                <div class="manga-chapters">Chapitres: ${manga.chapterCount || 0}</div>
            </div>
        `;

        // Ajouter les événements
        const infoIcon = mangaCard.querySelector('.info-icon');

        // Empêcher la propagation du clic sur l'icône d'info
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Ajouter le gestionnaire de clic sur la carte
        mangaCard.addEventListener('click', () => {
            const slug = mangaCard.getAttribute('data-manga-slug');
            if (slug) {
                openMangaDetails(slug);
            }
        });

        infoIcon.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            const bubbleContent = `
                <div class="info-bubble-content">
                    <div class="info-bubble-header">
                        <h3>${manga.title}</h3>
                        <div class="info-bubble-status ${manga.status.toLowerCase()}">${manga.status}</div>
                    </div>
                    <div class="info-bubble-synopsis">
                        ${manga.synopsis || 'Synopsis en cours de chargement...'}
                    </div>
                    <div class="info-bubble-details">
                        <div class="info-detail">
                            <span class="info-label">Auteur:</span>
                            <span class="info-value">${manga.author || 'Inconnu'}</span>
                        </div>
                        <div class="info-detail">
                            <span class="info-label">Artiste:</span>
                            <span class="info-value">${manga.artist || 'Inconnu'}</span>
                        </div>
                        <div class="info-detail">
                            <span class="info-label">Chapitres:</span>
                            <span class="info-value">${manga.chapterCount || 0}</span>
                        </div>
                    </div>
                </div>
            `;

            infoBubbleContainer.innerHTML = bubbleContent;
            positionBubble(e, infoBubbleContainer);
            infoBubbleContainer.style.display = 'block';
        });

        infoIcon.addEventListener('mouseleave', (e) => {
            const rect = infoBubbleContainer.getBoundingClientRect();
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            if (!(mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10)) {
                infoBubbleContainer.style.display = 'none';
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
    if (!slug) {
        showAlert('Aucun identifiant de manga fourni', 'danger');
        return;
    }
    
    console.log(`Ouverture des détails pour le manga avec slug: ${slug}`);
    
    // Vérifier si l'utilisateur est connecté et a une progression de lecture
    const token = localStorage.getItem('userToken');
    if (token) {
        try {
            // Récupérer la progression de lecture
            fetchApi('/users/mangas/reading-progress')
                .then(response => {
                    if (response.success && response.data) {
                        // Chercher la progression pour ce manga
                        const progress = response.data.find(p => p.manga.slug === slug);
                        
                        if (progress) {
                            console.log(`Progression trouvée pour ${slug}, chapitre ${progress.currentChapter}`);
                            
                            // Vérifier si le chapitre existe avant de rediriger
                            if (isValidChapter(slug, progress.currentChapter)) {
                                window.location.href = `reader.html?slug=${slug}&chapter=${progress.currentChapter}`;
                            } else {
                                // Si le chapitre n'existe pas, rediriger vers le dernier chapitre disponible
                                const manga = allMangas.find(m => m.slug === slug);
                                window.location.href = `reader.html?slug=${slug}&chapter=${manga.chapterCount}`;
                            }
                            return;
                        }
                    }
                    
                    // Si pas de progression ou erreur, rediriger vers le premier chapitre
                    window.location.href = `reader.html?slug=${slug}&chapter=1`;
                })
                .catch(error => {
                    console.error('Erreur lors de la récupération de la progression:', error);
                    // En cas d'erreur, rediriger vers le premier chapitre
                    window.location.href = `reader.html?slug=${slug}&chapter=1`;
                });
        } catch (error) {
            console.error('Erreur:', error);
            // En cas d'erreur, rediriger vers le premier chapitre
            window.location.href = `reader.html?slug=${slug}&chapter=1`;
        }
    } else {
        // Si l'utilisateur n'est pas connecté, rediriger vers le premier chapitre
        window.location.href = `reader.html?slug=${slug}&chapter=1`;
    }
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
        
        // Créer un conteneur pour la bulle d'info qui sera unique et en dehors des cartes
        const infoBubbleContainer = document.createElement('div');
        infoBubbleContainer.id = 'globalInfoBubbleContinue';
        infoBubbleContainer.className = 'info-bubble';
        document.body.appendChild(infoBubbleContainer);

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
                    <div class="info-icon" data-manga-id="${manga.slug}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                            <path fill="none" d="M0 0h24v24H0z"/>
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM11 7h2v2h-2V7zm0 4h2v6h-2v-6z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
                <div class="manga-info">
                    <h3>${manga.title}</h3>
                    <div class="manga-status ${manga.status.toLowerCase()}">Chapitre ${historyItem.chapter || 1}</div>
                </div>
            `;

            // Ajouter les événements
            const infoIcon = mangaCard.querySelector('.info-icon');
            const deleteIcon = mangaCard.querySelector('.delete-icon');

            // Empêcher la propagation du clic sur l'icône d'info
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
            });

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
                    window.location.href = `reader.html?slug=${slug}&chapter=${historyItem.chapter || 1}`;
                }
            });

            infoIcon.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                const bubbleContent = `
                    <div class="info-bubble-content">
                        <div class="info-bubble-header">
                            <h3>${manga.title}</h3>
                            <div class="info-bubble-status ${manga.status.toLowerCase()}">${manga.status}</div>
                        </div>
                        <div class="info-bubble-synopsis">
                            ${manga.synopsis || 'Synopsis en cours de chargement...'}
                        </div>
                        <div class="info-bubble-details">
                            <div class="info-detail">
                                <span class="info-label">Auteur:</span>
                                <span class="info-value">${manga.author || 'Inconnu'}</span>
                            </div>
                            <div class="info-detail">
                                <span class="info-label">Artiste:</span>
                                <span class="info-value">${manga.artist || 'Inconnu'}</span>
                            </div>
                            <div class="info-detail">
                                <span class="info-label">Chapitres:</span>
                                <span class="info-value">${manga.chapterCount || 0}</span>
                            </div>
                        </div>
                    </div>
                `;

                infoBubbleContainer.innerHTML = bubbleContent;
                positionBubble(e, infoBubbleContainer);
                infoBubbleContainer.style.display = 'block';
            });

            infoIcon.addEventListener('mouseleave', (e) => {
                const rect = infoBubbleContainer.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                if (!(mouseX >= rect.left - 10 && mouseX <= rect.right + 10 &&
                    mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10)) {
                    infoBubbleContainer.style.display = 'none';
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
    confirmationDialog.innerHTML = `
        <div class="confirmation-content">
            <h3>Confirmer la suppression</h3>
            <p>Voulez-vous vraiment supprimer <strong>${title}</strong> de votre historique de lecture ?</p>
            <div class="confirmation-buttons">
                <button class="btn btn-cancel">Annuler</button>
                <button class="btn btn-confirm">Supprimer</button>
            </div>
        </div>
    `;
    
    // Ajouter la boîte de dialogue au document
    document.body.appendChild(confirmationDialog);
    
    // Empêcher le défilement du corps pendant que la boîte de dialogue est active
    document.body.style.overflow = 'hidden';
    
    // Ajouter les gestionnaires d'événements pour les boutons
    const cancelButton = confirmationDialog.querySelector('.btn-cancel');
    const confirmButton = confirmationDialog.querySelector('.btn-confirm');
    
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(confirmationDialog);
        document.body.style.overflow = '';
    });
    
    confirmButton.addEventListener('click', async () => {
        document.body.removeChild(confirmationDialog);
        document.body.style.overflow = '';
        await deleteReadingHistoryItem(slug);
    });
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

        const progress = Math.round((item.currentPage / item.totalPages) * 100) || 0;
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
            <p class="progress-text">${progress}% lu</p>
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
        if (showAllHistoryBtn) showAllHistoryBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Empêcher le rafraîchissement de la page
            showFullHistory();
        });
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
    }

    .manga-card:hover {
        transform: scale(1.02);
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
`;

document.head.appendChild(style);

// Fonction pour afficher l'historique complet
function showFullHistory() {
    console.log('🔍 Vérification de l\'historique complet...');
    console.log('📚 Nombre total d\'entrées dans l\'historique:', readingHistory ? readingHistory.length : 0);

    const continueReadingList = document.getElementById('continueReadingList');
    const showAllHistoryBtn = document.getElementById('showAllHistoryBtn');
    
    if (!continueReadingList || !readingHistory || !showAllHistoryBtn) {
        console.error('❌ Éléments manquants pour l\'affichage de l\'historique complet');
        return;
    }

    // Si l'historique est vide ou contient moins de 5 éléments
    if (!readingHistory || readingHistory.length <= HISTORY_LIMIT) {
        console.log('⚠️ Pas assez d\'entrées dans l\'historique:', readingHistory ? readingHistory.length : 0);
        showAlert('Vous avez moins de 5 mangas dans votre historique. Lisez plus de mangas pour voir l\'historique complet !', 'warning');
        return;
    }

    // Si le bouton affiche déjà "Afficher moins", c'est qu'on est en mode étendu
    if (showAllHistoryBtn.textContent === 'Afficher moins') {
        console.log('🔄 Retour à l\'affichage des 5 derniers mangas');
        displayContinueReading();
        showAllHistoryBtn.textContent = 'Voir tout l\'historique';
        showAlert('Affichage réduit aux 5 derniers mangas', 'info');
        return;
    }

    console.log('✨ Ajout des entrées supplémentaires à la suite des 5 premières cards...');
    
    // Récupérer le HTML existant des 5 premières cards
    const existingHTML = continueReadingList.innerHTML;
    
    // Générer le HTML pour le reste des mangas (à partir du 6ème)
    const additionalHistory = readingHistory.slice(HISTORY_LIMIT);
    console.log('📚 Nombre d\'entrées supplémentaires à ajouter:', additionalHistory.length);

    const additionalHTML = additionalHistory.map(item => {
        const manga = allMangas.find(m => m.slug === item.mangaSlug);
        if (!manga) return '';
        
        console.log('➕ Ajout du manga:', manga.title);
        
        return `
            <div class="manga-card" data-slug="${item.mangaSlug}">
                <div class="manga-cover" style="background-image: url('${manga.cover || ''}')">
                    ${!manga.cover ? `<div class="manga-letter">${manga.title.charAt(0).toUpperCase()}</div>` : ''}
                    <div class="manga-status-badge ${manga.status === 'TERMINÉ' ? 'completed' : 'ongoing'}">
                        ${manga.status || 'EN COURS'}
                    </div>
                    <div class="reading-progress">
                        <div class="progress-bar" style="width: ${item.progress}%"></div>
                    </div>
                </div>
                <div class="manga-info">
                    <h3 class="manga-title">${manga.title}</h3>
                    <p class="chapter-info">Chapitre ${item.chapter}</p>
                    <p class="progress-text">${item.progress}% lu</p>
                </div>
            </div>
        `;
    }).filter(html => html !== '').join('');
    
    // Combiner le HTML existant avec le nouveau
    continueReadingList.innerHTML = existingHTML + additionalHTML;
    
    console.log('✅ Historique complet affiché avec succès');
    showAlert('Historique complet affiché avec succès', 'success');
    
    // Ajouter les écouteurs d'événements pour les nouvelles cartes
    continueReadingList.querySelectorAll('.manga-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            if (slug) {
                const progress = readingHistory.find(h => h.mangaSlug === slug);
                if (progress) {
                    console.log('🔗 Navigation vers le manga:', slug, 'chapitre:', progress.chapter);
                    window.location.href = `reader.html?slug=${slug}&chapter=${progress.chapter}`;
                }
            }
        });
    });

    // Changer le texte du bouton
    showAllHistoryBtn.textContent = 'Afficher moins';
}

// Ajouter du style CSS pour les icônes de suppression et la boîte de confirmation
const styleDeleteIcon = document.createElement('style');
styleDeleteIcon.textContent = `
    .delete-icon {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 10;
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .manga-card:hover .delete-icon {
        opacity: 1;
    }
    
    .delete-icon:hover {
        background-color: rgba(255, 0, 0, 0.8);
        transform: scale(1.1);
    }
    
    .delete-icon svg {
        width: 18px;
        height: 18px;
        color: white;
    }
    
    .confirmation-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .confirmation-content {
        background-color: var(--card-background);
        border-radius: 12px;
        padding: 24px;
        width: 400px;
        max-width: 90%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    .confirmation-content h3 {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 1.3rem;
    }
    
    .confirmation-content p {
        margin-bottom: 24px;
        color: var(--text-secondary);
    }
    
    .confirmation-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    
    .btn-cancel {
        background-color: transparent;
        color: var(--text-primary);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .btn-confirm {
        background-color: var(--error-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .btn-cancel:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .btn-confirm:hover {
        background-color: #ff3939;
    }
`;

document.head.appendChild(styleDeleteIcon);