# Handoff - Étape 5.6 Référencement

Date: 19 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Que le jeu puisse remonter dans les moteurs de recherche, et qu'un lien partagé montre un aperçu qui donne envie.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, avec une mesure avant sur la page en ligne (`docs/plan/etape-5-6.md`, commits `5c7eacb` et `79cec7b`).
- **Titre de la page**: « Neon Ninja, jeu multijoueur gratuit dans le navigateur ». Le nom seul est pris par d'autres jeux.
- **Une seule adresse**: `https://ninja.dendrolag.fr/`, déclarée canonique. L'alias `neon-ninja-jeu.vercel.app` y renvoie en 308, chemin compris, par une règle de la configuration Vercel que la mise en ligne écrit déjà.
- **`robots.txt`** (tout est permis, plan du site désigné) et **`sitemap.xml`** (la page d'accueil seule).
- **Aperçu d'un lien partagé**: Open Graph et carte Twitter, avec une vraie scène de jeu (Tokyo sous la pluie, 250 PNJ, sans l'interface, 1200 par 630, 130 Ko).
- **Données structurées** JSON-LD: un `WebSite` et un `VideoGame`.
- **Contenu lisible sans le code du jeu**: `#application` contient une présentation statique (titre de l'accueil, accroche, cinq modes avec leur texte), que l'application remplace en se montant. Elle sert aussi d'écran de chargement.
- **Défaut corrigé** (règle 7): sur téléphone, le bouton « Se connecter » de l'en-tête perdait son texte, caché par la feuille de style, et n'avait plus de nom pour un lecteur d'écran. Relevé par Lighthouse.
- **Vérifié dans le navigateur de Claude Code** (serveur local): présentation statique en bureau et en téléphone, puis l'accueil qui prend sa place, aucune erreur dans la console.

### Mesure avant et après, sur https://ninja.dendrolag.fr

| Ce qu'on regarde                           | Avant (`12ab3e8`)                        | Après (`c09a53a`)                                          |
| ------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| Titre                                      | « Neon Ninja »                           | « Neon Ninja, jeu multijoueur gratuit dans le navigateur » |
| `robots.txt`, `sitemap.xml`                | 404                                      | 200                                                        |
| Adresse canonique                          | aucune, alias servi en double            | déclarée, alias redirigé en 308                            |
| Aperçu d'un lien                           | aucun                                    | titre, texte, image 1200 par 630                           |
| Données structurées (validator.schema.org) | aucune                                   | `VideoGame` lu, 0 erreur, 0 avertissement                  |
| Texte sans exécuter le code                | une phrase                               | titre, accroche, cinq modes                                |
| Lighthouse 12 en téléphone                 | SEO 100, pratiques 100, accessibilité 87 | SEO 100, pratiques 100, accessibilité 94                   |
| Présence dans l'index (`site:`)            | aucune                                   | à suivre, voir « Problèmes connus »                        |

L'accessibilité ne monte pas à 100 à cause du zoom bloqué, décision du porteur du projet du 18 septembre 2026. PageSpeed Insights n'a pas répondu (quota anonyme épuisé): Lighthouse, son moteur, a été lancé en local contre la page en ligne.

## Fichiers créés ou modifiés

Commits `5c7eacb` et `79cec7b`: `docs/plan/etape-5-6.md` (créé, puis le nom exact de la phase 5).

Commit de l'étape (`c09a53a`):

- Page: `packages/client/page/index.html` (titre, canonique, Open Graph, JSON-LD, présentation statique), `page/robots.txt`, `page/sitemap.xml`, `page/icones/apercu.jpg`, `page/styles/presentation.css` (créés), `page/styles/principal.css` (import).
- Empaquetage et mise en ligne: `packages/client/scripts/empaqueter.ts` (recopie des nouveaux fichiers), `scripts/adresses.ts` (créé: adresse canonique et alias, sans dépendance pour être lus sous jsdom), `scripts/sortieVercel.ts` (redirection de l'alias).
- Interface: `packages/client/src/interface/application.ts` (remplace la présentation au lieu de s'y ajouter), `interface/composants/compte.ts` (étiquette du bouton « Se connecter »).
- Tests: `packages/client/scripts/referencement.test.ts` (créé); `scripts/sortieVercel.test.ts`, `src/interface/application.test.ts`, `application.comptes.test.ts`, `tests/e2e/navigation.spec.ts`.
- Documentation: `docs/deploiement.md` (l'alias redirige), `docs/design/README.md` (cinq entrées), `docs/plan/ROADMAP.md` (5.6 faite).

Commit de ce handoff: `docs/handoffs/etape-5-6-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: titre, description, canonique, Open Graph et taille réelle de l'image, JSON-LD; la présentation statique reprend le nom et le texte de chaque mode tels que `TEXTES_DES_MODES` les donne; robots et plan du site; la même adresse partout, égale à `PAGE_DU_JEU` de la CI; la redirection de l'alias, et d'aucune autre adresse, avant tout le reste; l'application remplace la présentation; le bouton « Se connecter » garde son nom. Bout en bout: la page sans JavaScript montre le titre et les cinq modes, les trois fichiers sont servis avec leur type, et avec le jeu la présentation disparaît sans erreur de console.
- Résultat: **2 414 tests Vitest** (unitaires et base) au vert; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **43 scénarios sur 43**.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- État de la CI: **`c09a53a` verte** (exécution 35450313881), « Types, linter et tests », « Bout en bout » et « Mise en ligne »: le référencement est en production.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md`: une seule adresse, le titre, la présentation sans le code, l'aperçu en vraie scène de jeu, le bouton « Se connecter ».

Écarts à la fiche:

1. L'adresse canonique vit dans `scripts/adresses.ts` et non dans `sortieVercel.ts`: ce dernier charge esbuild, qui refuse de se charger sous jsdom, où tourne le test de la page.
2. Le scénario de bout en bout ne vérifie pas le message `<noscript>`: Chromium, piloté avec JavaScript coupé, ne l'affiche pas. Le test unitaire de la page le couvre.

## Problèmes connus et dette

- **À faire par le porteur du projet**, hors de portée d'une session: déclarer `ninja.dendrolag.fr` dans la Google Search Console et dans Bing Webmaster Tools (preuve de propriété par un enregistrement DNS chez Hostinger), y soumettre `https://ninja.dendrolag.fr/sitemap.xml`, puis suivre l'indexation. C'est la seule mesure qui dise si le jeu remonte, et elle prend des semaines.
- **À relire par le porteur du projet**: le titre de la page, l'accroche de la présentation statique (« Jeu multijoueur gratuit en temps réel, dans le navigateur, sans inscription. Plusieurs modes, beaucoup de ninjas. ») et le texte de l'image (`og:image:alt`). Retouche dans `packages/client/page/index.html`; le titre est aussi vérifié par `referencement.test.ts` et `navigation.spec.ts`.
- Sans JavaScript, la présentation affiche à la fois « Chargement du jeu… » et le message qui demande JavaScript: la politique de sécurité interdit le style en ligne qui cacherait le premier. Cas rare, sans conséquence.
- L'image d'aperçu est faite à la main: à refaire si le décor de Tokyo change.

Repris du handoff 4.5, inchangé: textes de l'aide et du rappel du salon à relire; le rendu à 500 entités sur téléphone d'entrée de gamme (étape `5.7`); la densité de 300 et 500 PNJ à jouer; l'or du x4 proche de celui des Black Ninjas; l'équilibre de la prime de la Horde; le compteur de combo qui tombe au battement près; et la liste des points ouverts reprise du handoff 5.5.

## Prochaine action exacte

Dans une conversation neuve, sur `master`: ouvrir l'étape `5.7`, allègement du rendu. Sa fiche n'existe pas: la rédiger selon le cas de repli du PROTOCOLE à partir de l'entrée 5.7 du ROADMAP (section 4), de la mesure de l'étape 7.6 et de la section 17 de `docs/mesures/charge-serveur.md`.

## Étape suivante

Fiche à lire: aucune encore; celle de l'étape 5.7, allègement du rendu, à rédiger au début de la session.
