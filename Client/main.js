const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const dotenv = require('dotenv');

// Configuration par défaut
const DEFAULT_SERVER = 'bubblereader.zapto.org';
const DEFAULT_PORT = '5000';
const DEFAULT_API = `http://${DEFAULT_SERVER}:${DEFAULT_PORT}/api`;

// Variables globales
let apiUrl = DEFAULT_API;

// Charger les variables d'environnement
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error('Erreur lors du chargement du fichier .env:', result.error);
      console.log('Utilisation des valeurs par défaut');
    } else {
      const serverIp = process.env.SERVER_IP || DEFAULT_SERVER;
      const serverPort = process.env.SERVER_PORT || DEFAULT_PORT;
      apiUrl = process.env.API_URL || DEFAULT_API;
      console.log('Variables d\'environnement chargées avec succès');
      console.log(`Configuration API: ${apiUrl}`);
    }
  } catch (err) {
    console.error('Erreur lors du traitement du fichier .env:', err);
    console.log('Utilisation des valeurs par défaut suite à une erreur');
  }
} else {
  console.log('Fichier .env non trouvé, utilisation des valeurs par défaut');
}

// Définir le mode développement
process.env.NODE_ENV = 'development';

// Garder une référence globale de l'objet window, sinon la fenêtre sera fermée
// automatiquement quand l'objet JavaScript sera garbage collected.
let mainWindow;

function createWindow() {
  // Créer la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Désactiver le sandbox pour permettre l'utilisation des modules Node dans preload
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
      webSecurity: true, 
      allowRunningInsecureContent: false
    },
    show: false,
    backgroundColor: '#131419', // Couleur de fond sombre pour éviter les flashs blancs
    title: 'BubbleReader',
    center: true, // Centrer la fenêtre sur l'écran
    maximizable: true, // Permettre la maximisation
    frame: true // Afficher le cadre de la fenêtre
  });

  // Charger le fichier HTML principal
  mainWindow.loadFile('main.html');
  
  // Ouvrir les outils de développement au démarrage
  mainWindow.webContents.openDevTools();

  // Afficher la fenêtre lorsque le contenu est chargé pour éviter les flashs
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Gérer la fermeture de la fenêtre
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Maximiser la fenêtre au démarrage
  mainWindow.maximize();
}

// Lorsque l'application est prête, créer la fenêtre
app.whenReady().then(() => {
  createWindow();
  
  // Vérifier si nous avons des données utilisateur sauvegardées dans le localStorage
  mainWindow.webContents.on('did-finish-load', () => {
    // La page d'index vérifiera elle-même si l'auto-login est activé
    console.log('Application chargée, la page vérifiera l\'auto-login si activé');
  });
});

// Quitter l'application lorsque toutes les fenêtres sont fermées
app.on('window-all-closed', function () {
  // Sur macOS, il est courant que les applications et leur barre de menu
  // restent actives jusqu'à ce que l'utilisateur quitte explicitement avec Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // Sur macOS, il est courant de recréer une fenêtre dans l'application lorsque
  // l'icône du dock est cliquée et qu'il n'y a pas d'autres fenêtres ouvertes.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Gérer les messages IPC pour la navigation
ipcMain.on('navigate', (event, page) => {
  console.log(`Demande de navigation vers: ${page}`);
  
  switch (page) {
    case 'index.html':
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
      break;
    case 'main.html':
      mainWindow.loadFile(path.join(__dirname, 'main.html'));
      break;
    case 'register.html':
      mainWindow.loadFile(path.join(__dirname, 'register.html'));
      break;
    case 'reset-password.html':
      mainWindow.loadFile(path.join(__dirname, 'reset-password.html'));
      break;
    case 'forum.html':
      mainWindow.loadFile(path.join(__dirname, 'forum.html'));
      break;
    default:
      console.error(`Page inconnue: ${page}`);
  }
});

// Ajouter de nouveaux événements IPC pour la communication entre renderer et main
ipcMain.on('login-success', (event, userData) => {
  console.log('Utilisateur connecté:', userData);
});

ipcMain.on('register-success', (event, userData) => {
  console.log('Utilisateur inscrit:', userData);
});

ipcMain.on('logout', (event) => {
  console.log('Utilisateur déconnecté');
});

// Configuration de la sécurité Content Security Policy (CSP)
app.on('web-contents-created', (event, contents) => {
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src *; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.w3.org/ *"
        ]
      }
    });
  });
  
  // Gérer les erreurs de chargement de page
  contents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Erreur de chargement: ${errorDescription} (${errorCode})`);
    
    if (errorCode === -6) { // ERR_FILE_NOT_FOUND
      contents.loadFile('index.html');
      console.log('Redirection vers la page d\'accueil après erreur de fichier non trouvé');
    }
  });
  
  // Désactiver les avertissements de sécurité dans la console en mode développement
  if (process.env.NODE_ENV === 'development') {
    contents.on('console-message', (event, level, message) => {
      if (message.includes('Electron Security Warning')) {
        event.preventDefault();
      }
    });
  }
});

// Dans ce fichier, vous pouvez inclure le reste du code spécifique au processus principal de votre 
// application. Vous pouvez également le mettre dans des fichiers séparés et les inclure ici. 