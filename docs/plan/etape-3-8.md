# Fiche étape 3.8 - Les exploits de partie

Brief de session. Objectif unique: un compte débloque, à la fin d'une partie, les succès qui demandent un relevé pendant la partie (combo, Razzia, Évadé, secrets, Rassembleur), vus comme les autres à l'écran de fin, au profil et sur la fiche.

Fiche rédigée le 27 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.8 du ROADMAP (section 4), de l'étude `docs/design/etude-succes.md` (sections 4, 5.1 à 5.4, et les décisions du 26 septembre 2026), du handoff 3.7, du handoff 2.8 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, les handoffs 3.7 et 2.8, l'étude des succès, puis cette fiche. Au besoin: la fiche 3.7 (le socle), la fiche 2.8 (les invitations), et les fiches des modes (7.1 Tactique, 7.3 Chasse, 7.4 Massacre, 7.5 Horde, 7.9 l'Évadé) pour les faits que publie le moteur.

## Pourquoi

Le socle de l'étape 3.7 ne voit que ce que la base enregistre d'une partie: placement, points, prises, Black Ninjas détruits. Les exploits d'une partie (un combo, une grosse capture, l'Évadé attrapé) ne laissent rien en base. Ce sont eux qui récompensent la performance et la surprise (étude, section 3, principe 2, et les trois secrets).

## Décisions du porteur du projet (26 septembre 2026)

Prises au début de l'étape 3.7, rappelées ici.

1. **La liste est celle de l'étude**, section 4, aux seuils proposés.
2. **Les trois secrets sont gardés**, et construits ici.
3. **Les ninjas capturés ne se comptent qu'en Horde** (« Seigneur de la Horde »): `packages/sim` n'est pas touché.

## État du dépôt au départ (27 septembre 2026)

1. **Les étapes 2.8 et 3.7 ont été menées en parallèle**, depuis la fin de 3.6. La 2.8 est dans `master`, la 3.7 non. Cette étape part de leur réunion: la branche de la 3.7 est fusionnée au début de la session, conflits résolus (quatre fichiers, dont deux de documentation).
2. **Le moteur publie à chaque battement les faits dont les exploits ont besoin** (`etat.evenements`, remis à zéro au battement suivant): capture de joueur avec les ninjas transférés, capture par un Black Ninja, malus ramassé, tir du Tactique avec son nombre de captures, ralliement de la Horde et coup de katana du Massacre avec leur multiplicateur, joueur tranché, carte vidée, Évadé attrapé, x2 volé. Le temps de jeu, sans les pauses, est `etat.tempsEcouleMs`, sa durée réglée `etat.dureeMs`.
3. **Ce que l'état final dit et que les faits ne disent pas**: les proies encore non infectées d'une Chasse (`etat.chasse.traqueurs`), le porteur du x2 (`etat.evade.porteur`).
4. **`GameRoom.avancer` est le seul appelant du moteur**, et le seul moment où le journal d'un battement se lit sans perte. La room ne parle à personne: elle constate, elle range.
5. **La fin de partie passe par `finPourLesComptes`**, qui traduit le bilan de la room en résultats, puis par une seule transaction (`enregistrerPartie`) qui écrit la partie, les résultats, la progression, et attribue les succès par le pli de l'historique (`parcoursDe`).
6. **Une invitation qui fait entrer est retirée par `ReseauDesAmis.invitationServie`**, qui connaît l'inviteur et l'invité. La room, elle, ne sait rien des invitations.
7. **Le profil et la fiche se construisent depuis les définitions**: un succès ajouté y apparaît sans rien toucher au client, et un succès secret non obtenu s'y lit déjà « ??? » (étape 3.7).

## Décisions de conception

Aucune n'a été soumise au porteur du projet: elles découlent de l'étude et des décisions ci-dessus. Chacune est signalée au handoff.

