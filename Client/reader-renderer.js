// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = 'http://bubblereader.zapto.org:5000/api';

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans reader-renderer.js');
  
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

// Éléments DOM
const mangaTitle = document.getElementById('mangaTitle');
const chapterNumber = document.getElementById('chapterNumber');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const mangaImageContainer = document.getElementById('mangaImageContainer');
const readerContainer = document.getElementById('readerContainer');
const navigationControls = document.getElementById('navigationControls');
const prevChapterBtn = document.getElementById('prevChapterBtn');
const nextChapterBtn = document.getElementById('nextChapterBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const addToLibraryBtn = document.getElementById('addToLibraryBtn');
const settingsBtn = document.getElementById('settingsBtn');
const alertEl = document.getElementById('alert');

// Éléments DOM pour les paramètres
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const readingDirectionSwitch = document.getElementById('readingDirectionSwitch');
const pageTransitionRadios = document.querySelectorAll('input[name="pageTransition"]');
const pageSizeRadios = document.querySelectorAll('input[name="pageSize"]');

// Variables globales
let currentSlug = '';
let currentChapter = 0;
let currentPage = 0;
let totalPages = 0;
let mangaImages = [];
let chapterData = null;
let userSettings = {
  readingDirection: 'vertical', // vertical (manhwa), ltr (manga gauche à droite), rtl (manga droite à gauche)
  pageTransition: 'fade',      // fade, slide, none
  pageSize: 'fit-width'        // fit-width, fit-height, full
};

// Variables pour le suivi de la progression
let saveProgressTimeout = null;
let lastSavedPage = 0;
let lastSavedChapter = 0;
let isProgressSaving = false;
let localProgressInterval = null;
let serverSyncInterval = null;
let lastProgress = null;

// Variables pour le profil
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const readingHistory = document.getElementById('readingHistory');

// Fonction pour afficher les alertes
function showAlert(message, type = 'info') {
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.classList.add('visible');
  
  // Masquer l'alerte après 3 secondes
  setTimeout(() => {
    alertEl.classList.remove('visible');
  }, 3000);
}

// Fonction pour extraire les paramètres de l'URL
function getUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || '';
  const chapter = parseInt(params.get('chapter')) || 0;
  
  console.log('Paramètres URL reçus:', { slug, chapter });
  
  return { slug, chapter };
}

// Fonction pour mettre à jour l'URL sans recharger la page
function updateUrlParameters(slug, chapter) {
  const url = new URL(window.location.href);
  url.searchParams.set('slug', slug);
  url.searchParams.set('chapter', chapter);
  window.history.pushState({}, '', url);
}

// Fonction pour faire des requêtes API avec fetch
async function fetchApi(endpoint, method = 'GET', data = null, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    };
    
    // Ajouter le token d'authentification si disponible
    const token = localStorage.getItem('userToken');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const fullUrl = endpoint.startsWith('http') ? endpoint : apiUrl + endpoint;
    console.log(`Envoi d'une requête à: ${fullUrl}`);
    const response = await fetch(fullUrl, options);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw { 
        status: response.status,
        message: errorData.message || 'Erreur serveur',
        response: errorData
      };
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      error.code = 'ECONNABORTED';
      error.message = 'La requête a été interrompue (timeout)';
    }
    
    throw error;
  }
}

