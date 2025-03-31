import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

const ResetPassword = () => {
  const [step, setStep] = useState(1);
  const [uniqueID, setUniqueID] = useState('');
  const [userData, setUserData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Étape 1: Vérifier l'ID unique
  const verifyUniqueID = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.verifyUniqueID(uniqueID);
      setUserData(response);
      setStep(2);
    } catch (err) {
      setError(err.message || 'ID unique invalide');
    } finally {
      setLoading(false);
    }
  };

  // Étape 2: Réinitialiser le mot de passe
  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Vérifier que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    try {
      await authService.resetPassword(uniqueID, newPassword);
      setSuccess('Votre mot de passe a été réinitialisé avec succès');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Réinitialisation du mot de passe</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      {step === 1 && (
        <>
          <p style={{ marginBottom: '20px', textAlign: 'center' }}>
            Entrez l'ID unique qui vous a été fourni lors de la création de votre compte.
          </p>
          
          <form onSubmit={verifyUniqueID}>
            <div className="form-group">
              <label htmlFor="uniqueID" className="form-label">
                ID Unique
              </label>
              <input
                type="text"
                id="uniqueID"
                name="uniqueID"
                className="form-input"
                value={uniqueID}
                onChange={(e) => setUniqueID(e.target.value)}
                required
                placeholder="Exemple: 1A2B3C4D5E6F7G8H"
              />
            </div>
            
            <button type="submit" className="form-button" disabled={loading}>
              {loading ? 'Vérification...' : 'Vérifier l\'ID'}
            </button>
          </form>
        </>
      )}
      
      {step === 2 && userData && (
        <>
          <div className="user-info" style={{ marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px' }}>
            <p><strong>Utilisateur trouvé:</strong></p>
            <p>Nom d'utilisateur: {userData.username}</p>
            <p>Email: {userData.email}</p>
          </div>
          
          <form onSubmit={resetPassword}>
            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>
            
            <button type="submit" className="form-button" disabled={loading}>
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </button>
          </form>
        </>
      )}
      
      {step === 3 && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={() => navigate('/login')} 
            className="form-button"
          >
            Aller à la page de connexion
          </button>
        </div>
      )}
      
      <Link to="/login" className="form-link">
        Retour à la connexion
      </Link>
    </div>
  );
};

export default ResetPassword; 