// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = 'http://bubblereader.zapto.org:5000/api';

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans main-renderer.js');
  
  // Récupérer l'ipcRenderer de manière sécurisée
  if (window.electron.ipcRenderer) {
    ipcRenderer = window.electron.ipcRenderer;
  }
  
  // Récupérer l'URL de l'API depuis les variables d'environnement
  if (window.electron.env && window.electron.env.apiUrl) {
    apiUrl = window.electron.env.apiUrl;
    console.log('API URL récupérée:', apiUrl);
  }
} else {
  console.warn('window.electron n\'est pas disponible, les fonctionnalités de navigation natives ne seront pas accessibles');
}

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
  const alertEl = document.getElementById('alert');
  if (!alertEl) return;
  
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type} visible`;
  
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
    allMangas = response.mangas;
    console.log(`✨ ${allMangas.length} mangas chargés avec succès`);
    
    // Afficher les mangas
    console.log('🎨 Affichage des mangas...');
    displayMangaList(allMangas);
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

// Fonction pour afficher la liste des mangas
function displayMangaList(mangas) {
    const mangaContainer = document.getElementById('mangaList');
    if (!mangaContainer) {
        console.error('❌ Container mangaList non trouvé');
        return;
    }

    // Vérifier si les mangas sont valides
    if (!Array.isArray(mangas)) {
        console.error('❌ Les données des mangas ne sont pas un tableau:', mangas);
        mangaContainer.innerHTML = `
            <div class="error-message">
                Format de données invalide
            </div>
        `;
        return;
    }

    // Filtrer pour n'avoir que les manhwas (insensible à la casse)
    const manhwaList = mangas.filter(manga => 
        manga.type && manga.type.toUpperCase() === 'MANHWA'
    );
    
    console.log(`📚 Nombre total de mangas: ${mangas.length}`);
    console.log(`📚 Nombre de manhwas: ${manhwaList.length}`);
    
    // Mettre à jour le nombre total de manhwas dans le titre
    const sectionTitle = document.querySelector('#manhwaSection h2');
    if (sectionTitle) {
        sectionTitle.textContent = `MANHWA (${manhwaList.length})`;
    }

    // Si aucun manhwa trouvé, afficher un message
    if (manhwaList.length === 0) {
        mangaContainer.innerHTML = `
            <div class="no-results">
                <p>Aucun manhwa disponible pour le moment.</p>
            </div>
        `;
        return;
    }

    // Trier les mangas par ordre alphabétique
    manhwaList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    // Générer le HTML pour les cartes de manga
    const mangaListHTML = manhwaList.map(manga => {
        // Vérifier que le manga a les propriétés nécessaires
        if (!manga || !manga.title) {
            console.warn('⚠️ Manga invalide détecté:', manga);
            return '';
        }

        // Récupérer la progression si elle existe
        const readingProgress = readingHistory.find(h => h.mangaSlug === manga.slug);
        const progress = readingProgress ? Math.round((readingProgress.currentPage / readingProgress.totalPages) * 100) : 0;
        
        return `
            <div class="manga-card" data-slug="${manga.slug || ''}" data-type="${manga.type || 'MANGA'}">
                <div class="manga-cover" style="background-image: url('${manga.cover || ''}')">
                    ${!manga.cover ? `<div class="manga-letter">${manga.title.charAt(0).toUpperCase()}</div>` : ''}
                    <div class="manga-status-badge ${manga.status === 'TERMINÉ' ? 'completed' : 'ongoing'}">
                        ${manga.status || 'EN COURS'}
                    </div>
                    ${readingProgress ? `
                        <div class="reading-progress">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                </div>
                <div class="manga-info">
                    <h3 class="manga-title">${manga.title}</h3>
                    ${readingProgress ? `
                        <p class="chapter-info">Chapitre ${readingProgress.chapter}</p>
                        <p class="progress-text">${progress}% lu</p>
                    ` : ''}
                </div>
            </div>
        `;
    }).filter(html => html !== '').join('');

    // Mettre à jour le contenu
    mangaContainer.innerHTML = mangaListHTML;

    // Ajouter les écouteurs d'événements pour les cartes
    document.querySelectorAll('.manga-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            if (slug) {
                window.location.href = `reader.html?slug=${slug}&chapter=1`;
            }
        });
    });
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
              
              // Rediriger vers le lecteur avec le chapitre enregistré
              window.location.href = `reader.html?slug=${slug}&chapter=${progress.currentChapter}`;
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
    // Construire l'URL complète
    if (!endpoint.startsWith('/') && !endpoint.startsWith('http')) {
      endpoint = '/' + endpoint;
    }
    
    const fullUrl = endpoint.startsWith('http') ? endpoint : apiUrl + endpoint;
    console.log(`🌐 Envoi d'une requête à: ${fullUrl}`);
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

