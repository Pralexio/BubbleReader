const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const Store = require('electron-store');
const fs = require('fs');
const path = require('path');

const store = new Store();
let mainWindow;

// Configuration de l'auto-updater
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

// Initialisation de l'updater
function initUpdater(window) {
    mainWindow = window;
    
    // Vérifier les mises à jour au démarrage si activé
    if (store.get('updates.autoCheck', true)) {
        checkForUpdates();
    }
    
    // Gestionnaire d'événements pour les mises à jour
    autoUpdater.on('checking-for-update', () => {
        mainWindow.webContents.send('update-status', 'Recherche de mises à jour...');
    });

    autoUpdater.on('update-available', (info) => {
        try {
            // Lire les notes de version depuis le fichier changelog.json
            const changelog = JSON.parse(fs.readFileSync('changelog.json', 'utf8'));
            const version = info.version;
            
            if (changelog[version]) {
                const changes = changelog[version].changes.join('\n');
                mainWindow.webContents.send('update-status', `Nouvelle version ${version} disponible\n\n${changes}`);
            } else {
                mainWindow.webContents.send('update-status', `Nouvelle version ${version} disponible`);
            }
            mainWindow.webContents.send('update-available', info);
        } catch (error) {
            console.error('Erreur lors de la lecture des notes de version:', error);
            mainWindow.webContents.send('update-status', `Nouvelle version ${info.version} disponible`);
            mainWindow.webContents.send('update-available', info);
        }
    });

    autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('update-status', 'Aucune mise à jour disponible');
        store.set('updates.lastCheck', new Date().toISOString());
    });

    autoUpdater.on('error', (err) => {
        mainWindow.webContents.send('update-status', `Erreur: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        try {
            // Lire les notes de version depuis le fichier changelog.json
            const changelog = JSON.parse(fs.readFileSync('changelog.json', 'utf8'));
            const version = info.version;
            
            if (changelog[version]) {
                const changes = changelog[version].changes.join('\n');
                mainWindow.webContents.send('update-status', `Version ${version} téléchargée et prête à être installée\n\n${changes}`);
            } else {
                mainWindow.webContents.send('update-status', `Version ${version} téléchargée et prête à être installée`);
            }
            mainWindow.webContents.send('update-downloaded', info);
        } catch (error) {
            console.error('Erreur lors de la lecture des notes de version:', error);
            mainWindow.webContents.send('update-status', `Version ${info.version} téléchargée et prête à être installée`);
            mainWindow.webContents.send('update-downloaded', info);
        }
    });
}

// Vérification des mises à jour
async function checkForUpdates(userTriggered = false) {
    try {
        await autoUpdater.checkForUpdates();
        if (userTriggered) {
            store.set('updates.lastCheck', new Date().toISOString());
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des mises à jour:', error);
    }
}

// Configuration des événements IPC
function setupUpdateEvents() {
    ipcMain.handle('check-updates', () => checkForUpdates(true));
    
    ipcMain.handle('start-download', () => {
        autoUpdater.downloadUpdate();
    });
    
    ipcMain.handle('install-update', () => {
        autoUpdater.quitAndInstall(false, true);
    });
    
    ipcMain.handle('get-update-settings', () => ({
        autoCheck: store.get('updates.autoCheck', true),
        lastCheck: store.get('updates.lastCheck'),
        currentVersion: autoUpdater.currentVersion.version
    }));
    
    ipcMain.handle('set-auto-check', (event, value) => {
        store.set('updates.autoCheck', value);
        return value;
    });
}

module.exports = {
    initUpdater,
    setupUpdateEvents
}; 