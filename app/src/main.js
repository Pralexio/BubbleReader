const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initUpdater, setupUpdateEvents } = require('./updater');

let mainWindow = null;
let settingsWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Initialiser l'auto-updater
  initUpdater(mainWindow);
  setupUpdateEvents();

  // Centrer la fenêtre
  mainWindow.center();
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Ajouter un événement IPC pour ouvrir les paramètres
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

// Gestionnaire d'événements pour le stockage
ipcMain.handle('store-get', async (event, key) => {
  const Store = require('electron-store');
  const store = new Store();
  return store.get(key);
});

ipcMain.handle('store-set', async (event, key, value) => {
  const Store = require('electron-store');
  const store = new Store();
  store.set(key, value);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 