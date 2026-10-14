# Handoff - Étape 7.27 Among Ninjas, des réparations à la main

Date: 13 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'aucune réparation d'Among Ninjas ne consiste plus à se tenir dans un cercle en appuyant sur la touche d'action: la panne de néons et la surchauffe se réparent par de vrais gestes, joués dans la fenêtre néon des tâches, et chaque partie tire au sort la façon de les réparer, trois pour la panne, deux pour la surchauffe. Fiche: `docs/plan/etape-7-27.md`.

## Réponses du porteur du projet

Les cinq recommandations de la fiche, retenues le 13 octobre 2026 avant la construction (`e557325`): un interrupteur hors de son tour ne fait rien, et la console dit « à l'autre console »; les interrupteurs coupés restent coupés, et une console purgée reste purgée, jusqu'à la fin de la surchauffe, si leur réparateur part ou meurt; version 1.10.0 avec une note, au texte proposé; l'étape se fait sans l'image de la console.

## Ce qui a été fait

- **Hors étape, avant elle**: la pierre du jardin zen, image livrée par le porteur du projet en cours de session, habille la station du même nom (`8e0dd7c`, version 1.9.4, poussée et en ligne). Un objet du décor peut désormais habiller une station, dite par son nom (`LieuDUnObjet`, `placeDUnObjet`); elle remplace le disque cyan, bat là où il se serait montré, et s'éclaire quand le bouton d'action y ouvrirait la tâche. Vérifiée dans le vrai rendu PixiJS.
- **Le contrat** (`packages/shared`): les réparations (`REPARATIONS_DE_LA_PANNE`, `REPARATIONS_DE_LA_SURCHAUFFE`, `NATURES_DE_REPARATION`), les gestes et leurs durées minimales (`DUREES_MINIMALES_DES_REPARATIONS_MS`: 3 secondes pour chaque réparation de la panne, 2 pour une purge, 0,6 pour un interrupteur), le poste d'une réparation (`PosteDeReparation`: le boîtier, ou une console par son rang), les quatre interrupteurs du relais. `AMONG.REPARATION_DE_LA_PANNE_MS` disparaît: la panne ne se tient plus. Le message `reparation` (finie ou fermée) et sa validation. Dans la vue du sabotage: la réparation tirée, les consoles purgées, les interrupteurs coupés, la console du prochain; dans l'état privé, le poste de la réparation ouverte; dans l'annonce du lancement, la réparation tirée. Le flux binaire porte la réparation sur un octet de plus dans le bloc du sabotage.
- **Le moteur** (`packages/sim/src/among.ts`): le tirage des deux réparations, au lancement, après tous les tirages existants (rôles, stations et listes d'une graine inchangés, épinglés par un test sur la graine 4 du scénario). L'ouverture d'une réparation par l'appui au poste, après le signalement et le gong, avant la tâche; son annulation hors du disque, fenêtre fermée, ou sabotage fini; sa fin, refusée avant sa durée minimale. La panne réparée par le premier geste fini. Les deux clés: la purge d'une console, puis les deux clés tenues ensemble une seconde, par le bouton d'action tenu dans le disque d'une console purgée. Le relais: le premier interrupteur à l'une ou l'autre console, puis l'on alterne; hors de son tour, rien; chaque interrupteur se compte du précédent, aux deux consoles. Pendant une réparation, le bouton d'action ne signale ni ne sonne: il tient la clé. Une réunion, un meurtre, un tour neuf et la fin du sabotage ferment les réparations ouvertes.
- **Le serveur**: le message `reparation` relayé au moteur comme celui d'une tâche, les vues et l'état privé.
- **La page**: cinq modèles de gestes purs (`modeles/gestes/lanceur.ts`, `fusibles.ts`, `frequence.ts`, `purge.ts`, `interrupteur.ts`, et leur index `reparations.ts`), au clavier, au pointeur et au doigt, la fréquence aussi à la molette; leur dessin au trait néon (`composants/dessinsDesReparations.ts`); ce que montre la fenêtre selon l'état (`modeles/reparation.ts`: le geste de la panne, la purge puis la clé, l'interrupteur ou l'attente de son tour, et une ligne qui dit l'autre console); la fenêtre (`composants/reparation.ts`), orange pendant la panne, rouge pendant la surchauffe, qui fige le jeu, annonce la fin après la durée minimale et tient la clé par Espace, E ou le doigt. Le bandeau du HUD et la première annonce nomment la réparation tirée; l'aide décrit les cinq.
- **Planche** `docs/design/etape-7-27/1-planche.png`, dessinée par le vrai code de dessin, quatre moments de chaque geste.
- **Vérifié dans un vrai navigateur**, dans de vraies parties à cinq, Alice au bureau (1280 sur 720), Bob sur téléphone en portrait (375 sur 812), l'assassin un client du réseau (captures dans `docs/design/etape-7-27/`): le générateur relancé au doigt sur le téléphone, les fusibles changés au doigt, la fréquence accordée au doigt en rond, et au clavier au bureau; les deux clés purgées au clavier et au doigt puis tournées ensemble; le relais coupé en alternance, au clavier et au doigt. Les trois réparations de la panne aussi au clavier, dans la vraie fenêtre. L'outil qui a joué ces parties n'est pas commité. Le tirage d'une graine en partie réelle diffère parfois du calcul fait à part avec le moteur seul (le salon règle plus que les cinq réglages du scénario): les graines se vérifient sur la partie.
- **Le scénario de bout en bout** (`tests/e2e/among.spec.ts`) ouvre la réparation par E au générateur et joue au clavier celle que sa graine tire (la fréquence, à la graine 4); le harnais `tests/e2e/harnais/gestes.ts` sait les trois réparations de la panne.
- **Version 1.10.0**, note « Les réparations », au texte accepté par le porteur du projet.