// Fonction pour afficher la section "Reprendre la lecture"
function displayContinueReading() {
    const continueReadingSection = document.getElementById('continueReading');
    const continueReadingList = document.getElementById('continueReadingList');
    
    if (!continueReadingSection || !continueReadingList) {
        console.error('Éléments DOM manquants pour l\'affichage de la reprise de lecture');
        return;
    }
    
    if (!readingHistory || readingHistory.length === 0) {
        continueReadingSection.style.display = 'none';
        return;
    }
    
    continueReadingSection.style.display = 'block';
    
    // Prendre les 5 derniers mangas lus
    const recentlyRead = readingHistory.slice(0, HISTORY_LIMIT);
    
    // Générer le HTML pour chaque manga
    const historyHTML = recentlyRead.map(item => {
        const manga = allMangas.find(m => m.slug === item.mangaSlug);
        if (!manga) return '';
        
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
    
    continueReadingList.innerHTML = historyHTML;
    
    // Ajouter les écouteurs d'événements pour les cartes
    continueReadingList.querySelectorAll('.manga-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            if (slug) {
                const progress = readingHistory.find(h => h.mangaSlug === slug);
                if (progress) {
                    window.location.href = `reader.html?slug=${slug}&chapter=${progress.chapter}`;
                }
            }
        });
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
    
    // Vérifier l'état du serveur
    await checkServerStatus();
    
    // Vérifier périodiquement l'état du serveur (toutes les 30 secondes)
    setInterval(checkServerStatus, 30000);
    
    // Charger le profil utilisateur
    await loadUserProfile();
    
    // Charger la liste des mangas et l'historique
    await loadMangaList();
    if (isLoggedIn()) {
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
});

