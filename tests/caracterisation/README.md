# Tests de caractérisation du legacy

Ce dossier fige le comportement du jeu d'origine avant tout portage. C'est le
produit de l'étape 0.2 (voir `docs/plan/etape-0-2.md`).

## À quoi ça sert

Le gameplay de Neon Ninja est réglé depuis deux ans. La réécriture doit le
préserver. Ces tests décrivent, pour des situations de jeu précises, ce que le
serveur d'origine produit aujourd'hui: qui capture qui, quels scores, quelles
collisions, quels effets. Le portage de la phase 1 devra reproduire ces mêmes
sorties.

Ils ne décrivent pas un idéal. Ils décrivent l'existant, y compris ce qui
surprend. Chaque comportement surprenant porte un commentaire dans le test, et
figure dans `docs/handoffs/etape-0-2-handoff.md` avec son classement:
comportement de jeu à préserver, défaut de sécurité à corriger par conception,
ou bug franc à ne pas reproduire.

## Ce qui est couvert

| Fichier              | Domaine                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `capture.test.ts`    | Capture de joueur, de bot, par bot noir, et refus de capture           |
| `collisions.test.ts` | Carte de collisions, contacts entre entités, déplacement contre un mur |
| `score.test.ts`      | Calcul des scores et classement                                        |
| `effets.test.ts`     | Bonus, malus, expiration                                               |
| `harnais.test.ts`    | Le harnais lui-même, pas le jeu                                        |

Les instantanés de référence sont dans `__snapshots__/`. Ils sont versionnés:
un instantané qui change signale un changement de comportement, à examiner et
non à régénérer sans réfléchir.

## Comment le legacy est rendu testable

`harnais/charger-legacy.ts` porte l'explication complète. En résumé:
`legacy/server.js` ouvre un serveur, décode une image et démarre une boucle de
jeu dès qu'on l'importe, et il garde tout son état dans des variables de module.
Le harnais le lit donc comme du texte, remplace ses seules lignes d'import, et
évalue le reste dans une fonction dont les paramètres portent les noms des
éléments à contrôler: `Date`, `Math`, `setTimeout`, `console` et les
dépendances externes. Un paramètre masque la globale de même nom, donc le code
d'origine n'est pas retouché: il continue d'appeler `Date.now()`, mais cet appel
atteint l'horloge que le test lui fournit.

Chaque appel à `creerHarnais()` produit une instance neuve, avec son propre état
global. La remise à zéro entre deux scénarios est donc gratuite.

`legacy/` n'est jamais écrit, seulement lu.

## Ce que ce harnais deviendra

Rien. Il disparaîtra avec le legacy, à l'étape 6.1. Le temps injecté et le
hasard à graine qu'il simule ici deviennent, dans la nouvelle base, le paramètre
`dt` du moteur et le générateur à graine de `packages/shared` (étape 1.1). C'est
la même idée, appliquée proprement à la source au lieu d'être plaquée après
coup.
