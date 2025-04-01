const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.json');
const isDev = process.env.NODE_ENV === 'development';

// Configuration globale
global.config = config;

function createWindow() {
    // Définir l'icône selon la plateforme
    let iconPath;
    if (process.platform === 'win32') {
        // Utiliser .ico pour Windows si disponible, sinon fallback sur .png
        const icoPath = path.join(__dirname, 'Client/assets/logo.ico');
        const pngPath = path.join(__dirname, 'Client/assets/logo.png');
        iconPath = require('fs').existsSync(icoPath) ? icoPath : pngPath;
    } else {
        // Utiliser .png pour macOS et Linux
        iconPath = path.join(__dirname, 'Client/assets/logo.png');
    }

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: isDev
        }
    });

    // Charger l'URL de l'application
    mainWindow.loadFile('index.html');

    // Ouvrir les outils de développement uniquement en mode développement
    if (isDev) {
        mainWindow.webContents.openDevTools();
    } else {
        // En production, empêcher l'ouverture des outils de développement
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });
    }

    // Définir l'URL de l'API pour le processus de rendu
    global.apiUrl = config.server.url;
}

app.whenReady().then(() => {
    // Empêcher plusieurs instances de l'application
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
        app.quit();
        return;
    }
    
    // Protection contre certaines vulnérabilités web
    app.on('web-contents-created', (event, contents) => {
        // Bloquer la navigation vers des URL externes
        contents.on('will-navigate', (event, navigationUrl) => {
            const parsedUrl = new URL(navigationUrl);
            // Autoriser uniquement la navigation interne à l'application
            if (!parsedUrl.protocol.includes('file:')) {
                event.preventDefault();
            }
        });
        
        // Bloquer l'ouverture de nouvelles fenêtres
        contents.setWindowOpenHandler(({ url }) => {
            return { action: 'deny' };
        });

        // Bloquer l'exécution de code distant en production
        if (!isDev) {
            contents.on('will-attach-webview', (event) => {
                event.preventDefault();
            });
        }
    });
    
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Gestionnaire IPC pour obtenir l'URL de l'API
ipcMain.handle('get-api-url', () => {
    return config.server.url;
});

// Gestionnaire IPC pour obtenir la configuration
ipcMain.handle('get-config', () => {
    return config;
});

// ... rest of the file ... 