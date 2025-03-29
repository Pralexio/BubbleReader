const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

function generateReleaseNotes() {
    try {
        // Lire le fichier changelog.json
        const changelogPath = path.join(__dirname, 'changelog.json');
        if (!fs.existsSync(changelogPath)) {
            console.error('❌ Fichier changelog.json introuvable');
            process.exit(1);
        }

        const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
        const currentVersion = version;
        
        if (!changelog[currentVersion]) {
            console.error(`⚠️ Aucun changelog trouvé pour la version ${currentVersion}`);
            // Créer une entrée par défaut
            const defaultChangelog = {
                date: new Date().toISOString().split('T')[0],
                changes: ["Mise à jour de l'application"]
            };
            
            // Mettre à jour le fichier changelog.json
            changelog[currentVersion] = defaultChangelog;
            fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
            console.log(`✅ Entrée de changelog créée pour la version ${currentVersion}`);
        }
        
        // Générer le contenu des notes de version
        let notes = `# Nouveautés de la version ${currentVersion}\n\n`;
        
        // Ajouter les changements
        changelog[currentVersion].changes.forEach(change => {
            notes += `${change}\n`;
        });
        
        // Écrire les notes dans un fichier
        const notesPath = path.join(__dirname, 'RELEASE_NOTES.md');
        fs.writeFileSync(notesPath, notes);
        console.log('✅ Notes de version générées avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de la génération des notes de version:', error);
        process.exit(1);
    }
}

generateReleaseNotes(); 