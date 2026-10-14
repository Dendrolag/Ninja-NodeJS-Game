# Fiche étape 7.27 - Among Ninjas, des réparations à la main

Brief de session. Objectif unique: qu'aucune réparation d'Among Ninjas ne consiste plus à se tenir dans un cercle en appuyant sur la touche d'action. La panne de néons et la surchauffe se réparent par de vrais gestes, joués dans la fenêtre néon des tâches, et chaque partie tire au sort la façon de les réparer: trois pour la panne, deux pour la surchauffe. Les tâches des stations, le gong et les autres sabotages ne changent pas.

## Origine de cette fiche

Rédigée le 13 octobre 2026, à la demande du porteur du projet, avant l'exécution de l'étape. Sources: la conversation du même jour (les propositions, et la réponse « fais-les toutes, et ce sera aléatoire en fonction des parties »), la fiche 7.22 (les sabotages) et la fiche 7.21 (les gestes) prises comme modèles, et l'état du dépôt au commit `5b88da3`, qui a posé sur Tokyo le pavillon du gong et le générateur à la place de leurs cercles (version 1.9.3, `assets/among/map1/`).

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles des fiches 7.20 à 7.24.

**Numéro**: 7.27, numéro provisoire, dans la phase 7, « Modes de jeu ». `7.25` (l'appropriation) et `7.26` (d'autres tâches courtes) restent réservés.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff, cette fiche, `.claude/rules/sim-purity.md`, les fiches 7.21 et 7.22, et `packages/sim/src/among.ts` (fonctions `avancerLeSabotage`, `posteTenu`, `faireLesTaches`, `ouvrirUneTache`). Les questions de cette fiche ont leurs réponses (section « Réponses du porteur du projet »): la construction peut commencer, par la planche des rendus.

## Décisions du porteur du projet, 13 octobre 2026

1. **Plus aucune réparation « dans un cercle avec la touche d'action ».** La panne (tenir E trois secondes au boîtier) et la surchauffe (tenir E une seconde ensemble aux deux consoles) deviennent de vrais gestes.
2. **Les cinq propositions sont toutes retenues**, tirées au sort selon les parties: trois réparations de la panne, deux de la surchauffe.
3. **Des objets du décor, pas des cercles.** Le générateur sert déjà de boîtier sur Tokyo, et il s'éclaire pour qui peut le réparer. Les consoles gardent leur dessin néon tant que leur image n'est pas livrée.
4. **Le gong reste une simple pression**: c'est un bouton d'alarme, pas une tâche (proposition du 13 octobre, restée sans objection).

## Les réparations

### La panne de néons, au générateur

Une proie, vivante ou fantôme, ou un assassin vivant qui bluffe, ouvre la réparation par la touche d'action dans le disque du boîtier (50 pixels), comme on ouvre une tâche. Elle se joue dans la fenêtre néon des tâches, sans bouger, vulnérable dans le noir. Le premier qui la finit, à sa durée minimale ou après, rallume les néons. Quitter le disque ou fermer la fenêtre annule, et la réparation est à reprendre au début.

1. **Relancer le générateur** (`lanceur`). On tire le lanceur: tenir Espace, ou glisser le doigt vers le bas, et relâcher quand l'aiguille du régime passe dans la zone verte. Raté, le moteur tousse et l'on retire. Puis on remonte trois disjoncteurs dans l'ordre où ils clignotent.
2. **Changer les fusibles grillés** (`fusibles`). Une boîte de six fusibles, trois noircis, tirés au hasard. On touche chacun pour le remplacer, puis on abaisse le levier général.
3. **Accorder la fréquence** (`frequence`). Un oscilloscope néon. On tourne un cadran (flèches, molette, ou le doigt en rond) jusqu'à caler la courbe sur la courbe cible, puis on la tient une seconde dans la tolérance.

