# Handoff - Étape 7.5 Réglages du Classique

Date: 18 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Changer en une seule fois les règles du mode d'origine demandées par le porteur du projet: le Classique devient la « Horde », les faux ninjas ralliés à la suite font un combo qui ajoute une prime au score, les points flottants montent en couleur et en taille avec le combo, et tout le monde va à 150 pixels par seconde hors bonus.

## Ce qui a été fait

- **Règles tranchées avec le porteur du projet** au début de la session, puis fiche `docs/plan/etape-7-5.md` rédigée selon le cas de repli du PROTOCOLE (`418f8dd`). Décisions: prime de combo rangée dans une réserve, perdue à la capture sans aller au capteur; règles du Massacre (2 secondes, un cran tous les 5, x5 au plus); seuls nos contacts directs comptent, neutres ou pris à un autre; Horde seulement; la moitié de la réserve perdue face à un Black Ninja; points flottants du froid vers le chaud, aussi au Massacre; nom « Horde »; Black Ninjas à 150 comme les autres, confirmé en sachant qu'on ne les distance plus sans bonus.
- **Moteur**: `packages/sim/src/horde.ts`, l'état `EtatPartie.horde` posé au lancement, la règle de contacts `regleHorde` (ralliement, réserve vidée à la capture), la fenêtre et les Black Ninjas dans `agirEnHorde`, la réserve ajoutée au score, le fait `ralliement`.
- **Contrat**: constantes `COMBO` communes au Massacre et à la Horde, `multiplicateurDuCombo` dans `combo.ts`, vitesse commune de 150 pixels par seconde, notification `ralliement`.
- **Serveur**: les ralliements d'un battement regroupés en une notification, au seul joueur concerné.
- **Page**: le nom « Horde » partout où il se lit (création, salon, parties, fin, profil, aide); les points flottants de la Horde tirés des ralliements; le niveau de combo des points, en Horde et en Massacre; le compteur de combo commun aux deux modes; l'annonce d'un palier et le son des ralliements.
- **Vérifié dans une vraie partie Horde** dans le navigateur de Claude Code (serveur local): tuile et récapitulatif « Horde », compteur « x1 », score qui monte; l'échelle des cinq niveaux rendue par la vraie feuille de style (couleurs et tailles relevées: blanc 25 px, cyan 30, vert 35, or 40, magenta 45).
- Commit `8d1374d`.

## Fichiers créés ou modifiés

Commit `418f8dd`: `docs/plan/etape-7-5.md` (créé).

Commit `8d1374d`:

- Moteur: `packages/sim/src/horde.ts` et `horde.test.ts` (créés); `contacts.ts` (`regleHorde`), `moteur.ts` (jeu de règles du mode classique), `score.ts` (réserve au score), `etat.ts` (`Ralliement`, `RallieurEnHorde`, `EtatDeHorde`, `EtatPartie.horde`), `index.ts`, `massacre.ts` (lit `COMBO`); tests `modes.test.ts`, `massacre.test.ts`, `partie.test.ts` et son instantané (partie lancée comme par le serveur).
- Contrat: `packages/shared/src/constantes.ts` (vitesse commune, `COMBO`) et test; `combo.ts` (remplace `massacre.ts`); `evenements.ts` (`RalliementVu`, `NinjaRallieVu`); `index.ts`.
- Serveur: `packages/server/src/instantane.ts` (ralliements regroupés) et test; `ServeurSocket.ts`; `GameRoom.ts` (commentaire du lancement); `ServeurSocket.horde.test.ts` (créé).
- Page: `packages/client/src/faits.ts`, `client.ts`, `pointsFlottants.ts`, `hud/pointsFlottants.ts`, `rendu/boucle.ts`, `hud/modele.ts` et `hud/surcouche.ts` (`Hud.combo`), `annonces.ts`, `sons/declencheurs.ts`, `rendu/katana.ts`, `interface/modeles/cartes.ts`, `interface/ecrans/creation.ts`, `interface/composants/aide.ts`, `page/styles/jeu.css`; commentaires de `interface/modeles/creation.ts`, `fin.ts`, `parties.ts`, `profil.ts`; tests `horde.test.ts` (créé), `massacre.test.ts`, `pointsFlottants.test.ts`, `hud/pointsFlottants.test.ts`, `rendu/boucle.test.ts`, `sons/sons.test.ts`, et ceux des écrans qui lisent le nom du mode; `tests/e2e/parties.spec.ts`.
- Outils: `tests/charge/empreinte.ts` (parties lancées comme par le serveur).
- Documentation: `CLAUDE.md` (comportements 1, 3 et 5, datés), `docs/design/cadrage.md`, `docs/design/README.md` (cinq entrées au journal), `docs/plan/ROADMAP.md`, `docs/plan/etape-7-5.md` (réconciliation).

Hors commit: `.claude/launch.json` passe en port automatique (le port 3000 était pris par une autre conversation); le fichier est exclu du suivi (`.git/info/exclude`).

