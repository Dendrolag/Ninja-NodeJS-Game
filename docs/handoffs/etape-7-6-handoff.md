# Handoff - Étape 7.6 Options de partie

Date: 19 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Fondre Rainy Tokyo et Tokyo en une seule carte « Tokyo » avec une option pluie, en gardant lisibles les parties enregistrées, et permettre plus de 150 faux ninjas au départ, jusqu'à un plafond par carte justifié par la mesure du serveur et du rendu.

## Ce qui a été fait

- **Décisions tranchées avec le porteur du projet** au début de la session, puis fiche `docs/plan/etape-7-6.md` rédigée selon le cas de repli du PROTOCOLE (`9c003cd`). Plafond de 300 faux ninjas sur Tokyo et de 500 sur Spirit & Time, le même dans tous les modes; pluie sur Tokyo seule, activée par défaut; l'historique nomme « Tokyo » les deux anciennes cartes.
- **Contrat**: `CARTES` ne contient plus que `map1` (Tokyo) et `map3` (Spirit & Time); `CARTES_ENREGISTREES` et `CarteEnregistree` gardent `map2` pour la base et l'historique; `PLAFONDS_DE_FAUX_NINJAS`; le réglage `pluie`; la borne de `nombreBotsInitial` passe à 500, et une règle croisée refuse ce qui dépasse le plafond de la carte, avec un message qui le dit.
- **Base**: l'énumération `carte` est tirée des cartes enregistrées. `pnpm base:generer` confirme qu'aucune migration n'est nécessaire.
- **Page**: les deux anciennes cartes s'appellent « Tokyo »; l'interrupteur « Pluie » n'apparaît que sur Tokyo; le curseur des faux ninjas s'arrête au plafond de la carte choisie; le récapitulatif du salon dit « Tokyo · Pluie »; le rendu et le préchargement ne font tomber la pluie que si le réglage le demande.
- **Lissage de la page corrigé** (règle 7): il cherchait chaque entité par un parcours complet, un coût en carré. Les positions précédentes sont désormais rangées par identifiant, une fois par battement.
- **Mesures**: le harnais de charge gagne `--carte`; le banc du rendu gagne une série au processeur ralenti six fois. Résultats à la section 17 de `docs/mesures/charge-serveur.md`.
- **Vérifié dans le navigateur de Claude Code** (serveur local): accueil « 5 modes · 2 cartes »; à la création, Tokyo et Spirit & Time, pluie cochée et visible sur Tokyo, cachée sur Spirit & Time; curseur à 300 au plus sur Tokyo, 500 sur Spirit & Time, ramené de 500 à 300 en revenant à Tokyo, valeur affichée comprise; salon « Tokyo · Pluie », 300 faux ninjas; partie lancée avec ses 300 faux ninjas, aucune erreur dans la console.
- Commit `346d319`.

## Fichiers créés ou modifiés

Commit `9c003cd`: `docs/plan/etape-7-6.md` (créé).

Commit `346d319`:

