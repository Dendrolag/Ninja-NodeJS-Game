# Handoff - Étape 5.9 Le serveur de jeu à l'essai sur Oracle Always Free

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: partielle (points 1, 2, 4 et 6 de la définition de terminé faits; 3 et 5 en attente du porteur du projet et du temps)

## Objectif de l'étape

Faire tourner le serveur de jeu sur une machine Oracle Always Free, à côté de Render qui reste la production, le jouer à l'essai et le mesurer, sans risque de facture.

## Ce qui a été fait

- **Le garde-fou contre les factures, posé avant la machine, et vérifié**: compte resté en offre gratuite, politique de quotas `garde-fou-gratuit` (tout à zéro sauf la machine A1 gratuite et 200 Go de disque), budget d'un euro avec deux alertes. Les quotas sont actifs: ils ont refusé la première création de la machine (voir les décisions).
- **La machine**: `VM.Standard.A1.Flex`, 4 cœurs Arm et 24 Go, Ubuntu 24.04 Minimal aarch64, Francfort AD-2, adresse publique éphémère `92.5.46.188`, ports 80 et 443 ouverts dans la liste de sécurité du sous-réseau. Le porteur du projet l'a créée dans la console, guidé.
- **L'installation de la machine** par `deploiement/oracle/installer.sh`, lancé par SSH: pare-feu de la machine (80 et 443 avant le REJECT des images d'Oracle), mises à jour de sécurité automatiques avec redémarrage à 4h30 UTC, Docker et ses journaux tournants, Caddy, le compte `deploiement` de la CI, dont la clé ne peut lancer que `neon-ninja`.
- **Le nom et le certificat**: `serveur.ninja.dendrolag.fr`, entrée A chez Hostinger; certificat Let's Encrypt obtenu par Caddy, valable jusqu'au 2 janvier 2027, renouvelé seul.
- **La base de l'essai**: branche Neon `essai-oracle` (`br-misty-forest-b2pxtlgf`), copiée de la production le 4 octobre, avec son calcul de 0,25 unité. Les migrations s'y appliquent au démarrage du serveur.
- **La mise en ligne d'essai**: `deploiement/oracle.ts` envoie les sources du commit à la machine, qui construit l'image; le nouveau serveur démarre dans l'emplacement libre (bleu ou vert), Caddy ne bascule qu'une fois qu'il a rendu sa version, l'ancien ne s'arrête qu'après la vérification de l'adresse publique. Job « Essai sur Oracle » de la CI, qui ne bloque rien. Premier passage par la CI le 4 octobre, de bleu vers vert, commit `413a380`, deux minutes et demie.
- **`MANDATAIRES_DE_CONFIANCE=1` mesuré** derrière Caddy: l'adresse publique du poste avec et sans en-tête inventé.
- **Les mesures** (section 26 de `docs/mesures/charge-serveur.md`, bruts dans `docs/mesures/5-9/`): un cœur Arm vaut 0,6 cœur du poste de mesure; un processus tient 24 parties pleines (288 joueurs) et sature à 32, sous 300 Mo; sur le même iPhone, Tactique à 300 PNJ, Oracle n'a eu aucun battement en retard (pire écart 53 ms), Render trois (pire 205 ms).
- **Une partie jouée sur la page d'essai**, Tactique à 300 PNJ, seul, depuis l'iPhone: le serveur est régulier, mais la page rame avec le son (9,5 images par seconde) et pas sans (59,9). Devenu l'étape 5.12.
- **Défaut corrigé en route** (règle 7): la CI de `master` était rouge depuis `13f0dd9`. `ServeurSocket.poche.test.ts` dépendait du hasard: la mine, active par défaut depuis 7.11, se ramassait sur le chemin de la fumée, et une fumée pouvait apparaître sous le second joueur. Commit `6b11508`, 25 passages de suite au vert.
- **Documentation**: `docs/deploiement.md` dit ce qui tourne où pour l'essai, le garde-fou, la mise en ligne, l'administration de la machine, le retour arrière et l'arrêt de l'essai.

## Fichiers créés ou modifiés

