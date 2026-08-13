# Fiche étape 3.3 - Progression branchée sur la fin de partie

Brief de session. Objectif unique: à la fin d'une partie, calculer les récompenses, faire évoluer la progression du compte, et enregistrer le résultat. C'est ce qui alimente l'écran de fin de partie de la maquette.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.2 (comptes authentifiés), le handoff de l'étape 1.5 (le moteur expose les conditions de fin et les scores), le cadrage docs/design/cadrage.md (écran de fin de partie et données de progression), puis cette fiche.

## Objectif

Quand une GameRoom se termine, lire le résultat produit par le moteur (placement, score), en déduire les récompenses, appliquer l'évolution de la progression du compte, et persister le résultat de partie. À la fin, l'écran de fin de partie a toutes ses données.

## Périmètre

1. Détection de fin: la GameRoom détecte la fin via les conditions de fin pures du moteur (définies en phase 1) et déclenche le traitement de fin. Le déclenchement et la persistance sont côté serveur, le calcul des conditions reste pur dans le moteur.
2. Calcul des récompenses: à partir du placement et du score, déterminer l'XP gagnée, les pièces gagnées, et la variation de points de ligue. Définir des règles simples et claires, documentées.
3. Évolution de la progression: appliquer l'XP au niveau (gestion du passage de niveau), créditer les pièces, mettre à jour les points de ligue et, le cas échéant, le palier de rang. Persister la progression mise à jour.
4. Enregistrement du résultat: écrire le résultat de partie (mode, carte, placement, score, gains, horodatage) rattaché au compte.
5. Défis du jour: seulement si retenus en v1, vérifier l'accomplissement et créditer la récompense.
6. Exposer le récapitulatif de fin: fournir au client les données de l'écran de fin (placement, gains, passage de niveau, variation de rang, défi accompli le cas échéant).

## Hors périmètre

- Aucune logique de pass de saison, de skins ou de clans.
- Aucune échelle de ligue détaillée au-delà de la mise à jour du palier de rang stocké.
- Aucune interface. L'écran de fin est construit en phase 4, ici on fournit les données.

## Tests requis

- TI vérifiant qu'après une partie, la progression du compte reflète les récompenses (XP, niveau, pièces, points de ligue, rang).
- TI sur le passage de niveau: une XP suffisante fait monter le niveau correctement.
- TI sur l'enregistrement: le résultat de partie est persisté et rattaché au bon compte.
- TI sur le récapitulatif: les données fournies au client correspondent à l'évolution réellement appliquée.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La fin de partie applique des récompenses selon des règles documentées.
2. La progression évolue et est persistée, passage de niveau et rang compris.
3. Le résultat de partie est enregistré.
4. Le récapitulatif de fin est exposé au client.
5. Les TI passent.

## Fin de phase 3

Cette étape clôt la phase 3. Les comptes sont persistants et progressent après chaque partie. Avec les phases 1 à 3, le jeu est complet côté serveur et données, prêt pour la construction du client.

## Rituel de fin de session

Écrire docs/handoffs/etape-3-3-handoff.md. Documenter les règles de récompense et la forme du récapitulatif de fin, car l'écran de fin de la phase 4 s'en sert. Prochaine action exacte pour l'étape 4.1: squelette client avec séparation état et rendu, et décodage du flux delta binaire. Commiter.
