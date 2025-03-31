# Guide de Contribution

Merci de votre intérêt pour contribuer à BubbleReader ! Voici quelques lignes directrices pour vous aider à démarrer.

## Comment contribuer

1. **Fork & Clone**
   ```bash
   git clone https://github.com/votre-username/BubbleReader.git
   cd BubbleReader
   npm install
   ```

2. **Créer une branche**
   ```bash
   git checkout -b feature/ma-nouvelle-fonctionnalite
   ```

3. **Développement**
   - Suivez les standards de code existants
   - Commentez votre code quand nécessaire
   - Testez vos modifications

4. **Commit**
   ```bash
   git commit -m "feat: ajout d'une nouvelle fonctionnalité"
   ```
   Suivez les conventions de commit:
   - `feat:` pour une nouvelle fonctionnalité
   - `fix:` pour une correction de bug
   - `docs:` pour la documentation
   - `style:` pour le formatage
   - `refactor:` pour une refactorisation
   - `test:` pour les tests
   - `chore:` pour la maintenance

5. **Push & Pull Request**
   ```bash
   git push origin feature/ma-nouvelle-fonctionnalite
   ```
   Créez une Pull Request avec une description claire de vos modifications.

## Structure du Projet

```
BubbleReader/
├── Client/           # Code de l'application Electron
├── Server/           # API Backend
├── assets/          # Ressources statiques
└── docs/            # Documentation
```

## Guidelines de Code

- Utilisez ES6+ et les fonctionnalités modernes de JavaScript
- Suivez les bonnes pratiques d'Electron
- Maintenez une architecture propre et modulaire
- Documentez les nouvelles fonctionnalités
- Testez vos modifications avant de soumettre

## Rapporter des Bugs

Utilisez le système d'issues de GitHub :
1. Vérifiez si le bug n'a pas déjà été signalé
2. Créez une nouvelle issue avec un titre clair
3. Décrivez :
   - Les étapes pour reproduire
   - Le comportement attendu
   - Le comportement actuel
   - Screenshots si possible
   - Votre environnement (OS, version de Node, etc.)

## Proposer des Améliorations

1. Ouvrez une issue "Enhancement"
2. Décrivez votre idée en détail
3. Expliquez pourquoi cette amélioration serait utile
4. Attendez les retours avant de commencer le développement

## Questions ?

N'hésitez pas à ouvrir une issue pour toute question. 