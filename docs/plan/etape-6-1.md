# Fiche étape 6.1 - Retrait du legacy

Brief de session. Objectif unique : faire de la réécriture la seule version du jeu, dans le dépôt comme en ligne, et retirer ce qui reste de la version d'origine.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 5.4 (`docs/handoffs/etape-5-4-handoff.md` : recette fonctionnelle, défauts corrigés), puis cette fiche. Pour la production (adresses, mise en ligne, exploitation) : le handoff de l'étape 5.3 et `docs/deploiement.md`.

## Réconciliation du 14 septembre 2026

La fiche d'origine prévoyait une **bascule progressive** des joueurs, palier par palier, avec retour arrière vers l'ancien monolithe. Le ROADMAP (écart 6 de la section 5) l'a écartée : la version d'origine n'a pas de joueurs en ligne, il n'y a rien à basculer. La fiche est réécrite en conséquence, lors de l'étape 5.3, qui a relevé ce qui reste en ligne de la version d'origine.

**Ce qui reste de la version d'origine, relevé le 14 septembre 2026** (à vérifier au début de la session, rien n'a été modifié depuis) :

- Render, service « To The Point » (`srv-csdsvh68ii6s73cna9k0`), offre gratuite, branche `master`, en ligne sur `https://to-the-point.onrender.com`, déployé le 9 avril 2025.
- Vercel, projets `ttp` et `neon-ninja`, reliés au dépôt, branche de production `master`, qui servent l'ancienne page (`ttp-eight.vercel.app`, `neon-ninja-gules.vercel.app`) depuis le 16 avril 2025. Depuis le 14 septembre 2026, leur étape de construction ignorée n'accepte que `master`.
- Le service Render « Neon Ninja » n'en fait plus partie : il a été repris à l'étape 5.3 pour le serveur de jeu de la réécriture.

## Réconciliation du 15 septembre 2026

Vérifié au début de la session : les trois ressources listées ci-dessus servaient toujours la version d'origine, au fichier près (`client.js` et `styles.css` identiques à ceux de `legacy/`). Le service « To The Point » n'avait plus de déploiement automatique ; les deux projets Vercel, eux, construisaient tout commit poussé sur `master` : ils devaient donc disparaître avant la fusion. Trois écarts, décidés avec le porteur du projet : la branche `reecriture` est supprimée après la fusion ; l'ancien sommet de `master` est archivé sous l'étiquette `v0.8.6` ; la documentation qui annonçait une fusion bloquée par une CI rouge est corrigée, la poussée directe étant gardée.

## Périmètre

1. **Le dépôt** : fusionner `reecriture` dans `master`, qui redevient la branche principale et celle de la production. Le dossier `legacy/` reste en archive de référence.
2. **La production** : le service Render du serveur de jeu et la CI (job « Mise en ligne ») suivent `master` au lieu de `reecriture` ; la page et le serveur continuent d'être mis en ligne ensemble et vérifiés.
3. **Le retrait** : arrêter puis supprimer le service « To The Point » et les projets Vercel `ttp` et `neon-ninja`, **avec l'accord explicite du porteur du projet** pour chaque suppression. Aucune donnée de comptes n'y vit : la base Neon n'est pas concernée.
4. **La documentation** : CLAUDE.md (base legacy de référence, branche de travail), PROTOCOLE.md (cadre permanent : branche `reecriture`, interdiction de toucher `master`), `docs/deploiement.md`.

## Hors périmètre

- Aucune nouvelle fonctionnalité.
- Aucune suppression de données : les comptes et la progression restent dans la base de production.

## Tests requis

- La CI est verte sur `master` après la fusion, mise en ligne comprise.
- La page et le serveur en production sont de la version du commit de fusion (route de santé, code de la page).
- Les anciennes adresses ne servent plus la version d'origine.

## Définition de terminé

Conditions de ROADMAP réunies, plus :

1. `master` porte la réécriture, et c'est elle que la production suit.
2. Plus aucune ressource en ligne ne sert la version d'origine.
3. CLAUDE.md, PROTOCOLE.md et `docs/deploiement.md` décrivent la nouvelle situation.

## Fin de la roadmap

Cette étape clôt la réécriture. Les fonctionnalités reportées (autres modes, dont la décision du 14 septembre 2026 fixe qu'ils viennent après le socle, pass de saison, skins, clans) peuvent désormais s'ajouter sur cette base, chacune comme un ajout couvert par des tests, sans refonte.

## Rituel de fin de session

Écrire `docs/handoffs/etape-6-1-handoff.md` : l'état final du dépôt et de la production, et ce qui a été retiré. Indiquer comme suite la reprise du backlog reporté, à planifier au même format de fiches et de handoffs. Commiter.
