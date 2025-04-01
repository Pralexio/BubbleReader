import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Charger les variables d'environnement
let API_URL;
try {
  // Essayer de charger depuis .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      API_URL = process.env.API_URL;
      console.log('API URL chargée depuis .env:', API_URL);
    }
  }
} catch (error) {
  console.error('Erreur lors du chargement des variables d\'environnement:', error);
}

// Fallback si l'URL n'a pas pu être chargée
if (!API_URL) {
  console.warn('Impossible de charger l\'URL de l\'API depuis .env, utilisation de l\'API d\'environnement');
  API_URL = process.env.REACT_APP_API_URL || process.env.API_URL;
  
  if (!API_URL) {
    console.error('Aucune URL d\'API trouvée dans les variables d\'environnement');
    throw new Error('URL de l\'API non configurée');
  }
}

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