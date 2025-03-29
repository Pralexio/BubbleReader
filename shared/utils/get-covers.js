const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getCoverUrls() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox']
  });

  try {
    // Lire le fichier manga-list.json
    const mangaList = JSON.parse(fs.readFileSync('manga-list.json', 'utf8'));
    let updatedMangas = mangaList.mangas;
    
    for (let i = 0; i < updatedMangas.length; i++) {
      const manga = updatedMangas[i];
      const page = await browser.newPage();
      
      // Construire l'URL de la page du manga
      const mangaUrl = `https://phenix-scans.com/manga/${manga.slug}`;
      
      try {
        await page.goto(mangaUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Attendre que l'image de couverture soit chargée et récupérer son URL
        const coverUrl = await page.evaluate(() => {
          // Essayer différents sélecteurs pour trouver l'image
          const selectors = [
            'img.manga-cover-image',
            '.manga-cover img',
            '.cover img',
            '.manga-header img',
            'img[alt*="cover"]',
            'img[alt*="couverture"]',
            '.project_cover',
            'img.project_cover'
          ];
          
          for (const selector of selectors) {
            const img = document.querySelector(selector);
            if (img && img.src) {
              console.log('Trouvé avec le sélecteur:', selector);
              return img.src;
            }
          }
          
          // Si aucun sélecteur ne fonctionne, afficher la structure HTML pour debug
          const allImages = document.querySelectorAll('img');
          console.log('Toutes les images trouvées:', Array.from(allImages).map(img => ({
            src: img.src,
            class: img.className,
            alt: img.alt
          })));
          return null;
        });

        if (coverUrl) {
          updatedMangas[i] = {
            ...manga,
            cover: coverUrl
          };
          console.log(`✅ Cover trouvée pour ${manga.title}: ${coverUrl}`);
          
          // Sauvegarder après chaque manga réussi
          fs.writeFileSync(
            'manga-list.json',
            JSON.stringify({ mangas: updatedMangas }, null, 2),
            'utf8'
          );
        } else {
          console.log(`❌ Pas de cover trouvée pour ${manga.title}`);
        }
        
      } catch (error) {
        console.error(`Erreur pour ${manga.title}:`, error.message);
      }
      
      await page.close();
      
      // Attendre un peu entre chaque requête pour éviter de surcharger le serveur
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✨ Toutes les covers ont été récupérées et sauvegardées !');
    
  } catch (error) {
    console.error('Erreur générale:', error);
  } finally {
    await browser.close();
  }
}

getCoverUrls(); 