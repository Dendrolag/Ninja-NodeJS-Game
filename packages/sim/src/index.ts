/**
 * Point d'entree du coeur de simulation.
 *
 * INVARIANT: ce paquet ne fait aucune entree-sortie. Pas de reseau, pas de DOM,
 * pas de Date.now(), pas de Math.random(). Le temps arrive par dt, le hasard par
 * le generateur a graine de @neon-ninja/shared.
 *
 * La regle complete est dans .claude/rules/sim-purity.md, et le linter la fait
 * respecter automatiquement. Si le linter signale une violation, la correction
 * n'est jamais d'assouplir la regle: c'est de deplacer l'entree-sortie vers
 * packages/server et d'injecter ce dont le moteur a besoin.
 *
 * Le contenu reel (modele d'etat, contrat tick) arrive a l'etape 1.1.
 */

export {};
