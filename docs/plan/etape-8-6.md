# Fiche étape 8.6 - La régularité du battement en production

Brief de session. Objectif unique: **savoir si les instantanés partent du serveur à l'heure**, pour dire si les à-coups ressentis sur téléphone naissent dans le serveur ou sur le chemin jusqu'à lui. Sans rien changer au jeu.

## Origine de cette fiche

Issue de l'audit de l'étape 8.5 (`docs/mesures/audit-saccades-telephone.md`, sections 6 et 8), et demandée par le porteur du projet le 25 septembre 2026, qui a voulu la traiter dans la conversation de l'étape 8.5, avant de passer à `8.3` dans une conversation neuve.

Rédigée selon le cas de repli du PROTOCOLE, à partir de l'audit 8.5, de l'état du dépôt au commit `b9fe881` et de la fiche 8.5 prise comme modèle.

## Ce qu'on sait en entrant

- Sur un iPhone 14 Pro, **le dessin est fluide**, mais les instantanés arrivent irrégulièrement: un écart d'au moins 100 ms toutes les deux à trois secondes, et, certains jours, bien pire (audit 8.5, section 6.4).
- **Pas de retard ajouté à l'affichage**: décision du porteur du projet, le 25 septembre 2026.
- Le serveur de production tourne sur l'offre gratuite de Render, dont la puissance n'est pas garantie. Sa boucle vise un battement toutes les 50 ms, et rattrape un petit retard (étape 5.2, `rappelSuivant`), mais elle ne dit nulle part ce qu'elle tient réellement.

## Décisions prises par cette fiche

1. **Le serveur chronomètre chaque battement de chaque partie**: l'écart réel depuis le battement précédent de la même partie, et le temps du battement entier, moteur, projection, codage et envoi compris. Dans un tableau tournant de taille fixe, sans allocation.
2. **Il le résume sur sa route `/sante`**, qui existe déjà: les cinq dernières minutes, toutes parties confondues, en répartitions (médiane, neuvième décile, centile 99, maximum) et en compte des écarts d'au moins 100 ms. Calculé à la demande seulement.
3. **La page peut lire `/sante` depuis son origine**: une origine autorisée (`ORIGINES_AUTORISEES`) reçoit l'en-tête du contrôle d'accès, comme pour les comptes.
4. **Le relevé `?diagnostic=1` recopie ce résumé** à côté du sien. Il le lit pendant la partie et à sa fin, pas au moment de la copie: Safari n'écrit dans le presse-papiers que pendant le geste, qui ne peut pas attendre le réseau.
5. **La forme du résumé vit dans `packages/shared`**, avec sa vérification: la page ne croit pas le réseau sur parole.

## Périmètre

- `packages/server`: le chronomètre, son branchement sur la boucle des parties, `/sante`.
- `packages/shared`: la forme du résumé et sa lecture.
- `packages/client`: la section « Serveur » du relevé.
- La documentation: l'audit 8.5, `docs/deploiement.md`, le ROADMAP.

## Hors périmètre

- Toute règle de jeu, `packages/sim`.
- Tout changement d'hébergement: c'est la décision que la mesure prépare, pas l'étape.
- Tout changement du lissage.

## Tests requis

- Le chronomètre, sur des séries connues: répartitions, retards, fenêtre, capacité fixe.
- La boucle d'une partie alimente le chronomètre.
- `/sante`: le résumé, `null` sans battement, l'en-tête d'accès pour une origine autorisée et elle seule.
- La lecture du résumé dans le paquet partagé, réponses malformées comprises.
- La section « Serveur » du relevé.
- Le scénario de bout en bout du relevé lit les battements du serveur à la fin d'une partie.

## Définition de terminé

1. `/sante` en production dit l'écart réel entre les battements des cinq dernières minutes.
2. Le relevé de la page le recopie.
3. Une première mesure en production est consignée dans l'audit 8.5.
4. La façon de lire ces chiffres est écrite pour une personne non technique.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-6-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. La prochaine étape est `8.3`, dans une conversation neuve.
