# Fiche étape 8.4 - La version du jeu, lisible en pied d'accueil

Brief de session. Objectif unique: **qu'on puisse dire, en regardant la page, sur quelle version du jeu on est**. Un libellé lisible et horodaté, discret, en pied de l'écran d'accueil.

## Origine de cette fiche

Étape demandée par le porteur du projet le 20 septembre 2026, à la fin de l'étape 8.2, après un incident: la carte nouvelle était en ligne dans le code et pas en production, et rien sur la page ne permettait de s'en apercevoir. Il a fallu interroger la route `/sante` du serveur et comparer une empreinte de commit à la tête de `master` pour le voir.

Rédigée selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de la demande, de l'état du dépôt au commit `ee18151`, et de la fiche 8.2 prise comme modèle.

**Numéro**: 8.4, quatrième étape de la phase 8. Indépendante de `8.3`, le miroir calculé.

**Écart de méthode déclaré**: cette étape s'exécute dans la conversation de l'étape 8.2, à la demande du porteur du projet, qui l'a formulée séance tenante. La règle « une étape égale une conversation » n'est donc pas tenue. C'est un choix assumé pour une étape courte, et il est redit dans le handoff.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff, cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. Puis `docs/deploiement.md`, qui décrit la mise en ligne et la route `/sante`. `.claude/rules/sim-purity.md` n'est pas nécessaire: `packages/sim` n'est pas touché.

## Pourquoi

Le jeu a déjà une notion de version depuis l'étape 5.3: **le commit lui-même**. La page l'emporte dans son code, l'envoie à l'ouverture du lien, et le serveur refuse une page qui n'est pas la sienne. C'est un contrôle technique, et il fonctionne.

Mais cette version n'est écrite nulle part où un humain la lise. Conséquences constatées le 20 septembre 2026:

1. Personne ne peut dire, en regardant la page, de quand elle date.
2. Une mise en ligne sautée ne se voit pas. Trois poussées en vingt minutes ont fait sauter deux déploiements de suite, chaque exécution restant verte, et la production est restée trois commits en arrière sans que rien ne le signale.
3. Un joueur qui décrit un problème ne peut pas dire sur quelle version il l'a vu.

## Ce qui existe déjà, et où

| Ce qu'on cherche                          | Où c'est                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| La notion de version, et pourquoi         | `packages/shared/src/version.ts`                      |
| La version écrite dans la page            | `packages/client/scripts/empaqueter.ts`, define       |
| Ce que la page sait de sa mise en ligne   | `packages/client/src/configuration.ts`                |
| Ce que tous les écrans reçoivent          | `packages/client/src/interface/ecrans/types.ts`       |
| L'écran d'accueil                         | `packages/client/src/interface/ecrans/accueil.ts`     |
| Les styles de l'accueil                   | `packages/client/page/styles/ecrans.css`              |
| Les jetons de couleur et de police        | `packages/client/page/styles/jetons.css`              |
| La mise en ligne, et d'où vient le commit | `deploiement/deployer.ts`, `.github/workflows/ci.yml` |
| La sortie Vercel                          | `packages/client/scripts/sortieVercel.ts`             |

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE.

1. **Le libellé se lit `Version du 20 septembre 2026, 19h44 · ee18151`.** Une date en toutes lettres, que n'importe qui comprend, et les sept premiers caractères du commit, qui rendent la ligne actionnable pour qui a le dépôt. L'empreinte complète est dans l'infobulle.
2. **L'horodatage est celui du commit, pas celui de la mise en ligne.** Le commit et sa date décrivent la même chose: le code servi. La date de déploiement peut en différer de plusieurs heures, comme ce 20 septembre, et induirait en erreur sur le code réellement en ligne.
3. **La date se lit telle qu'elle est écrite dans le commit**, sans conversion d'heure. Elle se compose par lecture directe des champs de la chaîne ISO, sans objet `Date`: aucune dépendance à la langue du navigateur, aucun fuseau, et une fonction pure que les tests figent.
4. **Le libellé se fabrique dans `packages/shared`**, à côté de la notion de version qu'il présente, et non dans le client: c'est une règle de présentation d'une donnée partagée, et elle se teste sans DOM.
5. **En développement, le pied dit `Version de développement`.** Un empaquetage local n'a pas de commit, et une ligne vide serait plus troublante que la mention.
6. **Le pied est dans l'écran d'accueil**, sous la liste des modes, et nulle part ailleurs. Le porteur du projet a demandé l'accueil, et une ligne répétée sur tous les écrans cesserait d'être discrète.
7. **La date du commit arrive par l'empaquetage**, comme l'adresse du serveur et la version, et non par une requête à l'exécution. La page ne demande rien pour s'afficher.

