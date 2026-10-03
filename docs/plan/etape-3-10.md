# Fiche étape 3.10 - Les défis de la semaine

Brief de session. Objectif unique: chaque semaine, trois défis communs à tous les comptes, qui rapportent de l'XP une fois relevés, montrés à l'accueil et à la fin de partie.

## Origine de cette fiche

Aucune fiche n'existait. Le porteur du projet a demandé l'étape le 3 octobre 2026, après l'étape 8.10: « Comme prévu sur les maquettes initialement, ajouter des défis du jour et défis de la semaine pour permettre de gagner plus de points. Trouver de quoi varier les défis pour éviter que ce soit trop redondant (peut-être commencer juste avec des défis hebdomadaires). » Rédigée le même jour selon le cas de repli du PROTOCOLE, à partir de la maquette (`docs/design/Neon Ninja.html`, blocs « Défis du jour » de l'accueil et « Défi accompli » de la fin), du cadrage (question 7, reportée le 10 septembre 2026), de l'étude des succès et de l'état du dépôt au commit `73b2300`.

## Ce que montre la maquette

- À l'accueil, un bloc « Défis du jour »: trois défis, chacun avec son icône, son texte, sa récompense en XP et une jauge « 11 / 15 », et le temps restant avant le renouvellement.
- À la fin de partie, une ligne « Défi accompli : Activez 10 bonus », « Récompense +200 XP réclamée ».
- Les trois exemples: capturer 15 ninjas (+300 XP), gagner 3 parties (+500), activer 10 bonus (+200).

## Décisions prises par cette fiche

1. **La semaine d'abord, le jour plus tard.** Comme le porteur du projet le propose. Une population encore petite relève mieux des défis qui laissent sept jours; des défis du jour demanderaient de jouer chaque jour, et un défi qui réclame des adversaires serait souvent impossible dans la journée. Tout est construit pour qu'une seconde période s'ajoute sans refonte: la période est un paramètre du tirage et de l'enregistrement. Les défis du jour deviennent une étape à part, à décider après usage.
2. **Une semaine va du lundi 0 h au lundi suivant 0 h, heure de Paris**, le fuseau des joueurs, déjà celui des jours de « Fidèle ». Elle s'identifie par la date de son lundi: « 2026-10-05 ».
3. **Trois défis par semaine, les mêmes pour tous**, un par famille: **assiduité** (jouer), **action** (faire), **exploit** (réussir). Ils se tirent de la semaine seule, par le générateur à graine du paquet partagé: aucune table ne les garde, le serveur et le client calculent les mêmes.
4. **La variété, par familles et par cycles.** Chaque famille a sa réserve d'une dizaine de défis. Elle se parcourt dans un ordre mêlé, tiré par cycle: aucun défi ne revient avant que sa famille ait été parcourue en entier, et jamais deux semaines de suite, même d'un cycle au suivant. Des défis par mode et par carte font tourner les modes d'une semaine à l'autre.
5. **Les récompenses: 300 XP pour l'assiduité, 400 pour l'action, 500 pour l'exploit**, 1 200 XP par semaine au plus, l'équivalent de cinq bonnes parties. Seulement de l'XP, comme la maquette: les pièces ne servent à rien tant qu'il n'y a pas de boutique, et des points de ligue gagnés hors du classement fausseraient le palier. Nombres soumis au porteur du projet.
6. **Une partie compte pour les défis si on l'a finie, et si elle durait trois minutes au moins.** Un abandon ne rapporte rien, et des parties de trente secondes seul feraient de l'XP sans jouer: même seuil que celui des points de ligue, et c'est la durée par défaut. Une partie jouée seul compte, sauf pour ce qui demande des adversaires (une victoire, un podium) et pour ce que disent les faits de partie (bonus, malus, ralliements, Évadés, x2, revanches, multiplicateur, razzia): comme pour les succès, ils ne comptent qu'à plusieurs (décision du porteur du projet du 28 septembre 2026), sans quoi une partie privée deviendrait une ferme. Les textes de ces défis le disent.
7. **Relever un défi, c'est rattraper**, comme les succès. À chaque fin de partie, les parties de la semaine du compte se plient en avancées; un défi atteint et pas encore inscrit s'inscrit, daté de cette partie, et son XP s'ajoute à la progression, dans la transaction qui enregistre la partie. Un réessai d'enregistrement n'inscrit rien de plus. Une partie jouée en début de semaine, avant la mise en ligne, compte aussi.
8. **Une table, `defis_releves`**: compte, semaine, défi, XP versée, date et partie. La clé (compte, semaine, défi) empêche de toucher deux fois une récompense. L'XP versée s'écrit, parce qu'un défi peut changer de récompense plus tard: l'historique dit ce qui a été versé.
9. **L'XP des défis compte dans l'XP totale des succès.** Sans cela, un compte pourrait afficher le niveau 20 sans obtenir « Confirmé ». Le pli des succès lit l'XP des défis de chaque partie avec elle.
10. **Le récapitulatif de fin sépare les deux.** « XP gagnée » reste celle de la partie; les défis accomplis s'annoncent à part, avec leur XP, et la barre de niveau va de l'avant à l'après, défis compris.
11. **Un fait de partie de plus, `bonusRamasses`**: les bonus ramassés, objets de poche compris, pour le défi de la maquette.
12. **Une route, `GET /api/comptes/defis`**, réservée aux comptes: les trois défis de la semaine en cours, leur avancée et la fin de la semaine. Un invité ne voit pas de défis: ils ne rapportent qu'à un compte, et ce qui ne sert pas est masqué (décision du 29 juin 2026).
13. **Version 1.7.0, avec une note**: une nouveauté majeure pour le joueur. Texte soumis au porteur du projet.

