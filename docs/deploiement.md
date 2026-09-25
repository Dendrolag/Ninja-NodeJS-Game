# Mise en ligne et exploitation

Mis en place à l'étape 5.3, le 14 septembre 2026. Ce document dit ce qui tourne où, comment une version part en ligne, comment revenir en arrière et quoi surveiller. Les raisons des choix sont au journal de conception (`docs/design/README.md`, décisions du 14 septembre 2026).

## Ce qui tourne où

| Rôle           | Hébergement                                                            | Adresse                              |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Page du jeu    | Vercel, projet `neon-ninja-jeu` (`prj_x2NAYxrQy1D88sjkjGRewy96hbua`)   | https://ninja.dendrolag.fr           |
| Serveur de jeu | Render, service « Neon Ninja » (`srv-csrnm30gph6c73b9jmt0`), Francfort | https://neon-ninja.onrender.com      |
| Base           | Neon, projet `neon-ninja`, branche `production` (principale), pooler   | Dans `DATABASE_URL`, jamais en clair |

- **Vercel** : équipe `team_v9SkLK1zKjpRjtkmzq8Q9TM7` (« dendrolag's projects »). Le projet n'est relié à aucun dépôt : seule la mise en ligne ci-dessous y envoie une page.
- **Domaine** : `ninja.dendrolag.fr`, rattaché au projet Vercel le 15 septembre 2026. La zone DNS de `dendrolag.fr` est chez Hostinger (hPanel, serveurs `ns1` et `ns2.dns-parking.com`) : une seule entrée pour ce nom, un CNAME `ninja` vers `a3d44510bf05d743.vercel-dns-017.com`, la cible que Vercel recommande pour ce projet. Aucune entrée A ne doit coexister avec lui. Vercel émet et renouvelle le certificat. L'adresse https://neon-ninja-jeu.vercel.app reste en service, mais renvoie depuis l'étape 5.6 à `ninja.dendrolag.fr` par une redirection permanente (308), chemin compris, pour que les moteurs de recherche ne retiennent qu'une adresse. La règle est écrite dans la configuration que la mise en ligne envoie à Vercel (`packages/client/scripts/sortieVercel.ts`). Les adresses propres à chaque déploiement ne sont pas redirigées.
- **Render** : espace de travail `tea-csp5tt3gbbvc73fph8v0`, offre gratuite, branche `master` (depuis l'étape 6.1), déploiement automatique coupé. Le service a été repris de l'ancien service « Neon Ninja » de la version d'origine, suspendu depuis 2025, sur décision du porteur du projet.
- **Base** : `DATABASE_URL` vit dans le groupe d'environnement Render `neon-ninja-production` (`evg-dak0g56q1p3s739qm7b0`), lié au service. Les branches de test de la CI sont créées sans les données de la branche principale.

## Réglages du serveur de jeu

Commande de construction :

```bash
corepack pnpm install --frozen-lockfile && corepack pnpm exec tsc --build
```

Commande de démarrage :

```bash
node packages/server/dist/base/migrer.js && VERSION_DU_JEU=$RENDER_GIT_COMMIT exec node packages/server/dist/principal.js
```

Route de santé surveillée par Render : `/sante`.

| Variable                          | Valeur                                                         | Pourquoi                                                                           |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_VERSION`                    | `24`                                                           | La version de Node du projet, sans suivre la dernière parue.                       |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | `0`                                                            | corepack installe pnpm (champ `packageManager`) sans poser de question.            |
| `SERVIR_LA_PAGE`                  | `non`                                                          | La page est servie par Vercel.                                                     |
| `ORIGINES_AUTORISEES`             | `https://neon-ninja-jeu.vercel.app,https://ninja.dendrolag.fr` | La page, sous ses deux adresses, peut joindre Socket.IO et les routes des comptes. |
| `MANDATAIRES_DE_CONFIANCE`        | `3`                                                            | Mesuré, voir « Mandataires » ci-dessous.                                           |
| `DATABASE_URL`                    | groupe `neon-ninja-production`                                 | La base, par le pooler. Un secret.                                                 |
| `VERSION_DU_JEU`                  | posée par la commande de démarrage                             | Le commit en ligne, lu par le contrôle de version et la route de santé.            |
| `PORT`                            | posée par Render                                               | Le port d'écoute.                                                                  |

**Une variable modifiée ne s'applique qu'au déploiement suivant.** Redémarrer le service garde les anciennes valeurs (constaté le 14 septembre 2026). Après un changement, redéployer le commit en ligne, ou pousser.

## Mise en ligne

### Automatique

Le job « Mise en ligne » de la CI (`.github/workflows/ci.yml`) part après les deux autres jobs verts, pour une poussée sur `master`, et seulement si le commit est encore le dernier de la branche. Il lance `deploiement/deployer.ts`, qui :

0. lit la version en ligne sur `/sante`, et s'arrête sans rien changer si ce commit y est déjà, ou si rien de ce qui compose le jeu n'a changé depuis : documentation (`docs/`, fichiers `.md`), tests (`tests/`, fichiers `.test.ts` et `.spec.ts`), `legacy/`, `.claude/`, et l'outillage posé à la racine qui ne sert qu'aux tests, au linter ou au formateur (`playwright.config.ts`, `vitest.config.ts`, `vitest.workspace.ts`, `tsconfig.tests.json`, `tsconfig.e2e.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`) ne partent jamais en ligne. `tsconfig.base.json` et `tsconfig.json`, qui construisent les paquets, en font partie. Une mise en ligne coupe les parties en cours : un commit de documentation n'en coupe plus aucune (étape 5.4). Tout autre fichier, même inconnu, déclenche la mise en ligne, comme un serveur qui ne dit pas sa version ou un historique qui ne permet pas de comparer. La production est donc celle du dernier commit qui touche le jeu, pas forcément du dernier commit ;
1. empaquette la page pour ce commit (adresse du serveur et version écrites dans `app.js`) et l'envoie à Vercel **sans la promouvoir** ;
2. demande à Render de déployer ce commit, attend qu'il soit en ligne, et vérifie que `/sante` rend sa version ;
3. promeut la page, qui devient celle de l'adresse publique ;
4. vérifie la page publique : réponse, politique de sécurité ouverte au seul serveur de jeu, `app.js` du commit.

Une mise en ligne ne s'interrompt pas pour la suivante. Si elle échoue avant la promotion, rien n'a changé pour les joueurs : Render garde l'ancien serveur tant que le nouveau n'a pas démarré, et l'ancienne page reste publique.

Secrets du dépôt GitHub : `RENDER_API_KEY` et `VERCEL_TOKEN`. Les identifiants et adresses sont écrits en clair dans le job : ils ne sont pas secrets.

### À la main

Depuis la racine du dépôt compilé (`pnpm exec tsc --build`), avec `RENDER_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_SERVICE_ID`, `SERVEUR_DE_JEU`, `PAGE_DU_JEU` et `VERSION_DU_JEU` (un commit déjà poussé) dans l'environnement :

```bash
node --disable-warning=ExperimentalWarning deploiement/deployer.ts
```

### Pendant la mise en ligne

Entre la mise en ligne du serveur et la promotion de la page, quelques secondes, une page de l'ancienne version est refusée par le nouveau serveur avec « Une nouvelle version du jeu est en ligne. Rechargez la page. ». Les parties en cours sur l'ancien serveur s'arrêtent quand Render l'éteint : chaque mise en ligne coupe les parties en cours. Hors partie, une page ouverte rétablit son lien d'elle-même pendant une minute et demie (étape 2.6) ; une page de l'ancienne version se voit alors refuser, et propose de se recharger.

## Migrations de la base

Elles s'appliquent au démarrage du serveur, avant qu'il n'écoute (la commande préalable au déploiement de Render est réservée aux offres payantes). Pendant ce temps, l'ancien serveur tourne encore, sur la base déjà migrée : **une migration doit rester compatible avec la version précédente du serveur**. Ajouter une colonne ou une table se fait en un commit ; en retirer ou en renommer une se fait en deux, le code qui ne s'en sert plus d'abord, la migration ensuite. Une migration ne se défait pas par un retour arrière.

## Retour arrière

Le serveur et la page doivent toujours être du même commit, sans quoi le serveur refuse la page.

- **Le plus sûr** : annuler le commit fautif sur `master` (`git revert`), et pousser. La CI met en ligne l'ensemble, vérifié.
- **En urgence**, sans attendre la CI : relancer la mise en ligne à la main avec `VERSION_DU_JEU` égal au dernier commit sain.
- **Depuis les tableaux de bord** : Render, liste des déploiements, « Rollback » sur le déploiement sain ; puis Vercel, projet `neon-ninja-jeu`, liste des déploiements, « Promote » sur la page du même commit. Les deux, dans cet ordre.

## Surveillance

- **Le pied de l'écran d'accueil** (étape 8.4) : la façon la plus simple de savoir sur quelle version on est. Il dit « Version du 20 septembre 2026, 20h17 · 0e0cdc6 », c'est-à-dire la date du commit servi et les sept premiers caractères de son empreinte, l'empreinte complète étant dans l'infobulle. C'est la **version de la page**, celle que Vercel sert ; celle du serveur de jeu se lit sur `/sante`. Les deux doivent être la même : le serveur refuse une page d'un autre commit, avec un message qui dit de recharger.
- **`/sante`** du serveur : version en ligne, nombre de parties, de joueurs et de connexions, et adresse sous laquelle le serveur voit le demandeur.
- **La régularité du serveur, sur `/sante`** (étape 8.6) : le champ `battement` résume les cinq dernières minutes de toutes les parties. `ecart` est l'écart réel entre deux battements d'une même partie, qui doit rester à 50 ms ; `enRetard` compte ceux d'au moins 100 ms ; `duree` est le temps d'un battement, calcul et envoi compris, qui doit rester loin sous 50 ms. `null` quand aucune partie n'a tourné pendant ces cinq minutes. **Comment le lire** : si l'écart reste à 50 ms alors qu'un joueur ressent des à-coups, le serveur n'y est pour rien, le retard naît sur le chemin ; si l'écart monte, c'est le serveur qui peine, et une offre qui garantit sa puissance le corrigerait. Le relevé `?diagnostic=1` de la page recopie ces chiffres à côté des siens.
- **Journaux** : tableau de bord Render, onglet Logs du service ; la CI, job « Mise en ligne ».
- **Mise en veille** : en offre gratuite, le serveur s'endort après quinze minutes sans trafic, et se réveille à la visite suivante : quinze secondes mesurées le 14 septembre 2026, jusqu'à une minute selon Render. Pendant ce temps, la page dit que le serveur démarre et réessaie d'elle-même, toutes les trois secondes pendant une minute et demie. Une partie en cours le garde éveillé. Depuis l'étape 5.5, une page ouverte et visible le garde éveillé aussi : elle demande `/sante` toutes les dix minutes (`packages/client/src/eveil.ts`), faute de quoi le serveur s'endormait sous un joueur resté sur les menus, le WebSocket du jeu ne comptant pas comme du trafic entrant. Un onglet caché se tait. Au pire, le service tourne tout le mois : 744 heures au plus, dans les 750 heures gratuites de l'espace Render, qui n'a plus d'autre service depuis l'étape 6.1.
- **Heures gratuites** : 750 heures par mois pour tout l'espace de travail Render, dont le serveur de jeu est le seul service depuis l'étape 6.1.
- **Une mise en ligne peut être sautée sans que rien ne le signale.** Chaque exécution vérifie que son commit est encore le dernier de `master` avant de mettre en ligne, pour ne jamais écraser du neuf par du vieux. Trois poussées en vingt minutes, le 20 septembre 2026, ont donc sauté deux mises en ligne de suite, chaque exécution restant verte, et la production est restée trois commits en arrière. **Le réflexe** : après une série de poussées rapprochées, comparer le pied de l'accueil à la tête de `master`. Si la production est en retard et que rien n'est en cours, relancer la dernière exécution suffit. Rien ne surveille cela automatiquement à ce jour.
- **Échéances** : le jeton Vercel expire le 14 septembre 2027. Le renouveler avant : nouveau jeton, puis variable `VERCEL_TOKEN` de la machine de développement et secret GitHub du même nom.

## Mandataires

Entre le joueur et le serveur, Render place trois mandataires : deux relais qui inscrivent chacun une adresse dans l'en-tête `X-Forwarded-For` (des adresses internes en `10.`), et un dernier sur la machine même, d'où le serveur voit toutes les connexions venir de `::1`. `MANDATAIRES_DE_CONFIANCE` dit combien de mandataires croire : il vaut **3**.

Mesuré le 14 septembre 2026 : avec 10 mandataires de confiance et un en-tête inventé de neuf adresses numérotées, le serveur a rendu la troisième, et sans en-tête l'adresse publique de la machine de mesure. Avec 0, le serveur voyait `::1` ; avec 1, une adresse interne de Render : tous les joueurs auraient partagé la même limite de tentatives de connexion. Avec plus de 3, un joueur pourrait s'inventer une adresse.

Pour le vérifier après un changement d'hébergement : interroger `/sante` depuis une machine dont on connaît l'adresse publique, avec et sans en-tête `X-Forwarded-For` inventé. L'adresse rendue doit être l'adresse publique dans les deux cas : jamais celle d'un mandataire, jamais l'adresse inventée.

## Ressources de la version d'origine

Retirées à l'étape 6.1, le 15 septembre 2026, sur décision du porteur du projet : le service Render « To The Point » (`https://to-the-point.onrender.com`), suspendu puis supprimé, et les projets Vercel `ttp` et `neon-ninja` (`ttp-eight.vercel.app`, `neon-ninja-gules.vercel.app`), supprimés. Aucune ne portait de données. Plus rien en ligne ne sert la version d'origine : elle reste archivée sous l'étiquette git `v0.8.6`, et copiée en lecture seule dans `legacy/`.
