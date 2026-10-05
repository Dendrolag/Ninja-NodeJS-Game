# Handoff - Étape 5.12 Le son qui fait ramer l'iPhone

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Que le son ne fasse plus ramer la page sur iPhone, et que le relevé dise dans quel état était le son. Sans rien changer à ce qui s'entend.

## Ce qui a été fait

- **La cause retenue.** Les deux relevés du 5 octobre (`docs/mesures/5-9/`) mettent le temps perdu dans notre code, aux deux endroits de la boucle de rendu qui appellent le lecteur: les sons des faits (pointes à 305 ms dans « saisie, sons, lissage ») et les bruits de pas, joués après le HUD (12 ms par image en moyenne, hors des deux sous-totaux). Chaque effet était un élément audio branché sur Web Audio et relancé par `currentTime = 0` puis `play()`: un pas toutes les 250 ms en marchant, un coup de fusil à chaque tir. Sous WebKit, un élément audio est un lecteur multimédia complet.
- **Les effets sont des tampons décodés** (`sons/lecteur.ts`). Là où Web Audio existe, chaque fichier d'effet (sons ponctuels, pas, boucles de bonus) est lu et décodé une fois, au premier geste du joueur, et chaque lecture est une source de tampon neuve, sans élément ni retour au début. Une voix par effet: relancer un effet coupe sa lecture précédente, comme avant. Un effet pas encore décodé, introuvable, ou demandé contexte suspendu se tait. La musique reste un élément audio sur son gain. Sans Web Audio, les éléments comme avant.
- **Le relevé dit l'état du son** (`diagnostic/son.ts`): ligne « Son » de l'en-tête, « retiré par la variante », « coupé par le panneau du son », ou « joue, effets 50 %, musique 30 %, effets par Web Audio (contexte running, 30 fichiers prêts sur 30) ».
- **Une variante `&musique=0`** retire la musique seule, pour départager effets et musique si l'iPhone ramait encore.
- **Version 1.7.1**: une correction visible sur iPhone, sans note.
- **Le relevé sur l'iPhone**, pris par le porteur du projet après la mise en ligne, son compris, dans les conditions du relevé de départ (Tactique à 300 PNJ, pluie): 59,9 images par seconde au lieu de 9,5, notre code à 0,46 ms par image en moyenne au lieu de 23,4, et une seule image d'au moins 50 ms après la préparation au lieu de 448. Les mêmes chiffres que sans le son le matin. Rangé dans `docs/mesures/5-12/`.
- **Défaut de documentation corrigé** (règle 7): l'audit 8.5 donnait l'hypothèse « le son » pour écartée, sur des relevés sans doute pris son coupé. La ligne le dit désormais.

## Fichiers créés ou modifiés

- `docs/plan/etape-5-12.md` (créé, commit `0e87f90`): la fiche, rédigée selon le cas de repli du PROTOCOLE.
- `packages/client/src/sons/lecteur.ts`: effets par tampons décodés, chargement au premier déblocage, option `chargerFichier` pour les tests, option `musique`, méthode `etat()` pour le relevé.
- `packages/client/src/sons/sons.test.ts`: le bloc Web Audio réécrit pour les tampons.
- `packages/client/src/diagnostic/son.ts` (créé): la ligne « Son ».
- `packages/client/src/diagnostic/demande.ts`, `diagnostic.ts`, `diagnostic.test.ts`: la variante `musique`, la ligne « Son », leurs tests.
- `packages/client/src/principal.ts`: le lecteur reçoit la variante `musique`, le relevé lit son état.
- `packages/client/src/interface/essais.ts`, `packages/client/src/rendu/boucle.test.ts`: les doublures du lecteur gagnent `etat()`.
- `tests/e2e/diagnostic.spec.ts`: le relevé dit que le son joue et que tous les effets sont décodés, ou qu'il est retiré.
- `packages/shared/src/version.ts`: 1.7.1.
- `docs/mesures/audit-saccades-telephone.md`: la variante `musique`, la ligne « Son » du relevé, l'hypothèse 9 revue.
- `docs/plan/ROADMAP.md`: l'entrée 5.12, l'entrée 4.11 et le journal des décisions.
- `docs/mesures/5-12/telephone-tactique-300-avec-son.txt` (créé): le relevé de clôture.