## Périmètre

### Lot A. Le libellé

1. `packages/shared/src/version.ts`: une fonction pure `libelleDeVersion(version, horodatage)` qui rend la ligne lue par le joueur, dans les trois cas: version et date, version seule, ni l'une ni l'autre.

### Lot B. La date du commit jusqu'à la page

1. `packages/client/scripts/empaqueter.ts`: une option `horodatage`, écrite dans la page comme la version.
2. `packages/client/src/configuration.ts`: la porter à côté de la version.
3. `packages/client/scripts/sortieVercel.ts` et `deploiement/deployer.ts`: la date du commit lue par `git`, à côté du `git diff` qui décide déjà si la mise en ligne part.

### Lot C. Le pied de page

1. `packages/client/src/interface/ecrans/types.ts`: le libellé dans le contexte commun aux écrans.
2. `packages/client/src/interface/ecrans/accueil.ts`: le pied, sous la liste des modes.
3. `packages/client/page/styles/ecrans.css`: discret, avec les jetons existants.

### Lot D. Documentation

1. `docs/deploiement.md`: comment lire la version en ligne sans interroger `/sante`.
2. `docs/plan/ROADMAP.md`, `docs/design/README.md`: l'étape et la décision.

## Hors périmètre

- **Toute surveillance automatique de la production.** Comparer la version en ligne à la tête de `master` et alerter est une étape à part, et elle n'est pas demandée.
- **Tout changement au garde-fou de la mise en ligne.** Il a fait son travail le 20 septembre: il refuse de mettre en ligne un commit qui n'est plus le dernier de la branche.
- **Tout numéro de version sémantique** (1.2.3) et toute étiquette git. Le commit reste la version.
- **Le pied sur les autres écrans.**
- `packages/sim`, `legacy/`, `tests/caracterisation/`.

## Tests requis

- **Le libellé**, dans `packages/shared`: les trois cas, la composition de la date, et le fait qu'aucune langue ni aucun fuseau n'entre en jeu.
- **Le pied de l'accueil**, dans `packages/client`: il est là, il porte le libellé qu'on lui donne, et il porte l'empreinte complète en infobulle.
- La suite unitaire complète au vert, types, linter et formatage verts, CI verte.

## Définition de terminé

1. Ouvrir la page en production et lire, sans outil, de quand date le jeu qu'on a sous les yeux.
2. Le libellé est juste: sa date et son empreinte sont celles du commit servi.
3. En développement, la page le dit au lieu d'afficher une ligne vide ou fausse.
4. Le pied reste discret: il ne prend pas l'œil sur l'accueil.
5. Une personne non technique comprend la ligne.

## Points de vigilance

1. **Ne pas casser le contrôle de version de l'étape 5.3.** La version envoyée au serveur reste l'empreinte complète du commit, comparée à l'identique. Le libellé est une présentation, rien d'autre ne doit s'y raccrocher.
2. **Le bout en bout empaquette sans version.** Les scénarios Playwright passent par `empaqueterLeClient()` sans option: le pied doit y dire « développement » sans rien casser.
3. **`git` peut ne rien savoir dire.** Un historique tronqué ou un commit absent doivent laisser la page s'empaqueter, avec le libellé réduit à l'empreinte.
4. **Discret veut dire discret.** Texte faible, police de données, pas de panneau, pas de bordure.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-4-handoff.md` depuis le modèle, en y redisant l'écart de méthode, puis commiter. Prochaine action exacte: l'étape `8.3`, le miroir calculé, qui reste la seule étape planifiée non faite.
