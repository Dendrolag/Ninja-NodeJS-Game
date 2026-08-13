# Fiche étape 1.6 - Durcissement et autorité serveur

Brief de session. Objectif unique: rendre le moteur et son futur hôte insensibles aux entrées malveillantes ou aberrantes. Étape ajoutée, absente du plan d'origine.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.5, la section « Failles de sécurité » de docs/audit/AUDIT-EXISTANT.md, puis cette fiche.

Base legacy: master v0.8.6.

## Pourquoi cette étape existe

Le plan d'origine passait directement du cœur de simulation au réseau, sans jamais traiter la validation des entrées ni l'autorité du serveur. Or l'audit a relevé dans le legacy des failles exploitables par un simple client modifié.

La règle « caractériser sans corriger » de l'étape 0.2 est juste pour le gameplay et dangereuse pour la sécurité: appliquée ici, elle reviendrait à figer les failles dans les instantanés de référence, puis à les réimplanter fidèlement. **Les défauts de sécurité ne se caractérisent pas, ils se corrigent par conception.** C'est ce que fait cette étape.

Elle se place à la fin de la phase 1, avant l'exposition réseau (2.1 et 2.2), pour que le moteur soit déjà défendable au moment où on le branche.

## Objectif

Poser dans packages/sim et packages/shared les règles qui font que le moteur ne peut pas être mis dans un état incohérent par une entrée, quelle qu'elle soit, et définir les contrats de validation que la couche réseau appliquera en 2.2.

## Périmètre

### 1. Autorité sur le déplacement

Défaut du legacy: la vitesse d'un joueur est proportionnelle à son débit de messages, pas au temps écoulé. Le gestionnaire move (ligne 2604) applique un déplacement à chaque message reçu, sans aucune limite de fréquence. Un client qui émet mille messages par seconde se déplace cinquante fois plus vite qu'un joueur normal.

À faire: le déplacement est calculé **par le moteur, en fonction de dt**, à partir d'une intention de déplacement (une direction, éventuellement normalisée), et non d'un vecteur de déplacement fourni par le client. Plusieurs intentions reçues dans le même tick ne produisent pas plusieurs déplacements. Le déplacement maximal par unité de temps est borné par la vitesse du joueur, quoi qu'il arrive.

### 2. Ne rien croire de ce que déclare le client

Défaut du legacy: `data.speedBoostActive` et `data.isMobile` sont lus tels quels depuis le message du client et appliqués comme multiplicateurs de vitesse (1,7 et 2, cumulables à 3,4).

À faire: l'état des bonus est détenu par le moteur, jamais déclaré par le client. Le facteur mobile, s'il est conservé, est une caractéristique de session établie à la connexion, pas un champ de message. Règle générale: le message d'entrée d'un joueur ne contient que son intention, jamais son état.

### 3. Validation des entrées

À faire: définir dans packages/shared le schéma de validation de chaque entrée de jeu (bornes, types, valeurs admises), et le contrat de validation des données fournies par le joueur:

- Pseudo: longueur bornée, jeu de caractères contraint, normalisation. Aujourd'hui aucune validation n'existe, ni côté client (seul le vide est refusé) ni côté serveur.
- Message de chat: longueur bornée, et surtout **l'identité de l'auteur est celle de la session, jamais un champ du message**. Le legacy diffuse le champ nickname fourni par le client, ce qui permet d'écrire sous le nom de n'importe qui.
- Paramètres de partie: bornes sur la durée, le nombre de bots, les taux d'apparition, les durées d'effets. Un paramètre hors bornes est refusé, pas rogné en silence.

### 4. Séparation des données et de la présentation

Défaut du legacy: le pseudo est injecté dans du HTML par innerHTML à plusieurs endroits du client, ce qui permet d'exécuter du code chez tous les autres joueurs à la fin d'une partie.

À faire ici: poser la règle et la garantir côté données. Le moteur et les contrats transportent du texte, jamais du balisage. La règle d'échappement côté client est consignée pour l'étape 4.3, qui construira les écrans. Valider le pseudo à l'entrée ne dispense pas d'échapper à l'affichage: les deux sont exigés.

### 5. Contrat de limitation de débit

À faire: définir les limites par type d'entrée (fréquence maximale des intentions de déplacement, des messages de chat, des changements de paramètres), sous forme de données dans packages/shared. L'application effective revient à la couche réseau en 2.2, mais la règle et ses valeurs se décident ici, une fois, au même endroit.

## Hors périmètre

- Aucune authentification, aucun compte. C'est la phase 3.
- Aucune implémentation réseau. Les limites définies ici sont appliquées en 2.2.
- Aucune modération de contenu, aucun filtrage de mots. Hors sujet pour un jeu entre amis.
- Ne pas modifier legacy/.

## Tests requis

- TU: le déplacement produit par N intentions reçues dans un même tick est identique à celui produit par une seule. La vitesse ne dépend pas du nombre de messages.
- TU: une intention de déplacement de norme aberrante est ramenée à la vitesse autorisée.
- TU: un bonus déclaré par le client sans exister dans l'état n'a aucun effet.
- TU: chaque schéma de validation rejette les cas hors bornes, aux limites incluses.
- TU: un pseudo contenant du balisage est refusé ou normalisé, et jamais restitué tel quel.
- TU: un message de chat porte l'identité de la session, même si le message en déclare une autre.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La vitesse de déplacement dépend de dt et jamais du débit de messages.
2. Aucun champ d'état fourni par le client n'est cru par le moteur.
3. Chaque entrée de jeu a son schéma de validation dans packages/shared, testé aux bornes.
4. Les limites de débit sont définies en données, prêtes à être appliquées en 2.2.
5. Les tests de caractérisation de l'étape 0.2 restent au vert: le durcissement ne doit pas modifier le gameplay.

## Point de vigilance

Si un durcissement change un comportement de jeu observable (par exemple la vitesse réelle d'un joueur, parce que le legacy la calculait par message), c'est un écart légitime mais il doit être **mesuré, expliqué et consigné** dans le handoff, pas subi. Le legacy a connu au moins quatre corrections successives sur le réglage de la vitesse: c'est un point fragile, à traiter avec attention.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-6-handoff.md. Lister les règles de validation retenues, les limites de débit décidées, et tout écart de comportement mesuré par rapport au legacy. Prochaine action exacte pour l'étape 2.1: envelopper le moteur dans une GameRoom et un RoomManager. Commiter.
