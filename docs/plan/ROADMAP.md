# ROADMAP - Réécriture Neon Ninja

Plan d'exécution découpé en étapes calibrées pour une conversation Claude Code chacune. Ce fichier est la carte. La fiche détaillée de chaque étape est dans docs/plan/etape-X-Y.md, à lire avant d'attaquer l'étape.

Ce document distingue deux choses:

- **L'ordre d'exécution** (section 3), qui organise le travail en jalons livrables.
- **La carte thématique** (section 4), qui regroupe les étapes par domaine.

Les deux ne coïncident pas. La numérotation des étapes suit la carte thématique et ne change jamais, pour que les renvois entre fiches restent valides. C'est la section 3 qui dit dans quel ordre les exécuter.

## 1. Comment utiliser ce plan

- Une étape égale une conversation. On ne mélange pas deux étapes dans une même session.
- Lire la fiche de l'étape, et la réconcilier avec l'état réel du dépôt avant d'exécuter. Une fiche est un plan, pas un contrat figé. Tout écart se note dans le handoff.
- On termine toujours par un handoff (voir docs/handoffs/_TEMPLATE.md) et un commit.
- **La ligne « prochaine action exacte » en fin de fiche suit la numérotation thématique, pas l'ordre d'exécution.** En cas de divergence, la section 3 fait foi.

## 2. Définition de terminé, commune à toutes les étapes

Une étape est terminée quand, toutes ces conditions étant réunies:

1. Les tests requis de l'étape sont écrits et passent.
2. La CI est verte.
3. Aucune régression sur les tests de caractérisation.
4. Le code respecte les conventions de CLAUDE.md (commentaires en français, pas de variable globale mutable, fichiers concernés documentés).
5. Un handoff a été écrit et commité.

Si une étape déborde, ne pas forcer. La couper en deux, écrire un handoff partiel, et continuer dans la conversation suivante.

---

## 3. Ordre d'exécution et jalons

Le plan d'origine était découpé par couches: tout le moteur, puis tout le réseau, puis toute la base, puis tout le client. Conséquence, le jeu ne redevenait jouable qu'à l'étape 4.4, la vingtième sur vingt-trois. C'est la forme exacte de l'échec de la refonte de 2025: beaucoup construit, jamais confronté au réel.

L'ordre ci-dessous découpe en **tranches verticales**. La première tranche traverse le moteur, le serveur et le client pour redonner un jeu jouable, à parité avec l'existant. Les fonctionnalités nouvelles viennent ensuite, sur une base qui tourne.

### Jalon 1 - Le jeu actuel sur socle sain (15 étapes)

`0.1` `0.2` `1.1` `1.2` `1.3` `1.4` `1.5` `1.6` `2.1` `2.2` `1.7` `4.1` `4.2` `4.3` `4.4`

À l'arrivée: le jeu d'aujourd'hui, entièrement porté, couvert par des tests, avec une seule partie à la fois. Rien de neuf fonctionnellement, tout de neuf structurellement.

Adaptations à appliquer aux fiches de la phase 4 dans ce jalon, parce qu'elles supposent des étapes non encore faites:

- **4.1**: le flux d'état reste en JSON (celui de l'étape 2.2), pas en delta binaire. Pas de session authentifiée. Les écrans sont ceux du legacy (accueil et pseudo, salon, jeu, fin de partie), pas les sept écrans de la maquette. **Exigence de conception: isoler la couche réseau derrière une interface**, pour que le passage au delta binaire en 2.3 ne touche qu'elle.
- **4.3**: construire uniquement les écrans du legacy. Le navigateur de parties, la création, le profil et l'affichage de progression arrivent avec 2.4 et 3.3.
- **4.4**: parcours de bout en bout sans inscription ni progression. Deux clients dans la même partie, capture, score cohérent, plus un test de fumée en fenêtre mobile.

### Jalon 2 - Multi-parties (après les maquettes)

`0.3` `2.4`

