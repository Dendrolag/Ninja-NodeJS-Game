# Fiche étape 7.11 - La mine posée

Brief de session. Objectif unique: un second objet de poche, la mine. Le joueur qui la ramasse la pose sous ses pieds quand il le veut. Un adversaire ou un Black Ninja qui passe dessus l'arme, et elle explose un instant plus tard: elle fait perdre une part de leurs ninjas aux adversaires pris dans son rayon, tue les Black Ninjas, et en Massacre tue tout ce qui s'y trouve.

## Origine de cette fiche

Aucune fiche n'existait. Le porteur du projet a proposé le 28 septembre 2026: « Ajouter des mines (qui se déclenchent 3 secondes après être passé dessus avec un rayon d'explosion) qui font perdre 15% des points capturés du joueur (Et/ou qui pourraient déclencher les zones d'effets), pour ajouter + de stratégie ». L'étude l'a séparée en deux familles: la mine que pose un joueur, ici, et la mine que pose la carte, qui ouvre une zone (étape 7.12). Règles tranchées le même jour, avec celles de la fumée (étape 7.10).

Rédigée le 28 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- les décisions tranchées avec le porteur du projet, ci-dessous;
- la fiche 7.10, dont elle reprend la poche, et la fiche 7.9 prise comme modèle;
- l'état du dépôt au commit `2a7084a`, et le handoff 3.9.

**Numéro**: 7.11, dans la phase 7, « Modes de jeu ». Elle suit l'étape 7.10, dont elle a besoin: la mine se range dans la poche.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (celui de l'étape 7.10), cette fiche, les fiches 7.10, 7.2, 7.3, 7.4 et 7.5, et `.claude/rules/sim-purity.md`.

## Ce qu'est le jeu aujourd'hui

- **La poche existe** depuis l'étape 7.10: une place, un objet ramassé, une touche et un bouton pour s'en servir. Elle ne connaît que la fumée.
- **La prise par un Black Ninja** fait perdre une part des ninjas, qui redeviennent neutres, sans en créer (`depouiller`, `packages/sim/src/bots.ts`); le mode décide lesquels (`PerteFaceAuBotNoir`), par exemple la part du joueur en Équipes (`partDuJoueur`). En Horde, la réserve de primes perd la même part et le combo retombe (étape 7.5).
- **Un Black Ninja détruit rapporte 15 points** (comportement à préserver 3); en Massacre, seul le katana le détruit, et ses points sont multipliés par le combo (étape 7.4).
- **En Massacre, se faire tuer par un joueur cède la moitié de ses points à son tueur**, et tuer le porteur du x2 de l'Évadé lui prend le x2 (étape 7.9).
- **En Chasse**, une proie marque par la distance parcourue, un point tous les 100 pixels (`CHASSE.PIXELS_PAR_POINT`); un traqueur marque par ses captures et ses vies, et attend une seconde entre deux tirs.
- **Tout le monde va à 150 pixels par seconde** hors bonus, 255 sous bonus de vitesse.

## Décisions du porteur du projet, 28 septembre 2026

