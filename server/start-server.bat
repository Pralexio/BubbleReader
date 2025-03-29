@echo off
title BubbleReader Server
echo Demarrage du serveur BubbleReader...
echo.
echo Acces au serveur: http://localhost:3030
echo.
echo Pour arreter le serveur, fermez cette fenetre
echo.
cd /d "%~dp0"
node src/server.js
pause 