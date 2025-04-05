// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = null;

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans renderer.js');
  
  // Récupérer l'ipcRenderer de manière sécurisée
  if (window.electron.ipcRenderer) {
    ipcRenderer = window.electron.ipcRenderer;
  }
  
  // Récupérer l'URL de l'API depuis les variables d'environnement
  if (window.electron.getApiUrl) {
    apiUrl = window.electron.getApiUrl();
    console.log('API URL récupérée:', apiUrl);
  } else if (window.electron.env && window.electron.env.apiUrl) {
    apiUrl = window.electron.env.apiUrl;
    console.log('API URL récupérée depuis env:', apiUrl);
  }
} else {
  console.warn('window.electron n\'est pas disponible, les fonctionnalités de navigation natives ne seront pas accessibles');
  // Ne pas mettre d'URL par défaut ici, ce qui forcera une erreur si window.electron n'est pas disponible
}

// Configuration pour les requêtes API
const headers = {
  'Content-Type': 'application/json'
};

// Éléments DOM
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const registerLink = document.getElementById('registerLink');
const resetPasswordLink = document.getElementById('resetPasswordLink');
const alertContainer = document.getElementById('alertContainer');

// Fonction pour échapper les caractères spéciaux HTML
function sanitizeHTML(text) {
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent;
}

// Fonction pour afficher les alertes
function showAlert(message, type) {
  // Sanitizer le message avant de l'afficher
  const sanitizedMessage = sanitizeHTML(message);
  alertContainer.textContent = sanitizedMessage;
  alertContainer.className = `alert alert-${type}`;
  alertContainer.classList.remove('hidden');
  
  // Scroll vers le haut pour voir l'alerte
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Masquer l'alerte après 5 secondes
  setTimeout(() => {
    alertContainer.classList.add('hidden');
  }, 5000);
}