1. **Deux familles de mines**: celles que pose la carte, qui ouvrent les zones (étape 7.12), et celles que posent les joueurs, qui font perdre des ninjas (cette étape).
2. **La mine est un bonus « Mine » ramassé**, qui va dans la même poche que la fumée: une place, donc l'une ou l'autre. Une mine par bonus ramassé.
3. **La mine d'un joueur ne touche jamais son poseur, ni ses coéquipiers.**
4. **Elle est déclenchée par les joueurs adverses et par les Black Ninjas**, pas par les faux ninjas. Les Black Ninjas peuvent en mourir.
5. **Visibilité**: pleine pour le poseur et son équipe, un léger scintillement pour les autres. Le bonus Révélation la montre en entier.
6. **Elle reste jusqu'à ce que quelque chose la déclenche**, sans limite de temps.
7. **Délai et rayon: 1,5 seconde et 130 pixels.** Celui qui passe dessus sans s'arrêter s'en sort de justesse, un poursuivant collé à lui y reste, et un Black Ninja peut y mourir. Écarté: les 3 secondes de la proposition d'origine, avec lesquelles un joueur qui continue sa route est à 450 pixels quand elle saute, si bien qu'elle ne prend que ceux qui suivent ou qui traînent.
8. **Horde et Tactique**: un adversaire touché perd 15 pour cent de ses ninjas, qui redeviennent neutres, comme face à un Black Ninja. En Horde, sa réserve de primes perd la même part et son combo retombe. Rien ne revient au poseur: c'est un piège, pas une capture à distance. Le x2 de l'Évadé ne change pas de main, ce n'est pas une capture.
9. **Équipes**: même perte, et les coéquipiers du poseur sont épargnés.
10. **Massacre**: la mine tue tout ce qui se trouve dans son rayon. Les points des victimes vont au poseur, comme un coup de katana, mais sans multiplicateur de combo. Un joueur tué par une mine cède donc la moitié de ses points au poseur.
11. **Chasse**: une proie touchée perd 15 pour cent de ses points; un traqueur touché a son arme enrayée 3 secondes. Lui retirer une vie serait trop dur: la mort du dernier traqueur décide la partie.
12. **L'invincibilité (le « bouclier ») et la protection d'apparition protègent des mines ennemies.**
13. **Un Black Ninja tué par une mine rapporte 15 points à son poseur.** En Massacre, le katana n'est donc plus le seul à détruire un Black Ninja: la règle 3 de CLAUDE.md reçoit une précision datée.
14. **Trois mines posées au plus par joueur**: en poser une quatrième fait disparaître la plus ancienne.
15. **Les mines d'un joueur disparaissent s'il quitte la partie**, et restent s'il se fait capturer.
16. **En Chasse, la mine change de camp avec son poseur**: une proie infectée voit ses mines épargner les traqueurs et frapper les proies.

Écartés: une mine qui s'efface au bout de 60 secondes; les faux ninjas comme déclencheurs, qui feraient sauter les mines en permanence au milieu des troupeaux; les ninjas perdus donnés au poseur; une vie retirée au traqueur; la mine qui ouvre une zone, qui devient l'étape 7.12.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **La mine rejoint la famille des objets de poche** de l'étape 7.10 (`TYPES_OBJETS_DE_POCHE`), avec son réglage (actif, taux), tentée après la fumée. Taux par défaut: celui de la fumée.
2. **Utiliser la poche pose la mine** au centre du ninja. Les mines posées vivent dans un champ à part de l'état, `minesPosees`, absent tant qu'aucune n'est posée, comme `evade`. Une mine porte son poseur, sa position, son rang de pose (pour le plafond de trois), et, une fois armée, son temps restant avant l'explosion.
3. **Qui l'arme**: le contact d'une entité qui la déclenche (décision 4), mesuré comme les autres contacts, du rayon de l'entité à celui de la mine. Un joueur protégé (décision 12) l'arme comme un autre; seule l'explosion l'épargne.
4. **Qui l'explosion touche**: tout ce qui est dans les 130 pixels à l'instant où elle saute, pas celui qui l'a armée en particulier. Celui qui l'a armée et a continué sa route peut donc être sorti du rayon.
5. **Une explosion ne déclenche pas les autres mines**: pas de réaction en chaîne. Idée à rejouer plus tard si l'envie vient.
6. **La perte ne fait pas réapparaître la victime**, contrairement à la prise par un Black Ninja: elle perd sa part et reste où elle est, sans protection nouvelle. En Massacre, un joueur tué réapparaît comme après un coup de katana.
7. **La perte reprend `PerteFaceAuBotNoir`** du mode, à 15 pour cent au lieu de la part réglée pour les Black Ninjas: la même fonction décide quels ninjas partent, ce qui donne la part du joueur en Équipes sans règle nouvelle. Le taux (15) vit dans `packages/shared`, pas dans les réglages du salon.
8. **L'Évadé**: il ne déclenche pas les mines. Hors Massacre, l'explosion ne l'affecte pas; en Massacre, elle le tue, et le x2 va au poseur, comme s'il l'avait éliminé.
9. **Le porteur du x2 tué par une mine en Massacre** le cède au poseur: il a été tué par un joueur. Hors Massacre, il le garde (décision 8).
10. **Les kills d'une mine ne font pas avancer le combo du poseur**, ni en Massacre ni en Horde. Ils comptent pour la fin du Massacre, carte nettoyée.
11. **En Chasse, la perte d'une proie** retire 15 pour cent de la distance qu'elle a parcourue, dont ses points se déduisent: le score reste déduit, rien de nouveau n'est rangé. **L'arme enrayée** repousse le prochain tir du traqueur à 3 secondes, en réutilisant son attente entre deux tirs.
12. **Le camp d'une mine se lit au moment de l'explosion**, à partir de son poseur: sa couleur d'équipe en Équipes, son camp en Chasse (décision 16).
13. **Le flux d'état porte les mines** comme un nouveau type d'entité, en fin de liste (`TYPES_ENTITE`), avec son poseur et, armée, son temps restant. Toutes les mines partent à tous les joueurs: celles des autres ne sont pas un secret, puisqu'elles scintillent (décision 5). C'est la page qui choisit le rendu, plein ou discret, selon le poseur, l'équipe et la Révélation. Une partie sans mine doit s'écrire à l'octet comme avant.
14. **Armée, une mine se voit de tous**: elle clignote de plus en plus vite pendant ses 1,5 seconde. C'est ce qui laisse une chance de sortir du rayon.
15. **Faits**: la pose, l'armement, l'explosion (avec ses victimes et leur perte), pour les sons, le rendu et les points flottants de la Horde. Aucun grand titre, sauf pour la victime, qui voit la part qu'elle vient de perdre.
16. **Le rendu se choisit sur planche** au début de l'étape (`docs/design/etape-7-11/`): la mine posée, pleine et en scintillement, armée, l'explosion, et son icône de poche. Tout se dessine en code.