Durée minimale de chacune au serveur: **3 secondes**, celle de l'ancienne réparation. Comme pour les tâches courtes, chaque geste se règle pour qu'un joueur rapide et honnête finisse juste au-dessus.

### La surchauffe, aux deux consoles

Seuls les vivants la réparent, comme aujourd'hui: un fantôme lui ôterait son danger. Le délai reste de 45 secondes, et la surchauffe perdue fait toujours gagner les assassins. On ne peut pas se parler pendant le jeu (le chat ne sert qu'en réunion): chaque console montre donc l'état de l'autre.

1. **Les deux clés** (`cles`). À chaque console, d'abord **purger la pression**: une jauge monte, et trois coups de vanne au bon moment (Espace, ou toucher) la ramènent dans le vert. Durée minimale: **2 secondes**. La console est alors purgée, et une clé apparaît. **Tourner la clé et la tenir** (touche d'action, Espace, ou le doigt sur la clé) à une console purgée la tient. Les deux clés tenues ensemble pendant **1 seconde** réparent la surchauffe, comme les deux consoles tenues aujourd'hui. Un voyant dit l'autre console: « en attente », « purgée », « clé tournée ».
2. **Le relais** (`relais`). Quatre interrupteurs à couper en alternance entre les deux consoles. Le premier se coupe à l'une ou l'autre, puis l'on alterne. Couper un interrupteur est un geste bref (abaisser la manette jusqu'au déclic, **0,6 seconde** au moins). La fenêtre dit à chacun quand c'est son tour, et combien d'interrupteurs sont coupés. Le quatrième coupé répare la surchauffe.

### Le tirage

Au lancement de la partie, le moteur tire, de la graine de la partie, **une réparation de la panne et une de la surchauffe**, gardées toute la partie. Le tirage se fait **après tous les tirages existants** (rôles, stations, listes), pour ne rien changer à ce qu'une graine donnait jusqu'ici: le scénario de bout en bout tient à sa graine 4, où Alice tire l'assassin. Rien n'est tiré dans les autres modes.

Les joueurs découvrent la réparation de la partie à la première alerte, qui la nomme: « Panne de néons : relancez le générateur », « changez les fusibles », « accordez la fréquence »; « Surchauffe : purgez les deux consoles et tournez les clés ensemble », « coupez les quatre interrupteurs, d'une console à l'autre ». L'aide décrit les cinq.

## Questions soumises au porteur du projet

1. **Le relais, un interrupteur hors de son tour.** Recommandé: **il ne se passe rien**, la console dit « à l'autre console ». L'autre voie, tout recommencer, rend le relais plus dur, mais un assassin vivant pourrait alors défaire la réparation en coupant à contretemps, sans qu'on puisse le prouver.
2. **Le relais, un joueur qui part ou meurt en route.** Recommandé: **les interrupteurs coupés le restent** jusqu'à la fin de la surchauffe; un autre vivant reprend la console.
3. **Les deux clés, une purge faite puis abandonnée.** Recommandé: **la console reste purgée** jusqu'à la fin de la surchauffe; un autre vivant peut y tourner la clé. Sinon, un meurtre à la console fait tout recommencer, dans les 45 secondes.
4. **La version.** Recommandé: **1.10.0, avec une note**, puisque les réparations changent la façon de jouer le mode. Texte proposé, sur le ton des notes: « **Les réparations.** Les néons ne se rallument plus d'un claquement de doigts. Retroussez vos manches. » L'autre voie: 1.9.4, sans note.
5. **L'image de la console.** Recommandé: **l'étape se fait sans**, les consoles gardent leur dessin néon, et l'image se pose quand elle arrive, comme le générateur (`assets/among/map1/console.png`, livrée au moins deux fois plus grande qu'affichée).

## Réponses du porteur du projet, 13 octobre 2026

Les cinq recommandations sont retenues.

