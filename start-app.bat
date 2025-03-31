@echo off
echo Démarrage de l'application BubbleReader...
echo.
echo Serveur et client seront lancés simultanément.
echo Fermer cette fenêtre arrêtera les deux processus.
echo.
cd %~dp0
npm run dev
pause 