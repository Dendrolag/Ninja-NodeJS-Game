# Handoff - Étape 2.3 Diffusion en delta binaire

Date: 12 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Remplacer la diffusion de l'état complet en JSON par un delta binaire, qui n'envoie que ce qui a changé: le levier de bande passante que les mesures de 5.1 et 5.2 ont désigné comme première limite.

## Ce qui a été fait

- **Un format binaire partagé**, `packages/shared/src/flux.ts`: une image complète, puis des deltas; positions au huitième de pixel, durées à la milliseconde, couleurs en majuscules, arrondies de la même façon des deux côtés; éléments désignés par leur rang dans la liste précédente, champs modifiés codés par écart. Le décodage est défensif: une trame fausse lève une `ErreurDeTrame`.
- **Une politique d'envoi par partie**, `packages/server/src/fluxDEtat.ts`: une trame par battement, codée une fois pour toute la salle; image au premier battement, à toute la salle tous les cent battements, et à qui entre dans une partie en cours, juste après le delta qu'il ignore.
- **Le contrat**: l'événement `etat` porte une `TrameDEtat` (des octets). `ServeurSocket` diffuse la trame du battement puis les images attendues.
- **Le client**: `reconstruire` prend une trame, et ignore une trame périmée, un delta qui ne s'applique pas à la partie détenue, ou une trame illisible. Le magasin, les écrans et le rendu n'ont pas changé: ils lisent toujours une `VuePartie`.
- **Le harnais de charge** mesure la trame sur le fil, en ses deux paquets Socket.IO, et garde la taille JSON pour comparer; l'outil d'empreinte sépare l'empreinte du jeu de celle du flux, et vérifie la reconstruction à chaque battement.
- **Mesure avant après**: section 12 de `docs/mesures/charge-serveur.md`, chiffres bruts dans `docs/mesures/charge-serveur-2-3.json`.
- **Deux incohérences de documentation corrigées** (règle 7): la fiche 2.3 datait d'avant le client et l'étape 2.2 (réconciliation en tête de fiche); le cadrage (`docs/design/cadrage.md`, section 6) disait encore que rien ne transportait le mode jusqu'au moteur, ce qui est fait depuis 2.4.

## Les chiffres clés

Machine de mesure: AMD Ryzen 7 3800X, Windows 11 Pro, Node.js 24.16.0, comme en 5.1 et 5.2.

| Grandeur                                               | 5.2 (JSON)      | 2.3 (binaire)         |
| ------------------------------------------------------ | --------------- | --------------------- |
| Message, partie de référence du banc                   | 21 518 octets   | 453 octets            |
| Message, 150 bots et 12 joueurs, banc                  | 21 567 octets   | 464 octets (× 46)     |
| Débit par joueur, partie pleine                        | 3,4 Mbit/s      | 0,07 Mbit/s           |
| Une partie de trois minutes, reçue par un joueur       | 78 Mo           | 1,7 Mo                |
| Image complète, partie de référence                    | sans objet      | 3 403 octets          |
| Codage au serveur, 150 bots                            | 0,082 ms (JSON) | 0,051 ms              |
| Battement du banc, 150 bots                            | 0,434 ms        | 0,403 ms              |
| Décoder un message, client, processeur ralenti × 6     | 0,481 ms        | 0,052 ms              |
| Processeur par partie pleine, vrai serveur, 48 parties | 0,96 ms         | 0,96 ms, inchangé     |
| Parties pleines tenues par processus                   | 48 (64 non)     | 48 (64 non), inchangé |
| Parties mêlées tenues par processus                    | 64 (96 non)     | 64 (96 non), inchangé |
| Débit sortant, 48 parties pleines                      | 2 014 Mbit/s    | 42,0 Mbit/s           |

Le jeu n'a pas changé: l'empreinte du jeu des quatre parties de `tests/charge/empreinte.ts` est identique à celle de 5.2.

## Fichiers créés ou modifiés

Créés

- `packages/shared/src/flux.ts`, `flux.test.ts`: le format et ses tests.
- `packages/server/src/fluxDEtat.ts`, `fluxDEtat.test.ts`: la politique d'envoi par partie et ses tests.
- `docs/mesures/charge-serveur-2-3.json`: chiffres bruts de la mesure.
- `docs/handoffs/etape-2-3-handoff.md`.

Modifiés

