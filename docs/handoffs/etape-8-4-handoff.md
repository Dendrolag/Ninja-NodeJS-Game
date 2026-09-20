# Handoff - Étape 8.4 La version du jeu, lisible en pied d'accueil

Date: 20 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'on puisse dire, en regardant la page, sur quelle version du jeu on est: un libellé lisible et horodaté, discret, en pied de l'écran d'accueil.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, à partir de la demande du porteur du projet, de l'état du dépôt au commit `ee18151` et de la fiche 8.2 prise comme modèle (`docs/plan/etape-8-4.md`, commit `0e0cdc6`).
- **Le pied de l'accueil dit `Version du 20 septembre 2026, 20h17 · 0e0cdc6`**: la date du commit servi, en toutes lettres, et les sept premiers caractères de son empreinte. L'empreinte complète est dans l'infobulle, pour qui la colle dans un `git show`. En développement, le pied dit `Version de développement`.
- **Le libellé se fabrique dans `packages/shared`**, par deux fonctions pures, à côté de la notion de version qu'elles présentent et non dans le client.
- **La date du commit descend jusqu'à la page par l'empaquetage**, comme l'adresse du serveur et la version le faisaient déjà depuis l'étape 5.3. La page ne demande rien à l'exécution pour s'afficher.
- **Le déployeur lit la date par `git`**, par le même chemin que le `git diff` qui décide déjà si la mise en ligne part. La CI n'a pas eu besoin de changer: sa récupération du dépôt prend déjà tout l'historique.
- **Vu dans le navigateur**, page empaquetée avec un vrai commit: la ligne tient sur une ligne à 375 pixels de large comme sur un écran d'ordinateur, et ne déborde pas.
- **`docs/deploiement.md` gagne deux points de surveillance**: comment lire la version de la page sans interroger `/sante`, et le réflexe à avoir après une série de poussées rapprochées, puisqu'une mise en ligne sautée ne se signale nulle part.

## Fichiers créés ou modifiés

Commit `0e0cdc6`: `docs/plan/etape-8-4.md` (créé), la fiche.

Commit `0060150`:

- `packages/shared/src/version.ts`: `libelleDeVersion` et `dateDeVersion`, deux fonctions pures.
- `packages/shared/src/index.ts`: leur export.
- `packages/shared/src/version.test.ts`: neuf tests ajoutés.
- `packages/client/scripts/empaqueter.ts`: l'option `horodatage`, écrite dans la page comme la version.
- `packages/client/scripts/sortieVercel.ts`: l'option, et la variable d'environnement `HORODATAGE_DU_JEU`, **facultative**: sans elle le pied se replie sur la seule empreinte plutôt que de refuser d'empaqueter.
- `deploiement/deployer.ts`: `dateDuCommit`, qui lit `git show -s --format=%cI`.
- `packages/client/src/configuration.ts`, `packages/client/src/principal.ts`: la porter jusqu'à l'application.
- `packages/client/src/interface/application.ts`, `interface/ecrans/types.ts`: le libellé dans le contexte commun aux écrans.
- `packages/client/src/interface/ecrans/accueil.ts`: le pied, sous la liste des modes.
- `packages/client/page/styles/ecrans.css`: texte faible, police de données, centré, sans panneau ni bordure.
- `packages/client/src/interface/essais.ts`: le contexte d'essai des écrans, qui doit maintenant porter un libellé.
- `packages/client/src/interface/application.test.ts`: deux tests ajoutés.
- `docs/deploiement.md`, `docs/plan/ROADMAP.md`, `docs/design/README.md`.

Aucune modification de `packages/sim`, de `packages/server`, de `legacy/`, de `tests/caracterisation/` ni de `.github/workflows/`.

## Tests

- **Ajoutés: onze.** Neuf sur le libellé: la date en toutes lettres, le « 1er » du mois, les douze mois, le repli sur la seule empreinte quand git n'a rien su dire, le fait que l'empreinte entière ne s'affiche jamais, et surtout **qu'aucun fuseau n'entre en jeu**, trois chaînes de fuseaux différents rendant la même heure. Deux sur le pied de l'accueil: sans commit il dit le développement, avec commit il porte la date et l'empreinte complète en infobulle.
- **Résultat: 2 429 tests unitaires au vert** (contre 2 418 au handoff 8.2) et **46 de bout en bout** au vert. Types (paquets, tests et bout en bout), linter et formatage verts.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- **État de la CI**: à vérifier sur le commit poussé en fin de session.

