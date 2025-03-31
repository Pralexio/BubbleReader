const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const mangaRoutes = require('./mangaRoutes');

// Route pour vérifier que l'API est en ligne
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'API en ligne' });
});

// Routes utilisateurs
router.use('/users', userRoutes);

// Routes mangas
router.use('/mangas', mangaRoutes);

module.exports = router; 