import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Main from './pages/Main';
import './styles/global.css';

// Vérifier si l'utilisateur est connecté
const isAuthenticated = () => {
  return localStorage.getItem('userToken') !== null;
};

// Route protégée
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return children;
};

// Composant principal
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Main />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
};

ReactDOM.render(<App />, document.getElementById('app')); 