// Ajouter les styles pour la recherche
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
`;

document.head.appendChild(style);

// Fonction pour sauvegarder la progression de lecture
async function saveReadingProgress(mangaSlug, chapter, currentPage, totalPages) {
    try {
        const response = await fetchApi('/users/reading-progress', 'POST', {
            mangaSlug,
            chapter,
            currentPage,
            totalPages
        });
        console.log('✅ Progression sauvegardée:', response);
        return response;
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde de la progression:', error);
        throw error;
    }
}

// Gestion de l'historique
const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const showAllHistoryBtn = document.getElementById('showAllHistoryBtn');

// Fonction pour afficher l'historique complet
async function showFullHistory() {
    const historyModal = document.getElementById('historyModal');
    if (!historyModal) return;
    
    historyModal.style.display = 'block';
    await loadHistoryInModal();
}

// Fonction pour charger l'historique dans la modale
async function loadHistoryInModal() {
    try {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        historyList.innerHTML = '<div class="loading-spinner"></div>';
        
        // Charger l'historique depuis l'API
        const history = await fetchApi('/users/mangas/reading-progress');
        if (!Array.isArray(history)) {
            throw new Error('Format de données invalide');
        }

        // Trier l'historique par date de lecture (le plus récent en premier)
        const sortedHistory = history.sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead));
        
        if (sortedHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">Aucun historique de lecture disponible</div>';
        return;
    }
    
        historyList.innerHTML = '';
        
        for (const item of sortedHistory) {
            // Trouver les informations du manga correspondant
            const manga = allMangas.find(m => m.slug === item.mangaSlug);
            if (!manga) continue;

            const progress = Math.round((item.currentPage / item.totalPages) * 100) || 0;
            const lastRead = new Date(item.lastRead).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-cover" style="background-image: url('${manga.cover || ''}')">
                    ${!manga.cover ? `<div class="manga-letter">${manga.title.charAt(0).toUpperCase()}</div>` : ''}
                    <div class="reading-progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
                </div>
                <div class="history-info">
                    <h3>${manga.title}</h3>
                    <p>Chapitre ${item.chapter}</p>
                    <p class="progress-text">${progress}% lu</p>
                    <p class="last-read">Lu le ${lastRead}</p>
                </div>
                <div class="history-actions">
                    <button class="resume-reading" data-slug="${manga.slug}" data-chapter="${item.chapter}">
                        Reprendre la lecture
                    </button>
                    <button class="delete-history" data-slug="${manga.slug}" data-chapter="${item.chapter}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Supprimer
                    </button>
            </div>
        `;
        
            // Ajouter un gestionnaire de clic pour la reprise de lecture
            const resumeButton = historyItem.querySelector('.resume-reading');
            if (resumeButton) {
                resumeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const slug = e.target.dataset.slug;
                    const chapter = e.target.dataset.chapter;
                    window.location.href = `reader.html?slug=${slug}&chapter=${chapter}`;
                });
            }

            // Ajouter un gestionnaire de clic pour la suppression
            const deleteButton = historyItem.querySelector('.delete-history');
            if (deleteButton) {
                deleteButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const slug = e.target.closest('.delete-history').dataset.slug;
                    
                    // Afficher notre propre boîte de confirmation personnalisée
                    const confirmDialog = document.createElement('div');
                    confirmDialog.className = 'confirm-dialog';
                    confirmDialog.innerHTML = `
                        <div class="confirm-dialog-content">
                            <h3>Confirmation de suppression</h3>
                            <p>Êtes-vous sûr de vouloir supprimer cet élément de votre historique ?</p>
                            <div class="confirm-dialog-buttons">
                                <button class="btn-cancel">Annuler</button>
                                <button class="btn-confirm">Supprimer</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(confirmDialog);

                    // Gérer la confirmation
                    const handleConfirm = async (confirmed) => {
                        confirmDialog.remove();
                        if (confirmed) {
                            try {
                                console.log('Tentative de suppression pour le slug:', slug);
                                // Supprimer de la base de données avec le bon endpoint
                                await fetchApi(`/users/mangas/reading-progress/${slug}`, 'DELETE');
                                console.log('Suppression réussie');

                                // Recharger l'historique
                                await loadHistoryInModal();
                                // Mettre à jour l'affichage de "Reprendre la lecture"
                                await loadReadingHistory();
                                await displayContinueReading();
                                
                                showAlert('Élément supprimé avec succès', 'success');
                            } catch (error) {
                                console.error('Erreur lors de la suppression:', error);
                                showAlert('Une erreur est survenue lors de la suppression', 'error');
                            }
                        }
                    };

                    // Ajouter les écouteurs d'événements pour les boutons
                    confirmDialog.querySelector('.btn-cancel').addEventListener('click', () => handleConfirm(false));
                    confirmDialog.querySelector('.btn-confirm').addEventListener('click', () => handleConfirm(true));
                    
                    // Fermer si on clique en dehors
                    confirmDialog.addEventListener('click', (e) => {
                        if (e.target === confirmDialog) {
                            handleConfirm(false);
                        }
                    });
                });
            }

            historyList.appendChild(historyItem);
        }
    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.innerHTML = '<div class="error-message">Une erreur est survenue lors du chargement de l\'historique</div>';
        }
    }
}

// Fermer la modale si on clique en dehors
window.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.style.display = 'none';
    }
}); 