- `deploiement/oracle/` (créé): `Dockerfile`, `Caddyfile`, `neon-ninja.sh` (les commandes de la machine), `installer.sh`, `hote-connu` (identité épinglée de la machine).
- `deploiement/oracle.ts` et `oracle.test.ts` (créés): l'enchaînement bleu et vert, et ses tests.
- `deploiement/verifications.ts` et son test: une page servie par le serveur de jeu ne doit joindre que son hébergement. `deploiement/deployer.ts`: trois fonctions exportées pour la cible Oracle.
- `packages/client/scripts/empaqueter.ts` et `empaqueter.test.ts` (créé): l'empaquetage lancé directement lit `VERSION_DU_JEU` et `HORODATAGE_DU_JEU`.
- `.github/workflows/ci.yml`: le job « Essai sur Oracle ». `.gitattributes` (créé): fins de ligne Unix pour `deploiement/oracle/`.
- `packages/server/src/ServeurSocket.poche.test.ts`: le test de la fumée ne dépend plus du hasard.
- `docs/deploiement.md`, `docs/plan/etape-5-9.md` (réconciliation), `docs/plan/ROADMAP.md` (5.9 et 5.12), `docs/mesures/charge-serveur.md` (section 26), `docs/mesures/5-9/` (créé), ce handoff.

Hors du dépôt: secret GitHub `ORACLE_SSH_KEY` (clé de la CI, copie locale effacée); clé d'administration `~/.ssh/neon_ninja_oracle` sur le poste du porteur du projet; `/etc/neon-ninja/environnement` sur la machine (adresse de la base, jamais affichée).

Aucune modification de `legacy/` ni de `tests/caracterisation/`, ni de `packages/sim`.

## Tests

- Ajoutés: l'enchaînement de la mise en ligne d'essai (ordre des commandes, première mise en ligne, attente du démarrage, ancien gardé si le nouveau ne répond pas ou rend une autre version, retour à l'ancien si l'adresse publique ne suit pas, refus d'une page ouverte à un autre serveur), les arguments de ssh, les sources envoyées; la page servie par le serveur; les options de l'empaquetage.
- Résultat: suite unitaire complète au vert (3 548 tests sans la base), dont 57 pour le déploiement et l'empaquetage.
- Couverture de packages/sim: inchangée, non touché.
- État de la CI: verte sur `413a380` (exécution 37229724269: tests, bout en bout, mise en ligne Render, essai Oracle) et sur `84aaede` (37274834435). Render et Oracle servent `413a380`, le dernier commit qui touche le jeu.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche.

- **La page d'essai est servie par le serveur Oracle lui-même**, et non par une page Vercel non promue: le projet Vercel protège toute adresse autre que son domaine public, la page n'aurait pu se jouer qu'avec un compte Vercel.
- **Les quotas rouvrent la machine A1 par des noms génériques** (`/*standard-a1*/`): la mise à zéro coupe aussi des quotas « régionaux » que la documentation ne cite pas.
- **Image Ubuntu Minimal pour Arm**: l'Ubuntu par défaut est pour Intel et AMD, et la console ne montre la machine A1 qu'avec une image Arm.
- **Le constat de récupération est repoussé après la fin de l'essai gratuit de 30 jours** (vers le 3 novembre 2026). Le compte Oracle cumule un essai de 30 jours (crédit d'environ 300 dollars) et l'offre Always Free, sans limite de durée, dont relève la machine. La récupération des machines inactives vise les comptes gratuits: un constat à sept jours, pendant l'essai, pourrait rassurer à tort. À la fin de l'essai, Oracle proposera de passer en « Pay As You Go »: ne pas le faire.
- **La lenteur du son sur l'iPhone devient l'étape 5.12**, trop grosse pour celle-ci, qui porte sur le serveur (règle 7). Le porteur du projet précise que ses relevés fluides de septembre étaient sans doute son coupé: le défaut peut être ancien.

## Problèmes connus et dette

- **Point 3 de la définition de terminé en attente**: une partie à plusieurs, connectée à un compte, sur https://serveur.ninja.dendrolag.fr. Seule une partie seule, sans compte, a été jouée.
- **Point 5 en attente**: la machine doit tourner au-delà de la fin de l'essai gratuit pour savoir si Oracle la récupère.
- **L'adresse publique est éphémère**: une machine recréée en reçoit une autre; il faut alors corriger l'entrée DNS et `deploiement/oracle/hote-connu`.
- **Un compte créé sur l'essai n'existe pas en production**, la base étant une copie figée au 4 octobre.
- **La question de la bascule de la production** est posée au porteur du projet avec les mesures; elle ne se tranche pas avant le point 5.

## Prochaine action exacte

Exécuter l'étape `5.13`, la production sur Oracle avec Render en secours, décidée par le porteur du projet le 5 octobre 2026 après les mesures: lire `docs/plan/etape-5-13.md`. Puis l'étape `5.12`, le son qui fait ramer l'iPhone. La partie à plusieurs avec un compte (point 3) se joue désormais en production, après la bascule, et compte pour les deux étapes. Vers le 10 novembre 2026, vérifier que la machine Oracle tourne toujours (`curl https://serveur.ninja.dendrolag.fr/sante`, état de l'instance dans la console) et clore la 5.9.

## Étape suivante

Fiche à lire: docs/plan/etape-5-13.md