1. **Un interrupteur hors de son tour ne fait rien**, et la console dit « à l'autre console ».
2. **Les interrupteurs coupés le restent** jusqu'à la fin de la surchauffe, si un joueur part ou meurt.
3. **Une console purgée le reste** jusqu'à la fin de la surchauffe; un autre vivant peut y tourner la clé.
4. **Version 1.10.0, avec une note**, au texte proposé.
5. **L'étape se fait sans l'image de la console**, qui se posera quand elle arrivera.

## Le contrat et le moteur

- **`packages/shared/src/among.ts`**: `REPARATIONS_DE_LA_PANNE = ['lanceur', 'fusibles', 'frequence']` et `REPARATIONS_DE_LA_SURCHAUFFE = ['cles', 'relais']`, leurs durées minimales, le nombre d'interrupteurs du relais (4). `REPARATION_DE_LA_PANNE_MS` disparaît: la panne ne se tient plus.
- **`packages/sim/src/etatAmong.ts`**: les deux réparations tirées de la partie; pour chaque joueur, la réparation ouverte (`reparationEnCours`, son poste et son temps écoulé, sur le modèle de `tacheEnCours`); dans la surchauffe en cours, les consoles purgées (les deux clés) ou les interrupteurs coupés et la console du prochain (le relais).
- **`packages/sim/src/among.ts`**: l'ouverture d'une réparation par la touche d'action au poste, après le signalement et le gong, dans l'ordre du serveur; son annulation hors du disque ou fenêtre fermée; sa fin, refusée avant sa durée minimale; les clés tenues, le relais. Le moteur reste pur, et ne connaît des gestes que leur nature et leur durée minimale.
- **Les entrées** (`packages/shared/src/entrees.ts`, et leur validation): la fin et la fermeture d'une réparation, sur le modèle de celles d'une tâche. La clé tenue reste la touche d'action tenue.
- **Les vues**: la réparation tirée, les consoles purgées, les interrupteurs coupés et la console du prochain, dans la part commune du sabotage. Tout le monde voit déjà l'alerte: rien de nouveau ne s'y trahit.

## La page