## Sons provisoires

Faits de sons du jeu, à remplacer par ceux du porteur du projet (il suffit de changer le fichier dans `packages/shared/src/ressources.ts`), entendus du seul réparateur: `reparationTousse` (le moteur qui tousse, `collect-malus.wav`), `reparationDemarre` (`speed-active.mp3`), `reparationDisjoncteur` (`button-click.wav`), `reparationFusible` (`shotgun-reload.mp3`), `reparationLevier` (`mine-pose.mp3`), `reparationAccord` (`collect-bonus.wav`), `reparationVanne` (`bonus-escape-nuage.mp3`), `reparationDeclic` (`shotgun-reload.mp3`), `reparationCle` (`button-click.wav`). Un essai raté joue `tacheRatee`. Le grésillement de l'oscilloscope, qui dure, n'a pas de son: comme le frottement des tâches, son son en boucle reste à fournir.

## Réconciliation

Écarts à la fiche, aucun ne touche une règle:

1. **La clé tenue.** La fiche dit « la clé tenue reste la touche d'action tenue ». C'est bien le bouton d'action, mais la fenêtre l'émet elle-même (Espace, E, ou le doigt sur la clé), les commandes du jeu étant figées pendant la réparation. Pour que tenir la clé ne signale pas un cadavre voisin, un appui pendant une réparation ne fait rien d'autre au moteur.
2. **Le poste dans l'état privé.** La fiche plaçait la réparation ouverte dans les vues; elle va dans l'état privé (`reparationEnCours`), comme la tâche ouverte, et la part commune du sabotage dit la réparation tirée et où elle en est.
3. **Les noms des consoles.** La fenêtre les appelle « Console 1 » et « Console 2 », le boîtier « Générateur de la rue »; l'annonce de la panne dit « réparez le générateur de la rue » quand la réparation n'est pas connue, ce qui n'arrive plus qu'à une page plus ancienne que le serveur.
4. **Le titre de la note.** La fiche donnait le texte de la note, pas son titre: « Les mains dans le cambouis » est proposé par la session, **à confirmer par le porteur du projet**.
5. **Une ligne de l'aide corrigée en route (règle 7).** Elle disait que les fantômes réparent la panne « depuis leur carte »; ils la réparent au générateur, comme les vivants.
6. **`pnpm lint` en local (règle 7).** Le linter lisait les copies de travail des autres sessions (`.claude/worktrees/`), et échouait sur leur `legacy/` et leur page empaquetée; elles sont ignorées du linter et du formateur (`8e0dd7c`).

## Fichiers créés ou modifiés

