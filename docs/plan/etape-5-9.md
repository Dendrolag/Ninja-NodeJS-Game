# Fiche étape 5.9 - Le serveur de jeu à l'essai sur Oracle Always Free

Brief de session. Objectif unique: **faire tourner le serveur de jeu sur une machine Oracle Always Free, à côté de Render, et le jouer à l'essai**, sans rien changer pour les joueurs de la production et sans aucun risque de facture. La bascule de la production n'est pas dans cette étape: elle se décide sur les résultats de l'essai.

## Origine de cette fiche

Issue de l'étude `docs/design/etude-combat-survie-et-carte-geante.md` (sections 2.6 et 2.6 bis). Le porteur du projet a précisé le 3 octobre 2026 que toutes les idées de l'étude servent une Battle Royale, sur un hébergement gratuit; l'offre gratuite de Render ne la tient pas (un dixième de processeur, 512 Mo, une bande passante comprise dite tombée à 5 Go par mois). Le 4 octobre 2026, il a accepté d'essayer Oracle Always Free **sans décommissionner Render**, et demandé **un garde-fou posé tout de suite contre toute facture surprise**.

Rédigée selon le cas de repli du PROTOCOLE, à partir de l'étude, de `docs/deploiement.md` et de l'état du dépôt au commit `e5c77ad`.

## Ce qu'on sait en entrant

