const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3030;

// Configuration du logging
const logFile = path.join(__dirname, '..', 'server.log');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

// Middleware pour logger toutes les requêtes
app.use((req, res, next) => {
    const logMessage = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer || 'direct',
        protocol: req.protocol,
        hostname: req.hostname,
        originalUrl: req.originalUrl,
        query: req.query,
        body: req.body,
        headers: req.headers
    };
    
    logToFile(JSON.stringify(logMessage, null, 2));
    next();
});

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Middleware pour les images
app.use('/proxy/image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            logToFile(`[ERROR] Proxy image - URL manquante`);
            return res.status(400).send('URL manquante');
        }

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://phenix-scans.com/'
            }
        });

        if (!response.ok) {
            logToFile(`[ERROR] Proxy image - Échec de récupération: ${imageUrl}, Status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Transférer les en-têtes de l'image
        res.set('Content-Type', response.headers.get('content-type'));
        res.set('Cache-Control', 'public, max-age=31536000'); // Cache pour 1 an

        // Pipe la réponse directement
        response.body.pipe(res);
    } catch (error) {
        logToFile(`[ERROR] Proxy image - Exception: ${error.message}`);
        res.status(500).send('Erreur lors de la récupération de l\'image');
    }
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '..', 'public')));

// Route proxy pour les chapitres
app.get('/proxy/chapter', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            logToFile(`[ERROR] Proxy chapter - URL manquante`);
            return res.status(400).json({ error: 'URL manquante' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://phenix-scans.com/'
            }
        });

        if (!response.ok) {
            logToFile(`[ERROR] Proxy chapter - Échec de récupération: ${url}, Status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const images = [];

        // Chercher dans les scripts (pour Solo Leveling)
        const scriptContent = $('script:contains("chapter_data")').html();
        if (scriptContent) {
            const match = scriptContent.match(/chapter_data\s*=\s*(\[.*?\])/s);
            if (match) {
                try {
                    const chapterData = JSON.parse(match[1].replace(/'/g, '"'));
                    chapterData.forEach((src, index) => {
                        if (typeof src === 'string') {
                            let imageUrl = src.trim();
                            if (!imageUrl.startsWith('http')) {
                                imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://${imageUrl}`;
                            }
                            images.push({
                                url: `/proxy/image?url=${encodeURIComponent(imageUrl)}`,
                                pageNumber: index + 1
                            });
                        }
                    });
                } catch (e) {
                    logToFile(`[ERROR] Proxy chapter - Erreur parsing JSON: ${e.message}`);
                }
            }
        }

        // Si aucune image n'est trouvée dans les scripts, chercher dans le HTML
        if (images.length === 0) {
            $('img').each((index, element) => {
                const $img = $(element);
                let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
                
                if (src && (src.includes('/uploads/manga/') || src.includes('api.phenix-scans.com'))) {
                    let imageUrl = src.trim();
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://${imageUrl}`;
                    }
                    images.push({
                        url: `/proxy/image?url=${encodeURIComponent(imageUrl)}`,
                        pageNumber: index + 1
                    });
                }
            });
        }

        // Trier les images par numéro de page
        images.sort((a, b) => a.pageNumber - b.pageNumber);
        
        logToFile(`[SUCCESS] Proxy chapter - URL: ${url}, Images trouvées: ${images.length}`);
        
        res.json({ images });
    } catch (error) {
        logToFile(`[ERROR] Proxy chapter - Exception: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Démarrer le serveur
app.listen(3030, '0.0.0.0', () => {
    const startMessage = `Serveur web démarré sur le port 3030`;
    console.log(startMessage);
    logToFile(`[SERVER START] ${startMessage}`);
}); 