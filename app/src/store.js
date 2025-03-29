const Store = require('electron-store');

const store = new Store({
    defaults: {
        updates: {
            autoCheck: true,
            lastCheck: null,
            selectedVersion: null
        }
    }
});

module.exports = store; 