// Fonction pour charger les données du chapitre
async function loadChapter(slug, chapter) {
    try {
        // Afficher le spinner de chargement
        loadingSpinner.style.display = 'block';
        errorMessage.style.display = 'none';
        mangaImageContainer.innerHTML = '';
        
        // Vérifier d'abord si le chapitre existe
        const existsResponse = await fetchApi(`/mangas/${slug}/chapter/${chapter}/exists`);
        if (!existsResponse.exists) {
            throw new Error('Ce chapitre n\'existe pas.');
        }
        
        // Mettre à jour les variables globales
        currentSlug = slug;
        currentChapter = parseInt(chapter);
        
        // Mettre à jour l'URL
        updateUrlParameters(slug, chapter);
        
        console.log(`Chargement du chapitre ${chapter} de ${slug}`);
        
        // Récupérer les données du manga depuis l'API
        const response = await fetchApi(`/mangas/${slug}/chapter/${chapter}`);
        
        if (!response.success || !response.data) {
            throw new Error(response.message || 'Erreur lors du chargement du chapitre');
        }
        
        chapterData = response.data;
        console.log('Données du manga reçues:', chapterData);

        if (!chapterData.manga.chapterUrlPattern) {
            throw new Error('URL pattern non trouvé pour ce manga');
        }

        // Construire l'URL du chapitre
        const chapterUrl = chapterData.manga.chapterUrlPattern.replace('{chapter}', chapter);
        console.log('URL du chapitre:', chapterUrl);
        
        try {
            // Récupérer la page du chapitre
            const pageResponse = await fetch(chapterUrl);
            if (!pageResponse.ok) {
                throw new Error('Impossible de charger le chapitre');
            }
            
            const html = await pageResponse.text();
            
            // Créer un parser DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Récupérer toutes les images avec la classe chapter-img
            const images = Array.from(doc.querySelectorAll('.chapter-img'));
            
            if (images.length === 0) {
                // Si aucune image n'est trouvée, essayer une autre approche
                const allImages = Array.from(doc.querySelectorAll('img[src*="phenix-scans.com/uploads"]'));
                if (allImages.length > 0) {
                    images.push(...allImages);
                } else {
                    throw new Error('Aucune image trouvée dans ce chapitre');
                }
            }

            console.log('Images trouvées:', images.map(img => img.src));

            // Créer le tableau des images
            mangaImages = images.map((img, index) => ({
                url: img.src,
                index: index
            }));
            
            totalPages = mangaImages.length;
            console.log(`${totalPages} images trouvées pour le chapitre ${chapter} de ${slug}`);
            
            // Mettre à jour les informations d'en-tête
            mangaTitle.textContent = chapterData.manga.title || 'Manga';
            chapterNumber.textContent = `Chapitre ${chapter}`;
            
            // Charger la première page ou toutes les pages selon le mode de lecture
            if (userSettings.readingDirection === 'vertical') {
                loadAllPages();
            } else {
                loadPage(0);
            }
            
            // Masquer le spinner de chargement
            loadingSpinner.style.display = 'none';
            
            // Mettre à jour les contrôles de navigation
            updateNavigationControls();
            
            // Démarrer le suivi de la progression
            startProgressTracking();
            
        } catch (error) {
            console.error('Erreur lors du chargement des images:', error);
            throw new Error('Impossible de charger les images du chapitre');
        }
    } catch (error) {
        console.error('Erreur lors du chargement du chapitre:', error);
        loadingSpinner.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message || 'Erreur lors du chargement du chapitre';
        
        // Si c'est une erreur de chapitre inexistant, revenir au chapitre précédent
        if (error.message === 'Ce chapitre n\'existe pas.' && currentChapter > 1) {
            showAlert('Dernier chapitre atteint, retour au chapitre précédent', 'info');
            setTimeout(() => {
                loadChapter(currentSlug, currentChapter - 1);
            }, 2000);
        }
    }
}

// Fonction pour charger une page spécifique
async function loadPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= totalPages) {
    console.warn(`Index de page invalide: ${pageIndex}`);
    return;
  }
  
  // Mettre à jour la page courante
  currentPage = pageIndex;
  
  // Si nous sommes en mode vertical, charger toutes les pages
  if (userSettings.readingDirection === 'vertical') {
    loadAllPages();
    return;
  }
  
  // Nettoyer le conteneur d'images
  mangaImageContainer.innerHTML = '';
  
  // Créer et ajouter l'élément d'image
  const imageData = mangaImages[pageIndex];
  const img = document.createElement('img');
  img.className = 'manga-image';
  img.src = imageData.url;
  img.alt = `Page ${pageIndex + 1}`;
  img.loading = 'eager';
  
  // Gérer le chargement
  img.onload = () => {
    console.log(`Image ${pageIndex + 1} chargée avec succès`);
  };
  
  img.onerror = () => {
    console.error(`Erreur lors du chargement de l'image ${pageIndex + 1}`);
    // Si c'est la première image qui échoue, on considère que le chapitre n'existe pas
    if (pageIndex === 0) {
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Aucune page trouvée pour ce chapitre';
      mangaImageContainer.innerHTML = '';
      return;
    }
    // Si une image suivante échoue, on met à jour le nombre total de pages
    totalPages = pageIndex;
    updateNavigationControls();
  };
  
  // Ajouter un numéro de page
  const pageNumber = document.createElement('div');
  pageNumber.className = 'page-number';
  pageNumber.textContent = pageIndex + 1;
  
  // Créer un conteneur pour l'image et son numéro
  const imageContainer = document.createElement('div');
  imageContainer.className = 'single-page-container';
  imageContainer.appendChild(img);
  imageContainer.appendChild(pageNumber);
  
  // Ajouter au conteneur principal
  mangaImageContainer.appendChild(imageContainer);
  
  // Défiler vers le haut
  readerContainer.scrollTop = 0;
  
  // Mettre à jour l'information de page
  pageInfo.textContent = `${pageIndex + 1} / ${totalPages}`;
  
  // Mettre à jour les contrôles de navigation
  updateNavigationControls();
  
  // Précharger les pages adjacentes
  preloadAdjacentPages(pageIndex);
  
  // Sauvegarder la progression de lecture
  await saveReadingProgress(currentSlug, currentChapter, pageIndex + 1, totalPages);
}

