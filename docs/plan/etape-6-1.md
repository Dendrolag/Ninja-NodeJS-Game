# Fiche étape 6.1 - Bascule et extinction du legacy

Brief de session. Objectif unique: migrer progressivement les joueurs vers la nouvelle version, surveiller, puis retirer l'ancien monolithe. Dernière étape de la roadmap.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 5.3 (déploiement en parallèle, bascule et surveillance en place), puis cette fiche.

## Objectif

Augmenter progressivement la part de joueurs sur la nouvelle version jusqu'à la totalité, en surveillant à chaque palier, puis éteindre l'ancien monolithe une fois la nouvelle version stable et seule en charge.

## Périmètre

1. Bascule progressive: augmenter par paliers la fraction de trafic dirigée vers la nouvelle version, en observant les indicateurs à chaque palier avant d'aller plus loin.
2. Plan de retour arrière: à chaque palier, garder la possibilité de revenir à l'ancienne version sans perte, et documenter la procédure.
3. Surveillance: suivre erreurs, latence, stabilité des rooms, et le bon déroulement des fins de partie et de la progression, tout au long de la bascule.
4. Extinction: une fois la totalité du trafic sur la nouvelle version et la stabilité confirmée sur une durée suffisante, retirer l'ancien monolithe.
5. Nettoyage final: le dossier legacy/ peut rester en archive de référence dans le dépôt, mais l'ancien service en production est arrêté.

## Hors périmètre

- Aucune nouvelle fonctionnalité. Cette étape est une bascule d'exploitation.
- Aucune suppression de données. La migration préserve les comptes et la progression.

## Tests requis

- Vérification que chaque palier de bascule se passe sans dégradation des indicateurs.
- Vérification que le retour arrière reste possible jusqu'à l'extinction.
- Vérification, après extinction, que la nouvelle version assure seule l'ensemble du service.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La totalité du trafic est sur la nouvelle version, stable.
2. L'ancien monolithe est arrêté.
3. La procédure suivie et le plan de retour arrière sont documentés.

## Fin de la roadmap

Cette étape clôt la réécriture. Le monolithe legacy est éteint, la nouvelle base est seule en production, avec son filet de tests, son architecture multi-room, sa persistance, et son interface. Les fonctionnalités reportées (autres modes, pass de saison, skins, clans) peuvent désormais s'ajouter sur cette base, chacune comme un ajout couvert par des tests, sans refonte.

## Rituel de fin de session

Écrire docs/handoffs/etape-6-1-handoff.md. Documenter la bascule réalisée et l'état final. Indiquer comme suite possible la reprise du backlog reporté, à planifier au même format de fiches et de handoffs. Commiter.
