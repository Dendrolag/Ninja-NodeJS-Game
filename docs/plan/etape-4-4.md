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

## Réconciliation, faite le 10 septembre 2026

Cette fiche décrit des parcours qui supposent les comptes (3.2), la progression (3.3) et les parties privées par code (2.4). La section 3 du ROADMAP place l'étape à la fin du jalon 1, avant ces trois étapes, et en restreint le périmètre: **ni inscription ni progression, deux clients dans la même partie, une capture, un score cohérent, et un test de fumée en fenêtre mobile**. Le ROADMAP fait foi. Les écarts, point par point.

1. **Le parcours solo se fait sans compte ni progression.** Le joueur entre avec un pseudo, règle une partie courte, capture un faux ninja, voit son score, joue jusqu'au bout et retrouve au classement final ce que le serveur a compté. La sauvegarde de la progression se vérifiera à l'étape 3.3.
2. **Les deux clients se retrouvent sans code de partie.** Les parties privées arrivent avec l'étape 2.4. Ils se rejoignent par la règle provisoire du premier salon en attente; le premier arrivé est hôte.
3. **La capture vérifiée est celle d'un joueur.** La fiche admet un joueur ou un bot. La capture de joueur est celle qui transfère des ninjas et concerne les deux clients à la fois. Chacun capture d'abord un faux ninja, pour que le transfert porte sur quelque chose.
4. **La fenêtre mobile est jouée deux fois.** Le parcours solo tourne aussi dans le projet mobile, où le joueur se déplace par la manette virtuelle. Dans la partie à deux, le second joueur est un téléphone. Le scénario de navigation de l'étape 4.3 tournait déjà en mobile.
5. **Provoquer une capture demande de savoir où sont les joueurs**, et la page ne le dit pas. Le scénario lit l'état du serveur, qui tourne dans son propre processus, et déplace les joueurs par de vraies saisies, clavier ou tactiles. Rien n'est ajouté au code du jeu pour les tests. Décision au journal de conception.
6. **Rien à changer dans la CI.** Le travail « Bout en bout » lance `pnpm test:e2e`, donc tous les scénarios, depuis l'étape 0.1.

Les tests requis sont ajustés en conséquence: parcours solo en bureau et en mobile, partie à deux joueurs vérifiant le salon partagé, les annonces de la capture et le classement final des deux clients contre celui du serveur.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-4-handoff.md. Confirmer que les parcours passent et noter toute instabilité résiduelle des tests de bout en bout. Prochaine action exacte pour l'étape 5.1: tests de charge serveur, simuler plusieurs rooms peuplées de plus de 100 bots et mesurer le temps par tick et la bande passante. Commiter.