// Fonction pour précharger les pages adjacentes
function preloadAdjacentPages(currentIndex) {
  // Précharger la page suivante si elle existe
  if (currentIndex + 1 < totalPages) {
    const nextImg = new Image();
    nextImg.src = mangaImages[currentIndex + 1].url;
  }
  
  // Précharger la page précédente si elle existe
  if (currentIndex - 1 >= 0) {
    const prevImg = new Image();
    prevImg.src = mangaImages[currentIndex - 1].url;
  }
}

// Fonction pour mettre à jour les contrôles de navigation
function updateNavigationControls() {
  // Activer/désactiver les boutons de navigation de page
  prevPageBtn.disabled = currentPage <= 0;
  nextPageBtn.disabled = currentPage >= totalPages - 1;
  
  // Pour les boutons de chapitre, ils sont toujours actifs pour l'instant
  // Dans une version plus avancée, nous pourrions vérifier si les chapitres existent
  prevChapterBtn.disabled = currentChapter <= 1;
  nextChapterBtn.disabled = false;
}

// Fonction pour naviguer vers la page précédente
function goToPreviousPage() {
  if (currentPage > 0) {
    loadPage(currentPage - 1);
  }
}

// Fonction pour naviguer vers la page suivante
function goToNextPage() {
  if (currentPage < totalPages - 1) {
    loadPage(currentPage + 1);
  } else {
    // Si c'est la dernière page, proposer de passer au chapitre suivant
    showAlert('C\'est la dernière page. Voulez-vous passer au chapitre suivant?', 'info');
  }
}

// Fonction pour naviguer vers le chapitre précédent
function goToPreviousChapter() {
  if (currentChapter > 1) {
    loadChapter(currentSlug, currentChapter - 1);
  } else {
    showAlert('C\'est le premier chapitre.', 'info');
  }
}