Le cadrage fonctionnel puis le matchmaking, les parties privées par code et les publiques par liste et partie rapide. `2.1` ayant déjà encapsulé l'état par partie, il ne s'agit que d'en instancier plusieurs et d'y router les joueurs.

Les maquettes ont été déposées le 13 août 2026: ce jalon n'est plus bloqué. Elles sont à traiter comme des propositions à challenger, pas comme une spécification. Voir l'avertissement et les tensions relevées dans docs/design/README.md.

### Jalon 3 - Comptes et progression

`3.1` `3.2` `3.3`, puis reprise des écrans de `4.3` (navigateur, création, profil, fin de partie enrichie). Sa fiche est `docs/plan/etape-4-3-reprise.md`, rédigée le 11 septembre 2026 selon le cas de repli du PROTOCOLE.

### Jalon 4 - Performance et charge

`5.1` puis `5.2`. **`2.3` (delta binaire) est rattaché ici et conditionné à la mesure de `5.1`.** Le plan d'origine le plaçait en phase 2, avant toute mesure, ce qui contredisait son propre principe « optimisations validées par la mesure ». S'il n'est pas justifié, il ne se fait pas.

**Mesure du 11 septembre 2026 (étape 5.1): `2.3` est justifié, et se fait après `5.2`.** Ordre du jalon: `5.1` `5.2` `2.3`. Un instantané de partie à 150 bots pèse 21,5 Ko, soit 3,4 Mbit/s par joueur; mais le premier mur atteint en charge est la cadence du serveur, vers 16 à 24 parties pleines par processus, qui relève de `5.2`. Chiffres et raisonnement: `docs/mesures/charge-serveur.md`, et le journal de `docs/design/README.md`.

**Mesure du 12 septembre 2026 (étape 5.2): le mur de la cadence est levé, `2.3` suit.** Trois optimisations validées par la mesure, sans changement de jeu, font passer un processus de 16 à 48 parties pleines tenues, et de 24 à 64 parties mêlées. Le coût d'une partie pleine sur le vrai serveur est divisé par deux (1,92 à 0,95 ms par battement), et la perte de cadence de 5.1 est expliquée et corrigée: un processus ne décroche plus que lorsque son fil est réellement plein. La première limite est désormais la bande passante: 3,4 Mbit/s par joueur, 2 Gbit/s sortants pour 48 parties pleines. C'est l'objet de `2.3`.

### Jalon 5 - Extension

Le mode tactique en premier, ajouté comme jeu de règles enfichable (décision du 29 juin). Puis les autres modes. Puis `5.3` et `6.1`, ramenés à un déploiement simple: le legacy n'a pas de joueurs en ligne, la bascule progressive et les drapeaux de fonctionnalité sont sans objet.

---

## 4. Carte thématique des étapes

### Phase 0. Filet et fondations

Poser le harnais de test et figer le comportement actuel avant tout portage.

**0.1. Squelette du dépôt et outillage.** Monorepo (packages sim, server, client, shared), TypeScript, linter, formateur, Vitest, Playwright, CI GitHub Actions verte sur un test trivial. Committer CLAUDE.md, .claude/rules/ et docs/. Figer le legacy en lecture seule.
Tests requis: un test trivial vert dans Vitest, un scénario vide qui démarre dans Playwright, la CI verte.

**0.2. Tests de caractérisation du legacy.** Enregistrer le comportement actuel sur les points sensibles: résolution d'une capture, détection de collision, calcul de score, effets des bonus et malus. Ces références deviennent la vérité du comportement attendu.
Tests requis: une suite de caractérisation qui encode le comportement legacy et passe au vert.

**0.3. Cadrage fonctionnel depuis les maquettes.** Documentation, sans code. Produire docs/design/cadrage.md: périmètre v1, inventaire des écrans et de leurs besoins en données, contrat de configuration de partie, forme des données de progression, principe des modes enfichables.
Vérifications requises: chaque écran v1 a ses besoins listés, le contrat de configuration est complet.

### Phase 1. Cœur de simulation pur

