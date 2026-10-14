# Étude - Rendre le rôle du traqueur moins difficile, en Chasse

Date: 14 octobre 2026
Statut: étude seulement, rien n'est décidé. Les questions au porteur du projet sont en section 5.

## 1. La demande

En mode Chasse, le rôle du traqueur est trop difficile. Piste du porteur du projet: que les malus ne puissent être déclenchés que par le traqueur, contre les autres joueurs.

## 2. Ce qui se joue aujourd'hui

Les règles sont celles de l'étape 7.3 (`packages/sim/src/chasse.ts`, nombres dans `CHASSE`):

- Un traqueur par tranche de cinq joueurs. Il tire en cône, une fois par seconde, et ne prend que l'entité la plus proche.
- Une proie touchée devient traqueur. Un PNJ touché coûte une vie au traqueur, qui en a trois.
- Les PNJ naissent aux couleurs des proies (étape 2.9): chaque proie a des sosies.
- **Les objets se ramassent par tous**, bonus comme malus, et un malus frappe l'autre camp. Une proie qui ramasse un malus aveugle donc les traqueurs (flou, négatif) ou inverse leurs commandes. Une proie qui ramasse un bonus va plus vite ou devient invincible.

Ce qui rend le traqueur malheureux: il joue seul contre plusieurs, chaque erreur lui coûte une vie, et les objets, ramassés en majorité par les proies puisqu'elles sont plus nombreuses, jouent surtout contre lui.

## 3. Les leviers

**A. Les malus aux traqueurs seuls (la piste du porteur du projet).** Une proie passe sur un malus sans le prendre. Un traqueur le prend, et il frappe les proies. C'est le changement le plus simple: une condition dans la règle du ramassage propre à la Chasse, à côté de `malusEnChasse`. Il retire aux proies leur meilleure arme contre le traqueur et lui en donne une.

Un détail rend la piste meilleure qu'il n'y paraît: un malus subi par une proie la trahit. Avec les commandes inversées, une proie bouge de travers, et un PNJ ne le fait jamais. Le flou et le négatif la gênent sans la montrer.

**B. Les objets aux traqueurs seuls, bonus compris.** Les proies ne ramassent plus rien. Le traqueur gagne aussi la vitesse, l'invincibilité, et surtout la révélation, qui montre les vraies proies. Plus net encore, mais les proies perdent tout ce qui se ramasse: leur partie devient seulement « bouger sans se faire voir ».

**C. Un malus propre à la Chasse, la trace.** Pris par un traqueur, il fait laisser aux proies une traînée brève derrière elles. C'est le malus le plus utile au traqueur, mais il est nouveau, donc plus coûteux: dessin, test, réglage.

**D. Des nombres plus doux, sans toucher aux objets.** Quatre vies au lieu de trois, ou un PNJ touché qui ne coûte une vie qu'une fois sur deux; un tir toutes les 0,7 seconde au lieu d'une. Facile, mais cela ne change pas le sentiment d'être seul contre tous.

## 4. Recommandation

**A, et la révélation réservée aux traqueurs.** Les malus et la révélation ne se ramassent que par un traqueur; la vitesse et l'invincibilité restent à tous. C'est petit (une règle de ramassage et ses tests, l'aide du mode, les notes de version), cela suit la piste du porteur du projet, et la révélation est exactement l'outil qui manque au traqueur: savoir où regarder.

Les tests de caractérisation ne bougent pas: la Chasse n'existait pas dans le jeu d'origine.

## 5. Questions au porteur du projet

1. Les malus aux traqueurs seuls (A): d'accord?
2. La révélation aux traqueurs seuls aussi (recommandé), ou tous les bonus (B), ou aucun?
3. Une proie qui passe sur un objet qu'elle ne peut pas prendre: rien ne se passe (recommandé), ou l'objet disparaît sans effet, ce qui la trahirait?
4. Faut-il aussi adoucir un nombre (D), par exemple quatre vies, ou attendre un essai avec A seul?
