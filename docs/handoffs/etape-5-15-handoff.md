# Handoff - Étape 5.15 La fluidité des parties, surveillée en direct

Date: 12 octobre 2026
Auteur: session Claude Code
Statut: partielle. Code, tests, configuration et documentation faits, mis en ligne le 12 octobre 2026 (`58c74a5`), avec Among Ninjas (7.20 à 7.24); agent Alloy et import Grafana faits par le porteur du projet. Restent les essais en production de la définition de terminé.

## Objectif de l'étape

Voir en direct, dans un tableau Grafana Cloud gratuit, si les parties en production sont fluides, être prévenu en deux à trois minutes d'une latence, d'une saccade ou d'une baisse de performance, et savoir où elle naît (serveur, réseau ou page), sans alourdir le jeu. Fiche: `docs/plan/etape-5-15.md`.

## Ce qui a été fait

- **Lot A, le serveur mesure.** Un module de métriques à nous (`packages/server/src/metriques/registre.ts`): compteurs, jauges, histogrammes à cases fixes, format texte de Prometheus, étiquette `version` commune, rien d'alloué à l'observation. `SurveillanceDuJeu` (`packages/server/src/surveillance/`) compte chaque battement et ses quatre phases (moteur, vues, codage, envoi), les octets et la taille des trames, la file d'envoi de chaque connexion, les reconnexions, le ramasse-miettes, la boucle d'événements, la mémoire et le processeur; écrit dans le journal (lignes JSON sur la sortie standard) les épisodes du serveur et la ligne de chaque partie toutes les dix secondes, avec son verdict; plafond d'un épisode par partie ou par joueur et par minute, soixante en tout. Route `/metriques` sur un second port, `127.0.0.1` seulement, ouverte si `PORT_DES_METRIQUES` est posée.
- **Lot B, la page rend compte.** `SondeDeSurveillance` (`packages/client/src/diagnostic/surveillance.ts`) branchée sur la boucle, dans toutes les parties: cases de durée d'image, images lentes et très lentes, temps des images lentes (notre code, PixiJS, le reste), instantanés en retard, images tenues, allers et retours (accusé de la sonde toutes les cinq secondes), personnages, son, erreurs. Rien avant le lever de l'écran de préparation, rien onglet caché. Bulletin toutes les dix secondes, codé en tableau de nombres (une centaine d'octets), description de l'appareil une fois par minute. Contrat et vérification dans `packages/shared/src/surveillance.ts`; trois messages montants: `bulletin`, `appareil`, `sonde`.
- **Lot C, l'agent, Grafana, les alertes.** `deploiement/oracle/config.alloy` et `alloy-neon-ninja.conf` (un quart de cœur, 300 Mo), installés par `installer.sh`; `neon-ninja.sh` pose `PORT_DES_METRIQUES` (3101 bleu, 3102 vert). Tableau « Neon Ninja: fluidite » et dix alertes décrits en TypeScript dans `deploiement/grafana/`, importés par `importer.ts` (dossier, tableau, alertes évaluées chaque minute, courriel, politique de notification, vérifications de disponibilité), sans effet de bord à la relance. Workflow planifié `.github/workflows/production-a-jour.yml` (`deploiement/productionAJour.ts`): un commit qui touche le jeu ne doit pas attendre plus d'une heure; le secours Render vérifié une fois par jour.
- **Lot D, mesure et documentation.** Budget tenu (section 34 de `docs/mesures/charge-serveur.md`), harnais `pnpm charge --surveillance`, `tests/charge/ecriture-des-metriques.ts`; `docs/deploiement.md`, section « Surveillance », sous-section « La fluidité en direct, sur Grafana Cloud »: ce qui tourne, comment lire le tableau, que faire à chaque alerte, comment retrouver le contexte d'un épisode, la mise en place; `CLAUDE.md`: la variable et l'index.

## Fichiers créés ou modifiés

- Créés: `packages/server/src/metriques/registre.ts`, `packages/server/src/surveillance/surveillanceDuJeu.ts`, `journal.ts`, `verdict.ts`, `routeDesMetriques.ts`; `packages/shared/src/surveillance.ts`; `packages/client/src/diagnostic/surveillance.ts`, `surveillancePage.ts`; `deploiement/oracle/config.alloy`, `alloy-neon-ninja.conf`; `deploiement/grafana/requetes.ts`, `tableau.ts`, `alertes.ts`, `importer.ts`; `deploiement/productionAJour.ts`; `.github/workflows/production-a-jour.yml`; `tests/charge/ecriture-des-metriques.ts`; `tests/e2e/surveillance.spec.ts`; `docs/mesures/charge-serveur-5-15-*.json`.
- Modifiés: `packages/server/src/GameRoom.ts` (l'observateur du battement et le temps du moteur), `RoomManager.ts` (le transmet), `ServeurSocket.ts` (les phases de la diffusion, la file d'envoi, les trois messages, la reconnexion), `serveur.ts` (la route des métriques), `principal.ts` (`PORT_DES_METRIQUES`), `index.ts`; `packages/shared/src/evenements.ts`, `index.ts`; `packages/client/src/client.ts` (trois envois), `interface/ecrans/jeu.ts` (la surveillance de chaque partie), `diagnostic/diagnostic.ts` (`compterLesVisibles` exportée); `deploiement/oracle/installer.sh`, `neon-ninja.sh`; `deploiement/verifications.ts` (`deploiement/grafana/` hors du jeu); `tests/charge/charge.ts`, `charge-reseau.ts`, `clients.ts`; `tests/e2e/harnais/serveur-de-jeu.ts`; documentation: `docs/plan/etape-5-15.md` (réconciliation), `docs/plan/ROADMAP.md`, `docs/deploiement.md`, `docs/mesures/charge-serveur.md`, `CLAUDE.md`.
- Tests créés: `metriques/registre.test.ts`, `surveillance/journal.test.ts`, `ServeurSocket.surveillance.test.ts`, `packages/shared/src/surveillance.test.ts`, `packages/client/src/diagnostic/surveillance.test.ts`, `deploiement/grafana/importer.test.ts`, `deploiement/productionAJour.test.ts`; ajouts à `client.test.ts`, `deploiement/verifications.test.ts`, `tests/charge/charge-reseau.test.ts`.

## Tests

- Ajoutés: le module de métriques (cases, format texte, échappement, aucune allocation sur un million d'observations); le plafond et le verdict; le bulletin (aller et retour sur le fil, sept refus); la sonde de la page (cases, remise à zéro, onglet caché, écran de préparation, aucune allocation par image, navigateur et appareil); l'intégration du serveur (route absente sans port, sur 127.0.0.1 seulement et jamais sur le port public, chiffres d'une partie jouée, bulletins acceptés, trop fréquents, mal formés, trop gros, hors partie, un battement lent forcé et une page qui saccade dans le journal, la ligne de la partie et son verdict); Grafana (chaque métrique lue par le tableau et les alertes est écrite par le serveur, import relancé sans rien doubler); la production à jour; le bout en bout d'une partie qui envoie ses bulletins, bureau et téléphone.
- Résultat: unitaires et intégration, 4 193 au vert (262 fichiers); types des paquets, des tests et du bout en bout, linter et formateur: propres. Bout en bout complet, bureau et téléphone, trois à la fois: 103 au vert, 2 en échec sous la charge (la partie Among Ninjas à cinq, 3,4 minutes, et le lien perdu sur l'accueil, fragile depuis l'étape 5.4), tous deux au vert rejoués seuls.
- Couverture de packages/sim: inchangée, l'étape n'y touche pas.
- Empreinte des quatre parties de référence: identique, jeu et flux, avant et après l'étape.

## Décisions et écarts au plan

Douze écarts, consignés dans la section « Réconciliation » de la fiche. Les principaux: `PORT_DES_METRIQUES` posée par emplacement par `neon-ninja.sh` (deux conteneurs sur le réseau de la machine), tableau et alertes en TypeScript, bulletin en tableau de nombres, rien avant l'écran de préparation, deux alertes de version et deux de mémoire, Render vérifié par le workflow une fois par jour, la saccade du serveur provoquée par le test d'intégration et non en production.

## La première CI d'Among Ninjas, et ce qu'elle a corrigé

La poussée de `master` (43 commits, accord du porteur du projet) a d'abord échoué: le scénario Among Ninjas, qui n'avait jamais tourné en CI, ne s'arrêtait jamais à portée d'une station. La trace de la CI montrait chaque touche à deux secondes, et la page à une image par seconde, sans carte graphique. Rien n'était parti en ligne. Correctifs, commit `f120197`: la copie éteinte du cercle de vision se cuit une fois au lieu d'être filtrée à chaque image, la mini-carte n'écrit que ce qui change (272 ms par image, puis 165, en dessin logiciel; section 34.3 des mesures), et le scénario ouvre ses pages en 1000 sur 560. Deux tests d'allocation de cette étape, sensibles au bruit de la suite complète, ont été affermis (`b3a7f67`). La seconde CI est verte, mise en ligne comprise, Render au même commit.

Dans la même poussée, à la demande du porteur du projet: trois sons d'Among Ninjas (`58c74a5`, journal de conception du 12 octobre 2026), le gong des réunions, le son de la proie tuée, et l'alarme qui tourne pendant toute la surchauffe.

## Problèmes connus et dette

- **L'alarme de la surchauffe est au volume des boucles de bonus** (un cinquième des effets): à juger par le porteur du projet en jouant.
- **La configuration d'Alloy n'a pas été validée par Alloy lui-même**: aucun Alloy sur le poste. L'installation la relit; une erreur se lit dans `sudo journalctl -u alloy -n 50`.
- **Les seuils des alertes sont des points de départ**, à régler sur une semaine de production.
- **Les requêtes de disponibilité** lisent `probe_all_success_sum` et `probe_all_success_count` des vérifications de Grafana: si la pile les nomme autrement, l'alerte reste muette (« OK » sans données). À vérifier dans Explore une fois les vérifications posées.
- Dettes de 7.20 à 7.24 toujours ouvertes (handoff 7.24).

## Ce que le porteur du projet fait lui-même

**Fait le 12 octobre 2026**: le compte Grafana Cloud (pile en `eu-west-2`), l'agent Alloy installé et actif sur la machine Oracle, l'import du tableau, des dix alertes, du courriel et des deux vérifications de disponibilité (sortie de l'import sans erreur). Reste le point 3 ci-dessous.

Dans l'ordre, une fois le compte Grafana Cloud créé (guide donné dans la conversation, repris dans `docs/deploiement.md`, « Mettre en place »):

1. Écrire, hors du dépôt, `$HOME\alloy.env` (bloc d'exemple dans `docs/deploiement.md`), puis, dans PowerShell à la racine du dépôt:

   ```powershell
   $cle = "$HOME\.ssh\neon_ninja_oracle"; $connu = "deploiement/oracle/hote-connu"; $hote = "ubuntu@serveur.ninja.dendrolag.fr"
   scp -i $cle -o "UserKnownHostsFile=$connu" -r deploiement/oracle "${hote}:/tmp/oracle-5-15"
   scp -i $cle -o "UserKnownHostsFile=$connu" "$HOME\alloy.env" "${hote}:/tmp/alloy.env"
   ssh -i $cle -o "UserKnownHostsFile=$connu" $hote "sudo install -m 600 -o root -g root /tmp/alloy.env /etc/neon-ninja/alloy && sudo sed -i 's/\r$//' /etc/neon-ninja/alloy && rm /tmp/alloy.env && sudo sed -n 's/.*restrict //p' /home/deploiement/.ssh/authorized_keys > /tmp/cle-ci.pub && sudo bash /tmp/oracle-5-15/installer.sh /tmp/cle-ci.pub && rm -rf /tmp/oracle-5-15 /tmp/cle-ci.pub"
   ssh -i $cle -o "UserKnownHostsFile=$connu" $hote "systemctl is-active alloy; sudo journalctl -u alloy -n 30 --no-pager"
   Remove-Item "$HOME\alloy.env"
   ```

2. Importer le tableau et les alertes, dans PowerShell à la racine du dépôt, jetons hors du dépôt:

   ```powershell
   $env:GRAFANA_URL = "https://<pile>.grafana.net"; $env:GRAFANA_JETON_IMPORT = "<jeton du compte de service>"; $env:COURRIEL_DES_ALERTES = "<courriel>"
   $env:GRAFANA_SM_URL = "<adresse de l'API Synthetics, page Config>"; $env:GRAFANA_SM_JETON = "<jeton Synthetics>"
   pnpm exec tsc --build packages/shared; node deploiement/grafana/importer.ts
   ```

3. Décider de la mise en ligne (ci-dessous), puis jouer une partie en production sur ordinateur et sur téléphone, et essayer chaque alerte (`docs/deploiement.md`, « Mettre en place », point 5).

## État de la CI et de master

`master` poussé jusqu'à `58c74a5`, CI verte (exécution 38264706970), mis en ligne sur Oracle, Render au même commit, page publique en service.

## Prochaine action exacte

Le porteur du projet joue une partie en production, sur ordinateur et sur téléphone (Among Ninjas se lance seul avec quatre joueurs fictifs: une partie privée créée dans la page, puis `node tests/outils/joueurs-fictifs.mjs https://serveur.ninja.dendrolag.fr <code> 4`, qui présente désormais la version du serveur); la session suivante vérifie dans Grafana que le tableau la montre (verdict, battement et ses phases, joueurs chez eux, ligne de la partie), que `neon_demarrage_secondes` porte la version `58c74a5` (preuve que la route des métriques est ouverte), relève les séries actives et l'agent sur 24 heures (section 34.4 des mesures), fait déclencher chaque alerte une fois, provoque une saccade réseau et une saccade page, puis clôt l'étape.

## Étape suivante

`5.16`, l'usage et l'adoption, une fois la définition de terminé de `5.15` atteinte en production; ou `7.25` et `7.26`, selon le porteur du projet.
