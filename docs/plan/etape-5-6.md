# Fiche étape 5.6 - Référencement

Brief de session. Objectif unique: que le jeu puisse remonter dans les moteurs de recherche, et qu'un lien partagé montre un aperçu qui donne envie. La page servie par Vercel ne contient aujourd'hui qu'un titre de deux mots, une description et un élément vide que le code remplit.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 19 septembre 2026, à la demande du porteur du projet. Elle est rédigée le 19 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 5.6 de la section 4 du ROADMAP, et la fiche 4.5 prise comme modèle;
- l'état du dépôt au commit `1defeab`, et le handoff 4.5, qui a déjà réécrit la description de la page (décision 5 de sa fiche);
- la mesure de la page en ligne ci-dessous.

**Numéro**: 5.6, dans la phase 5, « Charge, performance et durcissement ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (4.5, ou le handoff partiel de cette étape), puis cette fiche. L'étape ne touche pas `packages/sim`.

## Mesure avant, 19 septembre 2026

Sur https://ninja.dendrolag.fr, page du commit `12ab3e8`:

| Ce qu'on regarde                              | Constat                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Présence dans l'index                         | **Aucune**: une recherche `site:ninja.dendrolag.fr` ne rend rien. Le nom « Neon Ninja » est déjà pris par d'autres jeux (itch.io).      |
| Titre de la page                              | « Neon Ninja », deux mots qui ne disent pas ce qu'est le jeu                                                                            |
| `robots.txt`, `sitemap.xml`                   | Absents (404)                                                                                                                           |
| Adresse canonique                             | Aucune. **Défaut**: `neon-ninja-jeu.vercel.app` sert la même page, deux adresses pour un même contenu                                   |
| Aperçu d'un lien partagé (Open Graph, cartes) | Aucun: un lien collé dans une messagerie ne montre ni image ni texte choisi                                                             |
| Données structurées                           | Aucune                                                                                                                                  |
| Contenu sans exécuter le jeu                  | Un élément vide et « Neon Ninja a besoin de JavaScript pour fonctionner. »: un robot qui n'exécute pas le code ne lit rien              |
| Lighthouse 12, en téléphone                   | Référencement 100 (il ne vérifie que les bases), bonnes pratiques 100, accessibilité 87                                                 |
| Accessibilité                                 | **Défaut**: sur téléphone, le bouton « Se connecter » de l'en-tête perd son texte, caché par la feuille de style, et n'a plus aucun nom |

L'outil PageSpeed Insights de Google n'a pas répondu (quota anonyme épuisé): la mesure est faite par Lighthouse, le même moteur, lancé en local contre la page en ligne. La Search Console de Google et les outils pour webmasters de Bing demandent de prouver la propriété du domaine avec un compte du porteur du projet: hors de portée d'une session, ils sont proposés au porteur du projet en fin d'étape.

## Décisions prises par cette fiche

