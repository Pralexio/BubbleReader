// Préchargement des modules et configuration
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Variables d'environnement par défaut
const DEFAULT_SERVER = 'bubblereader.zapto.org';
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
      apiUrl = process.env.API_URL || DEFAULT_API;
      console.log('Configuration API dans preload.js:', apiUrl);
    }
  } else {
    console.log('Fichier .env non trouvé, utilisation des valeurs par défaut');
  }
} catch (error) {
  console.error('Erreur lors du traitement des variables d\'environnement:', error);
  console.log('Utilisation des valeurs par défaut suite à une erreur');
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
        'logout'
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
      const validChannels = ['from-main'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
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
  }
}); 