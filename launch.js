const { spawn } = require('child_process');
const path = require('path');

// Configuration
const DELAY_SECONDS = 10;
const SERVER_DIR = path.join(__dirname, 'Server');
const CLIENT_DIR = path.join(__dirname, 'Client');

// Fonction pour créer un préfixe coloré pour les logs
function getPrefix(type) {
  if (type === 'server') {
    return '\x1b[36m[SERVER]\x1b[0m'; // Cyan
  } else if (type === 'client') {
    return '\x1b[35m[CLIENT]\x1b[0m'; // Magenta
  } else {
    return '\x1b[33m[LAUNCH]\x1b[0m'; // Jaune
  }
}

// Fonction pour lancer un processus
function spawnProcess(command, args, options, type) {
  const prefix = getPrefix(type);
  
  console.log(`${prefix} Démarrage de ${command} ${args.join(' ')}...`);
  
  const proc = spawn(command, args, {
    ...options,
    shell: true, // Nécessaire pour Windows
    stdio: 'pipe'
  });
  
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${prefix} ${line}`);
      }
    });
  });
  
  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`${prefix} \x1b[31m${line}\x1b[0m`);
      }
    });
  });
  
  proc.on('error', (error) => {
    console.error(`${prefix} \x1b[31mErreur: ${error.message}\x1b[0m`);
  });
  
  proc.on('close', (code) => {
    console.log(`${prefix} Processus terminé avec le code: ${code}`);
  });
  
  return proc;
}

// Lancer le serveur
console.log(`${getPrefix('launch')} Démarrage de l'application BubbleReader...`);
console.log(`${getPrefix('launch')} Lancement du serveur...`);

const serverProcess = spawnProcess(
  'npm', 
  ['run', 'dev'], 
  { cwd: SERVER_DIR }, 
  'server'
);

// Fonction pour attendre avec un compte à rebours
function countdown(seconds) {
  return new Promise(resolve => {
    console.log(`${getPrefix('launch')} Attente de ${seconds} secondes avant de lancer le client...`);
    
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      process.stdout.write(`${getPrefix('launch')} Démarrage du client dans ${remaining} secondes...\r`);
      
      if (remaining <= 0) {
        clearInterval(interval);
        console.log(`\n${getPrefix('launch')} Délai terminé, lancement du client...`);
        resolve();
      }
    }, 1000);
  });
}

// Attendre le délai puis lancer le client
countdown(DELAY_SECONDS).then(() => {
  const clientProcess = spawnProcess(
    'npm', 
    ['start'], 
    { cwd: CLIENT_DIR }, 
    'client'
  );
  
  // Gestion de la sortie propre
  const cleanup = () => {
    if (serverProcess && !serverProcess.killed) {
      console.log(`${getPrefix('launch')} Arrêt du serveur...`);
      serverProcess.kill();
    }
    if (clientProcess && !clientProcess.killed) {
      console.log(`${getPrefix('launch')} Arrêt du client...`);
      clientProcess.kill();
    }
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}); 