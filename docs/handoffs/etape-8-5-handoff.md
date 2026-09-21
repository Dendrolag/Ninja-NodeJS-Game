# Handoff - Étape 8.5 Audit des saccades sur téléphone, et plan d'action

Date: 21 septembre 2026
Auteur: session Claude Code
Statut: partielle (bloquée sur les relevés du vrai téléphone, comme la fiche le prévoit)

## Objectif de l'étape

Savoir pourquoi le jeu saccade sur un iPhone 14 Pro, chiffres à l'appui, et écrire ce qu'il faut faire. On mesure d'abord, sur le vrai appareil.

## Ce qui a été fait

- **Lot A, l'instrument, fait.** `https://ninja.dendrolag.fr/?diagnostic=1` ouvre un relevé de performance dans la page. Un bandeau en bas de l'écran montre la cadence, le neuvième décile et le centile 99 de la durée d'image, et le compte des images d'au moins 50 ms depuis le début de la partie. Un bouton copie le relevé complet en texte: appareil, dos de rendu réellement utilisé, répartition des durées d'image, part de notre code (rendu et HUD séparés), de PixiJS et de ce qui échappe à nos chronomètres, réseau (instantanés, écarts, battements sautés, images où le lissage attendait), déroulé par fenêtres de 5 secondes, et les vingt pires images. Sans le paramètre, rien n'existe.
- **Des variantes de l'adresse**, au-delà de la fiche, pour trancher chaque hypothèse par une partie de plus sans remettre le jeu en ligne: `son=0`, `hud=0`, `flou=0`, `densite=1`, `cadence=60`, `rendu=webgpu`, `lueur=0`.
- **Lot B, le protocole de recette, écrit**: section 4 de `docs/mesures/audit-saccades-telephone.md`. Neuf parties, dans l'ordre, chacune avec son adresse, ses réglages, sa durée et l'hypothèse qu'elle tranche. Les conditions à noter (iOS, Wi-Fi ou mobile, batterie, économie d'énergie).
- **Lot C, l'audit, commencé**: les quatre formes de saccade et leur signature dans le relevé, l'instrument expliqué pour une personne non technique, douze hypothèses (les dix de la fiche et deux trouvées à la lecture du code), et ce que le banc de l'étape 5.7 ne voit pas par construction. **Le verdict attend les relevés.**
- **Lot D, le plan d'action: pas commencé**, il découle du verdict.
- **Vérifié dans un navigateur de bureau**: une partie de 20 secondes à Tokyo, 59,7 images par seconde, notre code à 0,31 ms, PixiJS à 0,65 ms, 20 instantanés par seconde à 50 ms d'écart médian, 1,5 pour cent d'images tenues. C'est la référence d'un appareil qui ne saccade pas.

## Fichiers créés ou modifiés

- `packages/client/src/diagnostic/demande.ts` (créé): lit l'adresse; ne rend rien sans `diagnostic=1`.
- `packages/client/src/diagnostic/histogramme.ts` (créé): répartition de durées à taille fixe, sans allocation.
- `packages/client/src/diagnostic/releve.ts` (créé): le relevé, pur, qui rend le texte.
- `packages/client/src/diagnostic/diagnostic.ts` (créé): le bandeau, le chronomètre du dessin de PixiJS, le suivi des instantanés, et la variante de cadence.
- `packages/client/src/diagnostic/diagnostic.test.ts` (créé): 15 tests.
- `packages/client/src/rendu/boucle.ts`: une sonde facultative, qui reçoit la mesure de chaque image. Sans elle, la boucle ne lit aucune horloge de plus.
- `packages/client/src/rendu/interpolation.ts`: `enAttente`, le lissage au bout de son trajet. `interpolation.test.ts`: un test.
- `packages/client/src/rendu/pixi.ts`: les options `preference` et `densite` de `monterRendu`, que seul le relevé passe.
- `packages/client/src/interface/ecrans/jeu.ts`: reçoit le relevé, applique ses variantes et lui fait suivre la partie.
- `packages/client/src/principal.ts`: crée le relevé si l'adresse le demande, et aucun lecteur de sons avec `son=0`.
- `tests/e2e/diagnostic.spec.ts` (créé), `playwright.config.ts`: trois scénarios, projet bureau seul.
- `docs/mesures/audit-saccades-telephone.md` (créé): l'audit.
- `docs/plan/etape-8-5.md`: réconciliée (voir plus bas). `docs/plan/ROADMAP.md`: état de l'étape.

