# Handoff - Étape 4.1 Squelette client et couche réseau

Date: 18 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Poser la structure du client: un magasin d'état unique séparé du rendu, la couche réseau isolée derrière une interface, la reconstruction de l'état de jeu à partir du flux, et les transitions d'écran. Aucun rendu, aucun menu, aucune saisie.

## Ce qui a été fait

- `packages/client` n'est plus vide. Douze modules, chacun avec une seule responsabilité, et aucune variable globale mutable: tout vit dans des instances.
- La couche réseau est derrière une interface, ce qui était **l'exigence de conception explicite du jalon 1**. Le reste du client ne sait pas que le transport est Socket.IO ni que le flux arrive en JSON.
- La reconstruction du flux est isolée dans un seul fichier, qui sera le seul touché si l'étape 2.3 passe au delta binaire.
- Le contrat d'événements est branché **en entier**: les dix-neuf événements descendants ont un destinataire, les neuf montants ont une commande.
- Le client parle vraiment au serveur: un test d'intégration monte les deux paquets ensemble et joue le parcours complet, de la connexion au premier instantané reçu.
- Un défaut du magasin a été trouvé par un test et corrigé: voir la section « Décisions », point 3.
- Deux hypothèses de la fiche ont été retirées parce qu'elles supposaient des étapes non faites, et une divergence de la constitution a été corrigée.
- Quatre-vingt-seize tests ajoutés. **824 tests passent**, couverture inchangée à 99,73 pour cent.

## La forme du magasin d'état, que le rendu lira

C'est ce que la fiche demande de décrire ici. Un seul objet, immuable jusqu'au contenu de ses listes, dans `packages/client/src/etat.ts`.

```ts
interface EtatClient {
  ecran: 'accueil' | 'salon' | 'jeu' | 'fin';
  connexion: 'horsLigne' | 'connecte';
  moi: string | undefined; // notre identifiant de session
  pseudoDemande: string | undefined; // ce que le joueur a saisi
  salon: InfosSalon | undefined;
  compteARebours: EtatCompteARebours | undefined;
  partie: VuePartie | undefined; // reconstruit a partir du flux
  effets: readonly EffetActif[]; // pour l'affichage seul
  messages: readonly MessageAffiche[]; // le chat, borne a 100
  journal: readonly FaitDeJeu[]; // les faits recents, borne a 50
  pausePar: string | undefined; // le pseudo de l'hote qui a suspendu
  fin: FinDePartie | undefined;
  refus: Refus | undefined;
}
```

**L'interface qu'utilisera le rendu de l'étape 4.2**, et c'est volontairement minuscule:

- `client.etat`, à lire à chaque image. Le rendu ne s'abonne pas: il dessine à la cadence du navigateur et lit l'état courant. Le legacy dessinait à la cadence des messages reçus, ce qui plafonnait le jeu à vingt images par seconde.
- `client.abonner(observateur)`, pour les menus (étape 4.3), qui ne se redessinent que lorsque quelque chose change.
- Les sélecteurs de `selecteurs.ts`: `moiDansLaPartie` (le centre de la caméra), `jeSuisHote`, `maLigneDeClassement`, `effetsEnCours(etat, maintenant)`, `resteDeLEffet`, `partieEnMouvement`.
- Les commandes du joueur: `rejoindre`, `quitter`, `deplacer`, `parler`, `changerReglages`, `demarrer`, `annulerDemarrage`, `mettreEnPause`, `reprendre`, `fermer`.

**Le chemin d'un message, de bout en bout**, en une ligne:

```
reseau (transport)  ->  client (cablage)  ->  reduction (calcul pur)  ->  magasin (etat)  ->  affichage
```

Rien ne saute d'étape. En particulier, aucun message ne peut écrire l'état directement: il n'existe pas de moyen de le faire.

## Architecture, module par module

