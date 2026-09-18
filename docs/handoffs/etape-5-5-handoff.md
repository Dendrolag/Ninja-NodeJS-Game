# Handoff - Étape 5.5 Peaufinage et débogage

Date: 18 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Corriger les défauts et les manques relevés par le porteur du projet en jouant, et les limites connues des handoffs qu'il a retenues, dans les cinq modes, sur ordinateur et sur téléphone, sans nouvelle fonctionnalité.

## Ce qui a été fait

- **Tri avec le porteur du projet** au début de la session: sa liste de quinze points et les limites connues des handoffs 5.4 à 7.4. Treize points retenus pour l'étape, un quatorzième ajouté en cours de route (les sons du fusil du Tactique). Le gameplay nouveau devient deux étapes, **7.5** (réglages du Classique: combo, points flottants, nom « Horde », vitesse commune) et **7.6** (Tokyo avec une option pluie, plus de 150 bots). **Vitesse commune choisie: 150 pixels par seconde.** Fiche `docs/plan/etape-5-5.md` rédigée selon le cas de repli du PROTOCOLE (`3c16910`), réconciliée en fin d'étape.
- **Lot A, les sons (`fc5584c`)**: le défaut racine du son perdu (voir « Décisions »); le son des captures du Classique, qui ne se jouait plus; les sons du katana remplacés par ceux du porteur du projet; le son passé par Web Audio, pour que le volume marche sous iOS.
- **Lot B (`5942155`)**: « Rejouer » garde le mode; « Code privé » n'est plus tronqué; la flèche de localisation ne suit plus l'infection d'une proie en Chasse, et suit désormais une mise à mort en Massacre; le cadavre prend la couleur du mort.
- **Lot C**: le HUD en une seule barre supérieure translucide, la caméra descendant sous la barre au bord de la carte (`fffcb6a`); l'en-tête des menus tient sur un petit téléphone, et la page ne se zoome plus (`ec42b26`); l'état de la connexion en pastille colorée, en haut de l'accueil, et le surtitre qui comptait un seul mode (`ff73865`); les icônes de « Comment jouer » animées sur un halo clair (`4ab19a5`).
- **Point 14 (`145e0e7`)**: en Tactique, un coup de fusil à chacun de nos tirs et une recharge à chaque charge qui revient.
- **Lot D (`5916475`)**: une page ouverte et visible garde le serveur Render éveillé.
- **Correctif (`5818608`)**: les types du nouveau scénario de bout en bout, qui avaient rendu la CI rouge.

## Fichiers créés ou modifiés

Commit `3c16910`: `docs/plan/etape-5-5.md` (créé), `docs/plan/ROADMAP.md` (décision du tri, entrées 7.5 et 7.6).

Commit `fc5584c`: `packages/client/src/faits.ts` (`faitsArrives`), `rendu/boucle.ts` et test, `annonces.ts`, `pointsFlottants.ts` (`pointsDesRalliements` exporté), `sons/declencheurs.ts`, `sons/lecteur.ts`, `sons/sons.test.ts`, `principal.ts` (déblocage du son, session audio), `interface/essais.ts`; `packages/shared/src/ressources.ts`; `assets/sons/katana-swing.mp3` et `katana-hit.mp3` (créés, à la place des `.wav`), `assets/README.md`; `tests/outils/sons-katana.ts` (retiré).

Commit `5942155`: `packages/shared/src/entrees.ts`, `validation.ts` et test (mode de la partie rapide); `packages/server/src/ServeurSocket.ts` et test; `packages/client/src/client.ts`, `interface/ecrans/fin.ts` et test, `interface/application.test.ts`; `packages/client/page/styles/ecrans.css` (code privé); `packages/client/src/rendu/boucle.ts` et test (`faitQuiNousDeplace`); `packages/sim/src/etat.ts`, `massacre.ts` et test, `packages/shared/src/evenements.ts`, `packages/server/src/instantane.ts` et test, `packages/client/src/rendu/katana.ts`, `rendu/apparence.ts`, `massacre.essais.ts`, `massacre.test.ts` (couleur du cadavre); `tests/e2e/peaufinage.spec.ts` (créé).

