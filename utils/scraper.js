const { isElectron } = require('./platform');
const puppeteer = isElectron ? require('puppeteer') : null;

async function scrapePage(url) {
    if (isElectron) {
        // Version desktop : utilise Puppeteer directement
        const browser = await puppeteer.launch();
        try {
            const page = await browser.newPage();
            await page.goto(url);
            
            // Adaptez cette partie selon vos besoins de scraping
            const data = await page.evaluate(() => {
                return {
                    title: document.title,
                    // Ajoutez d'autres sélecteurs selon vos besoins
                };
            });
            
            return data;
        } finally {
            await browser.close();
        }
    } else {
        // Version web : utilise l'API du serveur
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du scraping');
        }
        
        return await response.json();
    }
}

module.exports = {
    scrapePage
}; 