| Fichier             | Responsabilité                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| `reseau.ts`         | L'interface du transport, et un banc d'essai piloté par les tests       |
| `reseauSocketIo.ts` | La seule implémentation. Le seul fichier qui sache qu'une socket existe |
| `reconstruction.ts` | Le seul fichier qui sache comment le flux d'état est fait               |
| `actions.ts`        | Tout ce qui peut faire changer l'état, décrit une fois                  |
| `reduction.ts`      | Le calcul de l'état suivant. Fonction pure, sans horloge ni réseau      |
| `magasin.ts`        | Le détenteur unique de l'état, et ses abonnés                           |
| `ecrans.ts`         | La seule réponse à « quel écran afficher »                              |
| `etat.ts`           | La forme de l'état, et l'état d'un client qui démarre                   |
| `faits.ts`          | Le fil des faits reçus, daté à l'arrivée                                |
| `selecteurs.ts`     | Les questions que l'affichage pose à l'état                             |
| `horloge.ts`        | Le temps local, injecté, avec une horloge manuelle pour les tests       |
| `client.ts`         | Le câblage. Aucun calcul, délibérément le fichier le plus bête          |

## Fichiers créés ou modifiés

Créés, dans `packages/client/src/`

- `actions.ts`, `client.ts`, `ecrans.ts`, `etat.ts`, `faits.ts`, `horloge.ts`, `magasin.ts`, `reconstruction.ts`, `reduction.ts`, `reseau.ts`, `reseauSocketIo.ts`, `selecteurs.ts`: les douze modules décrits ci-dessus.
- `client.test.ts` (20 tests), `reduction.test.ts` (28), `selecteurs.test.ts` (13), `ecrans.test.ts` (10), `magasin.test.ts` (9), `reconstruction.test.ts` (8).

Créé, dans `tests/`

- `client/integration/client-serveur.test.ts`: 8 tests d'intégration, avec un vrai serveur et un vrai client Socket.IO.

Modifiés

- `packages/client/src/index.ts`: les exports du paquet, et la carte des modules en tête de fichier.
- `packages/client/package.json`: dépendance `socket.io-client`.
- `vitest.config.ts` et `tsconfig.tests.json`: alias `@neon-ninja/client` et `@neon-ninja/server`, pour le seul test qui monte les deux paquets ensemble.
- `CLAUDE.md`: la section Commandes disait « le client arrive à l'étape 4.1 », ce qui laisserait croire qu'on peut jouer après cette étape. Corrigé: le paquet existe, rien ne s'affiche encore.
- `docs/plan/etape-4-1.md`: la fiche supposait les étapes 2.3, 3.2 et 3.3 faites. Réécrite pour l'ordre d'exécution réel, avec une section « Réconciliation » à sept points.
- `docs/design/README.md`: cinq décisions du 18 août 2026.

Supprimés

- `tests/client/unit/` et `tests/client/integration/rendering/`: dossiers vides, non suivis par git, restes de la refonte échouée de 2025 (ses commits parlent de « managers » et « network »). Ils auraient fait croire à une organisation de tests qui n'est pas la nôtre: les tests unitaires du client vivent à côté du code qu'ils couvrent, comme ceux de `sim` et `server`.

Aucune modification de `packages/sim`, `packages/server`, `packages/shared`, `legacy/` ni `tests/caracterisation/`.

## Tests

- Ajoutés: 96. Quatre-vingt-huit tests unitaires dans `packages/client`, huit tests d'intégration contre un vrai serveur.
- Résultat: **824 tests Vitest passent, 0 échec** (728 au handoff 1.7).
- Couverture: **99,73 pour cent** des instructions sur `packages/sim` et `packages/shared`, inchangée. Le paquet client n'est pas mesuré, conformément à la section « Cible de couverture » de CLAUDE.md.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- Bout en bout: les 4 scénarios Playwright passent, inchangés. Ils ne touchent pas encore au client, qui n'affiche rien.
- CI: **verte**. Run 32153958688 sur `reecriture`, tous les travaux au vert.

**Ce que couvre le test d'intégration**, parce que c'est lui qui prouve le point 2 de la définition de terminé: l'identifiant reçu à la connexion, l'entrée en partie et son salon, le refus d'un pseudo déjà pris, l'arrivée d'un second joueur, un message de chat signé par la session, le compte à rebours puis le lancement puis le premier instantané reconstruit, la pause et la reprise vues à la fois par l'annonce et par le flux, et le retour à l'accueil quand le serveur ferme.