## Tests

- Ajoutés: avec Web Audio, aucun élément pour les effets, la source branchée sur le bon gain, une voix par effet, les pas sur tampons, le chargement au premier déblocage et une seule fois, le silence d'un effet pas décodé ou contexte suspendu, un fichier manquant qui ne fait taire que lui, les boucles (une seule, sur leur canal, arrêtées), la coupure, la musique sans la variante, l'état rendu au relevé; sans Web Audio, la voie des éléments. Le relevé: la ligne « Son » dans ses cas, la variante `musique`. De bout en bout, dans Chromium: tous les effets se décodent et le contexte tourne.
- Résultat: 3 569 tests unitaires au vert; types et linter au vert. Bout en bout: 94 sur 95 au premier passage. Le banc « tient les plafonds de faux ninjas au processeur ralenti six fois » échoue en local, comme au 25 septembre (handoff 8.6): il mesure du temps processeur sur un poste chargé par une autre conversation, ne joue aucun son, et la CI ne l'exige pas. `poche.spec.ts` a échoué une fois sur quatre passages (personnage d'essai bloqué en route), sans lien avec le son.
- Couverture de packages/sim: inchangée, rien n'y a été touché.
- État de la CI: verte sur `04e6e51`, mise en ligne comprise (Render sert `04e6e51`).

## Décisions et écarts au plan

- **Pas de reproduction sur le poste.** Le WebKit de Playwright sous Windows n'a pas d'`AudioContext`, et Chromium ne montre rien: la correction s'appuie sur les relevés et sur l'usage établi de Web Audio pour les bruitages. Le relevé sur l'iPhone l'a confirmée.
- **Décisions du porteur du projet à la clôture**: les Black Ninjas gardent l'armement des mines de zone (règle de l'étape 7.12, qui était à l'essai), et les sons situés sur la carte se spatialiseront, en volume et en gauche-droite, à l'étape `4.11`.
- **Le chargement des effets attend le premier geste**: la page ne paie pas leurs 3,7 Mo à l'ouverture, et le son ne peut de toute façon pas jouer avant.
- **Les effets décodés occupent de la mémoire** (une vingtaine de mégaoctets, surtout les boucles d'invincibilité et de vitesse, et les deux jingles en WAV). Acceptable sur un téléphone récent; à surveiller si un téléphone d'entrée de gamme fermait la page.

## Problèmes connus et dette

- Le serveur de Render a eu 11 battements d'au moins 100 ms en cinq minutes pendant le relevé de clôture (pire 303 ms, un battement lui-même de 302 ms), contre aucun sur Oracle le matin: déjà connu de l'étape 5.9, dont l'essai doit décider de la bascule.
- Le dépôt contenait en début de session des fichiers du client modifiés par une autre session, par leurs seules fins de ligne (aucune différence de contenu), et son handoff `docs/handoffs/textes-du-jeu-handoff.md`, qu'elle a commité pendant cette session (`4cc6637`). Les fichiers du client sont laissés tels quels, non commités ici.

## Prochaine action exacte

Exécuter l'étape `4.11`, des sons situés sur la carte: rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de son entrée dans `docs/plan/ROADMAP.md` (phase 4) et des décisions du 5 octobre 2026 (section 5). Le lecteur à modifier est `packages/client/src/sons/lecteur.ts`, ses déclencheurs `packages/client/src/sons/declencheurs.ts`.

## Étape suivante

Fiche à lire: aucune encore; l'entrée `4.11` de `docs/plan/ROADMAP.md`, section 4, phase 4. En parallèle, l'étape 5.9 attend sa partie à plusieurs avec un compte, et vers le 10 novembre 2026 la vérification de la machine Oracle.