1. **Le relevé d'exploits est une fonction pure du serveur** (`packages/server/src/exploits.ts`): il reçoit l'état qui vient d'avancer, en lit le journal et le temps de jeu, et rend le relevé suivant. À la fin, une seconde fonction lit le relevé et l'état final et rend les faits de chaque joueur. La room tient le relevé, comme elle tient l'état. Rien ne touche `packages/sim`.
2. **Un fait est une observation chiffrée d'un joueur dans une partie**, jamais une conclusion: les ninjas ralliés, le meilleur multiplicateur, les Black Ninjas qui l'ont pris. Les conditions qui combinent un fait, le mode, le placement et le nombre de joueurs (« Intouchable ») restent dans le pli du paquet partagé, avec les autres succès. Seuls les faits non nuls s'écrivent.
3. **Trois faits se lisent à la fin**, dans l'état final: n'avoir jamais été pris, être la seule proie restante d'une Chasse, porter le x2. Tous trois ne s'écrivent que s'ils sont vrais: « jamais pris » n'est pas l'absence de captures subies, qui est aussi l'état d'une partie d'avant cette étape.
4. **Une table `faits_de_partie`** (`partie_id`, `compte_id`, `fait`, `valeur`), clé primaire sur les trois premiers, clé étrangère vers le résultat du compte dans cette partie, en cascade: un fait n'existe pas sans son résultat. Le nom du fait est un texte contrôlé par sa forme, pas un type énuméré, comme l'identifiant d'un succès: ajouter un fait ne demande pas de migration, et un fait que le code ne connaît plus est ignoré à la lecture. La valeur est strictement positive. Migration `0010`. Aucune colonne ne s'ajoute à `resultats`.
5. **Les faits s'écrivent dans la transaction de fin**, avec les résultats et avant l'attribution des succès: le pli qui suit les lit. Un réessai d'une partie déjà enregistrée n'écrit rien de plus.
6. **Un abandon n'a pas de faits** (étude, 5.4): il n'a plus d'écran de fin, et quitter ne doit pas être une façon d'obtenir un exploit. Un invité n'en a pas non plus. Le relevé suit pourtant tous les joueurs: la revanche d'un compte sur un invité en est une.
7. **Les parties d'avant cette étape n'ont pas de faits**: les exploits ne se rattrapent pas (étude, section 4, colonne « Source »). Le rattrapage de l'étape 3.7 est inchangé.
8. **Une prise est une capture, une infection ou une élimination**, comme pour « Première prise » (fiche 3.7, décision 6). « Revanche », « Sur le fil » et « Arroseur arrosé » parlent donc de prises: capturer en Horde, en Tactique et en Équipes, infecter en Chasse, trancher en Massacre. Une capture par un Black Ninja n'est pas une prise.
9. **Le temps des exploits est le temps de jeu**, sans les pauses: trente secondes de revanche ne s'écoulent pas pendant que la partie est suspendue.
10. **« Revanche »**: prendre le dernier joueur qui vous a pris, moins de trente secondes après. Une revanche consomme la prise qu'elle venge: deux prises en retour n'en font qu'une.
11. **« Sur le fil »**: une prise dans la dernière seconde du temps de jeu réglé. Une Chasse ou un Massacre terminés avant le terme ne rendent pas « sur le fil » la prise qui les termine: sinon toute Chasse gagnée par les traqueurs donnerait le secret à qui infecte la dernière proie.
12. **« Arroseur arrosé »**: être pris par un joueur moins de trois secondes après en avoir pris un.
13. **« Table rase »** revient au joueur, ou aux joueurs, dont le coup de katana a porté au battement où la carte s'est vidée: le dernier bot tombe toujours sous un katana. Être présent ne suffit pas.
14. **« Coup de filet »** lit le nombre de captures d'un tir du Tactique, que le moteur donne joueurs et ninjas confondus: un joueur pris dans le cône compte. Un tir de la Chasse ne compte pas.
15. **« En chaîne »** lit le multiplicateur de la Horde seule, **« Combo parfait »** celui de la Horde ou du Massacre, comme l'étude les écrit. Le multiplicateur plafonne à cinq dans les deux modes.
16. **« Intouchable »**: gagner une Horde d'au moins quatre joueurs sans avoir été pris, ni par un joueur ni par un Black Ninja, depuis son entrée dans la partie.
17. **« Dernière proie »**: finir une Chasse d'au moins quatre joueurs en étant la seule proie non infectée. Deux proies restantes n'en font aucune.
18. **« Double ou rien »**: porter le x2 à la fin d'une partie à plusieurs gagnée, placement 1, en Équipes celui de l'équipe.
19. **« Rassembleur »**: un ami entre dans votre partie par votre invitation, dans le salon ou en cours de partie. La couche réseau le dit à la room à l'entrée réussie, la room le retient pour l'inviteur. Comme tout fait, il s'enregistre à la fin de cette partie si l'inviteur y est encore: une partie jamais lancée ne donne rien. Un même ami entré deux fois compte une.
20. **Les paliers des succès sans palier dans l'étude**: « Rassembleur » en Découverte (un geste suffit, et il apprend les invitations), « Pas de chance » et « Arroseur arrosé » en Habitué, « Sur le fil » en Expert (une fenêtre d'une seconde).
21. **Deux cumuls de plus montrent leur progression**: « Collectionneur de fantômes » (Évadés attrapés) et « Seigneur de la Horde » (ninjas ralliés). Les autres exploits s'obtiennent d'un coup, sans progression, comme « Série » et « Meute ».

