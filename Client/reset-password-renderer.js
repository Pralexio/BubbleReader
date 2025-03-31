// Obtenir les APIs exposées par preload.js
let ipcRenderer = null;
let apiUrl = 'http://bubblereader.zapto.org:5000/api';

// Vérifier si window.electron existe et récupérer les valeurs
if (window.electron) {
  console.log('window.electron est disponible dans reset-password-renderer.js');
  
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
const alertContainer = document.getElementById('alertContainer');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const uniqueIdInput = document.getElementById('uniqueId');
const usernameDisplay = document.getElementById('usernameDisplay');
const emailDisplay = document.getElementById('emailDisplay');
const newPasswordInput = document.getElementById('newPassword');
const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
const verifyIdButton = document.getElementById('verifyIdButton');
const resetPasswordButton = document.getElementById('resetPasswordButton');
const goToLoginButton = document.getElementById('goToLoginButton');
const stepDots = document.querySelectorAll('.step-dot');

// Variables pour stocker les informations utilisateur
let userId = null;
let verifiedUniqueId = null;

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

// Fonction pour construire l'URL de l'API
function buildApiUrl(endpoint) {
  console.log('Construction de l\'URL de l\'API');
  console.log('URL de base:', apiUrl);
  console.log('Endpoint:', endpoint);
  
  // Si l'endpoint commence par http, c'est une URL complète
  if (endpoint.startsWith('http')) {
    console.log('URL complète fournie:', endpoint);
    return endpoint;
  }
  
  // Supprimer les slashes au début de l'endpoint si présents
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  console.log('Endpoint nettoyé:', cleanEndpoint);
  
  // Construire l'URL complète
  const fullUrl = `${apiUrl}/${cleanEndpoint}`;
  console.log('URL complète construite:', fullUrl);
  
  return fullUrl;
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
    
    console.log('Serveur non disponible ❌');
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
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const fullUrl = buildApiUrl(endpoint);
    console.log(`Envoi d'une requête à: ${fullUrl}`);
    
    const response = await fetch(fullUrl, options);
    clearTimeout(timeoutId);
    
    // Vérifier d'abord si la réponse est du JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw {
        status: response.status,
        message: `Erreur ${response.status} : ${response.statusText}`,
        response: { message: `La route ${fullUrl} n'existe pas ou n'est pas accessible` }
      };
    }

    const responseData = await response.json();
    
    if (!response.ok) {
      throw { 
        status: response.status,
        message: responseData.message || 'Erreur serveur',
        response: responseData
      };
    }
    
    return responseData;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      error.code = 'ECONNABORTED';
      error.message = 'La requête a été interrompue (timeout)';
    } else if (error instanceof SyntaxError) {
      // Erreur de parsing JSON
      error.status = 500;
      error.message = 'Réponse invalide du serveur';
    }
    
    throw error;
  }
}

// Fonction pour passer à une étape spécifique
function goToStep(stepNumber) {
  // Masquer toutes les étapes
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  
  // Afficher l'étape demandée
  document.getElementById(`step${stepNumber}`).classList.add('active');
  
  // Mise à jour des indicateurs d'étape
  stepDots.forEach(dot => {
    const dotStep = parseInt(dot.getAttribute('data-step'));
    if (dotStep <= stepNumber) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// Fonction pour vérifier l'ID unique
async function verifyUniqueId() {
  const uniqueId = uniqueIdInput.value.trim().toUpperCase();
  
  if (!uniqueId) {
    showAlert('Veuillez entrer votre identifiant unique.', 'danger');
    return;
  }

  // Validation du format de l'ID unique (16 caractères hexadécimaux)
  if (!/^[0-9A-F]{16}$/.test(uniqueId)) {
    showAlert('Format d\'ID unique invalide. L\'ID doit contenir 16 caractères hexadécimaux.', 'danger');
    return;
  }
  
  try {
    verifyIdButton.textContent = 'Vérification...';
    verifyIdButton.disabled = true;
    
    const response = await fetchApi('/users/verify-uid', 'POST', { uniqueID: uniqueId });
    
    if (response.success) {
      // Stocker l'ID unique vérifié
      verifiedUniqueId = uniqueId;
      
      // Afficher les informations utilisateur
      usernameDisplay.innerText = response.username;
      emailDisplay.innerText = response.email;
      
      showAlert('ID unique vérifié avec succès. Vous pouvez maintenant réinitialiser votre mot de passe.', 'success');
      
      // Passer à l'étape 2
      goToStep(2);
    }
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    
    if (error.status === 404) {
      showAlert('ID unique invalide ou introuvable', 'danger');
    } else if (error.status === 400) {
      showAlert(error.response?.message || 'Format d\'ID unique invalide', 'danger');
    } else {
      showAlert('Erreur serveur lors de la vérification de l\'ID unique', 'danger');
    }
  } finally {
    verifyIdButton.textContent = 'Vérifier';
    verifyIdButton.disabled = false;
  }
}

// Fonction pour réinitialiser le mot de passe
async function resetPassword() {
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmNewPasswordInput.value;

  if (!newPassword || !confirmPassword) {
    showAlert('Veuillez remplir tous les champs.', 'danger');
    return;
  }

  if (newPassword !== confirmPassword) {
    showAlert('Les mots de passe ne correspondent pas.', 'danger');
    return;
  }

  if (newPassword.length < 8) {
    showAlert('Le mot de passe doit contenir au moins 8 caractères.', 'danger');
    return;
  }

  if (!verifiedUniqueId) {
    showAlert('Veuillez d\'abord vérifier votre ID unique.', 'danger');
    goToStep(1);
    return;
  }

  try {
    resetPasswordButton.textContent = 'Réinitialisation...';
    resetPasswordButton.disabled = true;

    const response = await fetchApi('/users/reset-password', 'POST', {
      uniqueID: verifiedUniqueId,
      newPassword: newPassword
    });

    if (response.success) {
      showAlert('Mot de passe réinitialisé avec succès.', 'success');
      goToStep(3);
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation:', error);
    
    if (error.status === 404) {
      showAlert('ID unique invalide ou expiré. Veuillez recommencer.', 'danger');
      goToStep(1);
    } else if (error.status === 400) {
      showAlert(error.response?.message || 'Données invalides', 'danger');
    } else {
      showAlert('Erreur serveur lors de la réinitialisation du mot de passe', 'danger');
    }
  } finally {
    resetPasswordButton.textContent = 'Réinitialiser le mot de passe';
    resetPasswordButton.disabled = false;
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

// Ajout des écouteurs d'événements
verifyIdButton.addEventListener('click', verifyUniqueId);
resetPasswordButton.addEventListener('click', resetPassword);
goToLoginButton.addEventListener('click', goToLogin);

// Permettre l'utilisation de la touche Entrée pour soumettre les formulaires
uniqueIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') verifyUniqueId();
});

newPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') confirmNewPasswordInput.focus();
});

confirmNewPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') resetPassword();
}); 