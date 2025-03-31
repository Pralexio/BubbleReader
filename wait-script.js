// Script pour gérer le délai entre le démarrage du serveur et du client
console.log('\n');
console.log('┌───────────────────────────────────────────────┐');
console.log('│ Attente du démarrage du serveur BubbleReader  │');
console.log('├───────────────────────────────────────────────┤');

// Durée du délai en secondes
const WAIT_TIME = 5;
const startTime = Date.now();

// Affichage d'un compte à rebours
function showProgress() {
  const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
  const remainingTime = WAIT_TIME - elapsedTime;
  
  if (remainingTime >= 0) {
    process.stdout.write(`│ Délai restant: ${remainingTime} secondes ${' '.repeat(26)}│\r`);
    
    if (remainingTime > 0) {
      setTimeout(showProgress, 1000);
    } else {
      process.stdout.write(`│ Délai terminé. Démarrage du client...${' '.repeat(14)}│\n`);
      console.log('└───────────────────────────────────────────────┘');
      console.log('\n');
    }
  }
}

// Démarrer le compte à rebours
showProgress();

// Attendre la fin du délai
setTimeout(() => {
  // Ce script se terminera automatiquement après le délai
}, WAIT_TIME * 1000); 