- **Cinq gestes** dans `packages/client/src/interface/modeles/gestes/` (`lanceur.ts`, `fusibles.ts`, `frequence.ts`, `purge.ts`, `interrupteur.ts`), sur le modèle des gestes de 7.21: un état, des commandes au clavier, au pointeur et au doigt, un avancement, une fin. Leurs dessins au trait néon dans `dessinsDesGestes.ts`, au rendu choisi sur planche. La clé et les voyants des deux consoles dans la fenêtre.
- **La fenêtre des tâches** s'ouvre pour une réparation comme pour une tâche, avec son titre et son aide, et se ferme quand le sabotage finit, réparé par un autre ou non.
- **Le bouton d'action** dit « Réparer », comme aujourd'hui. La surbrillance du générateur ne change pas de règle: elle suit ce que ferait le bouton.
- **Le HUD et les annonces** nomment la réparation de la partie (section « Le tirage »). **L'aide** décrit les cinq.
- **Feinte**: un assassin vivant qui ouvre une réparation de la panne la fait vraiment (elle compte, comme aujourd'hui). Rien ne la distingue de celle d'une proie.

## Les sons

Provisoires, faits de sons du jeu, à remplacer par ceux du porteur du projet, sur le modèle des étapes 7.21 et 7.22: le moteur qui tousse, le moteur qui démarre, un disjoncteur, un fusible qui s'enclenche, le levier général, le grésillement de l'oscilloscope et son accord, la vanne de purge, la clé qui tourne, un interrupteur coupé. La liste exacte se consigne dans `packages/shared/src/ressources.ts` et le handoff.

## Périmètre

- Les cinq réparations, leur tirage, leurs règles au moteur, leurs entrées, leurs vues.
- Les cinq gestes dans la page, au clavier, au pointeur et au doigt, sur ordinateur et sur téléphone en portrait.
- Les textes du HUD, des annonces et de l'aide.
- La planche des rendus des gestes, proposée au porteur du projet, comme à 7.21.

## Hors périmètre

- Les tâches des stations, et leurs objets du décor (une autre demande, plus tard).
- Les collisions du gong et du générateur (proposées à part le 13 octobre 2026).
- L'image de la console, si elle n'est pas livrée (question 5).
- Les autres sabotages, la malédiction, le gong.

## Tests requis

- **Contrat (TU)**: les réparations et leurs durées minimales, les entrées et leur validation.
- **Tirage (TU)**: une réparation de chaque sabotage par partie, reproductible à graine égale, chacune tirée sur un échantillon de graines; les rôles, les stations et les listes d'une graine inchangés; rien dans les autres modes.
- **Moteur (TU)**: pour la panne, l'ouverture au boîtier et pas ailleurs, par qui le peut et pas par un assassin fantôme, la fin refusée avant 3 secondes puis acceptée, l'annulation hors du disque ou fenêtre fermée, plusieurs réparateurs à la fois; pour les deux clés, la purge refusée avant 2 secondes, la clé tenue sans purge qui ne compte pas, les deux clés ensemble qui réparent; pour le relais, l'alternance, le premier interrupteur à l'une ou l'autre console, l'interrupteur hors de son tour selon la réponse 1; pour les deux, ni fantôme ni surchauffe perdue réparée après son terme.
- **Vues (TU)**: la réparation et son avancement dans la part commune, rien de plus.
- **Serveur (TI)**: une panne et une surchauffe réparées à travers le vrai serveur, pour chaque réparation.
- **Page (TU)**: le modèle de chaque geste (but, raté et reprise, commandes), le rythme au plus vite qui ne passe jamais sous la durée minimale, la fenêtre, le HUD, l'aide.
- **Bout en bout**: le scénario `tests/e2e/among.spec.ts` répare la panne en jouant au clavier la réparation que sa graine a tirée (le harnais `tests/e2e/harnais/gestes.ts` apprend les trois).

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les cinq réparations se jouent dans la page à la souris, au clavier et au doigt, sur ordinateur et sur téléphone en portrait (375 sur 812), vérifiées dans un vrai navigateur, captures dans `docs/design/etape-7-27/`.
2. **Plus aucune réparation ne se fait en tenant seulement la touche d'action**, ni plus vite que sa durée minimale, ni de loin, ni par qui ne le peut pas, vérifié par les tests du moteur et du serveur.
3. **Les autres modes n'ont pas changé**: tests existants inchangés, empreinte des parties de référence identique.
4. La couverture de `packages/sim` ne baisse pas.
5. CI verte sur `master`, et mise en ligne suivie jusqu'au bout.

## Points de vigilance

1. **Le rythme et la durée minimale sont liés**, comme pour les gestes de 7.21: un joueur rapide refusé par le serveur serait un défaut. Un test le garde, geste par geste.
2. **La surchauffe dure 45 secondes**, trajet compris: les consoles sont à 1 490 pixels l'une de l'autre (1 415 depuis le 14 octobre 2026, quand leur image les a écartées des lampadaires). Le relais, le plus long, doit se faire à deux en une quinzaine de secondes une fois sur place.
3. **Aucune touche d'un geste ne doit faire bouger le ninja derrière**, comme pour les tâches.
4. **Dans le noir de la panne**, la fenêtre ne doit pas cacher plus que celle d'une tâche: le réparateur reste vulnérable, c'est voulu, mais il doit voir arriver quelqu'un autant qu'à une station.
5. **Le pilote des scénarios** tient la touche E au boîtier aujourd'hui (`among.spec.ts`, section « La panne de néons »): à remplacer, sans quoi le scénario échoue.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-27-handoff.md`: les réponses du porteur du projet, les écarts à cette fiche (section « Réconciliation », à créer), les sons provisoires, l'état de la CI et de la mise en ligne. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP, ou la main au porteur du projet. Commiter et pousser.