- `packages/shared/src/among.ts`, `index.ts`: réparations, durées, postes, objets du décor sur une station; `evenements.ts`: message `reparation`, vue du sabotage, état privé, annonce; `validation.ts`: `validerDemandeReparation`; `flux.ts`: l'octet de la réparation; `ressources.ts`: neuf sons; `version.ts`: 1.10.0.
- `packages/sim/src/among.ts`, `etatAmong.ts`, `moteur.ts`, `index.ts`: tirage, ouverture, gestes, clés, relais, entrée `reparation`.
- `packages/server/src/GameRoom.ts`, `ServeurSocket.ts`, `instantane.ts`: le message, les vues, l'état privé, l'annonce.
- `packages/client/src/among.ts`, `actions.ts`, `reduction.ts`, `client.ts`: la réparation ouverte et sa fermeture, `finirLaReparation`, `fermerLaReparation`.
- `packages/client/src/interface/modeles/gestes/` (créés): `communDesReparations.ts`, `reparations.ts`, `lanceur.ts`, `fusibles.ts`, `frequence.ts`, `purge.ts`, `interrupteur.ts`; `modeles/reparation.ts` (créé); `composants/reparation.ts`, `composants/dessinsDesReparations.ts` (créés); `ecrans/jeu.ts`: la fenêtre montée; `page/styles/jeu.css`: ses styles.
- `packages/client/src/hud/among.ts`, `annonces.ts`, `interface/composants/aide.ts`, `interface/modeles/notesDeVersion.ts`: textes, aide, note 1.10.
- `packages/client/src/rendu/among.ts`: la pierre du jardin zen (`8e0dd7c`).
- Tests: `packages/shared/src/among.test.ts`, `flux.test.ts`; `packages/sim/src/among.test.ts`; `packages/server/src/ServeurSocket.among.test.ts`, `among.sabotages.test.ts`, `among.pas.test.ts`; `packages/client/src/among.reparations.test.ts`, `interface/modeles/gestes/reparations.test.ts`, `interface/composants/reparation.test.ts` (créés), `hud/sabotages.test.ts`, `annonces.test.ts`, `rendu/sabotages.test.ts`, `interface/composants/carteAmong.test.ts`.
- `tests/e2e/among.spec.ts`, `tests/e2e/harnais/gestes.ts`: la panne réparée au clavier.
- Documentation: `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/etape-7-27/` (planche et captures), ce handoff; `assets/README.md` et `assets/among/map1/pierre-jardin.png` (`8e0dd7c`).

## Tests

- Ajoutés: contrat (réparations, durées, validation, octet du flux pour chacune); tirage (une de chaque, reproductible, chacune tirée sur quarante graines, rôles, stations et listes de la graine 4 inchangés, rien dans les autres modes); moteur (la panne qui ne se tient plus, l'ouverture au boîtier et nulle part ailleurs, par qui le peut, la fin refusée avant 3 secondes, l'annulation, plusieurs réparateurs, la réunion et le meurtre qui ferment, le bouton qui ne signale pas pendant une réparation; la purge refusée avant 2 secondes, la clé sans purge qui ne compte pas, les deux clés ensemble, la console purgée qui reste, le fantôme; le relais, l'alternance, le premier interrupteur aux deux consoles, hors de son tour, les 0,6 seconde du précédent, le quatrième qui répare, l'interrupteur qui reste au meurtre du réparateur, le bouton tenu qui ne coupe rien, rien après le terme); vues; serveur (les cinq réparations à travers le vrai serveur, chacune à une graine qui la tire); page (chaque geste au clavier et au pointeur, le rythme au plus vite jamais sous la durée minimale et pas plus d'une seconde au-dessus, la fenêtre, l'état, le HUD, l'annonce).
- Résultat: les 4 285 tests unitaires et d'intégration passent (projet `unitaires`; ceux de la base sont sautés en local, sans les clés de Neon). Types du code, des tests et du bout en bout, et linter: sans erreur. Le scénario `tests/e2e/among.spec.ts` passe, la panne réparée au clavier. Les trois réparations de la panne jouées au clavier dans la vraie fenêtre, dans un navigateur, par le harnais.
- Empreinte des parties de référence (`tests/charge/empreinte.ts`): identique, jeu et flux, avant et après l'étape.
- Couverture de packages/sim: 99,84 pour cent des instructions, comme au handoff 7.24.
- État de la CI: voir le commit qui suit celui de l'étape.

## Décisions et écarts au plan

Voir « Réconciliation ». Aucune autre.

## Problèmes connus et dette

- Le titre de la note 1.10 est à confirmer par le porteur du projet.
- L'image de la console n'est pas livrée: les consoles gardent leur dessin néon (réponse 5).
- Les sons sont provisoires.
- La relance du générateur se juge au temps de la page: sur une page qui fige plus d'une seconde et demie pendant qu'on tire, le moteur tousse, comme la fumée déborde dans la tâche du même nom. On retire.

## Prochaine action exacte

La main au porteur du projet: confirmer le titre de la note 1.10, puis choisir la suite, `7.26` (d'autres tâches courtes, faisable tout de suite), `7.25` (l'appropriation, après une partie d'essai), la clôture de `5.15` (une partie en production), ou les collisions des objets du décor.

## Étape suivante

Fiche à lire: celle que le porteur du projet choisira, `docs/plan/etape-7-26.md` à rédiger au début de l'étape selon le cas de repli du PROTOCOLE si c'est `7.26`.
