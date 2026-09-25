/**
 * Ce que la route de sante du serveur dit de ses battements (etape 8.6).
 *
 * PARTAGE PARCE QUE DEUX PAQUETS LE LISENT. Le serveur le calcule et l'expose par
 * `/sante`; le releve de performance de la page le recopie a cote du sien, pour qu'on
 * lise dans un meme texte ce que le serveur a envoye et ce que le telephone a recu.
 *
 * LA PAGE NE CROIT PAS LE RESEAU SUR PAROLE. Une reponse qui n'a pas exactement cette
 * forme est ecartee par lireLeResumeDuBattement, comme toute donnee venue d'ailleurs.
 */

/** Une repartition de durees, en millisecondes, arrondies au dixieme. */
export interface Repartition {
  readonly mediane: number;
  readonly p90: number;
  readonly p99: number;
  readonly max: number;
}

/** Ce que le serveur dit de ses battements recents, toutes parties confondues. */
export interface ResumeDuBattement {
  /** La fenetre observee, en secondes. */
  readonly fenetreS: number;
  /** Le nombre de battements dans la fenetre, toutes parties confondues. */
  readonly battements: number;
  /** L'ecart reel entre deux battements d'une meme partie, cinquante millisecondes vises. */
  readonly ecart: Repartition;
  /** Les ecarts d'au moins deux battements. */
  readonly enRetard: number;
  /** Le temps d'un battement: moteur, projection, codage et envoi. */
  readonly duree: Repartition;
}

/**
 * Le resume des battements lu dans une reponse de la route de sante.
 *
 * @returns Le resume; null quand le serveur dit qu'aucune partie n'a battu; undefined
 *          quand la reponse n'a pas la forme attendue.
 */
export function lireLeResumeDuBattement(reponse: unknown): ResumeDuBattement | null | undefined {
  if (!estUnObjet(reponse) || !('battement' in reponse)) {
    return undefined;
  }

  const battement = reponse['battement'];

  if (battement === null) {
    return null;
  }

  if (
    !estUnObjet(battement) ||
    !estUnNombre(battement['fenetreS']) ||
    !estUnNombre(battement['battements']) ||
    !estUnNombre(battement['enRetard']) ||
    !estUneRepartition(battement['ecart']) ||
    !estUneRepartition(battement['duree'])
  ) {
    return undefined;
  }

  return {
    fenetreS: battement['fenetreS'],
    battements: battement['battements'],
    enRetard: battement['enRetard'],
    ecart: repartitionDe(battement['ecart']),
    duree: repartitionDe(battement['duree']),
  };
}

/** Un objet ordinaire, lisible par cle. */
function estUnObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

/** Un nombre fini. */
function estUnNombre(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur);
}

/** Une repartition complete. */
function estUneRepartition(valeur: unknown): valeur is Repartition {
  return (
    estUnObjet(valeur) &&
    estUnNombre(valeur['mediane']) &&
    estUnNombre(valeur['p90']) &&
    estUnNombre(valeur['p99']) &&
    estUnNombre(valeur['max'])
  );
}

/** Une repartition recopiee, sans rien d'autre que ses quatre valeurs. */
function repartitionDe(valeur: Repartition): Repartition {
  return { mediane: valeur.mediane, p90: valeur.p90, p99: valeur.p99, max: valeur.max };
}