// Fonction pour naviguer vers le chapitre suivant
async function goToNextChapter() {
  try {
    // Vérifier si le chapitre suivant existe
    const response = await fetchApi(`/mangas/${currentSlug}/chapter/${currentChapter + 1}/exists`);
    if (response && response.exists) {
      loadChapter(currentSlug, currentChapter + 1);
    } else {
      showAlert('C\'est le dernier chapitre disponible.', 'info');
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du chapitre suivant:', error);
    showAlert('Impossible de charger le chapitre suivant.', 'error');
  }
}

// Fonction pour ajouter le manga à la bibliothèque
async function addToLibrary() {
  try {
    if (!currentSlug) {
      showAlert('Aucun manga sélectionné', 'warning');
      return;
    }
    
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('userToken');
    if (!token) {
      showAlert('Vous devez être connecté pour ajouter un manga à votre bibliothèque', 'warning');
      return;
    }
    
    // Faire la requête API pour ajouter à la bibliothèque
    const response = await fetchApi('/mangas/library', 'POST', {
      mangaId: currentSlug,
      currentChapter: currentChapter
    });
    
    if (response.success) {
      showAlert('Manga ajouté à votre bibliothèque', 'success');
    } else {
      showAlert(response.message || 'Erreur lors de l\'ajout à la bibliothèque', 'danger');
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout à la bibliothèque:', error);
    showAlert('Erreur lors de l\'ajout à la bibliothèque', 'danger');
  }
}

// Fonction pour ouvrir le panneau des paramètres
function openSettings() {
  settingsModal.classList.add('active');
  
  // Mettre à jour l'UI avec les paramètres actuels
  updateSettingsUI();
}

// Fonction pour fermer le panneau des paramètres
function closeSettings() {
  settingsModal.classList.remove('active');
}

// Fonction pour mettre à jour l'UI des paramètres
function updateSettingsUI() {
  // Mettre à jour le switch de direction de lecture
  readingDirectionSwitch.checked = userSettings.readingDirection === 'vertical';
  
  // Mettre à jour les radios de transition de page
  pageTransitionRadios.forEach(radio => {
    radio.checked = radio.value === userSettings.pageTransition;
  });
  
  // Mettre à jour les radios de taille de page
  pageSizeRadios.forEach(radio => {
    radio.checked = radio.value === userSettings.pageSize;
  });
}

// Fonction pour sauvegarder les paramètres
function saveSettings() {
  // Récupérer la direction de lecture
  userSettings.readingDirection = readingDirectionSwitch.checked ? 'vertical' : 'rtl';
  
  // Récupérer la transition de page
  pageTransitionRadios.forEach(radio => {
    if (radio.checked) {
      userSettings.pageTransition = radio.value;
    }
  });
  
  // Récupérer la taille de page
  pageSizeRadios.forEach(radio => {
    if (radio.checked) {
      userSettings.pageSize = radio.value;
    }
  });
  
  // Sauvegarder les paramètres dans le localStorage
  localStorage.setItem('readerSettings', JSON.stringify(userSettings));
  
  // Appliquer les changements
  applySettings();
  
  // Fermer la modale
  closeSettings();
  
  // Afficher un message de confirmation
  showAlert('Paramètres enregistrés', 'success');
}

// Fonction pour appliquer les paramètres
function applySettings() {
  // Appliquer la direction de lecture
  if (userSettings.readingDirection === 'vertical') {
    // Mode vertical (manhwa)
    readerContainer.classList.remove('horizontal-mode');
    readerContainer.classList.add('vertical-mode');
    
    // Afficher toutes les images en même temps si on est en mode vertical
    loadAllPages();
  } else {
    // Mode horizontal (manga)
    readerContainer.classList.remove('vertical-mode');
    readerContainer.classList.add('horizontal-mode');
    
    // En mode horizontal, on n'affiche qu'une seule page à la fois
    loadPage(currentPage);
  }
  
  // Appliquer la taille de page
  mangaImageContainer.className = `manga-image-container ${userSettings.pageSize}`;
  
  // Appliquer les transitions de page
  document.querySelectorAll('.manga-image').forEach(img => {
    img.style.transition = userSettings.pageTransition === 'none' 
      ? 'none' 
      : `all 0.3s ${userSettings.pageTransition}`;
  });
}

// Fonction pour charger toutes les pages (mode vertical)
function loadAllPages() {
  if (mangaImages.length === 0) return;
  
  // Nettoyer le conteneur
  mangaImageContainer.innerHTML = '';
  
  let lastValidPage = -1;
  
  // Ajouter toutes les images
  mangaImages.forEach((imageData, index) => {
    const img = document.createElement('img');
    img.className = 'manga-image';
    img.src = imageData.url;
    img.alt = `Page ${index + 1}`;
    img.loading = index < 3 ? 'eager' : 'lazy';
    
    // Gérer le chargement
    img.onload = () => {
      console.log(`Image ${index + 1} chargée`);
      lastValidPage = index;
    };
    
    img.onerror = () => {
      console.error(`Erreur lors du chargement de l'image ${index + 1}`);
      img.remove();
      // Si aucune image n'a été chargée
      if (lastValidPage === -1 && index === 0) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Aucune page trouvée pour ce chapitre';
        mangaImageContainer.innerHTML = '';
      }
      // Mettre à jour le nombre total de pages
      totalPages = lastValidPage + 1;
      updateNavigationControls();
    };
    
    // Ajouter un numéro de page
    const pageNumber = document.createElement('div');
    pageNumber.className = 'page-number';
    pageNumber.textContent = index + 1;
    
    // Créer un conteneur pour l'image et son numéro
    const imageContainer = document.createElement('div');
    imageContainer.className = 'single-page-container';
    imageContainer.appendChild(img);
    imageContainer.appendChild(pageNumber);
    
    // Ajouter au conteneur principal
    mangaImageContainer.appendChild(imageContainer);
  });
  
  // Mettre à jour l'information de page
  pageInfo.textContent = `1-${totalPages} / ${totalPages}`;
  
  // Mettre à jour les contrôles de navigation
  updateNavigationControls();
}

// Fonction pour sauvegarder localement la progression
function saveProgressLocally(slug, chapter, currentPage, totalPages, progress) {
    const progressData = {
        manga: { slug },
        chapter,
        currentPage,
        totalPages,
        progress,
        lastUpdate: Date.now()
    };
    
    lastProgress = progressData;
    localStorage.setItem('currentReadingProgress', JSON.stringify(progressData));
    console.log('Progression sauvegardée localement:', progressData);
}

// Fonction pour synchroniser avec le serveur
async function syncProgressWithServer() {
    if (!lastProgress || isProgressSaving) return;
    
    try {
        isProgressSaving = true;
        
        const response = await fetchApi('/users/reading-progress', 'POST', lastProgress);
        
        if (response.success) {
            console.log('Progression synchronisée avec le serveur');
            lastSavedPage = lastProgress.currentPage;
            lastSavedChapter = lastProgress.chapter;
        }
    } catch (error) {
        console.error('Erreur lors de la synchronisation avec le serveur:', error);
    } finally {
        isProgressSaving = false;
    }
}

// Fonction pour sauvegarder la progression de lecture
async function saveReadingProgress(slug, chapter, currentPage, totalPages) {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('userToken');
    if (!token) {
        console.log('Utilisateur non connecté, progression sauvegardée uniquement en local');
        saveProgressLocally(slug, chapter, currentPage, totalPages, progress);
        return;
    }
    
    // S'assurer que les valeurs sont valides
    const validatedCurrentPage = Math.max(1, Math.min(Number(currentPage), Number(totalPages)));
    const validatedTotalPages = Math.max(1, Number(totalPages));
    
    // Calculer le pourcentage de progression
    let progress = 0;
    if (userSettings.readingDirection === 'vertical') {
        // En mode vertical, utiliser la position de défilement
        const scrollHeight = readerContainer.scrollHeight - readerContainer.clientHeight;
        const scrollPosition = readerContainer.scrollTop;
        progress = Math.min(Math.max(0, Math.round((scrollPosition / scrollHeight) * 100)), 100);
    } else {
        // En mode horizontal, utiliser le numéro de page
        progress = Math.min(Math.max(0, Math.round((validatedCurrentPage / validatedTotalPages) * 100)), 100);
    }

    try {
        isProgressSaving = true;
        // Envoyer la progression au serveur
        const response = await fetchApi('/users/reading-progress', 'POST', {
            mangaSlug: slug,
            chapter: Number(chapter),
            currentPage: validatedCurrentPage,
            totalPages: validatedTotalPages,
            progress: progress,
            lastRead: new Date().toISOString()
        });

        if (response) {
            console.log('Progression sauvegardée avec succès dans la BDD:', response);
            // Mettre à jour lastProgress avec la réponse du serveur
            lastProgress = response;
            // Sauvegarder localement la dernière progression validée
            saveProgressLocally(slug, chapter, validatedCurrentPage, validatedTotalPages, progress);
            lastSavedPage = validatedCurrentPage;
            lastSavedChapter = Number(chapter);
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la progression sur le serveur:', error);
        // En cas d'erreur, sauvegarder uniquement en local
        saveProgressLocally(slug, chapter, validatedCurrentPage, validatedTotalPages, progress);
    } finally {
        isProgressSaving = false;
    }
}

// Fonction pour démarrer le suivi de la progression
function startProgressTracking() {
    // Arrêter les intervalles existants si présents
    stopProgressTracking();
    
    // Sauvegarder localement toutes les 30 secondes
    localProgressInterval = setInterval(() => {
        if (currentSlug && currentChapter) {
            saveReadingProgress(currentSlug, currentChapter, currentPage, totalPages);
        }
    }, 30000);
    
    // Synchroniser avec le serveur toutes les minutes
    serverSyncInterval = setInterval(() => {
        if (lastProgress) {
            syncProgressWithServer();
        }
    }, 60000);
}

// Fonction pour arrêter le suivi de la progression
function stopProgressTracking() {
    if (localProgressInterval) {
        clearInterval(localProgressInterval);
        localProgressInterval = null;
    }
    if (serverSyncInterval) {
        clearInterval(serverSyncInterval);
        serverSyncInterval = null;
    }
}

// Fonction pour essayer de charger la progression de lecture
async function tryLoadReadingProgress(slug, chapter) {
    const token = localStorage.getItem('userToken');
    let progressData = null;

    try {
        if (token) {
            // Essayer de charger depuis le serveur d'abord
            const response = await fetchApi('/users/mangas/reading-progress');
            
            if (response && Array.isArray(response)) {
                progressData = response.find(p => p.mangaSlug === slug);
                if (progressData) {
                    console.log('Progression chargée depuis la BDD:', progressData);
                    // Mettre à jour le stockage local avec les données du serveur
                    saveProgressLocally(
                        slug,
                        progressData.chapter,
                        progressData.currentPage,
                        progressData.totalPages,
                        progressData.progress
                    );
                }
            }
        }

        // Si pas de données du serveur, essayer le stockage local
        if (!progressData) {
            const localProgress = localStorage.getItem('currentReadingProgress');
            if (localProgress) {
                const parsed = JSON.parse(localProgress);
                if (parsed.manga.slug === slug) {
                    progressData = parsed;
                    console.log('Progression chargée depuis le stockage local:', progressData);
                }
            }
        }

        // Appliquer la progression si trouvée
        if (progressData && progressData.chapter === parseInt(chapter)) {
            currentPage = progressData.currentPage - 1;
            console.log(`Reprise à la page ${currentPage + 1} (${progressData.progress}%)`);
            
            if (userSettings.readingDirection === 'vertical') {
                loadAllPages();
                // Attendre que les images soient chargées avant de défiler
                setTimeout(() => {
                    const scrollPosition = (progressData.progress / 100) * 
                        (readerContainer.scrollHeight - readerContainer.clientHeight);
                    readerContainer.scrollTop = scrollPosition;
                }, 500);
            } else {
                loadPage(currentPage);
            }
            
            lastProgress = progressData;
            lastSavedPage = currentPage;
            lastSavedChapter = parseInt(chapter);
        } else {
            // Aucune progression trouvée ou chapitre différent
            currentPage = 0;
            loadPage(currentPage);
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la progression:', error);
        // En cas d'erreur, essayer de charger depuis le stockage local
        const localProgress = localStorage.getItem('currentReadingProgress');
        if (localProgress) {
            try {
                const parsed = JSON.parse(localProgress);
                if (parsed.manga.slug === slug && parsed.chapter === parseInt(chapter)) {
                    currentPage = parsed.currentPage - 1;
                    loadPage(currentPage);
                    return;
                }
            } catch (e) {
                console.error('Erreur lors du parsing de la progression locale:', e);
            }
        }
        // Si tout échoue, commencer au début
        currentPage = 0;
        loadPage(currentPage);
    }
}

// Fonction pour gérer les raccourcis clavier
function handleKeyDown(e) {
  // Ne pas traiter si une saisie est en cours
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  // Si la modal des paramètres est ouverte, permettre de la fermer avec Échap
  if (settingsModal.classList.contains('active') && e.key === 'Escape') {
    closeSettings();
    return;
  }
  
  switch (e.key) {
    case 'ArrowLeft':
      // Pour les manhwas en mode vertical, gauche/droite servent à la navigation latérale
      if (userSettings.readingDirection === 'vertical') {
        // Ne rien faire ou implémenter une autre fonction
      } else {
        // Pour les mangas, naviguer entre les pages
        if (userSettings.readingDirection === 'rtl') {
          goToNextPage(); // Dans un manga traditionnel, aller à gauche = page suivante
        } else {
          goToPreviousPage(); // Dans un manga occidentalisé, aller à gauche = page précédente
        }
      }
      break;
    case 'ArrowRight':
      if (userSettings.readingDirection === 'vertical') {
        // Ne rien faire ou implémenter une autre fonction
      } else {
        if (userSettings.readingDirection === 'rtl') {
          goToPreviousPage(); // Dans un manga traditionnel, aller à droite = page précédente
        } else {
          goToNextPage(); // Dans un manga occidentalisé, aller à droite = page suivante
        }
      }
      break;
    case 'ArrowUp':
      if (userSettings.readingDirection === 'vertical') {
        // En mode vertical, haut/bas servent à défiler, donc on n'intercepte pas
      } else {
        goToPreviousChapter();
      }
      break;
    case 'ArrowDown':
      if (userSettings.readingDirection === 'vertical') {
        // En mode vertical, haut/bas servent à défiler, donc on n'intercepte pas
      } else {
        goToNextChapter();
      }
      break;
    case ' ':
      // Espace - comportement différent selon le mode de lecture
      if (userSettings.readingDirection === 'vertical') {
        // En mode vertical, espace fait défiler naturellement
      } else {
        // En mode horizontal, espace = page suivante
        goToNextPage();
        e.preventDefault();
      }
      break;
  }
}

// Fonction debounce pour limiter les appels fréquents
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Fonction pour gérer le scroll avec debounce
const handleScroll = debounce(() => {
    if (userSettings.readingDirection === 'vertical' && !isProgressSaving) {
        const scrollHeight = readerContainer.scrollHeight - readerContainer.clientHeight;
        const scrollPosition = readerContainer.scrollTop;
        const progress = Math.min(Math.round((scrollPosition / scrollHeight) * 100), 100);
        
        // Ne sauvegarder que si la progression a changé significativement (plus de 5%)
        const lastProgressValue = lastProgress?.progress || 0;
        if (Math.abs(progress - lastProgressValue) > 5) {
            saveReadingProgress(currentSlug, currentChapter, currentPage, totalPages);
        }
    }
}, 1000); // Attendre 1 seconde d'inactivité avant de sauvegarder

// Fonction d'initialisation
function init() {
  console.log('Initialisation du lecteur...');
  
  // Charger les paramètres depuis le localStorage
  const savedSettings = localStorage.getItem('readerSettings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      userSettings = { ...userSettings, ...parsedSettings };
      console.log('Paramètres chargés:', userSettings);
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
  }
  
  // Appliquer les paramètres initiaux
  applySettings();
  
  // Récupérer les paramètres d'URL
  const params = getUrlParameters();
  console.log('Paramètres d\'URL récupérés dans init():', params);
  
  // Charger le chapitre si les paramètres sont présents
  if (params.slug && params.chapter) {
    console.log('Chargement du chapitre avec les paramètres:', params);
    loadChapter(params.slug, params.chapter);
  } else {
    // Afficher un message d'erreur
    console.error('Paramètres manquants:', params);
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Paramètres manquants: slug et/ou chapitre';
    loadingSpinner.style.display = 'none';
  }
  
  // Ajouter les écouteurs d'événements
  prevPageBtn.addEventListener('click', goToPreviousPage);
  nextPageBtn.addEventListener('click', goToNextPage);
  prevChapterBtn.addEventListener('click', goToPreviousChapter);
  nextChapterBtn.addEventListener('click', goToNextChapter);
  addToLibraryBtn.addEventListener('click', addToLibrary);
  
  // Écouteurs pour les paramètres
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Fermer la modale des paramètres si on clique en dehors
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });
  
  // Ajouter l'écouteur pour les raccourcis clavier
  document.addEventListener('keydown', handleKeyDown);
  
  // Masquer l'alerte au démarrage
  alertEl.classList.remove('visible');
  
  // Ajouter un écouteur pour les événements de défilement en mode vertical
  readerContainer.addEventListener('scroll', handleScroll);

  // Gestionnaires d'événements pour la modal du profil
  profileBtn.addEventListener('click', () => {
    loadReadingHistory();
    profileModal.classList.add('active');
  });

  closeProfileBtn.addEventListener('click', () => {
    profileModal.classList.remove('active');
  });

  // Démarrer le suivi de la progression
  startProgressTracking();
  
  // Ajouter un gestionnaire pour arrêter le suivi quand on quitte la page
  window.addEventListener('beforeunload', () => {
    stopProgressTracking();
    // Synchroniser une dernière fois avec le serveur
    if (lastProgress) {
      syncProgressWithServer();
    }
  });
}

// Initialiser l'application lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', init);

// Fonction pour charger l'historique de lecture
async function loadReadingHistory() {
    try {
        const response = await fetchApi('/users/mangas/reading-progress');
        if (response && Array.isArray(response)) {
            // Trier par date de dernière lecture
            const sortedHistory = response.sort((a, b) => {
                return new Date(b.lastRead) - new Date(a.lastRead);
            });
            
            // Mettre à jour l'interface
            readingHistory.innerHTML = sortedHistory.map(item => `
                <div class="history-item" data-slug="${item.mangaSlug}">
                    <span>Chapitre ${item.chapter}</span>
                    <span>${Math.round(item.progress)}%</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.warn('Erreur lors du chargement de l\'historique:', error);
    }
} 