- `packages/shared/src/evenements.ts`: l'événement `etat` porte une `TrameDEtat`; commentaires qui annonçaient 2.3 au futur.
- `packages/shared/src/index.ts`, `packages/server/src/index.ts`: exports.
- `packages/server/src/ServeurSocket.ts`: diffusion de la trame et des images attendues, un flux par partie rangé dans une `WeakMap`.
- `packages/server/src/ServeurSocket.test.ts`: suivi du flux depuis le lancement; tests de diffusion, de forme, de pause et de temps arrêté réécrits; deux tests ajoutés.
- `packages/client/src/reconstruction.ts`, `actions.ts`, `reduction.ts`, `client.ts`: le client lit des trames.
- `packages/client/src/reconstruction.test.ts`, `client.test.ts`, `reduction.test.ts`, `magasin.test.ts`, `ecrans.test.ts`, `rendu/boucle.test.ts`: les tests envoient des trames.
- `tests/charge/battement.ts`, `charge.ts`, `clients.ts`, `charge-reseau.test.ts`, `seuils.ts`, `empreinte.ts`: le harnais mesure le flux binaire (voir « Ce qui a été fait »).
- `docs/mesures/charge-serveur.md`: section 12.
- `docs/plan/etape-2-3.md`: réconciliation, et résultat de l'étape.
- `docs/plan/ROADMAP.md`: section 3, jalon 4, résultat de 2.3.
- `docs/design/README.md`: cinq décisions du 12 septembre 2026.
- `docs/design/cadrage.md`: section 6, le branchement du mode sur le moteur, fait depuis 2.4.

Aucune modification de `packages/sim`, `legacy/`, `tests/caracterisation/` ni `tests/e2e/`. Aucune migration.

## Tests

- Ajoutés, par exigence de la fiche:
  - **aller-retour fidèle**: une image redonne exactement l'instantané arrondi; pseudos accentués, emojis, couleurs quelconques (`flux.test.ts`);
  - **correction du delta**: une partie de 600 battements tirée au hasard, où des entités bougent, changent, apparaissent, disparaissent et changent d'ordre, reconstruite battement par battement depuis une seule image; un joueur inséré au milieu des entités, un classement qui se réordonne, un identifiant repris par une entité d'une autre nature (`flux.test.ts`); la salle entière reconstruit exactement la partie du serveur, sur de vrais clients (`ServeurSocket.test.ts`);
  - **état de référence**: un nouveau venu reçoit le delta qu'il ignore puis son image, et suit la salle (`flux.test.ts`, `fluxDEtat.test.ts`, `ServeurSocket.test.ts`);
  - **mesure avant après**: section 12.3 du rapport, et le seuil `OCTETS_PAR_MESSAGE_DE_REFERENCE` mis à jour (453 octets), vérifié en CI par `battement.test.ts`.
- Ajoutés en plus: un delta ne s'applique jamais à une autre partie; trames vides, tronquées, d'une autre version, avec des octets en trop ou des codes inconnus refusées; 300 trames altérées au hasard ne lèvent jamais autre chose qu'une `ErreurDeTrame`; chaque garde du décodage (entier trop long, texte qui dépasse, UTF-8 mal formé, indicateurs inconnus, liste trop longue, élément repris inexistant ou annoncé sans contenu, durée négative) a sa trame fausse écrite octet par octet; formes `ArrayBuffer` et vue décalée; le client garde ce qu'il affiche devant une trame illisible; cadence des images, et aucune image doublée.
- Résultat: **1 573 tests sur 1 573** par `pnpm test:coverage`, et `pnpm verify` vert. Types, linter et formatage: verts.
- Empreinte du jeu identique à 5.2 sur les quatre parties; reconstruction exacte à chaque battement de ces parties.
- Bout en bout, en local: 12 scénarios, dont la partie à deux joueurs, jouent avec le flux binaire dans Chromium. Voir « Problèmes connus » pour une fragilité locale sans rapport avec cette étape.
- Couverture de `packages/sim` et `packages/shared`: **99,82 pour cent** des instructions (99,77 au handoff 5.2); `shared` à 100 pour cent, `flux.ts` compris, `sim` inchangé à 99,63. Une première mesure donnait 99,18: le nouveau format laissait vingt-deux lignes de gardes sans test, couvertes avant de clore l'étape.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Cinq décisions au journal de `docs/design/README.md`, datées du 12 septembre 2026. Les écarts à la fiche sont dans sa réconciliation. Trois points à lire ici.

### 1. Un seul delta par partie, pas un par client

La fiche parlait d'un delta « par client ». L'étape 2.2 a fait de l'instantané un message identique pour toute la salle; le delta garde cette propriété. Le transport (WebSocket seul, sans reconnexion) livre tout, dans l'ordre: un client présent depuis le début détient toujours la trame qu'un delta suppose. Un delta par client aurait coûté un codage par joueur et une mémoire par connexion.

### 2. Le format arrondit, et la reconstruction est exacte

Un huitième de pixel ne se voit pas, et c'est ce qui code un pas de bot sur un octet. L'arrondi est fait des deux côtés par la même fonction (`quantifierInstantane`), et les deltas portent sur des valeurs déjà arrondies: aucun arrondi ne s'accumule. Conséquence à connaître: le client voit des positions au huitième de pixel, et des durées à la milliseconde; rien de ce qu'il fait n'en dépend.

### 3. Une image régulière plutôt qu'une demande d'image

Un client qui aurait décroché, par une faute que rien ne laisse prévoir, se recale sur l'image suivante, toutes les cinq secondes, pour environ 7 pour cent du débit du flux. Une demande d'image par le client aurait ajouté un message montant, sa validation et sa limite de débit, pour une situation que le transport exclut.

