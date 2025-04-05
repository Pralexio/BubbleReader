// Préchargement des modules et configuration
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Vérifier si nous sommes en mode production
const isProduction = process.env.NODE_ENV === 'production';

// Variables d'environnement par défaut
const DEFAULT_SERVER = 'localhost';
const DEFAULT_PORT = '5000';
const DEFAULT_API = `http://${DEFAULT_SERVER}:${DEFAULT_PORT}/api`;

let serverIp = DEFAULT_SERVER;
let serverPort = DEFAULT_PORT;
let apiUrl = DEFAULT_API;

// Essayer de charger les variables d'environnement depuis le fichier .env du client
const envPath = path.join(__dirname, '.env');
try {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error('Erreur lors du chargement du fichier .env:', result.error);
      console.log('Utilisation des valeurs par défaut');
    } else {
      console.log('Variables d\'environnement chargées avec succès depuis', envPath);
      // Ne pas écraser les valeurs par défaut si les variables d'environnement sont vides
      serverIp = process.env.SERVER_IP || DEFAULT_SERVER;
      serverPort = process.env.SERVER_PORT || DEFAULT_PORT;
      
      // Construction de l'URL de l'API en tenant compte des valeurs réelles
      if (process.env.API_URL) {
        apiUrl = process.env.API_URL;
      } else {
        apiUrl = `http://${serverIp}:${serverPort}/api`;
      }
      
      console.log('Configuration API dans preload.js:', apiUrl);
    }
  } else {
    console.log('Fichier .env non trouvé, utilisation des valeurs par défaut');
    // S'assurer que l'URL est correctement construite même sans fichier .env
    apiUrl = `http://${serverIp}:${serverPort}/api`;
  }
} catch (error) {
  console.error('Erreur lors du traitement des variables d\'environnement:', error);
  console.log('Utilisation des valeurs par défaut suite à une erreur');
  // S'assurer que l'URL est correctement construite même en cas d'erreur
  apiUrl = `http://${serverIp}:${serverPort}/api`;
}

// Exposer les APIs protégées Electron vers le "monde principal"
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // Les canaux autorisés que le renderer peut envoyer
      const validChannels = [
        'navigate', 
        'login-success', 
        'register-success', 
        'reset-success', 
        'logout',
        'window-minimize',
        'window-maximize',
        'window-close',
        'window-maximized-state-changed'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    navigateTo: (page) => {
      ipcRenderer.send('navigate', page);
    },
    receive: (channel, func) => {
      // Les canaux autorisés que le renderer peut écouter
      const validChannels = ['from-main', 'window-maximized-state-changed'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    on: (channel, callback) => {
      const validChannels = ['window-maximized-state-changed'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, callback);
      }
    },
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  env: {
    serverIp,
    serverPort,
    apiUrl
  },
  getApiUrl: () => {
    return apiUrl;
  },
  // Contrôles de fenêtre
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    onMaximizeChange: (callback) => {
      ipcRenderer.on('window-maximized-state-changed', (event, isMaximized) => {
        callback(isMaximized);
      });
    }
  }
}); 