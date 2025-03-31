const { ipcRenderer } = require('electron');

// Fonction pour obtenir l'URL de l'API
async function getApiUrl() {
    try {
        return await ipcRenderer.invoke('get-api-url');
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'URL de l\'API:', error);
        return 'http://bubblereader.zapto.org:5000/api'; // URL par défaut avec /api
    }
}

// Fonction principale pour les appels API
async function fetchApi(endpoint, method = 'GET', data = null) {
    try {
        const baseUrl = await getApiUrl();
        const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
        
        console.log(`🌐 Envoi d'une requête à: ${url}`);
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Ajouter le token d'authentification si disponible
        const token = localStorage.getItem('userToken');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        // Ajouter le corps de la requête pour POST/PUT
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        // Pour les requêtes DELETE qui retournent 204
        if (response.status === 204) {
            return { success: true };
        }

        // Gérer les erreurs HTTP
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Erreur HTTP: ${response.status}`);
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('❌ Erreur API:', error);
        throw error;
    }
}

// Fonctions d'API spécifiques
const api = {
    // Authentification
    login: (credentials) => fetchApi('/users/login', 'POST', credentials),
    register: (userData) => fetchApi('/users/register', 'POST', userData),
    logout: () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        return Promise.resolve();
    },

    // Mangas
    getAllMangas: () => fetchApi('/mangas'),
    getMangaBySlug: (slug) => fetchApi(`/mangas/${slug}`),
    getChapter: (slug, number) => fetchApi(`/mangas/${slug}/chapter/${number}`),
    searchMangas: (query) => fetchApi(`/mangas/search?query=${encodeURIComponent(query)}`),

    // Progression de lecture
    getReadingProgress: () => fetchApi('/users/mangas/reading-progress'),
    saveReadingProgress: (data) => fetchApi('/users/reading-progress', 'POST', data),
    deleteReadingProgress: (slug) => fetchApi(`/users/mangas/reading-progress/${slug}`, 'DELETE'),

    // Vérification du serveur
    checkHealth: () => fetchApi('/health')
};

module.exports = api; 