## Périmètre

### Lot A. Le contrat

1. **Les valeurs**: délai, rayon, part perdue, plafond par joueur, enrayement du traqueur (`MINES` dans `packages/shared`).
2. **L'objet de poche** et son réglage (micro-décision 1).
3. **Les vues et les événements**: l'entité mine dans le flux et son codage, les trois faits (micro-décisions 13 et 15).

### Lot B. Le moteur

1. **La pose**, le plafond de trois, la disparition au départ du poseur (décisions 14 et 15).
2. **L'armement et l'explosion** (micro-décisions 3 à 5).
3. **Les effets par mode**: Horde et Tactique, Équipes, Massacre, Chasse, les Black Ninjas, l'Évadé et le x2, les protections (décisions 8 à 13, micro-décisions 6 à 12).

### Lot C. Le serveur

1. **Tests à travers le vrai serveur**: une mine posée, armée par un adversaire, qui lui fait perdre sa part, en Horde; une mine qui tue en Massacre, points enregistrés en base.

### Lot D. La page

1. **La planche**, puis le rendu retenu (micro-décisions 14 et 16), et la vue pleine sous Révélation.
2. **La perte** en grand titre pour la victime, et en points flottants en Horde.
3. **Le réglage** dans le formulaire de création et dans le récapitulatif du salon.
4. **L'aide**: une ligne par mode, puisque la mine y agit différemment.

### Lot E. Mesure et documentation

1. **Empreinte**: les parties de référence, mine désactivée, identiques à l'octet à celles du handoff 7.10. Puis leurs nouvelles empreintes, mine active, consignées au handoff.
2. **Banc de charge**: une partie pleine où chaque joueur a trois mines posées, consignée dans `docs/mesures/charge-serveur.md`. Jusqu'à trois entités de plus par joueur: l'écart d'octets se mesure.
3. **CLAUDE.md**: le comportement à préserver 3 reçoit une précision datée (la mine détruit un Black Ninja, 15 points non multipliés); le 1, une précision pour la perte d'une proie en Chasse.
4. **Documentation**: le journal de conception, le ROADMAP.

