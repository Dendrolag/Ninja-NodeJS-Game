# Fiche étape 5.13 - La production sur Oracle, Render en secours

Brief de session. Objectif unique: **faire jouer la production sur le serveur de jeu Oracle**, la page publique `ninja.dendrolag.fr` joignant `serveur.ninja.dendrolag.fr`, sur la base de production, **Render gardé en secours**, à la même version, avec un retour vers lui en une commande.

## Origine de cette fiche

Décision du porteur du projet du 5 octobre 2026, à la lecture des mesures de l'étape 5.9 (section 26 de `docs/mesures/charge-serveur.md`): basculer dès maintenant sans décommissionner Render, les performances d'Oracle étant meilleures. Rédigée dans la conversation de l'étape 5.9, à partir de son handoff, de `docs/deploiement.md` et de l'état du dépôt au commit `ad39258`.

## Ce qu'on sait en entrant

- **La machine Oracle tourne et se met à jour par la CI** (étape 5.9): `deploiement/oracle.ts`, emplacements bleu et vert, Caddy, certificat, `MANDATAIRES_DE_CONFIANCE=1` mesuré. Elle sert aujourd'hui la page d'essai et la branche Neon `essai-oracle`.
- **Les mesures**: aucun battement en retard sur Oracle là où Render en avait trois; un processus tient 24 parties pleines; sous 300 Mo; 10 To sortants gratuits. Et surtout, **Oracle ne s'endort pas**: Render gratuit met 15 à 60 secondes à se réveiller après quinze minutes sans visite.
- **Le risque connu**: Oracle reprend une machine gratuite jugée inactive sur sept jours (processeur, réseau et mémoire sous 20 pour cent). On ne saura qu'après la fin de l'essai gratuit de 30 jours, vers le 3 novembre 2026, si cela vise la nôtre. D'où Render en secours.
- **Le serveur refuse une page d'un autre commit**: le secours ne sert que s'il est à la version de la page en ligne.
- **La mise en ligne d'aujourd'hui** (`deploiement/deployer.ts`): page envoyée à Vercel sans promotion, serveur déployé sur Render et vérifié, page promue, page publique vérifiée.

## Décisions prises par cette fiche

1. **La page publique joint Oracle.** Elle est empaquetée avec `SERVEUR_DE_JEU=https://serveur.ninja.dendrolag.fr`; sa politique de sécurité n'ouvre qu'à lui.
2. **Oracle passe sur la base de production**: `/etc/neon-ninja/environnement` reçoit l'adresse de la branche `production` par le pooler, écrite par SSH sans jamais l'afficher. `ORIGINES_AUTORISEES=https://neon-ninja-jeu.vercel.app,https://ninja.dendrolag.fr`, `SERVIR_LA_PAGE=non`: une seule page publique, celle de Vercel. La page d'essai disparaît.
3. **La mise en ligne devient**: page envoyée sans promotion; serveur Oracle mis en ligne et vérifié (bleu et vert, comme en 5.9); page promue et vérifiée; **puis Render mis à la même version, sans bloquer**: s'il échoue, la production tourne quand même, et le journal le dit. Les deux serveurs migrent la même base, ce que les migrations tolèrent déjà (compatibles avec la version précédente, `docs/deploiement.md`). Le job « Essai sur Oracle » disparaît, fondu dans « Mise en ligne ».
4. **Le retour vers Render en une commande**, et l'aller vers Oracle de même: une mise en ligne de la page seule, empaquetée pour le serveur choisi, du commit déjà en ligne, puis promue et vérifiée. Lançable à la main et depuis GitHub (`workflow_dispatch`), pour basculer depuis un téléphone. **Essayée une fois dans chaque sens pendant l'étape.**
5. **La bascule elle-même**, dans cet ordre: Oracle passe sur la base de production et se remet en ligne; la page joignant Oracle est promue; Render reste en ligne, inchangé. Les parties en cours sur Render sont coupées par la promotion, comme par toute mise en ligne. Les comptes créés sur l'essai ne passent pas en production.
6. **Après la bascule**: la branche Neon `essai-oracle` est supprimée.

## Périmètre

- `deploiement/`: la nouvelle mise en ligne, la bascule d'un serveur à l'autre, leurs tests.
- `.github/workflows/ci.yml`: le job « Mise en ligne » et un déclenchement manuel de la bascule.
- La machine: les variables de production.
- La documentation: `docs/deploiement.md` (ce qui tourne où, la mise en ligne, le retour vers Render, la surveillance d'une machine reprise par Oracle), le ROADMAP.

## Hors périmètre

- Le passage du compte Oracle en « Pay As You Go »: seulement si la machine est reprise après la fin de l'essai gratuit, sur décision du porteur du projet.
- Une bascule automatique vers Render quand Oracle ne répond pas: à décider sur l'usage.
- La suppression de Render: il reste le secours.
- Plusieurs processus de serveur sur la machine: inutile au trafic d'aujourd'hui.
- Le son qui fait ramer l'iPhone: étape 5.12.

## Tests requis

- L'enchaînement de la mise en ligne: page non promue avant un serveur Oracle vérifié; un échec d'Oracle ne promeut rien; un échec de Render ne fait pas échouer la mise en ligne, et se dit.
- La bascule: la page empaquetée pour le serveur choisi, et lui seul dans sa politique de sécurité; un serveur choisi qui ne rend pas la version en ligne est refusé avant toute promotion.
- La suite unitaire complète, le bout en bout, et la CI verte.
- En production: la page publique joint Oracle (politique de sécurité, `app.js`), `/sante` d'Oracle rend le commit, une partie à plusieurs avec un compte est jouée, sa progression s'inscrit dans la base de production.

## Définition de terminé

1. `https://ninja.dendrolag.fr` joue sur Oracle, sur la base de production.
2. Render tourne au même commit, en secours.
3. Le retour vers Render et l'aller vers Oracle ont été faits une fois chacun, par la commande, et vérifiés.
4. Une partie à plusieurs avec un compte jouée en production, après la bascule.
5. `docs/deploiement.md` dit, pour une personne non technique, ce qui tourne où, comment revenir à Render et quand le faire.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-13-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. Version: invisible au joueur, sauf la fin de la mise en veille; à décider par la session (troisième chiffre au plus, sans note).