## Décisions et écarts au plan

1. **Écart de méthode, déclaré dans la fiche et redit ici**: l'étape s'est exécutée dans la conversation de l'étape 8.2, le porteur du projet l'ayant demandée séance tenante. La règle « une étape égale une conversation » n'est donc pas tenue. Choix assumé pour une étape courte.
2. **La date est celle du commit, pas de la mise en ligne.** Le commit et sa date décrivent la même chose, le code servi. Ce 20 septembre, le commit de la carte a été poussé à 17h31 et mis en ligne à 20h14: une date de déploiement aurait laissé croire à un code plus récent qu'il ne l'était.
3. **La date se compose sans objet `Date`.** Les champs se lisent directement dans la chaîne ISO et le fuseau qui la termine est ignoré. Deux joueurs lisent donc la même heure pour la même version, quels que soient la langue de leur navigateur et le réglage de leur machine. Un `toLocaleDateString` aurait rendu « September 20, 2026 » chez l'un et « 20 septembre 2026 » chez l'autre, et les tests n'auraient rien figé.
4. **Les noms de mois sont écrits dans le code**, pour la même raison. La page du jeu est en français, sa version l'est aussi.
5. **Le pied ne vit que sur l'accueil.** Répété sur tous les écrans, il cesserait d'être discret, et le porteur du projet a demandé l'accueil.
6. **Écarté: un numéro de version sémantique** (1.2.3). Il demanderait une discipline d'étiquettes que le projet n'a pas, et n'apprendrait rien de plus qu'une date. Le commit reste la version, comme depuis l'étape 5.3.
7. **Le contrôle de version de l'étape 5.3 n'est pas touché.** La version envoyée au serveur reste l'empreinte complète, comparée à l'identique. Le libellé n'est qu'une présentation.

## Problèmes connus et dette

- **`dateDuCommit`, dans `deploiement/deployer.ts`, n'a pas de test.** C'est cohérent avec le voisinage: `fichiersChanges`, qui décide si la mise en ligne part, n'en a pas non plus, et `deploiement/` ne teste que `verifications.ts`. La fonction a été vérifiée à la main de bout en bout: page empaquetée avec le commit réel, date lue dans le navigateur. Si l'on veut fermer ce trou, ce sont ces deux fonctions ensemble, pas une seule.
- **Rien ne surveille que la production suit `master`.** L'incident du 20 septembre reste possible: trois poussées rapprochées peuvent sauter deux mises en ligne de suite, chaque exécution de la CI restant verte. Le pied de l'accueil rend le retard **visible**, il ne le **signale** pas. Une surveillance qui compare la version en ligne à la tête de `master` serait une étape à part entière, et elle n'est pas planifiée. Le réflexe est écrit dans `docs/deploiement.md`, section Surveillance.
- **Le pied affiche la version de la page, pas celle du serveur de jeu.** Les deux doivent être la même, et le serveur refuse une page d'un autre commit: un écart se voit donc au jeu, pas en pied de page. C'est écrit dans `docs/deploiement.md`.

Repris du handoff 8.2, inchangé: la carte du Quartier est mesurée et pas jugée, il reste à y jouer à plusieurs; l'errance des faux ninjas dans les cours à une porte et le Massacre qui pourrait y traîner sont les deux points à observer.

## Prochaine action exacte

Ouvrir l'étape **8.3, le miroir calculé**, dans une conversation neuve, sur `master`: rédiger sa fiche selon le cas de repli du PROTOCOLE, puis faire que le serveur retourne la collision et que la page retourne le décor, au lieu de charger un second jeu d'images. Point de départ: l'entrée `8.3` de la section 3 de `docs/plan/ROADMAP.md`, et la section 1.4 de `docs/mesures/etude-structures-de-carte.md`. Réserve à trancher dans l'étape: l'avant-plan de Tokyo a été retouché à la main dans son dossier `mirror`, identique à 91 pour cent seulement, et l'étape doit décider si l'on conserve une image livrée quand elle existe.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-3.md`, à rédiger au début de l'étape. L'entrée correspondante est à la section 3 de `docs/plan/ROADMAP.md`.