## Hors périmètre

- Les mines de zone (étape 7.12).
- La réaction en chaîne entre mines.
- Des mines que les faux ninjas déclenchent.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les valeurs; le réglage; le codage de la mine et l'aller-retour; une partie sans mine qui s'écrit à l'octet comme avant.
- **Moteur (TU)**: la pose et le plafond de trois; la disparition au départ du poseur, le maintien à sa capture; l'armement par un adversaire et par un Black Ninja, pas par un faux ninja, ni par le poseur, ni par un coéquipier, ni par l'Évadé; le délai et le rayon, un joueur qui s'en sort en continuant sa route et un poursuivant qui y reste; la perte de 15 pour cent dans chaque mode, la réserve et le combo en Horde, la part en Équipes; les protections; le Black Ninja tué et ses 15 points; le Massacre qui tue tout, cède la moitié des points, transfère le x2, sans combo; la Chasse, la distance réduite de la proie et l'arme enrayée du traqueur, la mine qui change de camp; aucune réaction en chaîne.
- **Serveur (TI)**: le lot C.
- **Client (TU)**: les trois rendus de la mine selon le spectateur; la mine armée; le grand titre de la perte; le réglage au formulaire.
- **Bout en bout**: une partie où le joueur pose une mine; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La mine se ramasse, se pose et explose dans les cinq modes, depuis la page, au clavier et au tactile.
2. Le rendu correspond à la planche retenue, vérifié dans le navigateur de Claude Code, avec une capture d'écran.
3. L'empreinte des parties de référence, mine désactivée, est identique à celle du handoff 7.10.
4. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **Le score reste un stock**: la mine retire des ninjas, elle ne range aucun score. En Chasse, c'est la distance qui baisse, pas un score rangé.
2. **Les mines permanentes s'accumulent**: trois par joueur, douze joueurs, trente-six mines au plus. Vérifier au banc que le test de contact reste bon marché, et sur la carte que le jeu reste lisible.
3. **Le délai de 1,5 seconde est une proposition**: le jouer, et le régler dans `packages/shared` si la mine prend trop ou trop peu.
4. **Les équipes sont des couleurs** pour le moteur (étape 7.2): épargner les coéquipiers se lit à la couleur, sans champ d'équipe nouveau.
5. **Le miroir** (étape 8.3) et le flux binaire (étape 2.3): une entité nouvelle demande son codage et un test d'aller-retour.

## Réconciliation pendant l'étape (28 septembre au 2 octobre 2026)

Écarts entre la fiche et ce qui a été construit, consignés au journal de `docs/design/README.md`.

