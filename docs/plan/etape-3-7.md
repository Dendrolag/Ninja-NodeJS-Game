# Fiche étape 3.7 - Les succès, socle

Brief de session. Objectif unique: un compte débloque, à la fin d'une partie, les succès qui se déduisent de ses résultats enregistrés. Il les voit à l'écran de fin, au profil avec leur progression et leur rareté, et les autres comptes les voient sur sa fiche.

Fiche rédigée le 26 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.7 du ROADMAP (section 4), de l'étude `docs/design/etude-succes.md`, des décisions prises avec le porteur du projet au début de l'étape, du handoff 3.6 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.6, l'étude des succès, puis cette fiche. Au besoin: la fiche 3.3 (la progression de fin de partie), la fiche 3.5 (la fiche joueur) et la fiche 3.6 (les amis).

## Pourquoi

Les succès donnent un cap à qui joue déjà, récompensent la performance et apprennent le jeu (étude, sections 1 à 3). Le socle construit tout ce qui ne demande aucun relevé pendant la partie: les définitions, la table, l'attribution, le rattrapage des comptes existants et l'affichage. L'étape `3.8` y ajoutera les exploits de partie et les secrets.

## Décisions du porteur du projet (26 septembre 2026)

Prises au début de l'étape, sur les recommandations de l'étude (section 8).

1. **L'ordre**: `3.7` passe avant `2.8`, qui n'apporte rien au socle. `3.8` reste après `2.8`, qui fait exister « Rassembleur ». Ordre: `3.7`, `2.8`, `3.8`, puis `3.9`.
2. **La récompense**: un titre choisi parmi ses succès, affiché sous le pseudo au salon et sur la fiche. Il touche au contrat du salon, donc il fait une étape à part, `3.9`, après `3.8`. Rien ne s'en construit ici.
3. **La liste**: celle de l'étude, avec les ajustements de la relecture contre le schéma (décisions de conception 6 à 9). **Les seuils restent ceux de l'étude**: la production n'a que quelques semaines de résultats, sur peu de joueurs, ce qui ne calibre pas des délais d'une semaine ou d'un mois. La requête de calibration est livrée dans le script de mesure (décision 18), pour un recalibrage plus tard, qui ne coûtera qu'un commit.
4. **Le rattrapage**: oui, par un script idempotent lancé une fois à la mise en ligne.
5. **Les secrets**: trois, tous de source « partie », donc construits en `3.8`.
6. **« 1000 ninjas capturés » tous modes**: non, on s'en tient à la Horde (« Seigneur de la Horde », en `3.8`). `packages/sim` n'est pas touché.
7. **La mesure de rétention**: oui, par un script en lecture seule que le porteur du projet lance avant la fusion dans `master`, puis un mois après. Cette session n'a pas accès à la base de production.

## État du dépôt au départ (26 septembre 2026)

1. **La fin de partie s'enregistre en une transaction** (`enregistrerPartie`, `base/parties.ts`): la partie, un résultat par compte (placement, points, captures, Black Ninjas détruits, gains), la progression augmentée sous verrou. Un réessai sous le même identifiant de partie relit ce qui a été appliqué, sans rien compter deux fois. Le récapitulatif `progressionDeFin` part ensuite à chaque compte encore dans la partie.
2. **`resultats.captures` n'est pas que des captures**: c'est `joueur.captures` du moteur, qui compte les joueurs capturés en Horde, en Tactique et en Équipes, mais aussi les **proies infectées en Chasse** et les **joueurs tués en Massacre**. Les ninjas pris par un tir du Tactique n'y sont pas.
3. **Le placement en Équipes est celui de l'équipe** (`placeDansLesEquipes`): dans un deux contre deux, les perdants sont troisièmes, et une égalité place tout le monde troisième.
4. **Un abandon laisse un résultat**, dernier et à zéro point, sans que rien ne le distingue d'une partie finie dernier à zéro.
5. **La base ne garde que les points de ligue courants**, qui baissent. Le sommet atteint se reconstruit: chaque résultat garde la variation réellement appliquée, jamais sous zéro.
6. **L'XP ne vient que des parties**: en production, seul `enregistrerPartie` l'augmente. La somme des `xp_gagnee` vaut donc l'XP totale.
7. **Trois cartes et cinq modes** existent: « trois cartes différentes » et « cinq modes différents » valent aujourd'hui toutes les cartes et tous les modes, comme l'étude le voulait.
8. **La fiche joueur est un objet à champs nommés**, prévu pour recevoir les succès (fiche 3.5, décision 12), et la fenêtre une suite de sections.
9. **Les migrations s'appliquent au démarrage du serveur**, pendant que l'ancien tourne encore (`docs/deploiement.md`): une migration doit rester compatible avec la version précédente. Une table ajoutée l'est.

