/**
 * Faire ecouter un serveur sans jamais garder un port que fetch et les navigateurs refusent.
 *
 * POURQUOI. Un serveur qui ecoute sur le port zero laisse le systeme choisir un port libre,
 * ce dont tous les tests se servent. Sous Linux, ce port est tire au-dela de 32768. Sous
 * Windows, la plage peut commencer a 1024, et le systeme peut alors rendre 6000 ou 6666.
 * Or fetch (undici, dans Node) et les navigateurs refusent de parler a une liste de ports
 * reserves a d'autres usages: la requete echoue en « bad port » avant meme de partir. Un
 * test passait ou echouait donc selon le port tire, comme le 19 octobre 2026 a l'etape 8.12.
 *
 * Quand le port demande est zero, on regarde donc celui que le systeme a choisi: s'il est
 * refuse, on ferme et on en redemande un autre. Un port demande explicitement est garde tel
 * quel: c'est un reglage, pas un tirage.
 */

import type { Server } from 'node:net';

/**
 * Les ports que fetch refuse, tels que la norme de fetch les liste (« bad port »). Chromium
 * refuse les memes. Le test de ce module verifie chacun contre le fetch de Node.
 */
export const PORTS_REFUSES: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

/** Le nombre de tirages au-dela duquel on renonce: dix refus de suite ne sont pas un hasard. */
export const TIRAGES_MAXIMUM = 10;

/** Les reglages de l'ecoute. */
export interface OptionsDEcoute {
  /** L'interface ou ecouter; absente, toutes. */
  readonly hote?: string;
  /** Dit si un port tire doit etre rendu. Par defaut, ceux de PORTS_REFUSES. */
  readonly estRefuse?: (port: number) => boolean;
}

/**
 * Fait ecouter le serveur sur ce port, et rend le port obtenu.
 *
 * @param port Le port; zero laisse le systeme en choisir un, jamais un port refuse.
 */
export async function ecouterSurUnPortPermis(
  serveur: Server,
  port: number,
  options: OptionsDEcoute = {},
): Promise<number> {
  const estRefuse = options.estRefuse ?? ((tire: number) => PORTS_REFUSES.has(tire));

  for (let tirage = 1; tirage <= TIRAGES_MAXIMUM; tirage += 1) {
    const obtenu = await ecouter(serveur, port, options.hote);

    if (port !== 0 || !estRefuse(obtenu)) {
      return obtenu;
    }

    await fermer(serveur);
  }

  throw new Error(`Le systeme a rendu ${String(TIRAGES_MAXIMUM)} ports refuses de suite: abandon.`);
}

/** Une ecoute, qui rend le port obtenu ou l'erreur du systeme. */
async function ecouter(serveur: Server, port: number, hote: string | undefined): Promise<number> {
  await new Promise<void>((resoudre, rejeter) => {
    const pret = (): void => {
      serveur.off('error', rejeter);
      resoudre();
    };

    serveur.once('error', rejeter);

    if (hote === undefined) {
      serveur.listen(port, pret);
    } else {
      serveur.listen(port, hote, pret);
    }
  });

  const adresse = serveur.address();

  return typeof adresse === 'object' && adresse !== null ? adresse.port : port;
}

/** Ferme l'ecoute, pour en ouvrir une autre sur le meme serveur. */
async function fermer(serveur: Server): Promise<void> {
  await new Promise<void>((resoudre, rejeter) => {
    serveur.close((erreur) => {
      if (erreur === undefined) {
        resoudre();
      } else {
        rejeter(erreur);
      }
    });
  });
}
