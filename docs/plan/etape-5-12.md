# Fiche étape 5.12 - Le son qui fait ramer l'iPhone

Brief de session. Objectif unique: **que le son ne fasse plus ramer la page sur iPhone**, et que le relevé dise dans quel état était le son. Sans rien changer à ce qui s'entend.

## Origine de cette fiche

Issue d'un relevé de l'étape 5.9, sur décision du 5 octobre 2026 (ROADMAP, section 5). Rédigée le même jour selon le cas de repli du PROTOCOLE, à partir de l'entrée 5.12 du ROADMAP, des relevés `docs/mesures/5-9/telephone-tactique-300-*.txt`, de l'état du dépôt au commit `ad39258` et de la fiche 8.6 prise comme modèle.

## Ce qu'on sait en entrant

- Sur l'iPhone du porteur du projet (iOS 18.7, Firefox, donc WebKit), en Tactique à 300 faux ninjas avec pluie: **9,5 images par seconde avec le son, 59,9 sans** (`&son=0`), le reste égal. Le serveur et le réseau sont réguliers dans les deux relevés.
- Avec le son, **notre code** prend jusqu'à 390 ms par image (centile 99: 276 ms), et la dégradation s'installe après une dizaine de secondes. Sans le son, il ne dépasse pas 5 ms.
- Le temps se perd aux deux endroits de la boucle de rendu qui appellent le lecteur: les sons des faits et des changements d'état (dans « saisie, sons, lissage », pointes à 305 ms), et les bruits de pas, joués après le HUD (environ 12 ms par image en moyenne, hors des deux sous-totaux).
- Chaque son ponctuel est **un élément audio branché sur Web Audio** (étape 5.5, pour que le volume marche sous iOS), **relancé par `currentTime = 0` puis `play()`**. Un pas part toutes les 250 ms tant qu'on marche, un coup de fusil à chaque tir. Sous WebKit, un élément audio est un lecteur multimédia complet: le replacer au début et le relancer se paie sur le fil principal.
- Le WebKit de Playwright sous Windows n'a pas Web Audio, et Chromium ne montre rien: le défaut ne se reproduit pas sur le poste. La preuve viendra du relevé sur l'iPhone.

## Décisions prises par cette fiche

1. **Les effets ne passent plus par des éléments audio quand Web Audio existe.** Chaque fichier d'effet (sons ponctuels, pas, boucles de bonus) est chargé et décodé une fois en tampon, puis joué par une source de tampon, sans élément, sans retour au début. C'est l'usage prévu de Web Audio pour les bruitages d'un jeu.
2. **Une voix par son**, comme avant: relancer un son coupe sa lecture précédente. Ce qui s'entend ne change pas.
3. **La musique reste un élément audio** branché sur son gain: elle est longue, se lit en continu et ne se relance qu'en changeant d'écran. La décoder coûterait des dizaines de mégaoctets.
4. **Le chargement des effets part au premier geste du joueur**, celui qui débloque le son: la première ouverture de la page ne paie pas leurs 3,7 Mo. Chaque fichier se charge pour son compte; un effet pas encore prêt, ou qui n'a pas pu se charger, se tait sans erreur.
5. **Un effet demandé pendant que le contexte audio ne tourne pas se tait**, au lieu d'attendre la reprise et de partir en rafale avec les autres.
6. **Sans Web Audio** (tests, très vieux navigateur), le lecteur garde les éléments audio, comme avant.
7. **Le relevé dit l'état du son**: retiré par la variante, coupé par le panneau, ou joué, avec les volumes, la voie (Web Audio ou éléments), l'état du contexte et le nombre d'effets prêts. Une variante `&musique=0` retire la musique seule, pour départager effets et musique si le défaut résistait.

## Périmètre

- `packages/client/src/sons/lecteur.ts`, ses tests, et ses doublures.
- `packages/client/src/diagnostic/`: la ligne « Son » et la variante `musique`.
- `packages/client/src/principal.ts`: le branchement.
- La documentation: le ROADMAP, l'audit 8.5 si sa lecture des relevés change.

## Hors périmètre

- Les fichiers de son eux-mêmes, leurs volumes relatifs, ce qui déclenche quel son (`declencheurs.ts`).
- Toute règle de jeu, `packages/sim`, le serveur.

## Tests requis

- Le lecteur avec Web Audio: aucun élément pour les effets, la source de tampon branchée sur le bon gain, une voix par son, le silence d'un effet pas prêt ou contexte suspendu, l'indépendance des chargements, le chargement au premier déblocage et une seule fois, les boucles, la coupure, l'état rendu au relevé.
- Le lecteur sans Web Audio: inchangé.
- Le relevé: la ligne « Son » dans ses trois cas, la variante `musique`.
- Bout en bout vert, relevé compris.
- Sur l'iPhone, son compris: un relevé revenu à la cadence du 25 septembre.

## Définition de terminé

1. Les effets ne passent plus par un élément audio là où Web Audio existe.
2. Le relevé dit l'état du son.
3. Un relevé sur l'iPhone, son compris, est consigné dans `docs/mesures/`, et revient vers 60 images par seconde. Il dépend du porteur du projet: tant qu'il manque, l'étape est close en partiel.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-12-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. La prochaine étape suit l'ordre de la section 3 du ROADMAP.