Aucune modification de `packages/sim`, de `packages/server`, de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 16 unitaires. Les répartitions sur des séries connues (médiane, neuvième décile, centile 99, compte au-delà d'un seuil, une saccade parmi cent images que la moyenne cache), la lecture de l'adresse (rien sans le paramètre, variantes ignorées sans lui, valeurs hors bornes écartées), le relevé (attribution d'une image lente, instantanés et battements sautés, page cachée non comptée, fenêtres de 5 s, remise à zéro), le lissage qui attend le réseau. Trois de bout en bout: sans le paramètre aucun bandeau, ni à l'accueil ni en partie; avec, le relevé suit la partie et se copie; avec des variantes, la densité, la cadence plafonnée à 20, sans son et sans HUD sont appliquées et nommées.
- Résultat: **2 445 tests unitaires au vert** (2 429 au handoff 8.4). Bout en bout: voir l'état de la CI. Types, linter et formatage verts.
- Couverture de packages/sim: inchangée, le paquet n'est pas touché.
- État de la CI: à vérifier sur le commit poussé.

## Décisions et écarts au plan

1. **La fiche se trompait sur le dos de rendu par défaut.** PixiJS 8.19 essaie WebGL d'abord, pas WebGPU. Hypothèse 1 corrigée dans la fiche: c'est WebGPU qu'il faut essayer.
2. **Deux hypothèses ajoutées**, 11 (le HUD réécrit à chaque image, sous cinq fonds floutés) et 12 (la saisie tactile non passive). Détail et faits de code à la section 5.1 de l'audit.
3. **Des variantes dans l'adresse**, non prévues par la fiche. Sans elles, trancher le son, le HUD, la densité ou la cadence aurait demandé une mise en ligne par essai. Elles ne valent qu'avec `diagnostic=1`, et le relevé les nomme.
4. **La variante de cadence fait passer la boucle du jeu dans le minuteur de PixiJS**, juste avant son dessin. Plafonner les deux minuteurs séparément les aurait fait tourner décalés. En production, rien ne change: deux minuteurs, et une image de retard entre la scène et son dessin (section 5.1 de l'audit), qui n'est pas une saccade.
5. **Le style du bandeau est posé par le code.** La politique de sécurité de la page refuse une balise de style ajoutée; la variante `flou=0` ajoute sa règle par le modèle objet des styles, qu'elle accepte.
6. **Le relevé se copie, il ne s'envoie pas.** La fiche l'avait décidé; le serveur est hors périmètre.

## Problèmes connus et dette

- **L'étape n'est pas finie**: verdict, plan d'action, réglages faits et remesurés, et le « jouable ou pas, à quelles conditions », tout attend les relevés.
- **Le bandeau peut couvrir un bouton** en bas d'un écran étroit. Il est petit et centré; c'est un instrument, pas un écran du jeu.
- **Le relevé ne voit pas la carte graphique.** Safari n'offre pas de chronomètre de la carte graphique à la page: son temps tombe dans « hors de nos chronomètres », avec la mise en page et le ramasse-miettes. Les variantes sont là pour les départager.

Repris des handoffs précédents, inchangé: la carte du Quartier reste à juger en jouant à plusieurs; rien ne surveille que la production suit `master`.

## Prochaine action exacte

**Au porteur du projet**: jouer les neuf parties de la section 4 de `docs/mesures/audit-saccades-telephone.md` sur l'iPhone 14 Pro, dans Safari, et coller chaque relevé dans la conversation avec une phrase sur le ressenti. Au minimum les parties 1, 2, 3, 4 et 8 pour que l'audit puisse conclure.

**À la session suivante**, relevés en main: les ranger dans `docs/mesures/releves-8-5/`, un fichier par partie; trancher les douze hypothèses (section 5); écrire le verdict (section 6), ce qu'il faut ajouter au banc (section 7) et le plan d'action (section 8); faire les remèdes qui tiennent dans un réglage et les faire remesurer par la même adresse; proposer les autres comme étapes au ROADMAP.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-5.md`, la même: l'étape reprend avec les relevés. Ensuite `8.3`, le miroir calculé, dont la fiche est à rédiger.
