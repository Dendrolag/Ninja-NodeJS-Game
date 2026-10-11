# Fiche étape 7.23 - Among Ninjas, les pas entendus

Brief de session. Objectif unique: faire entendre aux joueurs les pas des vivants qui marchent près d'eux, y compris hors de leur disque de vision, sans livrer de position ni d'identité. On entend venir quelqu'un avant de le voir. Les PNJ et les fantômes ne font aucun bruit: un pas est la preuve d'un vivant. Les tâches longues et l'appropriation restent aux étapes suivantes.

## Origine de cette fiche

Rédigée le 11 octobre 2026, au début de l'étape, selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2): aucune fiche n'avait été fournie. Sources: les sections 7.4 (les pas) et 18 (le plan) de l'étude `docs/design/etude-mode-among-ninjas.md`, la fiche 7.22 prise comme modèle, le handoff `docs/handoffs/etape-7-22-handoff.md`, et l'état du dépôt au commit `665a948`.

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles des fiches 7.20 à 7.22.

**Numéro**: 7.23, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.22, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, la section 7 de l'étude, et la fiche 7.22.

## Décisions du porteur du projet

Du 5 et du 6 octobre 2026 (étude, sections 7.4 et 20) et du 10 octobre 2026 (handoff 7.22):

1. **Les pas des vivants s'entendent au-delà du rayon de vision**, sans livrer la position: une direction arrondie et une distance en paliers, jamais les coordonnées.
2. **Le mode ne se déploie qu'avec ses étapes suivantes**, sur accord du porteur du projet: `master` ne se pousse pas à la fin de cette étape. Avant toute poussée, la suite de bout en bout complète se rejoue.

## Questions soumises au porteur du projet, et ses réponses du 11 octobre 2026

1. **Qui fait du bruit, et jusqu'où l'entend-on ?** Recommandé, et retenu: **les vivants qui marchent, proies et assassins, avec le même bruit, jusqu'à 500 pixels**. Les PNJ et les fantômes sont muets. Les autres voies écartées: 700 pixels, ou des PNJ bruyants, qui ôteraient aux pas leur valeur d'indice.
2. **Les pas hors de vue se signalent-ils aussi à l'écran ?** Recommandé, et retenu: **au son seul**, comme dans l'étude et Among Us. Un joueur sans son n'en profite pas; une marque à l'écran aurait mis un radar grossier sous les yeux de tous. Aucune planche de rendus, donc: l'étape ne dessine rien.
3. **Le nuage noir étouffe-t-il les pas ?** Recommandé, et retenu: **non**. Le nuage cache la vue, pas le bruit: une proie entend qu'on marche dans le nuage, et un assassin qui veut s'y cacher doit s'arrêter.
4. **La version.** Recommandé, et retenu: **tout sous la 1.9.0**, toujours pas en ligne, dont la note gagne les pas entendus.

## Les règles et les valeurs

Toutes se révisent après une partie d'essai.

### Qui fait du bruit

- **Un vivant qui marche**, proie ou assassin, pendant la phase de jeu. Le même bruit pour tous: un pas ne dit pas le rôle.
- **Le pas suit le mouvement réel**, pas la touche: un joueur bloqué contre un mur ne fait pas de bruit, comme nos propres pas depuis l'étape 4.11.
- **Une foulée tous les 37,5 pixels parcourus**, soit un pas toutes les 250 millisecondes à la vitesse commune de 150 pixels par seconde: la cadence de nos propres pas. Un saut plus long qu'un battement ne le permet (le replacement en réunion, et plus tard les égouts) n'est pas une marche, et ne compte pas.
- **Muets**: les PNJ, les fantômes, et tout le monde hors de la phase de jeu (révélation, réunion, éjection).

### Qui entend quoi