Porter toute la logique de gameplay dans packages/sim, sans entrée-sortie, couverte par des tests unitaires. Phase la plus risquée et la plus structurante. Elle valide tôt la préservation du gameplay.

**1.1. Squelette du moteur et modèle d'état.** Modèle d'état, contrat tick(etat, entrees, dt), générateur à graine, portage de Entity et Player.
Tests requis: TU sur la création d'état, la pureté, l'avancement par tick, le déterminisme de la graine.

**1.2. Déplacements et collisions.** Carte de collisions taille-agnostique sur données pures, déplacements des entités.
Tests requis: TU sur collisions entité-entité et entité-terrain, sur plusieurs tailles de carte, conformes à la caractérisation.

**1.3. Capture et score.** Résolution d'une capture de bot et de joueur, transfert des bots, calcul du classement.
Tests requis: TU sur la résolution d'une capture et la mise à jour des scores, conformes à la caractérisation.

**1.4. Bonus, malus et zones spéciales.** Effets et durées.
Tests requis: TU sur l'application et l'expiration de chaque effet.

**1.5. Intelligence artificielle des bots.** Bots standards et BlackBot, rendus déterministes via la graine.
Tests requis: TU sur les décisions des bots dans des situations données, reproductibles.

**1.6. Durcissement et autorité serveur.** Étape ajoutée, absente du plan d'origine. Validation des entrées, autorité du serveur sur le mouvement, limitation de débit, échappement des données fournies par le joueur. Les défauts de sécurité relevés dans docs/audit/AUDIT-EXISTANT.md ne se caractérisent pas, ils se corrigent par conception.
Tests requis: TU et TI sur le rejet des entrées invalides, le plafonnement du déplacement par unité de temps, le refus d'un débit excessif.

**1.7. Pause de partie.** Étape ajoutée le 14 août 2026, découverte à l'exécution de l'étape 2.2. Le legacy propose une pause (`togglePause`, `pauseGame`, `resumeGame`), et aucune étape de la phase 1 ne l'a portée : ni `EtatPartie` ni `tick` ne connaissent la notion. Elle ne pouvait pas être ajoutée dans la couche réseau, qui n'a le droit de contenir aucune logique de jeu. Périmètre : un état de pause dans le moteur, le temps de jeu qui cesse de s'écouler pendant, l'exposition par `GameRoom`, et les événements réseau correspondants. À placer après 2.2 parce qu'elle traverse le moteur, la room et le réseau, et avant le client, qui a besoin du contrat complet.
Tests requis : TU sur l'arrêt de l'écoulement du temps et le gel des entités pendant la pause, TI sur la mise en pause et la reprise par le réseau, plus la vérification qu'une partie en pause ne se termine pas.

### Phase 2. Serveur et réseau

**2.1. GameRoom et RoomManager.** Envelopper le moteur pur dans une GameRoom qui détient l'état d'une partie, et un RoomManager qui en instancie plusieurs. Boucle de tick par room, temps injecté.
Tests requis: TI sur le cycle de vie d'une room, et sur l'isolation entre plusieurs rooms.

**2.2. Couche Socket.IO et contrats d'événements.** Contrats typés partagés, routage des événements par room.
Tests requis: TI avec des clients simulés, vérification des séquences et de l'isolation entre rooms.

**2.3. Diffusion en delta binaire.** Remplacer la diffusion d'état complet en JSON par un delta binaire. **Conditionné à la mesure de l'étape 5.1.**
Tests requis: TI sur la correction du delta, plus une mesure avant-après de la taille des messages.

**2.4. Matchmaking, parties privées et publiques.** Code d'invitation pour les privées, liste et partie rapide pour les publiques (le cadrage de l'étape 0.3 a remplacé la file).
Tests requis: TI sur la création et la jonction par code, et l'attribution en file publique.

### Phase 3. Persistance et comptes

**3.1. Base de données et schéma.** PostgreSQL, schéma comptes, progression et résultats, migrations versionnées.
Tests requis: TI avec base de test, migrations rejouables, opérations de base.