## Réconciliation en cours d'étape

- **Numéro.** La fiche a d'abord été commitée sous le numéro 8.11, à la suite de la dernière étape faite. La phase 8 est celle des cartes; les défis prolongent la progression des comptes, phase 3, après le titre (3.9). Renumérotée 3.10 avant tout code commité.
- **La table s'appelle `defis_releves`**, du verbe que le code emploie partout (relever un défi), et non `defis_accomplis`.
- **Les faits de partie ne comptent qu'à plusieurs** (décision 6, précisée): la fiche ne l'avait pas vu, la règle des succès l'imposait.
- **Une ligne de plus à la fin de partie**: une partie réglée sur moins de trois minutes le dit (« Une partie de moins de trois minutes ne fait pas avancer les défis. »), pour qu'un joueur qui enchaîne des parties courtes sache pourquoi ses défis n'avancent pas.
- **Bout en bout**: une partie de trois minutes de plus rallongerait le scénario de trois minutes pour rien. Le scénario du compte vérifie que l'accueil et la fin montrent les trois défis, et que sa partie de trente secondes n'en fait avancer aucun, avec l'avis. L'avancée elle-même est éprouvée contre Neon (`tests/base/defis.test.ts`) et par les comptes en mémoire, qui appliquent les mêmes fonctions.
- **Des tests de la base dépendaient de la semaine tirée au hasard.** `tests/base/parties.test.ts` termine ses parties à une date au hasard sur trente-cinq ans: une semaine dont un défi se relève en une partie (une victoire en Horde) aurait ajouté 500 XP aux gains comptés au plus près. Ces tests finissent désormais leurs parties dans la semaine du 5 octobre 2026, dont aucun défi ne se relève en une partie. `tests/base/progression-de-fin.test.ts`, qui joue maintenant, retire l'XP des défis éventuels de l'écart compté.

## Les défis

### Assiduité, 300 XP

| Identifiant          | Texte                           | Seuil |
| -------------------- | ------------------------------- | ----- |
| `jouer-dix-parties`  | Finir 10 parties.               | 10    |
| `jouer-horde`        | Finir 3 parties de Horde.       | 3     |
| `jouer-tactique`     | Finir 3 parties de Tactique.    | 3     |
| `jouer-equipes`      | Finir 3 parties d'Équipes.      | 3     |
| `jouer-chasse`       | Finir 3 parties de Chasse.      | 3     |
| `jouer-massacre`     | Finir 3 parties de Massacre.    | 3     |
| `trois-cartes`       | Jouer sur 3 cartes différentes. | 3     |
| `trois-modes`        | Jouer 3 modes différents.       | 3     |
| `parties-en-miroir`  | Finir 3 parties en miroir.      | 3     |
| `parties-entre-amis` | Finir 2 parties avec un ami.    | 2     |

### Action, 400 XP

| Identifiant       | Texte                                                      | Seuil |
| ----------------- | ---------------------------------------------------------- | ----- |
| `prendre-joueurs` | Prendre 15 joueurs.                                        | 15    |
| `black-ninjas`    | Détruire 10 Black Ninjas.                                  | 10    |
| `bonus`           | Ramasser 15 bonus, à plusieurs.                            | 15    |
| `malus`           | Ramasser 10 malus, à plusieurs.                            | 10    |
| `rallier`         | Rallier 300 ninjas en Horde, à plusieurs.                  | 300   |
| `evades`          | Attraper 3 fois l'Évadé, à plusieurs.                      | 3     |
| `doubleurs`       | Prendre 2 fois le x2 à son porteur.                        | 2     |
| `revanches`       | Prendre 3 revanches : reprendre qui vient de vous prendre. | 3     |

