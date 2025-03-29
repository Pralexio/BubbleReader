# BubbleReader

Application de lecture de scans de mangas / Manwha / Webtoon / Manhua

## Structure du projet

Le projet est maintenant organisé en trois parties principales:

### 1. Application Electron (`/app`)

Cette partie contient l'application desktop Electron.

- `/app/src` : Contient le code source de l'application
- `/app/assets` : Contient les ressources (images, icônes, etc.)

### 2. Serveur Web (`/server`)

Cette partie contient le serveur web qui permet d'accéder à l'application via un navigateur.

- `/server/src` : Contient le code source du serveur
- `/server/public` : Contient les fichiers statiques (HTML, CSS, JS)

### 3. Code partagé (`/shared`)

Cette partie contient le code partagé entre l'application et le serveur.

- `/shared/utils` : Contient les utilitaires communs

## Installation

```bash
npm run install:all
```

Cette commande installera toutes les dépendances pour le projet principal, l'application et le serveur.

## Démarrage

### Application Electron

```bash
npm run start:app
```

### Serveur Web

```bash
npm run start:server
```

Ou lancez directement le fichier `server/start-server.bat` sous Windows.

## Compilation de l'application

```bash
npm run build:app
```

Cette commande générera les exécutables de l'application dans le dossier `dist`.

## 📖 À propos

BubbleReader est une application de lecture de scans de mangas, manhwas, webtoons et manhuas. Elle permet de lire facilement vos séries préférées depuis Phenix-Scans avec une interface moderne et intuitive.
Ajout d'une version web pour mobile `http://bubblereader.zapto.org`

## ✨ Fonctionnalités

- 🔍 Recherche rapide de séries
- 📚 Liste des derniers chapitres disponibles
- 💾 Sauvegarde automatique de votre progression de lecture
- 📱 Interface adaptative et moderne
- 🌙 Mode sombre par défaut
- 📖 Lecture fluide sans espaces entre les pages
- 🔖 Historique de lecture avec gestion des chapitres

## 🚀 Installation

1. Téléchargez la dernière version de BubbleReader depuis la section [Releases](https://github.com/votre-repo/BubbleReader/releases)
2. Exécutez le fichier d'installation `BubbleReader Setup.exe`
3. Choisissez votre dossier d'installation
4. Lancez l'application depuis le raccourci créé sur le bureau ou le menu démarrer

## 💻 Développement

### Prérequis

- Node.js (v14 ou supérieur)
- npm (v6 ou supérieur)

### Installation pour le développement

```bash
# Cloner le repository
git clone https://github.com/votre-repo/BubbleReader.git

# Accéder au dossier
cd BubbleReader

# Installer les dépendances
npm install

# Lancer l'application en mode développement
npm start
```

### Construction

```bash
# Créer l'installateur
npm run dist
```

## 🛠️ Technologies utilisées

- Electron
- Node.js
- Cheerio
- Puppeteer
- Axios

## 📝 Gestion de la progression

BubbleReader sauvegarde automatiquement votre progression de lecture pour chaque série. Vous pouvez :
- Voir votre dernier chapitre lu
- Modifier manuellement le numéro de chapitre
- Réinitialiser votre progression
- Supprimer l'historique d'une série

## ⚖️ Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Phenix-Scans](https://phenix-scans.com/) pour leur excellent travail de traduction
- La communauté Electron pour leurs outils et leur documentation
- Tous les contributeurs qui ont aidé à améliorer cette application

## ⚠️ Avertissement légal

Cette application est un lecteur de contenu et ne stocke aucun scan. Tout le contenu est fourni par des sources externes. Nous encourageons les utilisateurs à supporter les créateurs originaux en achetant les œuvres officielles lorsqu'elles sont disponibles. 