**3.2. Authentification.** Inscription, connexion, session, authentification de la connexion Socket.IO.
Tests requis: TI sur les parcours d'inscription et de connexion, et le rejet des accès non autorisés.

**3.3. Progression branchée sur la fin de partie.**
Tests requis: TI vérifiant que résultats et progression persistent après une partie.

### Phase 4. Client et rendu PixiJS

**4.1. Squelette client et couche réseau.** Séparation nette entre état et rendu, magasin d'état unique, couche réseau isolée derrière une interface.
Tests requis: TU sur la reconstruction d'état et les transitions d'écran.

**4.2. Rendu in-game PixiJS.** Lueur néon en filtre GPU au lieu du shadowBlur de Canvas 2D. Boucle de rendu propre, découplée du réseau.
Tests requis: banc de mesure de la fréquence d'images avec 100, 200 et 500 sprites, validant le choix du moteur.

**4.3. Menus et interface.**
Tests requis: scénarios de navigation, validation du formulaire de création.

**4.4. Bout en bout multi-clients.** Playwright, plusieurs clients simultanés, fenêtre mobile.
Tests requis: deux clients dans une même partie vérifiant la cohérence de l'état.

### Phase 5. Charge, performance et durcissement

**5.1. Tests de charge serveur.** N rooms peuplées de plus de 100 bots, mesure du temps par tick et de la bande passante.
Tests requis: rapport de charge chiffré, seuils de référence définis.

**5.2. Optimisations validées par la mesure.** Grille spatiale, niveau de détail sur l'IA des bots lointains, seulement si la mesure les justifie.
Tests requis: comparaison avant-après chiffrée, TU inchangés au vert.

**5.3. Déploiement.** Ramené à un déploiement simple, sans bascule progressive ni drapeau de fonctionnalité.
Tests requis: vérification que la version se déploie et démarre dans l'environnement cible.

### Phase 6. Retrait du legacy

**6.1. Extinction.** Retirer l'ancien monolithe une fois la nouvelle version en service.

---

## 5. Écarts assumés par rapport au plan d'origine

Consignés ici pour que la décision reste traçable.

1. **Ordre d'exécution en tranches verticales** au lieu de couches horizontales. Raison: rendre le jeu jouable au jalon 1 plutôt qu'à la vingtième étape.
2. **Base legacy: master v0.8.6** et non mode-strategique v0.9.0. Le corpus d'origine visait la v0.9.0 (vérifié: styles.css à 3 965 lignes, et huit fonctions du système de capture par cône qui n'existent que là). La v0.8.6 est Classique-seul, ce qui correspond au périmètre v1 figé le 29 juin, alors que les fiches 0.2 et 1.3 portaient le mode tactique dès la phase 1. Le mode tactique revient au jalon 5, comme mode enfichable. Note: server.js est identique entre v0.8.5 et v0.8.6, seul le client diffère.
3. **Étape 1.6 ajoutée.** Le plan d'origine ne traitait ni la validation des entrées, ni l'autorité serveur, ni la limitation de débit, alors que l'audit y a relevé des failles exploitables. La règle « caractériser sans corriger » de l'étape 0.2 est juste pour le gameplay et dangereuse pour la sécurité.
4. **2.3 conditionné à la mesure** et déplacé au jalon 4, pour respecter le principe posé en 5.2.
5. **Étape 1.7 ajoutée le 14 août 2026.** La pause de partie du legacy n'avait été portée par aucune étape de la phase 1, et l'étape 2.2 l'a découvert en relevant les événements du legacy. Elle ne pouvait pas se rattraper dans la couche réseau, qui ne contient aucune logique de jeu. Traitée selon la règle 7 de CLAUDE.md: un défaut trop gros pour l'étape en cours devient une étape à part entière, jamais une ligne de dette.
6. **5.3 et 6.1 simplifiés.** Le legacy n'a pas de joueurs en ligne: déploiement en parallèle, drapeaux de fonctionnalité et migration progressive sont sans objet.
