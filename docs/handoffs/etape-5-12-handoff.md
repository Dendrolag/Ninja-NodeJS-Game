# Handoff - Étape 5.12 Le son qui fait ramer l'iPhone

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: partielle (points 1 et 2 de la définition de terminé faits; le point 3, le relevé sur l'iPhone, attend le porteur du projet)

## Objectif de l'étape

Que le son ne fasse plus ramer la page sur iPhone, et que le relevé dise dans quel état était le son. Sans rien changer à ce qui s'entend.

## Ce qui a été fait

- **La cause retenue.** Les deux relevés du 5 octobre (`docs/mesures/5-9/`) mettent le temps perdu dans notre code, aux deux endroits de la boucle de rendu qui appellent le lecteur: les sons des faits (pointes à 305 ms dans « saisie, sons, lissage ») et les bruits de pas, joués après le HUD (12 ms par image en moyenne, hors des deux sous-totaux). Chaque effet était un élément audio branché sur Web Audio et relancé par `currentTime = 0` puis `play()`: un pas toutes les 250 ms en marchant, un coup de fusil à chaque tir. Sous WebKit, un élément audio est un lecteur multimédia complet.
- **Les effets sont des tampons décodés** (`sons/lecteur.ts`). Là où Web Audio existe, chaque fichier d'effet (sons ponctuels, pas, boucles de bonus) est lu et décodé une fois, au premier geste du joueur, et chaque lecture est une source de tampon neuve, sans élément ni retour au début. Une voix par effet: relancer un effet coupe sa lecture précédente, comme avant. Un effet pas encore décodé, introuvable, ou demandé contexte suspendu se tait. La musique reste un élément audio sur son gain. Sans Web Audio, les éléments comme avant.
- **Le relevé dit l'état du son** (`diagnostic/son.ts`): ligne « Son » de l'en-tête, « retiré par la variante », « coupé par le panneau du son », ou « joue, effets 50 %, musique 30 %, effets par Web Audio (contexte running, 30 fichiers prêts sur 30) ».
- **Une variante `&musique=0`** retire la musique seule, pour départager effets et musique si l'iPhone ramait encore.
- **Version 1.7.1**: une correction visible sur iPhone, sans note.
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
- `docs/plan/ROADMAP.md`: l'entrée 5.12 et le journal des décisions.

## Tests

- Ajoutés: avec Web Audio, aucun élément pour les effets, la source branchée sur le bon gain, une voix par effet, les pas sur tampons, le chargement au premier déblocage et une seule fois, le silence d'un effet pas décodé ou contexte suspendu, un fichier manquant qui ne fait taire que lui, les boucles (une seule, sur leur canal, arrêtées), la coupure, la musique sans la variante, l'état rendu au relevé; sans Web Audio, la voie des éléments. Le relevé: la ligne « Son » dans ses cas, la variante `musique`. De bout en bout, dans Chromium: tous les effets se décodent et le contexte tourne.
- Résultat: 3 569 tests unitaires au vert; types et linter au vert. Bout en bout: 94 sur 95 au premier passage. Le banc « tient les plafonds de faux ninjas au processeur ralenti six fois » échoue en local, comme au 25 septembre (handoff 8.6): il mesure du temps processeur sur un poste chargé par une autre conversation, ne joue aucun son, et la CI ne l'exige pas. `poche.spec.ts` a échoué une fois sur quatre passages (personnage d'essai bloqué en route), sans lien avec le son.
- Couverture de packages/sim: inchangée, rien n'y a été touché.
- État de la CI: voir le commit qui suit ce handoff.

## Décisions et écarts au plan

- **Pas de reproduction sur le poste.** Le WebKit de Playwright sous Windows n'a pas d'`AudioContext`, et Chromium ne montre rien: la correction s'appuie sur les relevés et sur l'usage établi de Web Audio pour les bruitages. La preuve sera le relevé sur l'iPhone.
- **Le chargement des effets attend le premier geste**: la page ne paie pas leurs 3,7 Mo à l'ouverture, et le son ne peut de toute façon pas jouer avant.
- **Les effets décodés occupent de la mémoire** (une vingtaine de mégaoctets, surtout les boucles d'invincibilité et de vitesse, et les deux jingles en WAV). Acceptable sur un téléphone récent; à surveiller si un téléphone d'entrée de gamme fermait la page.

## Problèmes connus et dette

- Le relevé sur l'iPhone, son compris (définition de terminé, point 3).
- Le dépôt contenait en début de session des fichiers du client modifiés par une autre session, par leurs seules fins de ligne (aucune différence de contenu), et son handoff non suivi `docs/handoffs/textes-du-jeu-handoff.md`. Laissés tels quels, non commités ici.

## Prochaine action exacte

Demander au porteur du projet un relevé sur l'iPhone, son compris: `https://ninja.dendrolag.fr/?diagnostic=1`, Tactique à 300 PNJ avec pluie, deux à trois minutes, le son réglé comme d'habitude (le relevé doit dire « Son: joue »). Le ranger dans `docs/mesures/5-12/`. S'il revient vers 60 images par seconde, clore l'étape. S'il rame encore, refaire un relevé avec `&musique=0`: s'il est fluide, c'est la musique, qui passe encore par un élément audio.

## Étape suivante

Aucune planifiée: la choisir avec le porteur du projet (section 5 du ROADMAP). L'étape 5.9 attend sa partie à plusieurs avec un compte, et vers le 10 novembre 2026 la vérification de la machine Oracle.
