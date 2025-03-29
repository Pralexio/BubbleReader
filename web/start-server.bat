@echo off
echo Installation des dependances...
call npm install
if %errorlevel% neq 0 (
    echo Erreur lors de l'installation des dependances
    pause
    exit /b %errorlevel%
)

echo.
echo Demarrage du serveur...
node server.js
if %errorlevel% neq 0 (
    echo Erreur lors du demarrage du serveur
    pause
    exit /b %errorlevel%
)

pause 