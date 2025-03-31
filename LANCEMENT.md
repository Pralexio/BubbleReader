# Instructions de lancement de BubbleReader

## Prérequis
- Node.js installé (v14 ou supérieur recommandé)
- NPM installé
- MongoDB installé et en cours d'exécution

## Lancement de l'application

Pour démarrer à la fois le serveur et le client avec un seul délai, utilisez la commande suivante à la racine du projet :

```
npm start
```

Cette commande va :
1. Démarrer le serveur MongoDB (assurez-vous qu'il est configuré et en cours d'exécution)
2. Lancer le serveur backend dans le dossier `Server/`
3. Attendre 10 secondes pour s'assurer que le serveur est complètement démarré
4. Lancer le client Electron dans le dossier `Client/`

## Comment ça marche

Le script utilise Node.js pour gérer le lancement séquentiel des processus :
- Il lance d'abord le serveur backend
- Il attend un délai configurable (actuellement 10 secondes)
- Il démarre ensuite le client Electron
- Les deux processus sont liés, donc fermer la console terminera à la fois le serveur et le client

## Problèmes connus

Si vous rencontrez des problèmes de connexion :

1. Vérifiez que MongoDB est en cours d'exécution
2. Assurez-vous que le port 5000 est disponible pour le serveur
3. Vérifiez les variables d'environnement dans les fichiers `.env`

## Configuration avancée

Pour modifier le délai entre le démarrage du serveur et du client, vous pouvez éditer la constante `DELAY_SECONDS` dans le fichier `launch.js`.

## Autres commandes disponibles

- `npm run dev` : Utilise concurrently pour lancer le serveur et le client avec un délai
- `npm run start:server` : Lance uniquement le serveur backend
- `npm run start:client` : Lance uniquement le client Electron 