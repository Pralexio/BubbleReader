import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import logo from '../assets/logo.png';
import defaultCover from '../assets/default-cover.png';

const Main = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData) {
          setUser(userData);
        } else {
          const response = await authService.getUserProfile();
          setUser(response.user);
        }
      } catch (err) {
        console.error('Erreur lors de la récupération du profil:', err);
        setError('Impossible de charger votre profil. Veuillez vous reconnecter.');
        if (err.status === 401) {
          handleLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="form-container" style={{ textAlign: 'center' }}>
        <h2 className="form-title">Chargement...</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logo} alt="BubbleReader Logo" style={{ height: '40px', width: 'auto' }} />
            <h1 style={{ margin: 0, fontSize: '24px', color: '#8b5cf6' }}>BubbleReader</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <input
              type="search"
              placeholder="Rechercher..."
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#242938',
                color: '#fff',
                width: '200px'
              }}
            />
            <div className="user-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {user && (
                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Bonjour, <strong style={{ color: '#fff' }}>{user.username}</strong>
                </span>
              )}
              <button 
                onClick={handleLogout}
                className="btn btn-danger"
                style={{ padding: '8px 16px' }}
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="app-sidebar">
        <div style={{ padding: '0 20px' }}>
          <h3 style={{ marginBottom: '20px', color: '#fff', fontSize: '18px' }}>Menu</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '15px' }}>
              <a href="#" className="menu-item">
                <span style={{ fontSize: '18px' }}>📚</span>
                Bibliothèque
              </a>
            </li>
            <li style={{ marginBottom: '15px' }}>
              <a href="#" className="menu-item">
                <span style={{ fontSize: '18px' }}>🔍</span>
                Découvrir
              </a>
            </li>
            <li style={{ marginBottom: '15px' }}>
              <a href="#" className="menu-item">
                <span style={{ fontSize: '18px' }}>⭐</span>
                Favoris
              </a>
            </li>
            <li style={{ marginBottom: '15px' }}>
              <a href="#" className="menu-item">
                <span style={{ fontSize: '18px' }}>⚙️</span>
                Paramètres
              </a>
            </li>
          </ul>
        </div>
      </div>

      <main className="app-content">
        {error && <div className="alert alert-danger">{error}</div>}
        
        <h2 style={{ color: '#fff', marginBottom: '20px', fontSize: '28px' }}>Bienvenue sur BubbleReader</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '30px' }}>
          Votre bibliothèque de mangas et manhwas en ligne
        </p>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '20px',
          marginTop: '30px'
        }}>
          <div className="manga-card">
            <div className="manga-cover" style={{ backgroundImage: `url(${defaultCover})` }}></div>
            <div className="manga-info">
              <h3 className="manga-title">Solo Leveling</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span className="manga-chapter">Chapitre 1-100</span>
                <span className="status-badge status-termine">TERMINÉ</span>
              </div>
            </div>
          </div>

          <div className="manga-card">
            <div className="manga-cover" style={{ backgroundImage: `url(${defaultCover})` }}></div>
            <div className="manga-info">
              <h3 className="manga-title">The Beginning After the End</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span className="manga-chapter">Chapitre 1-50</span>
                <span className="status-badge status-en-cours">EN COURS</span>
              </div>
            </div>
          </div>

          <div className="manga-card">
            <div className="manga-cover" style={{ backgroundImage: `url(${defaultCover})` }}></div>
            <div className="manga-info">
              <h3 className="manga-title">Jujutsu Kaisen</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span className="manga-chapter">Chapitre 1-80</span>
                <span className="status-badge status-en-cours">EN COURS</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Main; 