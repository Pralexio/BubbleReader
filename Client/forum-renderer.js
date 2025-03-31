// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = 'http://bubblereader.zapto.org:5000/api';

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans forum-renderer.js');
  
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
const logoHome = document.getElementById('logoHome');
const libraryButton = document.getElementById('libraryButton');
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutButton = document.getElementById('logoutButton');
const alertContainer = document.getElementById('alertContainer');
const newTopicButton = document.getElementById('newTopicButton');
const categoryCards = document.querySelectorAll('.category-card');
const serverIndicator = document.getElementById('serverIndicator');
const serverStatusText = document.getElementById('serverStatusText');

// Fonction pour afficher les alertes
function showAlert(message, type) {
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type}`;
  alertContainer.classList.remove('hidden');
  
  // Scroll vers le haut pour voir l'alerte
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Masquer l'alerte après 5 secondes
  setTimeout(() => {
    alertContainer.classList.add('hidden');
  }, 5000);
}

// Fonction pour mettre à jour l'indicateur d'état du serveur
function updateServerIndicator(status) {
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
  // Indiquer que nous essayons de nous connecter
  updateServerIndicator('connecting');
  
  try {
    console.log('Vérification de la disponibilité du serveur à:', `${apiUrl}/health`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiUrl}/health`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('Serveur disponible ✅');
      updateServerIndicator('online');
      await loadUserInfo();
      return true;
    } else {
      console.log('Serveur non disponible, statut:', response.status);
      updateServerIndicator('offline');
      showAlert('Le serveur est actuellement indisponible. Certaines fonctionnalités peuvent être limitées.', 'warning');
      
      // Même si le serveur n'est pas disponible, tentons d'afficher les informations locales
      const username = localStorage.getItem('userName');
      if (username) {
        usernameDisplay.textContent = username;
      } else {
        // Si pas d'informations locales, rediriger vers la connexion
        goToLogin();
      }
      
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du serveur:', error);
    updateServerIndicator('offline');
    showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'warning');
    
    // Même en cas d'erreur, tentons d'afficher les informations locales
    const username = localStorage.getItem('userName');
    if (username) {
      usernameDisplay.textContent = username;
    } else {
      // Si pas d'informations locales, rediriger vers la connexion
      goToLogin();
    }
    
    return false;
  }
}

// Fonction pour charger les informations de l'utilisateur connecté
async function loadUserInfo() {
  const token = localStorage.getItem('userToken');
  const username = localStorage.getItem('userName');
  
  if (!token || !username) {
    console.warn('Aucun token ou nom d\'utilisateur trouvé dans localStorage. Redirection vers la page de connexion.');
    goToLogin();
    return;
  }
  
  // Afficher le nom d'utilisateur immédiatement pour une meilleure expérience utilisateur
  usernameDisplay.textContent = username;
  
  // Vérifier la validité du token auprès du serveur
  try {
    console.log('Vérification de la validité du token...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${apiUrl}/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === 401) {
      console.warn('Token expiré ou invalide. Redirection vers la page de connexion.');
      showAlert('Votre session a expiré. Veuillez vous reconnecter.', 'warning');
      
      // On garde userName et userEmail pour faciliter la reconnexion
      localStorage.removeItem('userToken');
      localStorage.removeItem('autoLogin');
      
      setTimeout(goToLogin, 2000);
      return;
    }
    
    if (!response.ok) {
      console.warn(`Erreur ${response.status} lors de la vérification du profil.`);
      showAlert('Problème de connexion au serveur. Certaines fonctionnalités pourraient être limitées.', 'warning');
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Profil utilisateur vérifié avec succès:', data.user.username);
      usernameDisplay.textContent = data.user.username;
      
      // Mettre à jour les données en cache
      localStorage.setItem('userName', data.user.username);
      localStorage.setItem('userEmail', data.user.email);
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du profil:', error);
    showAlert('Problème de connexion au serveur. Mode hors ligne activé.', 'warning');
  }
}

// Fonction pour aller à la page principale (bibliothèque)
function goToLibrary() {
  if (ipcRenderer && ipcRenderer.navigateTo) {
    ipcRenderer.navigateTo('main.html');
  } else {
    window.location.href = 'main.html';
  }
}

// Fonction pour aller à la page de connexion
function goToLogin() {
  if (ipcRenderer && ipcRenderer.navigateTo) {
    ipcRenderer.navigateTo('index.html');
  } else {
    window.location.href = 'index.html';
  }
}

// Fonction de déconnexion
function logout() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('autoLogin');
  
  if (ipcRenderer && ipcRenderer.send) {
    ipcRenderer.send('logout');
  }
  
  goToLogin();
}

// Fonction pour simuler l'ouverture d'un nouveau sujet
function openNewTopic() {
  showAlert('La création de nouveaux sujets sera disponible dans une prochaine mise à jour.', 'info');
}

// Fonction pour simuler l'ouverture d'une catégorie
function openCategory(categoryTitle) {
  showAlert(`La catégorie "${categoryTitle}" sera disponible dans une prochaine mise à jour.`, 'info');
}

// Ajouter des écouteurs d'événements
logoHome.addEventListener('click', goToLibrary);
libraryButton.addEventListener('click', goToLibrary);
logoutButton.addEventListener('click', logout);
newTopicButton.addEventListener('click', openNewTopic);

// Ajouter des écouteurs d'événements pour les cartes de catégorie
categoryCards.forEach(card => {
  card.addEventListener('click', () => {
    const categoryTitle = card.querySelector('.category-title').textContent;
    openCategory(categoryTitle);
  });
});

// Vérifier la disponibilité du serveur au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  // Faire une première vérification
  checkServerAvailability();
  
  // Vérifier périodiquement l'état du serveur (toutes les 30 secondes)
  setInterval(checkServerAvailability, 30000);
}); 