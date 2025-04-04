const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
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
const isDev = process.env.NODE_ENV === 'development';
process.env.NODE_ENV = isDev ? 'development' : 'production';

// Garder une référence globale de l'objet window, sinon la fenêtre sera fermée
// automatiquement quand l'objet JavaScript sera garbage collected.
let mainWindow;

function createWindow() {
  // Créer la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true, // Réactiver les outils de développement
      webSecurity: true, 
      allowRunningInsecureContent: false
    },
    show: false,
    backgroundColor: '#131419',
    title: 'BubbleReader',
    frame: false,
    transparent: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    center: true,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    useContentSize: true
  });

  // Gérer les changements d'état de maximisation
  mainWindow.on('maximize', () => {
    console.log('Window maximized');
    mainWindow.webContents.send('window-maximized-state-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    console.log('Window unmaximized');
    mainWindow.webContents.send('window-maximized-state-changed', false);
  });

  // Gérer l'état initial de maximisation
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    
    // Toujours ouvrir les DevTools pour faciliter le développement
    mainWindow.webContents.openDevTools();
    
    mainWindow.webContents.send('window-maximized-state-changed', mainWindow.isMaximized());
  });

  // Charger le fichier HTML principal
  mainWindow.loadFile('index.html');

  // Empêcher l'ouverture de la console développeur via raccourcis clavier
  /*
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Bloquer les raccourcis qui ouvrent les DevTools
    // F12, Ctrl+Shift+I, Cmd+Option+I
    if ((input.key === 'F12') || 
        (input.control && input.shift && input.key === 'I') || 
        (input.meta && input.alt && input.key === 'i')) {
      event.preventDefault();
    }
    
    // Bloquer Ctrl+R et Cmd+R (rechargement)
    if ((input.control && input.key === 'r') || 
        (input.meta && input.key === 'r')) {
      event.preventDefault();
    }
  });
  */

  // Gérer la fermeture de la fenêtre
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Désactiver le menu contextuel
  mainWindow.webContents.on('context-menu', (e) => {
    // Autoriser le menu contextuel pendant le développement
    // e.preventDefault();
  });

  // Ne plus bloquer l'ouverture des DevTools
  /*
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });

  // Ne plus bloquer l'inspection d'éléments
  mainWindow.webContents.on('inspect-element', (event) => {
    event.preventDefault();
  });
  */
}

// Lorsque l'application est prête, créer la fenêtre
app.whenReady().then(() => {
  // Désactiver l'extension React DevTools et tout autre outil de développement tiers
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Bloquer les requêtes vers React DevTools et autres extensions de développement
    if (details.url.indexOf('chrome-extension://') !== -1) {
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });
  
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

// Gérer la détection d'ouverture des DevTools en production
ipcMain.on('devtools-opened', () => {
  console.log('DevTools ouvert - accès autorisé');
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

// Ajouter les gestionnaires pour les contrôles de fenêtre
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Gérer les messages IPC pour la navigation vers le lecteur
ipcMain.on('navigate-to-reader', (event, mangaSlug, chapterNumber) => {
  console.log(`Demande de navigation vers le lecteur pour: ${mangaSlug}, chapitre ${chapterNumber}`);
  
  // Charger la page du lecteur avec les paramètres
  mainWindow.loadFile(path.join(__dirname, 'reader.html'), {
    query: {
      manga: mangaSlug,
      chapter: chapterNumber
    }
  });
});

// Gérer les messages IPC pour le rechargement de la page
ipcMain.on('reload-page', () => {
  if (mainWindow) {
    mainWindow.reload();
  }
});

// Gérer les messages IPC pour la navigation vers l'arrière
ipcMain.on('go-back', () => {
  if (mainWindow && mainWindow.webContents.canGoBack()) {
    mainWindow.webContents.goBack();
  }
});

// Gérer les messages IPC pour la navigation vers l'avant
ipcMain.on('go-forward', () => {
  if (mainWindow && mainWindow.webContents.canGoForward()) {
    mainWindow.webContents.goForward();
  }
});

// Gérer les messages IPC pour ouvrir les DevTools
ipcMain.on('open-devtools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
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