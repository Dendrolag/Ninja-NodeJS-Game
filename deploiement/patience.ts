/**
 * Reposer une verification jusqu'a ce qu'elle passe (etapes 5.9 et 5.13).
 *
 * Un hebergeur qui vient de changer de version peut encore servir l'ancienne
 * quelques secondes, et un serveur qui demarre ne repond pas tout de suite: une
 * verification qui echouerait au premier essai signalerait une panne qui n'existe
 * pas. L'attente est injectee, pour que les tests ne patientent pas.
 */

/** Combien de fois reposer une question, et a quel intervalle. */
export interface Rythme {
  readonly essais: number;
  readonly intervalleMs: number;
}

/**
 * Repose une verification jusqu'a ce qu'elle ne trouve plus rien, au rythme dit.
 *
 * @returns Les problemes du dernier essai, aucun si la verification a fini par passer.
 */
export async function problemesApresPatience(
  quoi: string,
  verification: () => Promise<readonly string[]>,
  rythme: Rythme,
  attendre: (ms: number) => Promise<void>,
): Promise<readonly string[]> {
  let problemes: readonly string[] = [];

  for (let essai = 1; essai <= rythme.essais; essai += 1) {
    try {
      problemes = await verification();
    } catch (erreur) {
      problemes = [
        `${quoi} ne repond pas: ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      ];
    }

    if (problemes.length === 0) {
      return [];
    }

    if (essai < rythme.essais) {
      await attendre(rythme.intervalleMs);
    }
  }

  return problemes;
}
