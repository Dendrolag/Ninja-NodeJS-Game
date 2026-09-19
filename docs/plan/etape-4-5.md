# Fiche étape 4.5 - Textes de présentation

Brief de session. Objectif unique: réécrire les textes qui présentent le jeu au joueur. Ils datent du jeu d'origine et parlent de troupeaux et de capture seule, alors que le jeu compte cinq modes, la Horde, l'élimination au katana et la traque. Les textes ont été rédigés avec le porteur du projet, dans un ton court et un peu décalé.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 19 septembre 2026, à la demande du porteur du projet. Elle est rédigée le 19 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 4.5 de la section 4 du ROADMAP, et la fiche 7.6 prise comme modèle;
- l'état du dépôt au commit `ca27863`, et le handoff 7.6;
- le relevé des textes de la page, puis leur réécriture avec le porteur du projet, dans la conversation du 19 septembre 2026.

**Numéro**: 4.5, dans la phase 4, « Interface et bout en bout ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.6, ou le handoff partiel de cette étape), puis cette fiche. L'étape ne touche pas `packages/sim`.

## Relevé des textes, 19 septembre 2026

| Où                                                                       | Défaut                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Accueil, titre « Prêt à frapper dans l'ombre ? »                         | Ne parle plus que de discrétion                                                                                                 |
| Accueil, accroche                                                        | « Volez les troupeaux des autres joueurs »: la Horde seule                                                                      |
| Accueil, trois cartes de règles                                          | Les règles de la Horde, sous un bandeau qui annonce cinq modes                                                                  |
| Création, tuiles des modes                                               | « Leur troupeau » en Horde; les Équipes sans les captures                                                                       |
| Aide, « Le principe »                                                    | Huit paragraphes d'un bloc, dont les deux premiers ne valent que pour la Horde                                                  |
| Aide, bonus Invincibilité                                                | « Vous détruisez les Black Ninjas »: faux en Massacre, où l'invincibilité ne fait que protéger                                  |
| Aide, commandes                                                          | **Défaut**: Espace n'est cité que pour la Tactique, alors que la Chasse et le Massacre s'en servent, et le bouton Katana manque |
| Salon, rappel du mode; réglages; annonces de la Chasse; refus du plafond | « Faux ninjas », terme remplacé                                                                                                 |
| `index.html`, description; `README.md`                                   | La Horde seule                                                                                                                  |

## Décisions du porteur du projet, 19 septembre 2026

1. **Un ton court et décalé.** En dire juste assez pour comprendre le principe, laisser de la découverte, ne pas se prendre au sérieux. Style de ponctuation du porteur du projet dans les textes réécrits: ni deux-points, ni point-virgule, ni virgule avant « et ».
2. **Titre de l'accueil**: « Le ninja, c'est vous. Enfin, un des trois cents. »
3. **Accroche de l'accueil**: « Plusieurs modes, beaucoup de ninjas. » Elle doit tenir quand d'autres modes viendront.
4. **Textes des modes**:
   - Horde. Faites grossir vos rangs et attrapez les autres joueurs pour tout leur piquer.
   - Tactique. Réfléchir avant d'agir, pour une fois. Visez devant vous et capturez tout ce qui passe.
   - Équipes. Deux couleurs, une seule qui gagne. Ralliez pour votre camp, ne trahissez personne.
   - Chasse. Cache-cache, version ninja. Les traqueurs cherchent les vrais joueurs dans la foule. Les proies prises changent de camp.
   - Massacre. Fini les couleurs, place au bain de sang. Tranchez tout au katana et enchaînez pour faire exploser le score.
5. **Bonus et malus**:
   - Vitesse. Pour ceux qui trouvaient le jeu trop lent.
   - Invincibilité. Le nom parle de lui-même, non ?
   - Révélation. Les vrais ninjas ne peuvent plus faire semblant.
   - Commandes inversées. Gauche, c'est droite. Bon courage aux autres.
   - Flou. Les autres joueurs auraient dû prendre leurs lunettes.
   - Négatif. Ça ne pénalisera pas les daltoniens.
6. **« PNJ » remplace « faux ninjas »** partout où le joueur le lit. Les Black Ninjas gardent leur nom.
7. **Les cartes de l'accueil deviennent une carte par mode**, avec le texte de sa tuile: la grille s'allonge d'elle-même avec les modes. Les autres textes (aide, rappel du salon, description, README) sont rédigés dans ce cadre, puis relus par le porteur du projet sur la page.
8. **La ligne d'un compte connecté sur l'accueil** dit « Bienvenue, Alice. » au lieu de « Vous jouez avec votre compte, Alice. » (demande du porteur du projet, en fin d'étape).

Écartés: « Prêt à frapper dans l'ombre ? » et quatre autres titres; « Cinq façons de semer la zizanie », trop daté et lié au nombre de modes; « Plus on est de ninjas, plus on rit »; « Toucher, c'est pour les amateurs », au double sens malvenu; « bots » et « faux ninjas ».

## Décisions prises par cette fiche

1. **Une seule source pour le texte de chaque mode**, lue par l'accueil, la création et l'aide: deux écrans ne peuvent plus se contredire.
2. **L'aide garde les règles exactes et chiffrées**, lues dans les constantes comme aujourd'hui: c'est là qu'un joueur comprend pourquoi son score est retombé. Elle s'ouvre sur un principe commun, puis une section par mode, titrée du nom du mode, avec son texte puis ses règles.
3. **Le rappel du salon reste pratique** (touches, charges, vies): seuls changent le terme et la ponctuation.
4. **Le code et ses commentaires gardent leurs mots** (`bot`, « faux ninja »): le changement porte sur ce que le joueur lit. Les noms des tests qui décrivent le moteur ne changent pas.
5. **La description de la page change ici**; le reste du référencement (titre, aperçus pour les réseaux) relève de l'étape 5.6.

## Périmètre

1. Accueil: titre, accroche, une carte par mode.
2. Création: textes des tuiles, tirés de la source commune.
3. Aide: principe commun, une section par mode, bonus et malus, malus par camp, commandes corrigées.
4. Salon, réglages, récapitulatifs, annonces de la Chasse, refus du plafond: « PNJ ».
5. `packages/client/web/index.html` (description) et `README.md`.

## Hors périmètre

- Aucun changement de règle, de réglage ni de moteur. L'empreinte des parties ne bouge pas.
- Le référencement (étape 5.6), l'allègement du rendu (étape 5.7).
- Rendre les cartes de l'accueil cliquables vers la création d'un mode.

## Tests requis

- L'accueil montre le nouveau titre, l'accroche et une carte par mode avec son texte.
- La création montre le même texte pour chaque mode.
- L'aide a une section par mode, et sa liste de commandes cite Espace pour les trois modes qui s'en servent et le bouton Katana.
- Aucun texte visible des écrans ne contient plus « troupeau » ni « faux ninja ».
- Les tests existants qui lisent les anciens textes (réglages, salon, création, annonces, validation, serveur, bout en bout de la navigation) sont mis à jour.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les textes arrêtés avec le porteur du projet sont en place, mot pour mot.
2. Vérifié dans le navigateur: accueil, création, aide, salon.
3. Suite Vitest complète, types, linter, formatage et bout en bout verts; CI verte.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-5-handoff.md. Prochaine action exacte: l'étape 5.6, référencement, dont la fiche se rédige au début de la session. Commiter.