Commit `fffcb6a`: `packages/client/src/interface/ecrans/jeu.ts`, `rendu/camera.ts` et test, `page/styles/jeu.css`, `page/styles/composants.css`; `tests/e2e/peaufinage.spec.ts`, `tests/e2e/hud-telephone.spec.ts`.

Commit `145e0e7`: `assets/sons/shotgun-wave.mp3` et `shotgun-reload.mp3` (créés), `assets/README.md`, `packages/shared/src/ressources.ts`, `packages/client/src/sons/declencheurs.ts` et test, `rendu/boucle.ts`.

Commit `ec42b26`: `packages/client/page/styles/ecrans.css`, `packages/client/page/index.html`, `tests/e2e/peaufinage.spec.ts`.

Commit `ff73865`: `packages/client/src/interface/modeles/accueil.ts` et test, `interface/ecrans/accueil.ts`, `interface/application.test.ts`, `page/styles/ecrans.css`, `tests/e2e/lien.spec.ts`.

Commit `4ab19a5`: `packages/client/src/interface/composants/aide.ts` et `aide.test.ts` (créé), `page/styles/ecrans.css`.

Commit `5916475`: `packages/client/src/eveil.ts` et test (créés), `principal.ts`, `docs/deploiement.md`.

Commit `5818608`: `tests/e2e/peaufinage.spec.ts`.

