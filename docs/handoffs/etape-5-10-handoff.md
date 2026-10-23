# Handoff - Étape 5.10 La mesure en grand

Date: 23 octobre 2026
Auteur: session Claude Code
Statut: terminée, sauf le calage sur la machine Oracle, qui attend un geste du porteur du projet

## Objectif de l'étape

Mesurer ce que coûterait au jeu actuel une carte de 10 000 sur 10 000 pixels peuplée de 1 000 à 10 000 PNJ et de 12 à 60 joueurs, et dire pour chaque plafond ce qui le lève et jusqu'où. Aucune règle ni optimisation.

## Ce qui a été fait

- **La carte de mesure.** `CARTE_DE_MESURE` (10 000 sur 10 000), hors de `CARTES`: seule l'option `carteDeMesure` de `creerEtatInitial` la demande, et la `GameRoom` la reçoit par ses réglages du banc (`banc: { carteDeMesure, capacite }`), que le `RoomManager` ne transmet jamais. La garde du défaut X5 s'y applique. Les réglages du banc portent aussi une capacité, pour 30 et 60 joueurs.
- **Le banc** joue cette carte avec deux terrains fabriqués en mémoire, Tokyo répété cinq fois sur sept et coupé, ou sans mur; un Black Ninja par centaine d'entités; et mesure en plus la durée du lancement de la partie. Nouvelles options de `pnpm charge`: `--carte-de-mesure realiste|vide`, `--echauffement-banc`, `--zone-d-interet` (le filtrage estimé, rectangle de 2 400 sur 1 200), `--profil <dossier>` (profil du processeur, résumé par fonction et par fichier), `--demarrage` (le chargement d'une telle carte, durée et pointe de mémoire). `--joueurs` existait.
- **Le workflow de mesure** joue plusieurs lignes « Options: » à la suite, et une ligne « Machines: x64 arm » ajoute la machine Arm de GitHub (`ubuntu-24.04-arm`, disponible pour ce dépôt public: vérifié).
- **Mesuré** sur le poste (deux séances, neuf témoins de 1,11 à 1,29 ms), sur GitHub x64 et sur GitHub Arm. Résultats, profil et verdicts: section 37 de `docs/mesures/charge-serveur.md`. Bruts: `docs/mesures/5-10/`.
- **Ce que disent les chiffres**, en bref:
  - Le moteur est quadratique, la carte et les murs n'y changent rien. 259 ms par battement à 5 000 PNJ, 1 072 à 10 000, sur le poste; deux fois plus sur la machine Arm de GitHub, bien que celle-ci soit à 1,1 fois le poste sur le témoin.
  - Quatre calculs croissent au carré: le relevé des contacts (83 pour cent du battement à 5 000 PNJ), la cible des Black Ninjas, **le lancement de la partie** (61 secondes à 10 000 PNJ, toutes les parties du serveur arrêtées: chaque PNJ posé recopie la table et parcourt toutes les places prises), et **le classement** (`scoreDe` parcourt tous les PNJ pour chaque joueur: 23 pour cent du battement à 60 joueurs).
  - Ce qui reste une fois ces quatre-là proportionnels: environ 21 ms à 5 000 PNJ sur le poste, au-delà des 35 ms utilisables sur un cœur Arm. La grille suffit à 2 000 ou 3 000 PNJ, pas à 9 000.
  - Le filtrage par zone d'intérêt divise le flux par vingt (1,8 Mbit/s par joueur à 5 000 PNJ, 0,09 avec). Il coûte 9,4 ms par battement à 60 joueurs sans la grille.
  - Le démarrage tient: 24 secondes et 2,0 Go de pointe pour décoder la carte dans ses deux sens, sur le poste comme sur l'Arm de GitHub.
