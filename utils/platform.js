// Détection de l'environnement
const isElectron = typeof window !== 'undefined' && window.process && window.process.versions && window.process.versions.electron;

// Gestionnaire d'événements compatible
const events = {
    on: (eventName, callback) => {
        if (isElectron && typeof window !== 'undefined') {
            const { ipcRenderer } = require('electron');
            return ipcRenderer.on(eventName, callback);
        } else if (typeof window !== 'undefined') {
            document.addEventListener(eventName, callback);
            return {
                remove: () => document.removeEventListener(eventName, callback)
            };
        }
    },
    send: (channel, ...args) => {
        if (isElectron && typeof window !== 'undefined') {
            const { ipcRenderer } = require('electron');
            return ipcRenderer.send(channel, ...args);
        } else if (typeof window !== 'undefined') {
            // Version web : appel API
            fetch('/api/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: channel, data: args })
            });
        }
    },
    invoke: async (channel, ...args) => {
        if (isElectron && typeof window !== 'undefined') {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke(channel, ...args);
        } else if (typeof window !== 'undefined') {
            // Version web : appel API
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: channel, data: args })
            });
            return await response.json();
        }
        return null;
    }
};

// Stockage compatible
const storage = {
    get: async (key) => {
        if (typeof window === 'undefined') return null;
        if (isElectron) {
            return await events.invoke('store-get', key);
        } else {
            return JSON.parse(localStorage.getItem(key) || 'null');
        }
    },
    set: async (key, value) => {
        if (typeof window === 'undefined') return;
        if (isElectron) {
            return await events.invoke('store-set', key, value);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }
};

// Mises à jour
const updates = {
    check: async () => {
        if (typeof window === 'undefined') return null;
        if (isElectron) {
            return await events.invoke('check-for-updates');
        } else {
            const response = await fetch('/version');
            return await response.json();
        }
    },
    download: async () => {
        if (typeof window === 'undefined') return;
        if (isElectron) {
            return await events.invoke('download-update');
        } else {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'download-update' })
            });
            return await response.json();
        }
    },
    install: () => {
        if (typeof window === 'undefined') return;
        if (isElectron) {
            events.send('install-update');
        } else {
            fetch('/api/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'install-update' })
            });
        }
    }
};

// Navigation
const navigation = {
    openExternal: (url) => {
        if (typeof window === 'undefined') return;
        if (isElectron) {
            return events.invoke('open-external', url);
        } else {
            window.open(url, '_blank');
        }
    }
};

module.exports = {
    isElectron,
    events,
    storage,
    updates,
    navigation
}; 