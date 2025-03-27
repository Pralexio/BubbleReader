const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const sources = {
    phenixScans: {
        name: 'Phenix Scans',
        baseUrl: 'https://phenix-scans.com',
        mangaList: [],
        cacheFile: path.join(__dirname, 'manga-list.json'),

        // Fonction pour sauvegarder la liste dans un fichier JSON
        saveMangaList(mangaList) {
            fs.writeFileSync(this.cacheFile, JSON.stringify(mangaList, null, 2), 'utf8');
            console.log('Liste des mangas sauvegardée avec succès');
        },

        // Fonction pour charger la liste depuis le fichier JSON
        loadMangaList() {
            try {
                if (fs.existsSync(this.cacheFile)) {
                    console.log('Chargement de la liste des mangas depuis le fichier local');
                    return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                }
            } catch (error) {
                console.error('Erreur lors du chargement de la liste:', error);
            }
            return null;
        },

        // Fonction pour récupérer la liste des mangas
        async fetchMangaList() {
            try {
                // Vérifier si une liste existe déjà
                const existingList = this.loadMangaList();
                if (existingList) {
                    this.mangaList = existingList;
                    return existingList;
                }

                console.log('Récupération de la liste des mangas depuis Phenix Scans...');
                const mangaSet = new Set();
                const response = await axios.get(`${this.baseUrl}/manga`);
                const $ = cheerio.load(response.data);

                // Sélectionner tous les conteneurs de manga
                $('.series-item, article.manga-item, .manga-entry').each((_, element) => {
                    const $item = $(element);
                    const title = $item.find('h2, h3, .title').first().text().trim();
                    const link = $item.find('a').first().attr('href');
                    const img = $item.find('img').first();
                    const cover = img.attr('src') || img.attr('data-src');

                    if (title && link) {
                        // Extraire le slug du lien
                        const slug = link.split('/').pop();
                        
                        const manga = {
                            title: title,
                            slug: slug,
                            cover: cover ? (cover.startsWith('http') ? cover : `${this.baseUrl}${cover}`) : null,
                            url: link.startsWith('http') ? link : `${this.baseUrl}${link}`,
                            source: 'phenixScans'
                        };

                        mangaSet.add(JSON.stringify(manga));
                    }
                });

                // Convertir le Set en array
                this.mangaList = Array.from(mangaSet).map(manga => JSON.parse(manga));
                
                // Sauvegarder la liste
                this.saveMangaList(this.mangaList);
                
                console.log(`${this.mangaList.length} mangas trouvés et sauvegardés`);
                return this.mangaList;

            } catch (error) {
                console.error('Erreur lors de la récupération de la liste des mangas:', error);
                return [];
            }
        },

        // Fonction simple de recherche
        async searchManga(query) {
            if (!query || query.length < 2) {
                return [];
            }

            // Si la liste n'est pas chargée, la charger
            if (this.mangaList.length === 0) {
                await this.fetchMangaList();
            }

            const searchTerm = query.toLowerCase();
            return this.mangaList.filter(manga => 
                manga.title.toLowerCase().includes(searchTerm)
            );
        },

        // Fonction pour récupérer les chapitres d'un manga
        async getChapters(mangaSlug) {
            try {
                const url = `${this.baseUrl}/manga/${mangaSlug}`;
                const response = await axios.get(url);
                const $ = cheerio.load(response.data);
                const chapters = [];

                $('.chapters-list li, .chapter-item').each((_, element) => {
                    const $chapter = $(element);
                    const link = $chapter.find('a').first();
                    const chapterUrl = link.attr('href');
                    const title = link.text().trim();
                    const number = title.match(/\d+/)?.[0];

                    if (chapterUrl && number) {
                        chapters.push({
                            number: parseInt(number),
                            title: title,
                            url: chapterUrl.startsWith('http') ? chapterUrl : `${this.baseUrl}${chapterUrl}`
                        });
                    }
                });

                return chapters.sort((a, b) => b.number - a.number);
            } catch (error) {
                console.error(`Erreur lors de la récupération des chapitres:`, error);
                return [];
            }
        }
    }
};

module.exports = sources; 