**Le temps est simulé, le réseau ne l'est pas.** Comme dans les tests de l'étape 2.2: le serveur reçoit une horloge manuelle, donc un décompte de cinq secondes passe en un appel, mais chaque message fait un vrai aller-retour et chaque vérification passe par une attente explicite.

## Décisions et écarts au plan

Les cinq décisions de fond sont au journal de `docs/design/README.md`, datées du 18 août 2026. Les sept écarts à la fiche sont dans sa section « Réconciliation ». Cinq points méritent d'être lus ici.

### 1. Le client sait qui il est par son identifiant de connexion

Le contrat ne dit nulle part au joueur lequel des joueurs du salon il est: l'accusé de réception de `rejoindre` rend un `InfosSalon`, qui décrit tout le monde pareil. Le rapprochement se fait donc par l'identifiant de session, que le transport expose et que le serveur utilise comme identifiant de joueur (`SessionJoueur` est fabriquée à partir de la connexion depuis l'étape 2.2).

Ce n'est pas une fuite du transport vers le reste du client: l'interface `Reseau` déclare un `identifiant`, et l'implémentation Socket.IO le remplit. Deux conséquences à connaître. Ce rapprochement ne peut pas se faire par le pseudo, que le serveur normalise et qui peut donc différer de la saisie. Et il change à chaque connexion: c'est l'étape 3.2 qui donnera une identité qui survit au transport.

### 2. La reconnexion automatique de Socket.IO est coupée

Elle est proposée par la bibliothèque et activée par défaut. Sans session qui survive au transport, une reconnexion silencieuse redonnerait un identifiant neuf, donc un joueur que le serveur ne connaît pas, et le client afficherait une partie dans laquelle il n'est plus. Une déconnexion franche, que l'état enregistre et qu'un écran pourra annoncer, est préférable à une reprise qui ment. À rouvrir à l'étape 3.2.

### 3. Un défaut trouvé par un test, dans le magasin

Le magasin ne prévient ses abonnés que si l'état a changé, ce qui compte: le flux arrive vingt fois par seconde, et réveiller les menus pour rien reviendrait à payer le prix du legacy. Le calcul rendait pourtant un objet neuf même quand rien ne changeait, si bien que la porte ne se fermait jamais. Le test du magasin l'a montré immédiatement, avant tout usage. Corrigé: à l'arrivée d'un instantané périmé, le calcul rend l'état reçu lui-même.

Cela vaut d'être noté parce que c'est exactement le genre de défaut que le client d'origine accumulait sans jamais le voir: rien ne casse, rien ne remonte, cela coûte juste du temps machine à chaque image.

### 4. Le client décompte les effets, et ce n'est pas de la simulation

Le moteur seul détient les durées et les fait décroître. Il n'existe aucun message d'expiration, et la règle de l'étape 1.6 interdit qu'un client annonce son état. Mais une jauge doit descendre à l'écran, et le contrat d'événements confie explicitement cette tâche au client depuis l'étape 2.2. Le client apprend donc la durée au ramassage et la décompte, **cumul compris**, puisque les durées se cumulent (comportement à préserver numéro 10).

Le garde-fou tient en une phrase: aucune décision de jeu n'en dépend. Si les deux comptes divergeaient d'une demi-seconde, seule la jauge serait fausse.

### 5. Ce qui n'a délibérément pas été fait

- **Ni Express, ni empaqueteur, ni page HTML.** Le client existe comme bibliothèque; rien ne le sert encore à un navigateur. Servir des fichiers appartient à l'étape 4.3, qui aura une page à servir. Ajouter Express maintenant recommencerait ce que le handoff 2.2 avait refusé, et pour la même raison.
- **Aucune saisie clavier ni manette virtuelle.** Étape 4.3. La commande `deplacer` existe et attend son appelant.
- **Aucun rendu.** Étape 4.2.

### Ce que cette étape rend structurellement impossible

- **Le score ne peut plus exister à trois endroits.** Il vit dans un seul objet, et rien ne peut l'écrire sans passer par une action.
- **Un client ne peut plus se désynchroniser du serveur en silence.** Les deux côtés compilent contre le même fichier de contrat: une divergence est une erreur de compilation, pas une panne à l'exécution.
- **Le passage au delta binaire ne peut plus se répandre dans tout le client.** Deux fichiers savent quelque chose du format, et le reste lit une `VuePartie`.
- **Un instantané rejoué ou en retard ne peut plus faire reculer la partie à l'écran.** La reconstruction refuse un numéro de battement qui n'avance pas.
- **Les écoutes réseau ne peuvent plus s'empiler.** Le legacy en ajoutait à chaque entrée en partie, si bien qu'un joueur qui rejoignait trois fois traitait chaque message trois fois. Ici elles sont toutes retenues et retirées par `fermer()`.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Rien ne s'affiche.** Le paquet client est une bibliothèque sans page, sans rendu et sans saisie. C'est le périmètre de l'étape, mais cela veut dire que le jeu n'est toujours pas jouable, et qu'il le restera jusqu'à l'étape 4.3.
- **`reseauSocketIo.ts` n'est couvert que par le test d'intégration.** C'est voulu, il n'y a rien à tester en isolation dans une traduction d'interface, mais cela signifie qu'une régression y sera vue par un seul test.

Repris du handoff 1.7, inchangé:

- **Le terrain n'est toujours pas décodé.** Le jeu tourne sans aucun mur. Il demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`, qui est figé. **À traiter au plus tard à l'étape 4.2**, qui a besoin des mêmes images pour dessiner: c'est maintenant l'échéance la plus proche.
- **Sans identifiant de partie, on entre dans la première qui attend, et on en ouvre une s'il n'y en a aucune.** Comportement du legacy, provisoire, remplacé par l'étape 2.4.
- **Le retour au salon après une partie n'existe toujours pas.** Question ouverte depuis 2.1: une partie terminée refuse les nouveaux joueurs et se détruit quand elle se vide. Côté client, l'écran de fin n'a donc aucune sortie autre que quitter.
- **Aucune reconnexion.** Voir le point 2 des décisions. Appartient à l'étape 3.2.
- **Aucune capacité maximale par partie.** Se décide avec le matchmaking en 2.4.
- **Le chat ne porte pas d'horodatage du serveur.** Le client date à l'arrivée, sur une horloge monotone: un affichage en heure du mur devra convertir. Suffisant tant qu'il n'y a pas d'historique à reconstituer.
- **Aucune mesure de charge.** C'est l'étape 5.1, et c'est sa mesure qui décidera de l'étape 2.3.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 1.7.

Question ouverte pour l'étape 4.3, sans effet sur le code d'aujourd'hui: la tension numéro 7 de `docs/design/README.md` demande si le bouton « Terminer » du HUD de la maquette est un abandon de partie, une pause renommée, ou un artefact. Le contrat est maintenant complet sous les yeux, et le client expose `quitter`, `mettreEnPause` et `reprendre`: la question peut se trancher.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 4.2, rendu in-game PixiJS. Lire `docs/plan/etape-4-2.md` et le réconcilier avec l'état réel du dépôt.

Trois points à avoir en tête dès le début:

1. **Le rendu lit `client.etat` à chaque image, il ne s'abonne pas.** C'est ce qui découple la cadence d'affichage de celle du réseau, et c'est le défaut du legacy que cette étape doit ne pas reproduire. Le lissage entre deux battements se fait sur deux `VuePartie` successives, sans jamais inventer d'état: le client ne simule rien.
2. **Le terrain n'est toujours pas décodé, et cette étape en a besoin.** C'est la dette la plus ancienne du projet et son échéance arrive: dessiner une carte suppose de savoir où sont les murs. Elle demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`, qui est en lecture seule et ne doit pas être modifié. Si ce travail dépasse l'étape, c'est une étape à part entière, planifiée dans le ROADMAP, jamais une ligne de dette (règle 7 de CLAUDE.md).
3. **Les sélecteurs sont déjà écrits pour le rendu.** `moiDansLaPartie` donne le centre de la caméra, `effetsEnCours(etat, maintenant)` donne les effets à dessiner avec leur reste. Ils sont testés: les utiliser plutôt que de refaire ces déductions dans la boucle de rendu.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-2.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 4.2 suit 4.1, puis viennent 4.3 et 4.4 pour fermer le jalon 1.
