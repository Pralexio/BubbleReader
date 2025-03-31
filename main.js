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
            devTools: true
        }
    });

    // Charger l'URL de l'application
    mainWindow.loadFile('index.html');

    // Ouvrir les outils de développement
    mainWindow.webContents.openDevTools();

    // Définir l'URL de l'API pour le processus de rendu
    global.apiUrl = config.server.url;
}

app.whenReady().then(() => {
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