Commit de ce handoff: `docs/handoffs/etape-7-5-handoff.md` (créé).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés, écrits avant leur code pour le moteur: le combo (ralliement d'un ninja neutre ou pris à un autre, rien pour un ninja déjà à nous, rien pour la contagion, rien au salon), la prime aux paliers x2 à x5 et le plafond, la fenêtre (prolongée à 2 secondes pile, retombée au-delà), la réserve vidée à la capture sans aller au capteur, la moitié perdue face à un Black Ninja, un Black Ninja détruit sans effet sur le combo, le score avec la réserve et sans elle hors Horde, la vitesse commune, le déterminisme; au serveur, la notification regroupée au seul rallieur, omise pour un joueur parti, la réserve au classement, et une partie Horde à travers le vrai réseau; à la page, le compteur de combo, les points tirés des ralliements et leur niveau, l'annonce de palier, le son, le niveau des morts du Massacre, l'attribut `data-niveau`.
- Résultat: **2 300 tests unitaires sur 2 300**; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **38 scénarios sur 38**.
- Couverture de `packages/sim`: **99,84 pour cent** des instructions, inchangée; `horde.ts` à 100 pour cent des instructions.
- **Empreintes du jeu, nouvelles références** (changées volontairement par la vitesse et le combo, reproductibles à l'identique d'une exécution à l'autre): `f43a7636…7b59` (150 bots, 12 joueurs, murs), `61afe783…d230` (50 bots), `9590fda2…6f43` (300 bots sans mur), `95260260…790c` (150 bots, 2 joueurs). Ces parties comptent 38 à 525 ralliements.
- Banc rapide du Classique: 0,48 ms par battement à 150 bots et 12 joueurs.
- État de la CI: **`8d1374d` verte** (exécution 35384621620), avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne »: la Horde est en production. Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md` (18 septembre 2026), et une section « Réconciliation » dans la fiche. À retenir:

1. **Les ralliements d'un battement voyagent en une seule notification**, là où la fiche en prévoyait une par ralliement: le fil des faits de la page est plafonné à cinquante.
2. **`Hud.massacre` est devenu `Hud.combo`**, commun au Massacre et à la Horde.
3. **La partie de référence du moteur et l'outil d'empreinte lancent désormais leurs parties**, comme le serveur. Sans cela, la Horde y aurait joué sans combo, et l'empreinte n'aurait pas prouvé le jeu réel.
4. **Le test d'intégration du serveur ne peut pas exiger une prime**: la graine est tirée au hasard par le serveur. Il vérifie l'accord entre notifications, état et classement; les paliers se testent dans le moteur.
5. **Les points d'un Black Ninja détruit ne sont pas multipliés en Horde**, et ne touchent pas au combo.

## Problèmes connus et dette

- **À regarder par le porteur du projet**: l'or du x4 (`#ffd23f`) est très proche de l'or des points d'un Black Ninja détruit (`#ffd700`); seule la taille les distingue (40 contre 35 pixels).
- **À jouer par le porteur du projet**: l'équilibre de la prime, dont la valeur en partie réelle n'est pas mesurée, et les Black Ninjas désormais aussi rapides que les joueurs.
- **Le compteur de combo de la page tombe au battement près**: il lit la fenêtre depuis l'arrivée du dernier ralliement, comme au Massacre.

Repris du handoff 5.5, inchangé: le volume des sons sur un vrai iPhone et le son malgré le mode silencieux; les sons du katana et du fusil à écouter; la barre du HUD à regarder à plusieurs; en bas, aucun élément du HUD ne couvre le centre; l'équilibrage du Massacre et de la Chasse reste à jouer; le coût du sang et d'un tir en Chasse n'est pas mesuré; un traqueur éliminé ne voit que les traqueurs et sa caméra reste figée; en Équipes, on ne distingue ses coéquipiers qu'à la couleur, une partie coûte un peu plus cher, une équipe vidée n'est plus classée, un joueur entré en cours de partie ne choisit pas son camp, le chat n'est pas par équipe; un hôte seul dans son salon le perd avec son lien; un joueur revenu dans le salon n'en est plus l'hôte; l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet); jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; la fluidité et le lancement sur iPhone restent à confirmer; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027; la musique reste à écouter (cas C21 de la grille de recette).

## Prochaine action exacte

Dans une conversation neuve, sur `master`: ouvrir l'étape `7.6`, options de partie. Sa fiche n'existe pas: la rédiger selon le cas de repli du PROTOCOLE à partir de l'entrée 7.6 du ROADMAP (section 4): Tokyo et Rainy Tokyo réunis en une seule carte « Tokyo » avec une option pluie dans les réglages de partie, les parties et records déjà enregistrés restant lisibles; plus de 150 faux ninjas au départ, selon le mode ou la carte, dans la limite qu'une mesure du débit et du rendu justifie. Trancher avec le porteur du projet le plafond de faux ninjas et s'il dépend du mode ou de la carte.

Au porteur du projet: jouer une Horde pour juger la prime et la vitesse des Black Ninjas, et regarder l'or du x4 à côté de celui des Black Ninjas.

## Étape suivante

Fiche à lire: aucune encore; celle de l'étape 7.6, options de partie, à rédiger au début de la session (entrée 7.6 de la section 4 du ROADMAP).