- **ROADMAP**: cibles chiffrées ajoutées à `5.11`, `8.13` et `2.10`; deux étapes ajoutées, `5.17` (une partie sur son propre fil, avant `7.19`) et `5.18` (l'allègement des PNJ lointains, conditionnelle à la mesure de `5.11` sur la machine Oracle). Les études du 16 septembre et du 3 octobre ont leurs extrapolations remplacées par les mesures.
- **Empreinte des parties de référence identique**, comparée au commit `5466005` d'avant l'étape. Numéro de version inchangé: rien ne change pour les joueurs.

## Fichiers créés ou modifiés

- `packages/shared/src/constantes.ts`, `index.ts`: `CARTE_DE_MESURE`.
- `packages/sim/src/etat.ts`: l'option `carteDeMesure`, et le nom de la carte dans le message de la garde X5. `etat.test.ts`: la carte de mesure, et la garde dans les deux sens.
- `packages/server/src/GameRoom.ts`, `index.ts`: `ReglagesDuBanc` (carte de mesure, capacité). `GameRoom.test.ts`: 60 joueurs sur la carte de mesure, et rien sans le banc. `RoomManager.test.ts`: une demande forgée ne passe pas.
- `packages/shared/src/validation.test.ts`: aucun salon ne choisit la carte de mesure.
- `tests/charge/terrainDeMesure.ts` (créé): les deux terrains. `zoneDInteret.ts` (créé): le filtrage estimé. `demarrage.ts` (créé): la mesure du démarrage. `profil.ts` (créé): le résumé d'un profil. `plan.ts` (créé): la ligne de commande, sortie de `charge.ts` pour se tester. Leurs tests: `terrainDeMesure.test.ts`, `zoneDInteret.test.ts`, `plan.test.ts`, `profil.test.ts`.
- `tests/charge/battement.ts`: la carte de mesure, la capacité, les Black Ninjas de la mesure, l'estimation du filtrage, la durée du lancement. `battement-isole.ts`: le terrain de mesure par processus, le profileur, et la réponse lue à la sortie du processus (sans quoi le profil n'était pas encore écrit). `charge.ts`: les options, les colonnes, le profil et le démarrage. `battement.test.ts`: le banc sur la carte de mesure.
- `.github/workflows/charge.yml`: le plan des machines, la machine Arm, plusieurs mesures par séance; commentaire périmé sur `master` corrigé.
- Mesures: `docs/mesures/charge-serveur.md` (section 37, section 10, en-tête), `docs/mesures/5-10/` (créé).
- Documentation: `docs/plan/etape-5-10.md` (réconciliation), `docs/plan/ROADMAP.md`, `docs/mesures/etude-grandes-cartes.md`, `docs/design/etude-combat-survie-et-carte-geante.md`, `docs/design/README.md` (journal), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: la carte de mesure dans le moteur et sa garde X5; la `GameRoom` du banc; le refus de la carte de mesure par la validation et le `RoomManager`; les terrains (dimensions, répétition exacte de Tokyo, coupe au bord, sans mur); le filtrage (dedans, dehors, bord, trame qui se décode); le banc sur la carte de mesure (30 joueurs, Black Ninjas, filtrage qui ne change pas la partie, terrain refusé); les options du plan; le résumé du profil.
- Résultat: 4 544 tests sur 4 544 en local (290 fichiers), types des paquets, des tests et du bout en bout, linter et formatage des fichiers touchés verts. Seuils de charge inchangés.
- Couverture de packages/sim: la nouvelle branche de `creerEtatInitial` est couverte.
- Empreinte des quatre parties de référence: identique, jeu et flux.
- État de la CI: voir le commit poussé.

## Décisions et écarts au plan

- **Décision 2 de la fiche tranchée pour des dimensions fournies au moteur**, et non un identifiant de plus: l'identifiant serait entré dans le type des cartes, donc dans les plafonds, la page, le préchargement du serveur et la base. Détail dans la fiche, section « Réconciliation ».
- **300 battements mesurés après 100 d'échauffement** sur la carte de mesure, au lieu de 1 200 après 200: une ligne à 10 000 PNJ aurait duré vingt-cinq minutes.
- **Un plafond de plus que la fiche ne prévoyait pas: le lancement d'une partie**, mesuré par une colonne ajoutée au banc. Rangé dans `5.11`, dont les apparitions faisaient déjà partie.
- **Un calcul en joueurs fois PNJ trouvé par le profil, le classement**: rangé aussi dans `5.11`.
- **La machine Oracle n'est pas mesurée**: la session n'y a pas accès. Commandes ci-dessous. Le calage par le seul témoin ne suffit pas, la machine Arm de GitHub l'a montré: les commandes mesurent donc aussi la carte de mesure jusqu'à 5 000 PNJ.
- **Les profils bruts** (`.cpuprofile`, 1,4 Mo chacun) ne sont pas versionnés: leur résumé, quarante lignes par fonction et par fichier, est dans `poste-profil-5000-12.json` et `-60.json`.