- Contrat: `packages/shared/src/constantes.ts`, `reglages.ts`, `bornes.ts`, `validation.ts`, `comptes.ts`, `ressources.ts` (commentaires), `index.ts`; tests `constantes.test.ts`, `validation.test.ts`, `ressources.test.ts`.
- Serveur: `packages/server/src/base/schema.ts`, `base/parties.ts`, `terrain.ts` (commentaire); `ServeurSocket.options.test.ts` (créé); tests `ServeurSocket.test.ts`, `finDePartie.test.ts`, `terrain.test.ts`.
- Moteur: tests seulement, `bots.test.ts` (500 faux ninjas sur Spirit & Time), `etat.test.ts`.
- Page: `packages/client/src/interface/modeles/cartes.ts`, `modeles/reglages.ts`, `composants/reglages.ts`, `modeles/salon.ts`, `modeles/creation.ts` et `modeles/fin.ts` (commentaires), `ecrans/jeu.ts`, `principal.ts`, `rendu/pixi.ts`, `rendu/interpolation.ts`, `rendu/apparence.ts` (commentaire); tests des modèles et écrans qui lisent le nom de la carte, `composants/reglages.test.ts`, `modeles/reglages.test.ts`, `modeles/profil.test.ts`, `modeles/salon.test.ts`, `rendu/interpolation.test.ts`, `interface/application.test.ts`.
- Ressources: `assets/cartes/map2/` supprimé, `assets/README.md`.
- Base: `tests/base/parties.test.ts` (partie `map2` relue), `tests/base/migrations.test.ts` (l'énumération suit les cartes enregistrées).
- Outils et bancs: `tests/charge/charge.ts` (`--carte`, mode et carte au rapport), `tests/e2e/banc-rendu.spec.ts` (série téléphone), `docs/mesures/charge-serveur-7-6-tokyo.json` et `charge-serveur-7-6-spirit.json` (créés).
- Bout en bout: `tests/e2e/rendu-pluie.spec.ts` (Tokyo avec et sans pluie, Spirit & Time), `parties.spec.ts`, `rendu-couleurs.spec.ts`.
- Documentation: `docs/mesures/charge-serveur.md` (section 17), `docs/design/README.md` (cinq entrées au journal), `docs/design/cadrage.md`, `docs/plan/ROADMAP.md` (7.6 faite, étapes 4.5, 5.6 et 5.7), `docs/plan/etape-7-6.md` (réconciliation).

Commit de ce handoff: `docs/handoffs/etape-7-6-handoff.md` (créé).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: la validation de la pluie, des plafonds et du refus de `map2`; les cartes jouables et enregistrées; un peuplement de 500 faux ninjas déterministe; à travers le vrai serveur et les vrais murs, la pluie coupée au salon et gardée au lancement, 300 faux ninjas sur Tokyo et 500 sur Spirit & Time tous hors des murs, une partie de 300 diffusée, un plafond refusé à la création et au salon, `map2` refusée; en base, une partie `map2` relue; à la page, l'option pluie, le curseur borné et ramené, « Tokyo · Pluie », l'ancienne `map2` nommée Tokyo, le lissage indexé; au bout en bout, la pluie avec et sans l'option.
- Résultat: **2 395 tests Vitest** (unitaires et base) au vert après correction du test des migrations; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **41 scénarios sur 41**, banc du rendu compris.
- Couverture de `packages/sim`: **99,84 pour cent** des instructions, inchangée.
- **Empreinte**: recalculée sans le seul champ `pluie`, **identique à l'octet** à celle du handoff 7.5 pour les quatre parties, empreintes du flux identiques. Nouvelles références, avec le champ: `b566653a…3a06` (150 bots, 12 joueurs, murs), `c64c0e08…9b12` (50 bots), `8a8ba1af…93ce` (300 bots sans mur), `3c090830…4884` (150 bots, 2 joueurs).
- Mesures: au banc, 1,02 ms par battement à 300 sur Tokyo, 2,31 ms (p99 3,20) à 500 sur Spirit & Time; dans la page, 0,59 ms par image à 500 sprites sur carte graphique (1,26 avant la correction du lissage), 3,1 à 3,4 ms à 300 et 4,3 à 5,3 ms à 500 au processeur ralenti six fois, environ 54 images par seconde.
- État de la CI: **`346d319` verte** (exécution 35424156628), avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne »: Tokyo unique et les nouveaux plafonds sont en production. Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md`, et une section « Réconciliation » dans la fiche. À retenir:

1. **`map1` devient Tokyo, `map2` se retire des cartes jouables** et reste dans l'énumération de la base. Le test des migrations, qui comparait l'énumération aux cartes jouables, l'a relevé: il compare désormais aux cartes enregistrées.
2. **Le curseur n'est pas ramené par une règle du formulaire** (décision du 14 août 2026, aucun rognage): son maximum suit la carte, et un curseur ne montre pas de valeur au-delà. Le composant le fait lui-même, jsdom ne le faisant pas.
3. **Le lissage de la page est corrigé dans l'étape**, sur la mesure.
4. **Le quart d'une image n'est pas tenu à 500 entités au processeur ralenti.** Décision du porteur du projet: garder 500 et alléger le rendu dans l'étape `5.7`. Le banc exige en continu le plafond existant de 8 ms.
5. **L'empreinte change d'octets par le nouveau réglage**, pas par le jeu: prouvé en l'excluant.

## Problèmes connus et dette

- **Le rendu à 500 entités sur téléphone d'entrée de gamme**: 26 à 32 pour cent d'une image pour notre code, surtout la transmission des sprites à PixiJS. Étape `5.7`.
- **Les textes du menu principal** parlent encore de troupeaux et de capture seule (« volez les troupeaux des autres joueurs »): étape `4.5`, demandée par le porteur du projet.
- **À jouer par le porteur du projet**: la densité de 300 faux ninjas sur Tokyo et de 500 sur Spirit & Time, et sur un vrai téléphone.

Repris du handoff 7.5, inchangé: l'or du x4 proche de celui des Black Ninjas; l'équilibre de la prime de la Horde et les Black Ninjas aussi rapides que les joueurs, à jouer; le compteur de combo qui tombe au battement près; et la liste des points ouverts reprise du handoff 5.5 (sons sur un vrai iPhone, équilibrage du Massacre et de la Chasse, limites des Équipes, serveur local branché sur la base de production, jeton Vercel qui expire le 14 septembre 2027, et le reste).

## Prochaine action exacte

Dans une conversation neuve, sur `master`: ouvrir l'étape `4.5`, textes de présentation. Sa fiche n'existe pas: la rédiger selon le cas de repli du PROTOCOLE à partir de l'entrée 4.5 du ROADMAP (section 4), en relevant d'abord tous les textes qui décrivent le jeu (accueil, cartes de présentation, tuiles des modes, aide), puis les réécrire avec le porteur du projet: la Horde et non des troupeaux, la capture, l'élimination au katana et la traque.

## Étape suivante

Fiche à lire: aucune encore; celle de l'étape 4.5, textes de présentation, à rédiger au début de la session (entrée 4.5 de la section 4 du ROADMAP). Suivront `5.6`, référencement, puis `5.7`, allègement du rendu.
