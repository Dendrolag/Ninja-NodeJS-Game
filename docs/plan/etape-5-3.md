# Fiche étape 5.3 - Déploiement en parallèle

Brief de session. Objectif unique: déployer la nouvelle version à côté de l'ancienne, sans bascule sèche, pour permettre une transition contrôlée et réversible.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 5.2 (la version tient la charge cible), puis cette fiche.

## Objectif

Mettre la nouvelle version en production en parallèle de l'ancien monolithe, de façon à pouvoir y diriger une partie du trafic, observer, et revenir en arrière sans incident en cas de problème.

## Périmètre

1. Cible de déploiement: préparer l'hébergement de la nouvelle version. Client sur Vercel, base sur Neon en région de production. Pour le serveur de jeu, c'est ici que se décide le passage de Render (utilisé en construction) vers Fly.io pour la production, afin de placer le serveur près des joueurs et réduire la latence. Choisir la région du serveur et y co-localiser la base. Si le volume de départ est faible, rester sur Render un temps reste possible, la bascule vers Fly se justifie quand la latence pour de vrais joueurs le demande.
2. Mécanisme de bascule: un drapeau de fonctionnalité ou un déploiement séparé permettant de diriger une fraction des joueurs vers la nouvelle version, le reste restant sur l'ancienne.
3. Réversibilité: pouvoir ramener le trafic vers l'ancienne version immédiatement, sans perte, en cas de problème.
4. Observabilité: mettre en place le minimum de surveillance (erreurs serveur, latence, état des rooms) pour décider en connaissance de cause.

## Hors périmètre

- Pas d'extinction de l'ancien monolithe ici. C'est la phase 6.
- Pas de migration massive des joueurs ici. On dirige une fraction du trafic, la bascule complète est la phase 6.

## Tests requis

- Vérification que la nouvelle version se déploie et démarre dans l'environnement cible.
- Vérification que la bascule dirige bien le trafic prévu, et que le retour arrière fonctionne.
- Vérification que la surveillance remonte les indicateurs clés.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La nouvelle version tourne en production à côté de l'ancienne.
2. La bascule contrôlée et le retour arrière fonctionnent.
3. La surveillance est en place.

## Fin de phase 5

Cette étape clôt la phase 5. La nouvelle version tient la charge cible et tourne en production en parallèle, prête pour une bascule progressive.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-3-handoff.md. Décrire le mécanisme de bascule et de retour arrière, et les indicateurs surveillés. Prochaine action exacte pour l'étape 6.1: migrer progressivement les joueurs, surveiller, puis retirer l'ancien monolithe, avec un plan de retour arrière documenté. Commiter.
