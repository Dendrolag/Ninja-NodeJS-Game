/**
 * Le resume d'un profil du processeur (etape 5.10): ou passe le temps d'un battement.
 *
 * `pnpm charge --banc --profil <dossier>` fait tourner chaque processus de banc sous le
 * profileur de Node, qui ecrit en sortant un fichier .cpuprofile: l'echantillon de la pile
 * d'appels prise toutes les millisecondes environ, et le temps entre deux echantillons.
 * Ce module le lit et le range deux fois.
 *
 *   - PAR FONCTION, en temps propre: le temps passe dans la fonction elle-meme, hors de
 *     celles qu'elle appelle. C'est la ou le processeur calcule vraiment.
 *   - PAR FICHIER, en temps inclus: le temps ou au moins une fonction du fichier etait sur
 *     la pile. contacts.ts dit ce que coute le releve des contacts, bots.ts l'intelligence
 *     des faux ninjas, flux.ts le codage, et ainsi de suite.
 *
 * Le profil couvre tout le processus: la fabrication du terrain, la mise en route et
 * l'echauffement compris. Les parts se lisent donc en relatif, battement par battement,
 * pas comme des durees de battement.
 *
 * En ligne de commande: node tests/charge/profil.ts <fichier.cpuprofile> [nombre de lignes].
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Un noeud du profil: une fonction a un endroit de la pile. */
interface NoeudDuProfil {
  readonly id: number;
  readonly callFrame: {
    readonly functionName: string;
    readonly url: string;
    readonly lineNumber: number;
  };
  readonly children?: readonly number[];
}

/** Un fichier .cpuprofile, tel que Node l'ecrit. */
export interface ProfilDuProcesseur {
  readonly nodes: readonly NoeudDuProfil[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
}

/** Une ligne du resume: un nom, et le temps qui lui revient. */
export interface PartDuProfil {
  readonly nom: string;
  readonly ms: number;
  readonly pourCent: number;
}

/** Le profil range par fonction et par fichier. */
export interface ResumeDuProfil {
  readonly totalMs: number;
  /** Par fonction, en temps propre, du plus long au plus court. */
  readonly fonctions: readonly PartDuProfil[];
  /** Par fichier, en temps inclus, du plus long au plus court. */
  readonly fichiers: readonly PartDuProfil[];
}

/** Le nom d'une fonction, avec son fichier et sa ligne. */
function nomDeFonction(noeud: NoeudDuProfil): string {
  const { functionName, url, lineNumber } = noeud.callFrame;
  const fichier = url === '' ? '' : ` ${basename(url)}:${String(lineNumber + 1)}`;
  return `${functionName === '' ? '(anonyme)' : functionName}${fichier}`;
}

/** Le nom du fichier d'une fonction, ou le nom de ce que Node a fait hors de tout fichier. */
function nomDeFichier(noeud: NoeudDuProfil): string {
  const { functionName, url } = noeud.callFrame;
  return url === '' ? `(${functionName.replace(/[()]/gu, '')})` : basename(url);
}

/** Range les durees d'une table, de la plus longue a la plus courte. */
function trier(table: ReadonlyMap<string, number>, totalMs: number): PartDuProfil[] {
  return [...table]
    .map(([nom, ms]) => ({ nom, ms, pourCent: (ms / Math.max(totalMs, 1e-9)) * 100 }))
    .sort((a, b) => b.ms - a.ms);
}

/** Resume un profil du processeur. */
export function resumerLeProfil(profil: ProfilDuProcesseur): ResumeDuProfil {
  const noeuds = new Map(profil.nodes.map((noeud) => [noeud.id, noeud]));
  const parents = new Map<number, number>();

  for (const noeud of profil.nodes) {
    for (const enfant of noeud.children ?? []) {
      parents.set(enfant, noeud.id);
    }
  }

  const propres = new Map<string, number>();
  const inclus = new Map<string, number>();
  let totalMs = 0;

  profil.samples.forEach((id, rang) => {
    // Les ecarts sont en microsecondes.
    const ms = (profil.timeDeltas[rang] ?? 0) / 1000;
    const noeud = noeuds.get(id);

    if (noeud === undefined) {
      return;
    }

    totalMs += ms;
    const nom = nomDeFonction(noeud);
    propres.set(nom, (propres.get(nom) ?? 0) + ms);

    // Chaque fichier present sur la pile, une fois par echantillon.
    const fichiers = new Set<string>();
    for (
      let courant: number | undefined = id;
      courant !== undefined;
      courant = parents.get(courant)
    ) {
      const surLaPile = noeuds.get(courant);
      if (surLaPile !== undefined && surLaPile.callFrame.url !== '') {
        fichiers.add(nomDeFichier(surLaPile));
      }
    }
    if (fichiers.size === 0) {
      fichiers.add(nomDeFichier(noeud));
    }
    for (const fichier of fichiers) {
      inclus.set(fichier, (inclus.get(fichier) ?? 0) + ms);
    }
  });

  return { totalMs, fonctions: trier(propres, totalMs), fichiers: trier(inclus, totalMs) };
}

/** Le resume, en texte, avec ses lignes les plus lourdes. */
export function resumeEnTexte(resume: ResumeDuProfil, lignes = 25): string {
  const ligne = (part: PartDuProfil): string =>
    `  ${part.pourCent.toFixed(1).padStart(5)} %  ${part.ms.toFixed(0).padStart(7)} ms  ${part.nom}`;

  return [
    `Profil: ${resume.totalMs.toFixed(0)} ms echantillonnees`,
    'Par fonction, temps propre:',
    ...resume.fonctions.slice(0, lignes).map(ligne),
    'Par fichier, temps inclus:',
    ...resume.fichiers.slice(0, lignes).map(ligne),
  ].join('\n');
}

// En ligne de commande, resume le fichier donne.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [chemin, lignes] = process.argv.slice(2);

  if (chemin === undefined) {
    console.error('Usage: node tests/charge/profil.ts <fichier.cpuprofile> [nombre de lignes]');
    process.exitCode = 1;
  } else {
    const profil = JSON.parse(readFileSync(chemin, 'utf8')) as ProfilDuProcesseur;
    console.log(resumeEnTexte(resumerLeProfil(profil), lignes === undefined ? 25 : Number(lignes)));
  }
}