### Ce que cette étape rend structurellement impossible

- **Un client qui reconstruit un état faux à partir d'un delta**: un delta nomme le battement auquel il s'applique, et il est ignoré sur toute autre partie.
- **Un format qui diverge entre le serveur et le client**: il n'existe qu'un module, partagé, qui code et décode.
- **Une régression de bande passante qui passe inaperçue**: la taille de la partie de référence est vérifiée en CI à 5 pour cent, soit une vingtaine d'octets.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Le filtrage du flux par zone d'intérêt n'est pas justifié par la mesure.** C'était la question reportée de 5.2. Un joueur ne reçoit plus que 9 Ko/s; retirer les bots hors champ lui ferait gagner au mieux 7 Ko/s sur téléphone, et coûterait une trame par joueur au lieu d'une par salle, soit environ 0,6 ms de plus par partie pleine (section 12.9 du rapport). À rouvrir seulement si les cartes grandissent nettement, ou si le coût du débit sortant mesuré en 5.3 le demande.
- **En local, le scénario mobile « capturer un faux ninja » peut échouer quand tous les scénarios jouent en parallèle**: Alice n'atteint pas sa cible en douze secondes. Joué seul, il passe (deux fois sur deux). Il pilote Alice à partir de l'état du serveur, pas du flux: ce n'est pas une régression de cette étape, mais la charge d'une machine qui fait tourner douze navigateurs. La CI joue un scénario à la fois, avec deux reprises.
- **Le seuil de taille vérifié en CI est désormais étroit** (5 pour cent de 453 octets): une modification du jeu qui change le mouvement des bots, et donc la taille des deltas, le fera échouer. C'est voulu, mais la nouvelle taille doit alors se mesurer et se reporter.
- **La mesure sur le fil compte deux paquets par message**; la trame compressée n'est donnée qu'à titre d'information, la compression des WebSockets restant désactivée.

Repris du handoff de 5.2, inchangé: le relevé des contacts et le lissage du client restent en carré du nombre d'entités, sans enjeu aux bornes actuelles; la mesure du client ne reproduit ni la carte graphique ni l'échauffement d'un téléphone; la mesure sous Linux est celle d'une machine d'intégration à quatre cœurs; le budget par cœur est prudent; tout est mesuré sur un réseau local; `app.js` pèse 219 Ko en gzip, compression à vérifier au déploiement (5.3). Et des handoffs précédents: les erreurs d'un travailleur échappent aux scénarios de bout en bout; continuer en invité laisse la session ouverte côté serveur; une déconnexion dans un onglet ne touche pas un autre; la liste des parties ne se rafraîchit pas d'elle-même; aucune gestion du mot de passe ni suppression de compte; un échec d'enregistrement n'est pas retenté; poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` au déploiement (5.3).

## État de la CI

- Commit du code, `bed2441`: **verte**, exécution GitHub Actions 34658234243 (« Types, linter et tests » et « Bout en bout », dont le scénario mobile « capturer un faux ninja »).
- Commit de documentation: voir le commit qui suit, qui confirme sa CI dans ce handoff.

`master` n'a pas été touché. Aucune fusion de `reecriture` avant l'étape 6.1.

## Prochaine action exacte

Le jalon 4 est terminé. La section 3 du ROADMAP ouvre le jalon 5 par **le mode tactique**, « ajouté comme jeu de règles enfichable », puis les autres modes, puis 5.3 et 6.1.

**Le mode tactique n'a ni numéro d'étape, ni entrée dans la carte thématique (section 4 du ROADMAP), ni fiche.** Dans une conversation neuve, la première chose à faire est donc le cas de repli du PROTOCOLE: rédiger sa fiche, lui attribuer un numéro dans la section 4, la commiter, puis l'exécuter. Sources à lire pour la rédiger:

1. `docs/design/cadrage.md`, section 6 (principe des modes), et le journal de `docs/design/README.md` au 29 juin 2026.
2. La branche `mode-strategique` (v0.9.0), qui porte la capture par cône du jeu d'origine; son dernier commit, `8a7b5fc`, signale des régressions à corriger. La section 5 du ROADMAP (point 2) et `CLAUDE.md` rappellent qu'elle a été écartée comme base, et pourquoi.
3. Le point d'extension du moteur: `RegleDeResolution` et `REGLES_DES_MODES` (`packages/sim/src/contacts.ts`, `moteur.ts`), et `MODES` et `CAPACITES` (`packages/shared/src/constantes.ts`).

**Condition d'arrêt possible**: si la capture par cône suppose des décisions de jeu que ni le cadrage ni les maquettes ne tranchent (angle, portée, capacité du mode, écrans), les poser au porteur du projet plutôt que de les inventer (PROTOCOLE, conditions d'arrêt).

## Étape suivante

Fiche à lire: aucune n'existe encore; voir « Prochaine action exacte ».

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