## La liste construite ici

18 succès de source « partie », qui portent le total à 47.

| Palier     | Succès                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Découverte | Cadeau empoisonné (un malus ramassé), Rassembleur (un ami entré par votre invitation)                                                                                   |
| Habitué    | Razzia (20 ninjas d'une capture), Revanche, En chaîne (x3 en Horde), Pas de chance (secret, 3 Black Ninjas dans une partie), Arroseur arrosé (secret)                   |
| Expert     | Combo parfait (x5), Intouchable, Coup de filet (8 d'un tir), Dernière proie, Table rase, Chasseur d'Évadé, Main leste (le x2 pris), Double ou rien, Sur le fil (secret) |
| Légende    | Collectionneur de fantômes (10 Évadés), Seigneur de la Horde (10 000 ninjas ralliés)                                                                                    |

## Périmètre

1. **Paquet partagé**: les faits d'une partie (`FAITS_DE_PARTIE`), `PartieDuParcours.faits`, les mesures qui s'en tirent, les 18 définitions et leurs unités.
2. **Serveur**: le relevé d'exploits et les faits de fin (`exploits.ts`), la room qui le tient et apprend un ami rassemblé, la fin de partie qui joint ses faits au résultat de chaque compte présent, la couche réseau qui dit l'entrée par invitation à la room.
3. **Base**: la table `faits_de_partie` et sa migration `0010`, l'écriture dans la transaction de fin, la lecture dans l'historique que plie l'attribution.
4. **Outils de test**: les comptes en mémoire gardent les faits et les plient.
5. **Client**: rien de neuf à construire, les écrans lisent les définitions. Les tests qui comptent 29 succès en comptent 47.
6. **Aucun changement** de `packages/sim` ni des règles de jeu.

## Hors périmètre

- Le titre: étape `3.9`.
- Un cumul de ninjas pris tous modes confondus (décision 3).
- Annoncer un exploit pendant la partie (étude, 5.4).

## Tests requis

- TU du relevé sur des suites de faits construites à la main: chaque fait, les fenêtres de trente et trois secondes juste dedans et juste dehors, la dernière seconde, la carte vidée, la revanche consommée, les joueurs entrés en cours de partie.
- TU des faits de fin: jamais pris, dernière proie (seule, ou deux), porteur du x2.
- TU du relevé sur une partie réelle rejouée par graine: ses cumuls égalent les compteurs du moteur (prises, captures par un Black Ninja), et deux rejeux donnent le même relevé.
- TU du pli: chaque nouveau succès juste sous et juste sur son seuil, les conditions de mode, de placement et de nombre de joueurs, une partie sans faits.
- TU de la room et de la fin de partie: les faits des présents, aucun pour un abandon ni un invité, l'ami rassemblé.
- TI (base): la table et ses contraintes, la cascade, l'écriture dans la transaction, le réessai qui n'écrit rien, un fait inconnu ignoré, un exploit attribué et annoncé.
- TI (couche réseau): une entrée par invitation fait débloquer « Rassembleur » à la fin.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie où un compte ramasse un malus lui annonce « Cadeau empoisonné » à la fin, vérifié sans base (comptes en mémoire) et en base.
2. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-8-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude des succès. Prochaine action exacte: l'étape `3.9`, le titre. Commiter.