- **Le code du jeu ne dépend pas de Render.** Seuls `deploiement/deployer.ts` (l'interface de Render), le job « Mise en ligne » de `.github/workflows/ci.yml` et `docs/deploiement.md` le nomment.
- **La production n'a pas de souci de bande passante aujourd'hui**: relevé de l'interface de Render le 4 octobre 2026, 90 Mo sortants en septembre, 14 Mo du 1er au 4 octobre, pic de 8,5 Mo en une heure le 29 septembre.
- **Oracle Always Free** (à vérifier dans la console au moment de créer): une machine Arm Ampere A1, 4 cœurs et 24 Go, ou 2 et 12 si la réduction annoncée pour juin 2026 est réelle; 200 Go de disque; 10 To sortants par mois. Les ressources gratuites ne vivent que dans la **région d'origine**, choisie à l'inscription et définitive.
- **Une machine gratuite jugée inactive est récupérée**: moins de 20 pour cent de processeur au 95e centile, de réseau et de mémoire sur sept jours. Un compte « Pay As You Go » n'y est pas soumis, mais sa facturation est ouverte.
- **Oracle n'a pas de plafond de dépense automatique.** Les quotas empêchent de créer une ressource payante; les budgets ne font qu'alerter.

## Le garde-fou contre les factures, en trois couches

1. **Pas de facturation ouverte pendant l'essai.** Le compte reste en offre gratuite: un compte gratuit ne peut rien facturer, Oracle refuse simplement ce qui dépasse. C'est le garde-fou le plus sûr. Le passage en « Pay As You Go » ne se fait qu'à la bascule, et seulement si l'essai montre que la machine est récupérée.
2. **Des quotas posés avant toute ouverture de la facturation**, sur la location entière: zéro partout, sauf la machine A1 dans les limites gratuites, le disque dans les 200 Go, et le réseau gratuit. Une ressource payante devient alors impossible à créer, même par erreur. Syntaxe exacte à prendre dans la documentation d'Oracle (« Quota Policy Syntax », « Sample Quotas ») et à vérifier dans la console.
3. **Un budget d'un euro avec deux alertes par courriel**, dépense réelle au premier centime et dépense prévue au-delà d'un euro, posé lui aussi avant toute ouverture de la facturation.

Ce qui resterait payant après ces trois couches: un trafic sortant au-delà de 10 To par mois. Une Battle Royale de 30 joueurs jouée sans interruption tout le mois en écrirait environ 1 To.

## Préalables du porteur du projet

Claude ne crée pas de compte et ne saisit aucune donnée de carte bancaire. À faire avant la session, ou pendant, guidé:

1. Créer le compte Oracle Cloud Free Tier, avec **Francfort (Germany Central) comme région d'origine**. Paris a été considéré et écarté le 4 octobre 2026: depuis le poste du porteur du projet, un aller-retour vers Paris prend 20 ms et vers Francfort 28 ms, soit 8 ms gagnés, peu au regard des irrégularités de plus de 100 ms du réseau mobile (audit 8.5); mais la base Neon est à Francfort, à un aller-retour d'environ 10 ms de Paris pour chaque requête, et Francfort compte trois domaines de disponibilité contre un seul à Paris, donc plus de chances d'y trouver une machine A1 gratuite libre. La carte bancaire sert à vérifier l'identité: une autorisation temporaire, levée par la banque sous trois à cinq jours, sans débit.
2. Créer une paire de clés SSH pour la machine, et donner à la session la clé publique.
3. Ajouter chez Hostinger une entrée DNS de type A, par exemple `serveur.ninja.dendrolag.fr`, vers l'adresse publique de la machine, quand la session la donne.

## Décisions prises par cette fiche

1. **Render reste la production pendant toute l'étape.** Rien de ce que voient les joueurs ne change: la page publique continue de joindre `neon-ninja.onrender.com`.
2. **L'essai se joue sur une page non promue**, envoyée à Vercel comme la mise en ligne le fait déjà avant sa promotion, mais construite pour joindre le serveur Oracle. Son adresse propre sert à jouer l'essai.
3. **L'essai a sa propre base**: une branche Neon `essai-oracle` copiée de la production, pour que rien de l'essai ne s'écrive dans les vraies données.
4. **Le serveur tourne dans une image Docker**, derrière Caddy, qui obtient et renouvelle seul le certificat de `serveur.ninja.dendrolag.fr`. Redémarrage automatique s'il tombe, mises à jour de sécurité automatiques du système.
5. **La mise en ligne d'essai est un job de CI à part, qui ne bloque rien**: s'il échoue, la production part quand même sur Render.
6. **`MANDATAIRES_DE_CONFIANCE` vaut 1 derrière Caddy**, à mesurer par la procédure de `docs/deploiement.md`.

## Périmètre

- La machine: système, pare-feu (liste de sécurité d'Oracle et règles de la machine), Docker, Caddy, le service du serveur.
- `deploiement/`: une cible Oracle à côté de la cible Render, et ses tests.
- `.github/workflows/ci.yml`: le job d'essai, ses secrets (clé SSH, adresse de la machine).
- Les mesures: le banc de charge sur la machine Arm, la régularité du battement sur `/sante`, un relevé `?diagnostic=1` depuis un téléphone, comparés à Render.
- La documentation: `docs/deploiement.md`, l'étude, le ROADMAP.

## Hors périmètre

- La bascule de la production vers Oracle, et le passage en « Pay As You Go »: une décision du porteur du projet sur les résultats de l'essai, puis une étape à part.
- Toute règle de jeu, `packages/sim`, la page.
- La suppression du service Render: il reste, en production pendant l'essai, en secours ensuite.

## Tests requis

- La cible Oracle de `deploiement/`: étapes, vérification de `/sante`, refus d'une version qui ne répond pas, conservation de l'ancien serveur tant que le nouveau n'a pas répondu.
- La page d'essai joint le serveur Oracle, et lui seul, dans sa politique de sécurité du contenu.
- La suite unitaire complète, et la CI verte sur la production Render inchangée.

## Définition de terminé

1. Le serveur tourne sur Oracle, en HTTPS sur `serveur.ninja.dendrolag.fr`, à la version du dernier commit de `master`.
2. Les trois couches du garde-fou sont posées et vérifiées dans la console.
3. Une partie à plusieurs a été jouée sur la page d'essai, compte compris.
4. Le banc de charge et la régularité du battement sont mesurés sur la machine, et comparés à Render dans `docs/mesures/charge-serveur.md`.
5. La machine a tourné au moins sept jours, pour savoir si Oracle la récupère.
6. `docs/deploiement.md` dit ce qui tourne où, comment mettre à jour la machine et comment revenir en arrière, pour une personne non technique.

Le point 5 dépasse une session: l'étape peut se clore sur les points 1 à 4 et 6, avec un handoff partiel, et se reprendre pour le constat des sept jours.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-9-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. Poser au porteur du projet la question de la bascule, avec les mesures.
