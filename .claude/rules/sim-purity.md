# Règle - Pureté du cœur de simulation

Règle ciblée sur packages/sim. C'est l'invariant le plus important du projet. Le legacy était bloqué parce que son état et sa logique de jeu étaient mêlés au réseau, à l'horloge et à l'affichage. On ne reproduit pas cette erreur.

## L'invariant

packages/sim ne fait aucune entrée-sortie. C'est une bibliothèque de logique pure. Elle prend un état et des entrées, elle renvoie un nouvel état. Rien d'autre.

## Interdit dans packages/sim

- Importer socket.io ou tout code réseau.
- Importer express ou tout serveur web.
- Importer un module Node d'entrée-sortie (fs, http, net, et leurs variantes node:).
- Importer pixi.js ou toute bibliothèque d'affichage.
- Utiliser une API navigateur (window, document, et apparentés).
- Appeler Date.now() ou toute lecture directe de l'horloge.
- Appeler Math.random() ou toute source de hasard non maîtrisée.

## À la place

- Le temps est fourni en paramètre du moteur, sous la forme d'un delta (dt). La simulation ne lit jamais l'heure elle-même.
- Le hasard passe par le générateur à graine de packages/shared, fourni dans l'état ou en paramètre. Mêmes entrées, même sortie.
- Tout besoin d'entrée-sortie (charger, sauvegarder, envoyer) appartient à packages/server, qui appelle le moteur. Le moteur ne sait pas qu'un réseau ou une base existent.

## Pourquoi

Cette contrainte est ce qui rend le gameplay testable comme une fonction mathématique, rapide et reproductible. C'est elle qui permet la couverture élevée de packages/sim, la rejouabilité des parties, et plus tard le mode spectateur. Si on l'enfreint, on perd la testabilité et on retombe dans le monolithe.

## Comment c'est vérifié

L'enforcement est automatique via le linter sur packages/sim (règles no-restricted-imports pour les bibliothèques et modules interdits, no-restricted-properties pour Date.now et Math.random). Un import interdit fait échouer le linter, donc la CI, donc bloque la fusion. Si le linter signale une violation, la correction n'est jamais d'assouplir la règle. C'est de déplacer l'entrée-sortie vers packages/server et d'injecter ce dont le moteur a besoin.
