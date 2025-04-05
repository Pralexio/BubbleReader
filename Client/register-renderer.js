// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = null;

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans register-renderer.js');
  
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
const alertContainer = document.getElementById('alertContainer');
const registerFormContainer = document.getElementById('registerFormContainer');
const successContainer = document.getElementById('successContainer');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const registerButton = document.getElementById('registerButton');
const goToLoginButton = document.getElementById('goToLoginButton');
const uniqueIdDisplay = document.getElementById('uniqueIdDisplay');
const copyUniqueIdButton = document.getElementById('copyUniqueIdButton');
const copyConfirmation = document.getElementById('copyConfirmation');

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
  await checkServerAvailability();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const options = {
      method,
      headers,
      signal: controller.signal
    };
    
    // Si on a un token, l'ajouter aux headers
    const token = sessionStorage.getItem('userToken') || localStorage.getItem('userToken'); // Compatibilité avec ancien code
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

// Fonction de validation du formulaire
function validateForm() {
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Valider le nom d'utilisateur
  if (!username) {
    showAlert('Veuillez entrer un nom d\'utilisateur.', 'danger');
    return false;
  }
  
  if (username.length < 3) {
    showAlert('Le nom d\'utilisateur doit contenir au moins 3 caractères.', 'danger');
    return false;
  }
  
  // Valider l'email
  if (!email) {
    showAlert('Veuillez entrer une adresse email.', 'danger');
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert('Veuillez entrer une adresse email valide.', 'danger');
    return false;
  }
  
  // Valider le mot de passe
  if (!password) {
    showAlert('Veuillez entrer un mot de passe.', 'danger');
    return false;
  }
  
  if (password.length < 8) {
    showAlert('Le mot de passe doit contenir au moins 8 caractères.', 'danger');
    return false;
  }
  
  // Vérification de complexité du mot de passe
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    showAlert('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.', 'danger');
    return false;
  }
  
  // Valider la confirmation du mot de passe
  if (password !== confirmPassword) {
    showAlert('Les mots de passe ne correspondent pas.', 'danger');
    return false;
  }
  
  return true;
}

// Fonction de gestion de l'inscription
async function handleRegister() {
  // Validation du formulaire
  if (!validateForm()) {
    return;
  }
  
  // Désactiver le bouton pendant l'inscription
  registerButton.textContent = 'Inscription en cours...';
  registerButton.disabled = true;
  
  const userData = {
    username: usernameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value
  };
  
  try {
    // Envoi de la requête d'inscription
    const response = await fetchApi('/users/register', 'POST', userData);
    
    if (response.success) {
      // Notifier le processus principal si possible
      if (ipcRenderer) {
        ipcRenderer.send('register-success', {
          username: userData.username,
          email: userData.email
        });
      }
      
      console.log('Réponse du serveur après inscription:', response);
      
      // Afficher l'identifiant unique - avec sanitization
      if (response.uniqueId) {
        const sanitizedUniqueId = sanitizeHTML(response.uniqueId);
        uniqueIdDisplay.textContent = sanitizedUniqueId;
        // Enregistrer temporairement l'ID unique dans sessionStorage au lieu de localStorage
        sessionStorage.setItem('tempUniqueId', sanitizedUniqueId);
      } else {
        console.error('Identifiant unique non trouvé dans la réponse:', response);
        uniqueIdDisplay.textContent = "ERREUR: ID UNIQUE NON GÉNÉRÉ";
      }
      
      // Masquer le formulaire et afficher le message de succès
      registerFormContainer.classList.add('hidden');
      successContainer.classList.remove('hidden');
    } else {
      showAlert(response.message || 'Une erreur est survenue lors de l\'inscription.', 'danger');
    }
  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    
    if (error.status === 400) {
      showAlert(error.message || 'Données invalides. Veuillez vérifier vos informations.', 'danger');
    } else {
      showAlert('Une erreur est survenue lors de l\'inscription. Veuillez réessayer.', 'danger');
    }
  } finally {
    // Réactiver le bouton
    registerButton.textContent = 'Créer mon compte';
    registerButton.disabled = false;
  }
}

// Vérifier la disponibilité du serveur au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  checkServerAvailability();
});

// Fonction pour aller à la page de connexion
function goToLogin() {
  if (ipcRenderer && ipcRenderer.navigateTo) {
    ipcRenderer.navigateTo('index.html');
  } else {
    window.location.href = 'index.html';
  }
}

// Fonction pour copier l'identifiant unique dans le presse-papiers
function copyUniqueIdToClipboard() {
  try {
    const uniqueId = uniqueIdDisplay.textContent;
    
    if (!uniqueId) {
      console.error('Aucun identifiant unique à copier');
      return;
    }
    
    // Utilisation de l'API Clipboard moderne
    navigator.clipboard.writeText(uniqueId)
      .then(() => {
        console.log('Identifiant unique copié dans le presse-papiers');
        showCopyConfirmation();
      })
      .catch(err => {
        console.error('Erreur lors de la copie:', err);
        // Méthode de secours si l'API Clipboard échoue
        fallbackCopyToClipboard(uniqueId);
      });
  } catch (error) {
    console.error('Erreur lors de la copie:', error);
  }
}

// Méthode de secours pour copier dans le presse-papiers
function fallbackCopyToClipboard(text) {
  try {
    // Créer un élément de texte temporaire
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Éviter le défilement
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('Identifiant unique copié (méthode de secours)');
        showCopyConfirmation();
      } else {
        console.error('Échec de la copie (méthode de secours)');
      }
    } catch (err) {
      console.error('Erreur lors de la copie (méthode de secours):', err);
    }
    
    document.body.removeChild(textArea);
  } catch (err) {
    console.error('Erreur lors de la copie (méthode de secours):', err);
  }
}

// Afficher la confirmation de copie
function showCopyConfirmation() {
  copyConfirmation.classList.remove('hidden');
  copyConfirmation.classList.add('visible');
  
  // Masquer la confirmation après animation
  setTimeout(() => {
    copyConfirmation.classList.remove('visible');
    copyConfirmation.classList.add('hidden');
  }, 2000);
}

// Ajout des écouteurs d'événements
registerButton.addEventListener('click', handleRegister);
goToLoginButton.addEventListener('click', goToLogin);
if (copyUniqueIdButton) {
  copyUniqueIdButton.addEventListener('click', copyUniqueIdToClipboard);
}

// Permettre l'utilisation de la touche Entrée pour s'inscrire
confirmPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleRegister();
});

emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') passwordInput.focus();
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') emailInput.focus();
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') confirmPasswordInput.focus();
}); 