// Fonction pour vérifier si le serveur est disponible
async function checkServerAvailability() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiUrl}/health`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('Serveur disponible ✅');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erreur de connexion au serveur:', error);
    showAlert('Impossible de se connecter au serveur. Veuillez vérifier que le serveur est lancé.', 'danger');
    return false;
  }
}

// Fonction pour faire des requêtes API avec fetch
async function fetchApi(endpoint, method = 'GET', data = null, timeout = 10000) {
  // Vérifier d'abord si le serveur est disponible
  const serverAvailable = await checkServerAvailability();
  if (!serverAvailable) {
    throw new Error('Le serveur est actuellement indisponible');
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const options = {
      method,
      headers: { ...headers },
      signal: controller.signal
    };
    
    // Si on a un token, l'ajouter aux headers
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
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

// Fonction pour vérifier si l'utilisateur est déjà connecté
async function checkAutoLogin() {
  try {
    // Vérifier si on a un token stocké
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
    if (!token) {
      console.log('Aucun token trouvé pour l\'auto-connexion');
      return false;
    }
    
    // Si le token est dans localStorage mais pas dans sessionStorage, le copier dans sessionStorage
    // Cela arrive notamment au démarrage de l'application quand sessionStorage est vide
    if (localStorage.getItem('userToken') && !sessionStorage.getItem('userToken')) {
      console.log('Token trouvé dans localStorage, copie dans sessionStorage pour la session actuelle');
      sessionStorage.setItem('userToken', localStorage.getItem('userToken'));
    }
    
    try {
      console.log('Récupération des informations utilisateur depuis le serveur...');
      const data = await fetchApi('/users/profile', 'GET');
      
      console.log('Informations utilisateur récupérées avec succès:', data.username);
      
      // Mettre à jour systématiquement les données utilisateur à partir du serveur
      // en écrasant toute donnée antérieure en cache
      localStorage.setItem('user', JSON.stringify({
        id: data._id,
        username: data.username,
        email: data.email
      }));
      
      // Mettre à jour également les anciennes clés pour la compatibilité
      localStorage.setItem('userName', data.username);
      localStorage.setItem('userEmail', data.email);
      
      console.log('Auto-connexion réussie pour', data.username);
      showAlert(`Reconnexion automatique en cours...`, 'success');
      
      // Rediriger vers la page principale
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1000);
      
      return true;
    } catch (error) {
      if (error.status === 401) {
        console.warn('Token invalide ou expiré, suppression des données de session');
        sessionStorage.removeItem('userToken');
        localStorage.removeItem('userToken'); // Pour s'assurer que les deux sont supprimés
        localStorage.removeItem('user');
        localStorage.removeItem('userName'); // Supprimer aussi les anciennes clés
        localStorage.removeItem('userEmail');
        localStorage.removeItem('autoLogin');
        showAlert('Session expirée. Veuillez vous reconnecter.', 'danger');
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error('Erreur générale lors de l\'auto-connexion:', error);
    
    if (error.code === 'ECONNABORTED') {
      showAlert('Le serveur met trop de temps à répondre. Veuillez réessayer.', 'warning');
    } else {
      showAlert('Erreur de connexion au serveur. Veuillez réessayer.', 'warning');
    }
    
    return false;
  }
}

// Fonction de connexion
async function handleLogin() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  // Validation des champs
  if (!username || !password) {
    showAlert('Veuillez remplir tous les champs', 'danger');
    return;
  }
  
  // Validation plus stricte du mot de passe (au moins 8 caractères)
  if (password.length < 8) {
    showAlert('Le mot de passe doit contenir au moins 8 caractères', 'danger');
    return;
  }
  
  try {
    // Désactiver le bouton pendant la connexion
    loginButton.textContent = 'Connexion en cours...';
    loginButton.disabled = true;
    
    console.log(`Tentative de connexion pour l'utilisateur: ${username}`);
    
    // Envoyer la requête de connexion via fetchApi
    const data = await fetchApi('/users/login', 'POST', { 
      login: username,
      password 
    });
    
    if (data.token) {
      // Sauvegarder le token à la fois dans sessionStorage (pour la sécurité) et localStorage (pour l'auto-login)
      sessionStorage.setItem('userToken', data.token);
      localStorage.setItem('userToken', data.token); // Conserver dans localStorage pour l'auto-login
      
      // Garder uniquement les informations non-sensibles dans localStorage
      localStorage.setItem('user', JSON.stringify({
        id: data._id,
        username: data.username,
        email: data.email
      }));
      localStorage.setItem('autoLogin', 'true');
      
      // Mettre à jour également les anciennes clés pour la compatibilité
      localStorage.setItem('userName', data.username);
      localStorage.setItem('userEmail', data.email);
      
      // Notifier le processus principal si possible
      if (ipcRenderer) {
        ipcRenderer.send('login-success', {
          username: data.username,
          email: data.email
        });
      }
      
      showAlert('Connexion réussie ! Redirection...', 'success');
      
      // Rediriger vers la page principale
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1000);
    } else {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }
  } catch (error) {
    console.error('Erreur de connexion:', error);
    showAlert(error.message || 'Erreur lors de la connexion. Veuillez réessayer.', 'danger');
  } finally {
    // Réactiver le bouton
    loginButton.textContent = 'Se connecter';
    loginButton.disabled = false;
  }
}

// Vérifier la disponibilité du serveur au chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
  // Vérifier d'abord la disponibilité du serveur
  const serverAvailable = await checkServerAvailability();
  
  if (serverAvailable) {
    // Vérifier s'il y a un token stocké pour l'auto-login
    const autoLoginEnabled = localStorage.getItem('autoLogin') === 'true';
    if (autoLoginEnabled) {
      await checkAutoLogin();
    }
  }
});

// Fonction pour aller à la page d'inscription
function goToRegister() {
  if (ipcRenderer && ipcRenderer.navigateTo) {
    ipcRenderer.navigateTo('register.html');
  } else {
    window.location.href = 'register.html';
  }
}

// Fonction pour aller à la page de réinitialisation du mot de passe
function goToResetPassword() {
  if (ipcRenderer && ipcRenderer.navigateTo) {
    ipcRenderer.navigateTo('reset-password.html');
  } else {
    window.location.href = 'reset-password.html';
  }
}

// Ajout des écouteurs d'événements
loginButton.addEventListener('click', handleLogin);
registerLink.addEventListener('click', goToRegister);
resetPasswordLink.addEventListener('click', goToResetPassword);

// Permettre l'utilisation de la touche Entrée pour se connecter
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') passwordInput.focus();
});

// Gestionnaires d'événements pour les contrôles de la fenêtre
document.getElementById('minimize-button').addEventListener('click', () => {
    window.electron.windowControls.minimize();
});

document.getElementById('maximize-button').addEventListener('click', () => {
    window.electron.windowControls.maximize();
});

document.getElementById('close-button').addEventListener('click', () => {
    window.electron.windowControls.close();
});

// Mettre à jour l'état de maximisation
window.electron.onMaximizeChange((isMaximized) => {
    document.body.classList.toggle('maximized', isMaximized);
}); 