1. **Une seule adresse canonique, `https://ninja.dendrolag.fr/`.** Elle est déclarée dans la page, et l'alias `neon-ninja-jeu.vercel.app` y renvoie par une redirection permanente, posée dans la configuration Vercel que la mise en ligne écrit déjà. Les adresses propres à chaque déploiement ne sont pas redirigées: elles servent au diagnostic.
2. **Titre**: « Neon Ninja, jeu multijoueur gratuit dans le navigateur ». Le nom seul est pris par d'autres jeux: le titre dit ce que le jeu est et ce qu'on cherche pour le trouver. Ponctuation du porteur du projet, sans deux-points ni tiret. À relire par le porteur du projet.
3. **La description reste celle de l'étape 4.5**, déjà à la bonne longueur.
4. **Un contenu lisible sans exécuter le jeu**: `#application` contient une présentation statique, le nom, ce qu'est le jeu, le titre et l'accroche de l'accueil, et les cinq modes avec leur texte. L'application la remplace en se montant. Elle sert aussi d'écran de chargement, à la place d'une page vide pendant que le code arrive. Les textes des modes restent ceux de `TEXTES_DES_MODES`: un test vérifie que la page statique les reprend mot pour mot, la source reste unique.
5. **L'image d'aperçu est une vraie scène de jeu**, Tokyo avec 250 PNJ, sans l'interface, en 1200 par 630 pixels et en JPEG léger. Elle est produite une fois, en local, et versionnée avec la page (`page/icones/apercu.jpg`).
6. **Données structurées** en JSON-LD: un `WebSite` et un `VideoGame` (nom, adresse, description, image, langue, genre, mode multijoueur, plateforme navigateur, gratuit). Un bloc de données n'est pas un script exécuté: la politique de sécurité du contenu n'a pas à changer.
7. **`robots.txt` autorise tout et désigne le plan du site; `sitemap.xml` ne liste que la page d'accueil**, seule adresse du jeu. Pas de date de modification inventée.
8. **L'adresse canonique est écrite une fois dans le code** (la sortie Vercel), et en clair dans les fichiers statiques de la page. Un test vérifie que la page, le fichier des robots, le plan du site et l'adresse publique de la CI disent la même.

## Périmètre

1. `packages/client/page/index.html`: titre, adresse canonique, Open Graph, carte Twitter, JSON-LD, présentation statique.
2. `packages/client/page/robots.txt`, `sitemap.xml`, `icones/apercu.jpg`, recopiés par l'empaqueteur.
3. Styles de la présentation statique.
4. L'application remplace le contenu de `#application` au lieu de s'y ajouter.
5. Sortie Vercel: redirection permanente de l'alias `vercel.app` vers l'adresse canonique.
6. Défaut d'accessibilité du bouton « Se connecter » sur téléphone (règle 7).
7. `docs/deploiement.md`, section « Ce qui tourne où »: l'alias redirige.

## Hors périmètre

- La Search Console et les outils de Bing: ils demandent un compte du porteur du projet (voir « Après l'étape »).
- Des pages supplémentaires (règles, modes) pour élargir ce qui s'indexe: une décision de contenu du porteur du projet.
- Le zoom de la page, bloqué à la demande du porteur du projet le 18 septembre 2026: Lighthouse le signale, c'est une décision assumée.
- L'allègement du rendu (étape 5.7).

## Tests requis

- La page statique: titre, description, adresse canonique, Open Graph et carte avec l'image d'aperçu en adresse absolue, JSON-LD valide avec les champs attendus.
- La présentation statique reprend le nom et le texte de chaque mode, tels que `TEXTES_DES_MODES` les donne.
- `robots.txt` et `sitemap.xml`: forme attendue, adresse canonique.
- La même adresse canonique partout, et égale à `PAGE_DU_JEU` de la CI.
- L'application monte sur un hôte qui contient déjà la présentation, et la remplace.
- La configuration Vercel redirige l'alias et lui seul, en redirection permanente, avant les fichiers.
- Le bouton « Se connecter » a un nom accessible sans son texte.
- L'empaqueteur recopie `robots.txt`, `sitemap.xml` et l'image d'aperçu.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Vérifié dans le navigateur: la présentation s'affiche puis laisse place à l'accueil, aucune erreur dans la console (JSON-LD compris sous la politique de sécurité).
2. Mesure après, sur la page en ligne: `robots.txt` et `sitemap.xml` servis, alias redirigé, Lighthouse relancé, données structurées lues par un validateur.
3. Suite Vitest complète, types, linter, formatage et bout en bout verts; CI verte, page en ligne.

## Après l'étape, pour le porteur du projet

Déclarer le domaine dans la Google Search Console et dans Bing Webmaster Tools, soumettre le plan du site, puis suivre l'indexation et les requêtes. C'est la seule mesure qui dise si le jeu remonte, et elle prend des semaines.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-6-handoff.md. Prochaine action exacte: l'étape 5.7, allègement du rendu, dont la fiche se rédige au début de la session. Commiter.