## Problèmes connus et dette

- Le calage sur la machine Oracle reste à faire (définition de terminé, point 2).
- Le banc à 10 000 PNJ prend de 5 à 7 minutes par ligne sur le poste; une séance complète dure environ une heure et demie.

## Les commandes du porteur du projet pour la machine Oracle

Une seule fois, à une heure sans partie en cours. Le banc tourne dans un conteneur à part, borné à un cœur et à 6 Go: la production garde ses trois autres cœurs. Durée: de l'ordre de trente minutes, installation comprise. À lancer une fois ce commit en ligne.

1. Dans PowerShell, sur le poste, à la racine du dépôt: vérifier qu'aucune partie ne tourne (`"parties":0` dans la réponse), puis se connecter.

```powershell
(Invoke-WebRequest -UseBasicParsing https://serveur.ninja.dendrolag.fr/sante).Content
ssh -i ~/.ssh/neon_ninja_oracle ubuntu@serveur.ninja.dendrolag.fr
```

2. Sur la machine, une ligne après l'autre:

```bash
git clone --depth 1 https://github.com/Dendrolag/Ninja-NodeJS-Game.git ~/mesure-5-10
cd ~/mesure-5-10
docker run --rm --cpus 1 --memory 6g -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -v ~/mesure-5-10:/jeu -w /jeu node:24-bookworm-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm charge --banc --bots-banc 300 --sortie oracle-temoin-1.json && pnpm charge --banc --carte-de-mesure realiste --bots-banc 1000,2000,5000 --battements 300 --echauffement-banc 100 --zone-d-interet --sortie oracle-realiste-12.json && pnpm charge --banc --bots-banc 300 --sortie oracle-temoin-2.json && pnpm charge --demarrage --sortie oracle-demarrage.json"
exit
```

3. De retour dans PowerShell, rapatrier les quatre fichiers, puis nettoyer la machine:

```powershell
scp -i ~/.ssh/neon_ninja_oracle "ubuntu@serveur.ninja.dendrolag.fr:mesure-5-10/oracle-*.json" docs/mesures/5-10/
ssh -i ~/.ssh/neon_ninja_oracle ubuntu@serveur.ninja.dendrolag.fr "sudo rm -rf ~/mesure-5-10"
```

Puis une session ajoute leur tableau à la section 37.9 de `docs/mesures/charge-serveur.md`, et dit si `5.18` devient nécessaire pour la population retenue.

## Questions au porteur du projet

1. **Combien de joueurs par Battle Royale ?** La mesure ne l'arrête pas: 60 joueurs coûtent au moteur à peine plus que 12; ce qu'ils coûtent est le classement (levé par `5.11`) et le réseau (levé par `2.10`).
2. **Quelle foule ?** Recommandation, chiffres de la section 37: **2 000 PNJ, 60 joueurs, 20 Black Ninjas** (un par centaine). Une fois la grille faite, de l'ordre de 10 ms par battement sur le poste, 20 à 30 sur un cœur Oracle, dans le budget. C'est une carte clairsemée, un PNJ pour 50 000 pixels carrés, six fois moins dense que Tokyo: les PNJ y sont surtout du gibier et des repères, pas une foule où se cacher. 3 000 PNJ restent possibles si la mesure de `5.11` sur la machine Oracle le permet. La densité de Tokyo, 9 000 PNJ, demanderait `5.18` en plus, et peut-être davantage.
3. **D'accord pour lancer une fois le banc sur la machine de production**, avec les commandes ci-dessus ?
4. **Deux étapes ajoutées au ROADMAP**, `5.17` (la Battle Royale sur son propre fil, nécessaire: une telle partie prend presque tout un cœur) et `5.18` (conditionnelle). À valider.

## Prochaine action exacte

Exécuter l'étape 5.11, la grille du moteur, avec les cibles de sa fiche au ROADMAP: à 2 000 PNJ et 60 joueurs sous 10 ms par battement sur le poste, à 5 000 sous 30, le lancement à 10 000 PNJ sous une seconde, empreinte des parties de référence identique.

## Étape suivante

Fiche à lire: `docs/plan/etape-5-11.md`, à rédiger selon le cas de repli du PROTOCOLE depuis l'entrée `5.11` du ROADMAP et la section 37 de `docs/mesures/charge-serveur.md`.
