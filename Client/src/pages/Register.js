import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uniqueID, setUniqueID] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Vérifier que les mots de passe correspondent
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    try {
      const { username, email, password } = formData;
      const response = await authService.register({ username, email, password });
      
      // Afficher l'ID unique à l'utilisateur
      setUniqueID(response.uniqueID);
      setSuccess(response.message);
      
      // Effacer le formulaire
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      
      // Ne pas rediriger immédiatement pour que l'utilisateur puisse voir son ID unique
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Inscription à BubbleReader</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      {success && (
        <div className="alert alert-success">
          {success}
          {uniqueID && (
            <div className="unique-id">
              <p><strong>Votre ID unique: </strong></p>
              <p style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                textAlign: 'center',
                padding: '10px',
                margin: '10px 0',
                backgroundColor: '#f8f9fa',
                border: '1px dashed #ced4da',
                borderRadius: '4px'
              }}>
                {uniqueID}
              </p>
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                IMPORTANT: Notez cet ID et conservez-le en lieu sûr. 
                Il est la seule façon de récupérer votre compte si vous oubliez votre mot de passe.
              </p>
            </div>
          )}
        </div>
      )}
      
      {!success ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Nom d'utilisateur
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength="6"
            />
          </div>
          
          <button type="submit" className="form-button" disabled={loading}>
            {loading ? 'Inscription en cours...' : 'S\'inscrire'}
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={() => navigate('/login')} 
            className="form-button"
          >
            Aller à la page de connexion
          </button>
        </div>
      )}
      
      {!success && (
        <Link to="/login" className="form-link">
          Déjà un compte? Se connecter
        </Link>
      )}
    </div>
  );
};

export default Register; 