### Exploit, 500 XP

| Identifiant       | Texte                                                 | Seuil |
| ----------------- | ----------------------------------------------------- | ----- |
| `victoires`       | Gagner 3 parties à plusieurs.                         | 3     |
| `podiums`         | Finir 3 fois sur le podium d'une partie à 4 ou plus.  | 3     |
| `gagner-horde`    | Gagner une partie de Horde à plusieurs.               | 1     |
| `gagner-tactique` | Gagner une partie de Tactique à plusieurs.            | 1     |
| `gagner-equipes`  | Gagner une partie d'Équipes.                          | 1     |
| `gagner-chasse`   | Gagner une partie de Chasse.                          | 1     |
| `gagner-massacre` | Gagner une partie de Massacre à plusieurs.            | 1     |
| `multiplicateur`  | Atteindre le multiplicateur x5, à plusieurs.          | 5     |
| `razzia`          | Récupérer 20 ninjas d'une seule capture, à plusieurs. | 20    |
| `points-de-ligue` | Gagner 40 points de ligue.                            | 40    |

Une victoire, comme pour les succès, est une première place dans une partie d'au moins deux joueurs; en Équipes, la première place est celle de l'équipe. Les points de ligue comptent les gains, pas les pertes: une défaite ne fait pas reculer un défi.

## Périmètre

### Lot A. Le paquet partagé

- `packages/shared/src/defis.ts` (créé): familles, définitions, semaine d'un jour, tirage des trois défis, avancée d'un défi sur les parties de la semaine, contrats `AvancementDUnDefi`, `DefisDeLaSemaine`, `DefisDeFin`.
- `succes.ts`: le fait `bonusRamasses`; `PartieDuParcours` gagne `dureeS`; l'XP des défis d'une partie (`xpDesDefis`) entre dans l'XP totale.
- `evenements.ts`: `ProgressionEnregistree.defis`. `comptes.ts`: la route `defis`.

### Lot B. Le serveur

- `releveDesExploits.ts`: `bonusRamasses`.
- `base/schema.ts` et sa migration: la table `defis_accomplis`.
- `base/defis.ts` (créé): inscrire les défis atteints, relire ceux d'une semaine.
- `base/parties.ts`: les défis dans la transaction de fin, et au réessai.
- `base/succes.ts`: l'historique lit la durée et l'XP des défis de chaque partie.
- `finDePartie.ts`: le récapitulatif porte les défis. `comptes/`: la route et le service.

### Lot C. Le client

- L'accueil d'un compte montre les trois défis, leur jauge, leur récompense et le temps restant.
- La fin de partie annonce les défis accomplis et l'avancée des autres.

### Lot D. Version, documentation

- Version 1.7.0 et sa note. Cadrage (question 7), journal de conception, ROADMAP, handoff.

## Hors périmètre

- Les défis du jour.
- Des défis choisis, rejetés ou rerollés par le joueur.
- Une récompense en pièces, en gemmes ou en objets.
- Un historique des défis au profil.

## Tests requis

- Partagé: la semaine d'un jour, lundi et dimanche compris, et d'une année à l'autre; trois défis par semaine, un par famille; aucun défi ne revient deux semaines de suite sur cinq cents semaines, y compris aux changements de cycle; chaque défi de chaque famille sort au moins une fois par cycle; l'avancée de chaque genre (somme, record, distincts); une partie abandonnée ou trop courte ne compte pas; l'XP des défis compte pour les succès de niveau.
- Serveur: le fait `bonusRamasses`; le récapitulatif sépare l'XP de la partie de celle des défis.
- Base: un défi atteint s'inscrit une fois, avec son XP, dans la transaction de la partie; un réessai n'inscrit rien et rend le même récapitulatif; une partie de la semaine précédente ne compte pas; la route rend les trois défis et leur avancée.
- Client: l'accueil d'un compte montre les défis, celui d'un invité non; la fin annonce un défi accompli.
- Bout en bout: l'accueil d'un compte et la fin de partie montrent les trois défis (voir la réconciliation).

## Définition de terminé

1. Chaque semaine, trois défis, les mêmes pour tous, variés d'une semaine à l'autre.
2. Un défi relevé verse son XP une seule fois, dans la transaction de la partie qui le relève.
3. L'accueil d'un compte et la fin de partie les montrent.
4. Couverture de packages/sim maintenue, CI verte, handoff écrit et commité.
