import axios from 'axios';

// URL de base de l'API
const API_URL = 'http://bubblereader.zapto.org:5000/api';

// Créer une instance axios avec la configuration de base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Service d'authentification
export const authService = {
  // Inscription
  register: async (userData) => {
    try {
      const response = await api.post('/users/register', userData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Connexion
  login: async (credentials) => {
    try {
      const response = await api.post('/users/login', credentials);
      if (response.data.token) {
        localStorage.setItem('userToken', response.data.token);
        localStorage.setItem('user', JSON.stringify({
          id: response.data._id,
          username: response.data.username,
          email: response.data.email,
        }));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Déconnexion
  logout: () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
  },

  // Vérification de l'UID
  verifyUniqueID: async (uniqueID) => {
    try {
      const response = await api.post('/users/verify-uid', { uniqueID });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Réinitialisation du mot de passe
  resetPassword: async (uniqueID, newPassword) => {
    try {
      const response = await api.post('/users/reset-password', { uniqueID, newPassword });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },

  // Obtenir le profil utilisateur
  getUserProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  },
};

export default api; 