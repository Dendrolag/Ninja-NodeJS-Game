# Fiche étape 4.4 - Bout en bout multi-clients

Brief de session. Objectif unique: couvrir les parcours réels d'un joueur en bout en bout, avec plusieurs clients simultanés et en fenêtre mobile. C'est ici que le multijoueur se teste vraiment. Cette étape clôt la phase 4.

## Rituel de début de session

Lire CLAUDE.md, les handoffs des étapes 4.1 à 4.3, puis cette fiche. L'outil de bout en bout est Playwright, en place depuis l'étape 0.1.

## Objectif

Écrire des tests Playwright qui rejouent les parcours critiques dans un vrai navigateur, dont un scénario à deux clients simultanés pour vérifier la cohérence du multijoueur, et une vérification en fenêtre mobile.

## Périmètre (parcours critiques)

1. Parcours complet solo: inscription ou connexion, rejoindre une partie publique, jouer, capturer un faux ninja, voir le score, et vérifier que la progression est bien sauvegardée après la partie.
2. Parcours privé à deux clients: deux navigateurs, l'un crée une partie privée et partage le code, l'autre la rejoint par le code. Lancer la partie, l'un capture l'autre ou un bot, et vérifier que les deux clients voient un état cohérent (scores, captures).
3. Fenêtre mobile: rejouer un parcours clé en émulation mobile, pour valider la cible mobile.

Utiliser les contextes de navigateur multiples de Playwright pour les deux clients simultanés.

## Hors périmètre

- Aucune nouvelle fonctionnalité. On teste l'existant.
- Pas de test exhaustif de chaque écran. On cible les parcours vraiment critiques. Le gros de la vérification fine reste dans les tests unitaires du moteur, rapides et stables.
- Pas de test de charge ici. C'est la phase 5.

## Tests requis

- Le parcours complet solo, vert.
- Le parcours privé à deux clients vérifiant la cohérence de l'état, vert.
- Le parcours en fenêtre mobile, vert.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les trois parcours passent en bout en bout.
2. Le scénario à deux clients confirme la cohérence du multijoueur.
3. Ces tests tournent dans la CI.

## Fin de phase 4

Cette étape clôt la phase 4. Le jeu est complet et jouable de bout en bout, des comptes à la partie, testé du moteur jusqu'à l'interface.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-4-handoff.md. Confirmer que les parcours passent et noter toute instabilité résiduelle des tests de bout en bout. Prochaine action exacte pour l'étape 5.1: tests de charge serveur, simuler plusieurs rooms peuplées de plus de 100 bots et mesurer le temps par tick et la bande passante. Commiter.