## Décisions de conception

Aucune n'a été soumise au porteur du projet: elles découlent de l'étude et des décisions ci-dessus. Chacune est signalée au handoff.

1. **Les définitions sont des données**, dans `packages/shared/src/succes.ts`: un identifiant stable en minuscules et tirets, jamais réutilisé, un nom, une description, un palier (Découverte, Habitué, Expert, Légende), un drapeau secret, une mesure et un seuil. La condition est « la mesure atteint le seuil »: une fonction pure, la même pour tous, que le serveur et le client lisent.
2. **Les mesures se tirent d'un parcours**: un pli pur, dans le paquet partagé, sur l'historique d'un compte partie par partie, dans l'ordre de fin. Une seule implémentation sert la fin de partie, le profil et le rattrapage, et se teste sans base. Pour chaque succès, le pli dit aussi la première partie où il a été atteint.
3. **L'attribution se fait dans la transaction de fin**, pour chaque compte de la partie: son historique complet est lu, plié, et tout succès atteint qui n'est pas encore enregistré s'inscrit, **daté de la partie où il a été atteint la première fois**. Le rattrapage est la même fonction, appliquée à tous les comptes. Conséquence: une fin de partie rattrape aussi tout succès oublié de ce compte, avec sa vraie date, et un rattrapage oublié ne retarde que les comptes qui ne jouent plus.
4. **L'écran de fin annonce les succès dont la partie d'origine est celle-ci**, et eux seuls. Un réessai d'enregistrement les relit par cet identifiant: il n'en annonce ni plus ni moins. Un joueur ancien qui joue avant le rattrapage voit ses anciens succès inscrits à leur date, mais pas annoncés.
5. **Un abandon compte**, comme le prévoit l'étude (section 5.4): son résultat s'enregistre, et rien ne le distingue en base. Les descriptions disent donc « Jouer » et non « Terminer », comme les parties jouées du profil.
6. **« Première prise » et « Pickpocket » comptent les prises dans tous les modes**: capturer, infecter ou éliminer un joueur (état du dépôt, point 2). La description le dit.
7. **« Meute » passe en 3.7**: trois proies infectées dans une même Chasse se lisent dans `resultats.captures` d'une partie Chasse.
8. **« Sur le podium » demande une victoire en Équipes**: ailleurs, les trois premiers d'une partie d'au moins quatre joueurs. En Équipes, où les perdants d'un deux contre deux sont troisièmes, seulement l'équipe gagnante.
9. **Les paliers de ligue se lisent au sommet atteint**, reconstruit par la somme des variations enregistrées: « Atteindre le palier Or » reste acquis quand les points redescendent.
10. **« Série » compte trois victoires d'affilée parmi les parties à plusieurs**: une partie jouée seul ne l'interrompt pas, une défaite ou un abandon l'interrompent.
11. **« Fidèle » compte les jours à l'heure de Paris**, calculés par la base.
12. **Les succès avec les amis lisent les amitiés actuelles**: parties jouées avec un ami d'aujourd'hui, ou devant lui, sur tout l'historique. Un succès obtenu le reste si l'amitié est retirée. Les égalités (coéquipiers d'Équipes, deux abandons) ne font devancer personne, comme au face-à-face de l'étape 3.6.
13. **La table `succes_debloques`** (`compte_id`, `succes`, `debloque_le`, `partie_id`), clé primaire sur le compte et le succès, en cascade sur le compte, `partie_id` mis à vide si la partie disparaissait. L'identifiant est un texte contrôlé par sa forme, pas un type énuméré: ajouter un succès ne demande pas de migration, et un identifiant que le code ne connaît plus est ignoré à la lecture.
14. **La rareté** est la part des comptes qui ont au moins une partie enregistrée et qui détiennent le succès, en pour cent entier, calculée à chaque lecture. « Moins de 1 % » plutôt que « 0 % » pour un succès détenu.
15. **Le profil** gagne une section « Succès », palier par palier: le nom, la description, la rareté, puis, obtenu, sa date, et sinon, grisé, et sa progression quand c'est un cumul (« 412 sur 500 »). Un succès secret non obtenu se lit « ??? », sans description ni progression. Le compte de succès obtenus s'affiche en tête (« 12 sur 29 »).
16. **La fiche joueur** gagne les succès obtenus, avec leur rareté, **sans leur date**: une date dirait quand le joueur a joué, ce que l'étude des amis réserve au profil (sa décision 7).
17. **L'écran de fin** gagne, dans le bloc de progression, les succès débloqués par la partie, puis le cumul le plus proche de son seuil (plus grande part faite, puis ordre des définitions): « Plus que 3 victoires pour Dix couronnes ». Rien pendant la partie.
18. **La mesure**: `pnpm base:mesurer`, en lecture seule sur la base de `DATABASE_URL`. Deux parties: la rétention (comptes actifs par semaine, et, par semaine de première partie, la part des comptes revenus sept jours ou plus après leur première partie), et la calibration (captures et Black Ninjas détruits par partie, victoires par compte, parties par semaine). La procédure et les relevés vont dans `docs/mesures/retention.md`.
19. **Le rattrapage**: `pnpm base:rattraper`, qui applique l'attribution à tous les comptes qui ont une partie, par lots, et dit combien de succès il a inscrits. Relancé, il n'inscrit rien.

## La liste construite ici

29 succès, tous de source « base ». Les descriptions exactes vivent dans `succes.ts`.

| Palier | Succès |
| --- | --- |
| Découverte | Premier pas (1 partie), Première prise (1 prise), Nettoyeur (1 Black Ninja), Reflet (1 partie en miroir), Sur le podium, Première couronne (1 victoire) |
| Habitué | Habitué (25 parties), Dix couronnes (10 victoires), Pickpocket (50 prises), Démineur (25 Black Ninjas), Touriste (3 cartes), Touche-à-tout (5 modes), Fidèle (7 jours), Recrue (niveau 5), Argent, En bande (10 parties avec un même ami) |
| Expert | Vétéran (100 parties), Cinquante couronnes (50 victoires), Série (3 victoires d'affilée), Solidaires (10 victoires en Équipes), Confirmé (niveau 20), Or, Meute (3 infections dans une Chasse), Rivalité (devant un même ami 10 fois) |
| Légende | Pilier (500 parties), Centurion (100 victoires), Grand chelem (une victoire dans 5 modes), Diamant, Légende (niveau 50) |

## Périmètre

1. **Paquet partagé**: `succes.ts` (définitions, parcours, mesures, première partie de chaque succès, succès le plus proche), les contrats: `ProfilDuCompte.succes`, `FicheJoueur.succes`, `ProgressionEnregistree.succes`.
2. **Base**: la table et sa migration `0009`, la lecture de l'historique d'un ou plusieurs comptes pour le pli, l'attribution, la rareté, le rattrapage, la mesure, et les deux commandes.
3. **Serveur**: l'attribution dans l'enregistrement de la fin, le récapitulatif de fin, le profil et la fiche.
4. **Client**: le bloc de fin, la section du profil, la section de la fiche, un pictogramme, les styles.
5. **Outils de test**: les comptes en mémoire appliquent le même pli.
6. **Aucun changement** de `packages/sim` ni des règles de jeu.

## Hors périmètre

- Les succès de source « partie » et les secrets: étape `3.8`.
- Le titre: étape `3.9`.
- Dire à un invité ce qu'il aurait débloqué avec un compte: l'étude le permettait, sans le demander. Rien ne l'annonce.
- Un recalibrage des seuils: après quelques mois de résultats.

## Tests requis

- TU du pli: chaque mesure sur des historiques construits à la main, chaque succès juste sous et juste sur son seuil, première partie de chaque succès, série interrompue ou non, podium en Équipes, sommet de ligue qui redescend, jours à Paris, amis.
- TU du succès le plus proche et de la rareté mise en forme.
- TI (base): table, contraintes, cascade. Attribution en fin de partie, datée de la partie d'origine, jamais deux fois. Réessai qui annonce les mêmes. Rattrapage idempotent, daté de la partie d'origine. Rareté, profil et fiche, mesure.
- TU du client: modèles de fin, du profil et de la fiche, et les écrans.
- Bout en bout: une première partie débloque « Premier pas », visible en fin de partie, puis au profil.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une première partie avec un compte débloque « Premier pas », annoncé en fin de partie et daté au profil, vérifié de bout en bout.
2. Le rattrapage, relancé, n'inscrit rien.
3. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-7-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP, le cadrage (profil) et l'étude des succès. Prochaine action exacte: l'étape `2.8`, la présence et les invitations entre amis. Commiter.