- **Un vivant** entend les pas des autres vivants à **500 pixels** au plus, de centre à centre.
  - Ceux qu'il **voit**: la page joue leurs pas comme les siens, à leur place exacte, à gauche ou à droite.
  - Ceux qu'il **ne voit pas**, hors de son disque ou dans le nuage noir: le serveur lui envoie, pour chacun de leurs pas, **une direction arrondie à huit secteurs** (de 45 degrés) **et une distance en trois paliers**: proche (170 pixels au plus), moyen (335 au plus), loin (500 au plus). Ni position, ni identifiant, ni rôle.
  - **Au plus un pas par secteur et par palier à chaque battement**: deux marcheurs côte à côte font un seul bruit, et la trame ne dit pas combien ils sont.
- **Un fantôme**, qui voit tout, entend les pas des vivants qu'il voit, jusqu'à 500 pixels, à leur place exacte, comme un vivant ceux qu'il voit. Il n'a besoin de rien d'autre.
- **Le nuage n'étouffe rien** (réponse 3). La panne de néons, qui réduit le disque à 110 pixels, fait entendre plus de pas qu'elle n'en montre: c'est voulu.
- **On n'entend pas ses propres pas deux fois**: les nôtres restent ceux de l'étape 4.11.

### Comment ils s'entendent

- **Le volume baisse avec la distance**, jusqu'au silence à 500 pixels: un pas d'autrui, même tout près, s'entend moins fort que les nôtres. Un pas hors de vue s'entend au volume du milieu de son palier.
- **Le côté suit la direction**: un pas à l'est s'entend à droite, au nord ou au sud au centre, comme les sons situés de l'étape 4.11.
- **Les mêmes quatre bruits de pas** que les nôtres, provisoirement (section « Les sons »).

## Les sons

| Son à fournir            | Qui l'entend                     | Provisoire proposé                |
| ------------------------ | -------------------------------- | --------------------------------- |
| Le pas d'un autre vivant | Les vivants et fantômes à portée | `footstep1.mp3` à `footstep4.mp3` |

Le porteur du projet peut fournir un bruit de pas propre aux autres (mp3, court, sans silence en tête), plus sourd que les nôtres, pour qu'on ne confonde pas un pas voisin avec le sien.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE, à réviser en exécutant si le dépôt le demande. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite.

1. **Les valeurs sont dans le contrat** (`AMONG`, `packages/shared/src/among.ts`): la foulée, la portée, les paliers, le nombre de secteurs. Le calcul du secteur et du palier aussi, pur et partagé: le serveur le fait, la page le lit à l'envers pour placer le son.
2. **Les pas se comptent dans le moteur.** Chaque joueur d'Among Ninjas retient sa dernière position et la distance faite depuis son dernier pas (`JoueurAmong`); chaque battement de jeu dit qui vient de faire un pas (`EtatAmong.pasDuBattement`). Tout avance par le battement, sans horloge, et la même partie rejouée fait les mêmes pas.
3. **Les pas hors de vue voyagent dans le bloc du mode** (`AmongVu.pas`), dans la vue de chaque vivant seulement: une liste de couples secteur et palier, un octet chacun. Les fantômes et les destinataires inconnus n'en reçoivent pas.
4. **Les pas qu'on voit se jouent dans la page**, d'après le mouvement lissé des ninjas vivants affichés, comme les nôtres: rien de plus dans la trame. Une cadence par marcheur, pour qu'un groupe ne fasse pas une rafale.
5. **Le lecteur de sons gagne une voix par bruit de pas d'autrui**, à part des nôtres, et une lecture située (volume et côté), comme les sons situés.

## Rendus

Aucun: l'étape ne dessine rien (réponse 2). Pas de planche.

## Périmètre

### Lot A. Le contrat et le moteur

1. Les valeurs, le secteur et le palier d'un écart, purs, dans le contrat.
2. Les foulées: qui marche, la distance comptée, le saut qui ne compte pas, les fantômes et les PNJ muets, rien hors de la phase de jeu.
3. L'empreinte des quatre parties de référence identique avant et après.