Commit de ce handoff: `docs/handoffs/etape-5-5-handoff.md` (créé), `docs/plan/etape-5-5.md` (réconciliation), `docs/design/README.md` (huit entrées au journal), `docs/plan/ROADMAP.md` (étape terminée).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés, rouges avant leur correction sauf deux, écrits en même temps que leur code (le signal de vie, module neuf, et le surtitre de l'accueil): la boucle entend encore les faits quand le journal est plein; le son des ralliements et ceux du fusil; le volume par nœuds de gain et le déblocage; la partie rapide d'un mode (contrat, serveur, écran de fin); les flèches de localisation selon le mode; la couleur du mort, du moteur à la scène; la marge haute de la caméra; l'état du lien à l'accueil; l'icône animée de l'aide; le signal de vie; et le scénario `tests/e2e/peaufinage.spec.ts` (code privé, barre du HUD, en-tête d'un compte sur 360 pixels), au bureau et sur téléphone. Deux tests existants suivent la nouvelle disposition voulue: `hud-telephone.spec.ts` (le classement à gauche du temps, plus sous lui) et `lien.spec.ts` (le lien revenu se dit au lieu de disparaître).
- Résultat: **2 260 tests unitaires sur 2 260**; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **37 scénarios sur 37**.
- Couverture de `packages/sim`: **99,84 pour cent** des instructions, inchangée.
- **Empreinte du jeu identique** pour les quatre parties Classique de référence: `636d774e…8f05`, `48c7cb94…f5fc`, `3c06acdd…8829`, `d20dc54c…7e10`.
- État de la CI: lots A et B verts; `ec42b26` à `5916475` rouges sur la vérification des types du bout en bout (voir « Problèmes connus »); **`5818608` verte** (exécution 35370327020), avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne ». Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même.

## Décisions et écarts au plan

Huit entrées au journal de `docs/design/README.md` (18 septembre 2026), et une section « Réconciliation » dans la fiche. À retenir:

1. **Le son perdu du Massacre venait de la boucle, pas des bonus.** Elle lisait le journal des faits à partir de son ancienne longueur, qui ne bouge plus une fois le journal plein (cinquante faits): au cinquantième fait, plus aucun son, plus de flèche de localisation, plus de micro-arrêt, dans tous les modes. Les faits nouveaux se reconnaissent maintenant à leur identité (`faitsArrives`), comme le faisaient déjà les annonces et les points flottants, qui l'utilisent aussi.
2. **« Rejouer » reprend le mode et les réglages** de la partie terminée: le contrat gagne, pour la partie rapide seulement, un mode et des réglages facultatifs. Une partie en attente ne convient que si elle a les mêmes. Une partie privée rejouée mène à une partie publique.
3. **La couleur du cadavre passe par le contrat**, un champ de plus dans les morts d'un coup de katana.
4. **La page ne se zoome plus**, à la demande du porteur du projet: un joueur malvoyant ne peut plus agrandir au pincement.
5. **Deux défauts voisins corrigés en route (règle 7)**: les flèches après une mise à mort en Massacre, le surtitre de l'accueil.

## Problèmes connus et dette

- **La CI a été rouge sur quatre commits** (`ec42b26` à `5916475`): le nouveau scénario parcourait des `NodeList` d'une façon que `tsconfig.e2e.json` refuse, et j'avais omis de recompiler cette configuration avant de commiter. Aucune mise en ligne n'est partie pendant ce temps.
- **À vérifier sur un vrai iPhone**: le volume des sons et de la musique, et le son malgré le mode silencieux (la session audio de lecture n'existe que dans Safari 16.4 et ses cousins).
- **À écouter par le porteur du projet**: les sons du katana et du fusil en jeu.
- **La barre du haut ne règle que le haut de la carte.** En bas, aucun élément du HUD ne couvre le centre de l'écran; les coins restent aux effets, à la minimap et aux boutons tactiles.
- **Le panneau du navigateur de Claude Code ne dessine pas la partie**: les captures de vérification ont été prises avec Playwright sur le serveur local.

Repris du handoff 7.4, inchangé, sauf ce que cette étape a résolu (le joueur sous le HUD en haut de la carte, la flèche d'une proie infectée, la teinte fixe du cadavre, les sons synthétiques du katana): l'équilibrage du Massacre et de la Chasse reste à jouer; le coût du sang et d'un tir en Chasse n'est pas mesuré; un traqueur éliminé ne voit que les traqueurs et sa caméra reste figée; en Équipes, on ne distingue ses coéquipiers qu'à la couleur, une partie coûte un peu plus cher, une équipe vidée n'est plus classée, un joueur entré en cours de partie ne choisit pas son camp, le chat n'est pas par équipe; un hôte seul dans son salon le perd avec son lien; un joueur revenu dans le salon n'en est plus l'hôte; l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet); jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. La musique reste à écouter par le porteur du projet (cas C21 de la grille de recette).

## Retours du porteur du projet après l'étape

Trois demandes, le même jour, chacune avec ses tests:

- la bordure basse de la barre du HUD barrait le classement qui descend dessous: retirée (`packages/client/page/styles/jeu.css`);
- le traqueur de la Chasse a lui aussi les sons du fusil: le coup à chacun de ses tirs, la recharge une seconde après, quand il peut tirer de nouveau, cette attente n'étant pas transmise par le serveur (`packages/client/src/sons/declencheurs.ts`, `rechargeApresLeTir`, et `rendu/boucle.ts`);
- « Rejouer » garde aussi les réglages (`packages/shared/src/entrees.ts`, `validation.ts`, `packages/server/src/ServeurSocket.ts`, `packages/client/src/client.ts`, `interface/ecrans/fin.ts`, et leurs tests).

## Prochaine action exacte

Dans une conversation neuve, sur `master`: ouvrir l'étape `7.5`, réglages du Classique. Sa fiche n'existe pas: la rédiger selon le cas de repli du PROTOCOLE à partir de l'entrée 7.5 du ROADMAP (section 4) et de l'entrée du 18 septembre 2026 du journal de conception, après avoir tranché avec le porteur du projet les règles du combo (fenêtre, paliers, plafond, ce qui le casse), l'échelle des couleurs et des tailles des points flottants, et le nom « Horde »; la vitesse commune est déjà choisie, 150 pixels par seconde. Mettre à jour les comportements à préserver 1 et 5 de CLAUDE.md, datés.

Au porteur du projet: vérifier le volume sur son iPhone, écouter les sons du katana et du fusil, et regarder la nouvelle barre du HUD à plusieurs.

## Étape suivante

Fiche à lire: aucune encore; celle de l'étape 7.5, réglages du Classique, à rédiger au début de la session (entrée 7.5 de la section 4 du ROADMAP).