1. **Faite dans la conversation de l'étape 7.10**, à la demande du porteur du projet, après les ajustements de recette de la fumée: écart de méthode à la règle 6, comme pour les étapes 4.6, 7.9 et 7.10.
2. **Rendus choisis par le porteur du projet** sur la planche `docs/design/etape-7-11/1-mine.png`: A, A, B, B, A. La mine ronde (disque de métal cerné, anneau à la couleur du poseur, diode rouge au centre); pour les adversaires, un reflet blanc de deux dixièmes de seconde toutes les deux secondes, chaque mine à son rythme; armée, la diode s'affole et un cercle pointillé rouge marque les 130 pixels; l'explosion en boule de feu néon, orange puis rouge; le pictogramme de la mine ronde (`assets/objets/mine.svg`).
3. **Qui arme une mine** (micro-décision 3): au seuil du contact entre deux entités, 20 pixels entre les centres en inégalité stricte (`MINES.SEUIL_ARMEMENT_PX`), et non la somme des rayons de l'entité et de la mine, qu'aucun contact du jeu n'utilise.
4. **L'adversaire est celui qu'un malus du poseur frapperait**: le moteur réutilise `victimeDuMalus` du jeu de règles du mode. Les coéquipiers en Équipes et le camp en Chasse en découlent sans règle nouvelle, et la question se pose au moment de l'armement comme à celui de l'explosion (décision 16).
5. **La perte face au Black Ninja prend sa part en paramètre** (`PerteFaceAuBotNoir`, micro-décision 7): 50 pour cent réglés pour un Black Ninja, 15 pour une mine.
6. **Une mort par mine en Massacre** partage avec le katana sa mise à mort (`mettreAMort`, `massacre.ts`), mais ne tient pas compte du délai du poseur entre deux joueurs tués, ne le relance pas, et peut tuer plusieurs joueurs d'un coup. Elle compte comme une prise pour les exploits (revanche, prise sur le fil). Une mine qui tue le dernier faux ninja vide la carte.
7. **Le flux d'état porte la mine** comme une entité de type `mine`, à la fin de `TYPES_ENTITE`, avec son poseur et, armée, son temps restant; sa couleur est celle de son poseur au moment présent. Une mine immobile et qui attend ne coûte rien dans un delta.
8. **Faits**: la pose au seul poseur (son son: le clic des boutons, faute de mieux), l'armement et l'explosion à tous. Les sons de l'armement et de l'explosion sont **provisoires** (`SONS.mineArmee`, le tic du compte à rebours; `SONS.mineExplosee`, le Black Ninja détruit), comme celui de la fumée.
9. **Les annonces**: la victime lit sa perte en grand titre brouillé, « Piège · Mine · 3 ninjas perdus », « −1 point » en proie de la Chasse, « Arme enrayée pendant 3 s » en traqueur; en Massacre, une bulle « Une mine vous a eu ». Le poseur lit une bulle, « Votre mine a touché 2 cibles : +15 points » ou « Votre mine a sauté dans le vide ». La pose et l'armement ne s'annoncent pas.
10. **Les points flottants**: le gain du poseur, en or quand la mine détruit des Black Ninjas, en violet quand elle tue en Massacre; en Horde, la perte de la victime, en rouge et en négatif sous son ninja (nouveau genre `perte`).
11. **L'aide** décrit la mine dans un paragraphe qui nomme chaque mode, au lieu d'une ligne par mode: l'aide range les objets de poche dans une liste à une entrée par objet.
12. **Le rappel des touches** dit « E pour la poche », « E pour la fumée » ou « E pour poser la mine » selon les objets en jeu. **Défaut corrigé en route**: le rappel passait sous le temps restant à 1 280 pixels de large, déjà avec la fumée; il tient désormais dans la moitié droite de la barre, sur deux lignes au besoin, et disparaît sous 1 200 pixels.
13. **Le banc**: une option `--mines` (`pnpm charge --banc --mines`), et une mesure isolée de trente-six mines qui ne s'arment jamais; section 22 de `docs/mesures/charge-serveur.md`. Trois coûts évitables retirés pendant la mesure (Black Ninjas relevés une fois, état non recopié sans armement, préfiltre par axe).
14. **L'empreinte**: une option `--sans-mine` à l'outil, qui rejoue à l'octet l'étape 7.10; `--sans-poche` coupe désormais les deux objets de poche.
15. **Le contrat du serveur** est joué à travers le vrai serveur (`ServeurSocket.mine.test.ts`): une mine posée, vue de tous, armée par Bob qui y perd des ninjas, en Horde; une mine qui tue Bob en Massacre et rapporte au poseur la moitié de ses points. L'enregistrement en base n'a pas de test propre: les points d'une partie Massacre y vont par le classement de fin, que rien de la mine ne change.
16. **Mesure de gameplay à rejouer à la recette**: à la même vitesse, un poursuivant collé au joueur qui arme la mine, à moins de 78 pixels derrière lui, en sort aussi; c'est celui qui suit de plus loin, et arrive sur la mine quand elle saute, qui y reste. Le délai de 1,5 seconde est à juger en jouant (point de vigilance 3).

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-11-handoff.md`: les décisions construites, les écarts à cette fiche, les deux jeux d'empreintes, les mesures, l'état de la CI. Prochaine action exacte: l'étape 7.12, ou l'étape suivante de la section 3 du ROADMAP. Commiter, pousser, vérifier la CI et la mise en ligne.