### Lot B. Le serveur

1. Les pas hors de vue dans la vue de chaque vivant: à portée, hors du disque ou dans le nuage, ni les siens, ni ceux qu'il voit, un par secteur et par palier.
2. Le codage du bloc du mode, et sa lecture.
3. Tests à travers le vrai serveur: une proie entend un assassin qui marche hors de sa vue, sans recevoir sa position; elle n'entend ni un PNJ, ni un fantôme, ni un vivant au-delà de 500 pixels; un fantôme ne reçoit aucun pas.

### Lot C. La page

1. Les pas hors de vue joués à leur place: volume du palier, côté du secteur.
2. Les pas des vivants affichés, joués à leur place, une cadence par marcheur, jamais ceux des PNJ ni des fantômes, jamais en réunion.
3. L'aide du mode: une ligne sur les pas.

### Lot D. Bout en bout, mesure et documentation

1. Le scénario `tests/e2e/among.spec.ts`: une page reçoit des pas hors de vue quand un autre vivant marche près d'elle.
2. Banc: la mesure de 7.22 rejouée (section 31 de `docs/mesures/charge-serveur.md`), avec les pas.
3. Journal de conception, ROADMAP, étude (section 24).
4. La note de la 1.9.0 complétée des pas entendus (réponse 4), à soumettre au porteur du projet; le numéro reste 1.9.0.
5. **Avant toute poussée**, sur accord du porteur du projet: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Hors périmètre

- Toute marque à l'écran des pas entendus (réponse 2).
- Les tâches longues (étape 7.24), l'appropriation (7.25), d'autres tâches courtes (7.26).
- Toute modification des autres modes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: le secteur de chaque direction, ses bords, le palier de chaque distance, ses bords, la portée.
- **Moteur (TU)**: une foulée par 37,5 pixels, le reste gardé d'un battement à l'autre, rien contre un mur, rien pour un saut, rien pour un fantôme ni un PNJ, rien hors de la phase de jeu, la liste vidée à chaque battement.
- **Vues (TU)**: ni position, ni identifiant dans ce que reçoit un vivant; ni ses pas, ni ceux qu'il voit; ceux du nuage; un par secteur et par palier; rien au-delà de 500 pixels; rien aux fantômes.
- **Flux (TU)**: le bloc du mode avec et sans pas, aller et retour.
- **Serveur (TI)**: le lot B, point 3.
- **Page (TU)**: la place d'un pas hors de vue, celle d'un pas vu, la cadence par marcheur, les muets.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les pas s'entendent dans la page, vérifiés dans le navigateur.
2. **Rien de ce que reçoit un vivant ne dit qui marche, ni où exactement**, vérifié par les tests des vues.
3. **Les cinq autres modes n'ont pas changé**: tests existants inchangés, empreinte des quatre parties de référence identique.
4. La couverture de `packages/sim` ne baisse pas (99,84 pour cent au handoff 7.22).
5. `master` n'est pas poussé sans l'accord du porteur du projet, et jamais avant la suite de bout en bout complète.

## Points de vigilance

1. **Un pas ne doit désigner personne.** Ni identifiant, ni position, ni rôle, ni nombre exact de marcheurs.
2. **Les pas ne doivent pas devenir un radar.** Huit secteurs et trois paliers, un par secteur et par palier: assez pour l'oreille. Si l'essai montre qu'un client modifié en tire trop, la voie suivante est d'arrondir dans le temps (un pas par marcheur et par demi-seconde au plus).
3. **Le coût de la trame**: un octet par pas entendu, quelques-uns par battement au plus. À mesurer au banc.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-23-handoff.md`: les décisions confirmées en début d'étape, les écarts à cette fiche (section « Réconciliation », à créer), les chiffres du banc, l'état de la CI et de `master` (non poussé). Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP. Commiter.
