/**
 * La mise en ligne d'un commit et la bascule d'un serveur de jeu a l'autre (etape
 * 5.13).
 *
 * DEUX SERVEURS DE JEU, UNE PAGE. Le serveur de jeu tourne sur la machine Oracle et
 * sur Render, au meme commit. La page publique, sur Vercel, n'ouvre qu'a l'un des
 * deux: c'est la production; l'autre est le secours. C'est donc la page qui dit ou
 * est la production, et rien d'autre: une bascule change la page, et la mise en
 * ligne suivante la suit.
 *
 * LA MISE EN LIGNE, dans l'ordre qui laisse le moins de joueurs devant une page et
 * un serveur de versions differentes:
 *   1. la page publique dit quel serveur est la production;
 *   2. la page de ce commit est envoyee a Vercel, sans etre promue;
 *   3. le serveur de la production est mis en ligne et verifie;
 *   4. la page est promue, puis verifiee;
 *   5. le secours est mis a la meme version.
 * Un echec avant 4 arrete tout: la page n'est pas promue, rien n'a change pour les
 * joueurs. Un echec en 5 ne fait rien echouer: la production tourne, et le journal
 * le dit, par une annotation de la CI. La mise en ligne suivante, ou la meme
 * relancee, remet le secours a jour.
 *
 * LA BASCULE remplace la page publique par celle du meme commit, empaquetee pour
 * l'autre serveur. Elle ne touche a aucun serveur: le secours est deja a la version
 * de la page. Elle refuse, avant toute promotion, un serveur qui ne dit pas sa
 * version, ou qui n'est pas a celle de la page en ligne: il refuserait les joueurs.
 *
 * Tout ce qui touche au reseau est injecte (deploiement/deployer.ts et
 * deploiement/basculer.ts le branchent): l'enchainement se teste sans rien mettre
 * en ligne.
 */

import type { Rythme } from './patience.ts';
import { problemesApresPatience } from './patience.ts';
import type { PageLue } from './verifications.ts';
import {
  fichiersQuiChangentLeJeu,
  problemesDeLaPage,
  serveurJointParLaPage,
} from './verifications.ts';

/** Les deux serveurs de jeu. */
export type NomDuServeur = 'oracle' | 'render';

/** Le serveur qui n'est pas celui-ci. */
export function autreServeur(nom: NomDuServeur): NomDuServeur {
  return nom === 'oracle' ? 'render' : 'oracle';
}

/** La page publique, sur Vercel. */
export interface PagePublique {
  /** Ce que sert l'adresse publique en ce moment: la page et son code. */
  lire(): Promise<PageLue>;
  /**
   * Empaquete la page de ce commit pour ce serveur de jeu, et l'envoie sans la
   * promouvoir. Les sources empaquetees sont celles du depot, qui doit etre a ce
   * commit.
   *
   * @returns L'adresse du deploiement envoye.
   */
  envoyer(serveurDeJeu: string, version: string): Promise<string>;
  /** Fait du deploiement envoye celui de l'adresse publique. */
  promouvoir(deploiement: string): Promise<void>;
}

/** Ce dont la bascule a besoin du monde exterieur. */
export interface DependancesDeLaBascule {
  /** L'origine de chaque serveur de jeu, par exemple https://serveur.ninja.dendrolag.fr. */
  readonly origines: Readonly<Record<NomDuServeur, string>>;
  readonly page: PagePublique;
  /** La version que rend /sante a cette origine, ou rien s'il ne la dit pas a temps. */
  versionEnLigne(origine: string): Promise<string | undefined>;
  attendre(ms: number): Promise<void>;
  ecrire(texte: string): void;
}

/** Ce dont la mise en ligne a besoin du monde exterieur. */
export interface DependancesDeLaMiseEnLigne extends DependancesDeLaBascule {
  /**
   * Met un commit en ligne sur ce serveur de jeu, et ne rend la main qu'une fois
   * sa route de sante a cette version. Echoue sinon, l'ancien serveur restant en
   * service.
   */
  readonly mettreEnLigneSur: Readonly<Record<NomDuServeur, (version: string) => Promise<void>>>;
  /** Les fichiers changes d'un commit a l'autre, ou rien si git ne sait pas les comparer. */
  fichiersChanges(depuis: string, jusqua: string): Promise<readonly string[] | undefined>;
}

/** Ce qu'a fait une mise en ligne. */
export interface BilanDeLaMiseEnLigne {
  /** Le serveur de la production. */
  readonly production: NomDuServeur;
  /** Le commit que sert la production a la fin. */
  readonly version: string;
  /** Ce commit a-t-il ete mis en ligne, ou l'etait-il deja. */
  readonly misEnLigne: boolean;
  /** Le secours est-il a la meme version a la fin. */
  readonly secoursAJour: boolean;
}

/**
 * Le temps laisse a l'adresse publique pour servir la page promue. Une minute:
 * Vercel sert la nouvelle en quelques secondes.
 */
export const RYTHME_DE_LA_PAGE: Rythme = { essais: 12, intervalleMs: 5_000 };

/** Le message d'une erreur, sur une ligne. */
function messageDe(erreur: unknown): string {
  return (erreur instanceof Error ? erreur.message : String(erreur)).replace(/\s*\n\s*/gu, ' ');
}

/** Le serveur que joint la page publique: celui de la production. */
async function serveurDeLaProduction(dependances: DependancesDeLaBascule): Promise<NomDuServeur> {
  const nom = serveurJointParLaPage(
    (await dependances.page.lire()).politique,
    dependances.origines,
  );

  if (nom === undefined) {
    throw new Error(
      "La page publique n'ouvre ni a Oracle ni a Render: on ne sait pas lequel est la production. Basculer d'abord la page vers l'un d'eux (docs/deploiement.md).",
    );
  }

  return nom;
}

/**
 * Pourquoi ce commit n'a pas a partir en ligne, ou rien s'il le doit.
 *
 * Il n'y part pas s'il y est deja, ni si rien de ce qui a change depuis la version
 * en ligne ne compose le jeu: une mise en ligne coupe les parties en cours (etape
 * 5.4). Dans le doute (serveur muet, historique incomplet), il part.
 */
async function raisonDeNePasMettreEnLigne(
  enLigne: string | undefined,
  version: string,
  dependances: DependancesDeLaMiseEnLigne,
): Promise<string | undefined> {
  if (enLigne === undefined) {
    return undefined;
  }

  if (enLigne === version) {
    return `le commit ${version} est deja en ligne.`;
  }

  const changes = await dependances.fichiersChanges(enLigne, version);

  return changes !== undefined && fichiersQuiChangentLeJeu(changes).length === 0
    ? `depuis le commit en ligne ${enLigne}, seuls des fichiers sans effet sur le jeu ont change.`
    : undefined;
}

/** Promeut la page envoyee, et attend que l'adresse publique la serve; echoue sinon. */
async function promouvoirLaPage(
  deploiement: string,
  serveurDeJeu: string,
  version: string,
  dependances: DependancesDeLaBascule,
  rythme: Rythme,
): Promise<void> {
  dependances.ecrire('\n== Promotion de la page\n');
  await dependances.page.promouvoir(deploiement);

  const problemes = await problemesApresPatience(
    'La page publique',
    async () => problemesDeLaPage(await dependances.page.lire(), serveurDeJeu, version),
    rythme,
    async (ms) => dependances.attendre(ms),
  );

  if (problemes.length > 0) {
    throw new Error(`La page publique n'est pas conforme:\n- ${problemes.join('\n- ')}`);
  }

  dependances.ecrire('La page publique: conforme.\n');
}

/**
 * Met le secours a la version de la production, sans jamais echouer.
 *
 * @returns Vrai si le secours est a cette version a la fin.
 */
async function mettreLeSecoursAJour(
  secours: NomDuServeur,
  version: string,
  dependances: DependancesDeLaMiseEnLigne,
): Promise<boolean> {
  dependances.ecrire(`\n== Le secours (${secours}) au commit ${version}\n`);

  if ((await dependances.versionEnLigne(dependances.origines[secours])) === version) {
    dependances.ecrire('Le secours est deja a cette version.\n');
    return true;
  }

  try {
    await dependances.mettreEnLigneSur[secours](version);
    dependances.ecrire('Le secours est a jour.\n');
    return true;
  } catch (erreur) {
    // Une annotation de la CI: elle s'affiche en tete de l'execution, qui reste
    // verte. Une seule ligne, sans quoi GitHub ne la lit pas.
    dependances.ecrire(
      `::warning title=Secours en retard::Le secours (${secours}) n'est pas au commit ${version}: ${messageDe(erreur)} La production tourne. Relancer la mise en ligne pour le remettre a jour: tant qu'il est en retard, on ne peut pas basculer vers lui.\n`,
    );
    return false;
  }
}

/** Met ce commit en ligne: la production, la page, puis le secours. */
export async function mettreEnLigne(
  version: string,
  dependances: DependancesDeLaMiseEnLigne,
  rythme: Rythme = RYTHME_DE_LA_PAGE,
): Promise<BilanDeLaMiseEnLigne> {
  const { ecrire, origines } = dependances;

  ecrire('\n== Quel serveur de jeu sert la production\n');
  const production = await serveurDeLaProduction(dependances);
  const secours = autreServeur(production);
  ecrire(
    `La page publique joint ${production} (${origines[production]}); ${secours} est le secours.\n`,
  );

  ecrire('\n== Faut-il mettre en ligne\n');
  const enLigne = await dependances.versionEnLigne(origines[production]);
  const raison = await raisonDeNePasMettreEnLigne(enLigne, version, dependances);

  if (raison !== undefined && enLigne !== undefined) {
    ecrire(`Rien a mettre en ligne: ${raison}\n`);

    return {
      production,
      version: enLigne,
      misEnLigne: false,
      secoursAJour: await mettreLeSecoursAJour(secours, enLigne, dependances),
    };
  }

  ecrire(`\n== Envoi de la page du commit ${version} a Vercel, sans la promouvoir\n`);
  const deploiement = await dependances.page.envoyer(origines[production], version);
  ecrire(`Page envoyee: ${deploiement}\n`);

  ecrire(`\n== Mise en ligne du serveur de jeu sur ${production}\n`);
  await dependances.mettreEnLigneSur[production](version);

  await promouvoirLaPage(deploiement, origines[production], version, dependances, rythme);
  ecrire(`\n== Commit ${version} en ligne, sur ${production}\n`);

  return {
    production,
    version,
    misEnLigne: true,
    secoursAJour: await mettreLeSecoursAJour(secours, version, dependances),
  };
}

/**
 * Fait joindre a la page publique ce serveur de jeu, au commit qu'il sert.
 *
 * @param cible             Le serveur que la page doit joindre.
 * @param versionDesSources Le commit des sources du depot, que la page empaquete.
 */
export async function basculer(
  cible: NomDuServeur,
  versionDesSources: string,
  dependances: DependancesDeLaBascule,
  rythme: Rythme = RYTHME_DE_LA_PAGE,
): Promise<void> {
  const { ecrire, origines } = dependances;
  const origine = origines[cible];

  ecrire(`\n== Bascule de la page publique vers ${cible} (${origine})\n`);
  const page = await dependances.page.lire();

  if (serveurJointParLaPage(page.politique, origines) === cible) {
    ecrire(`La page publique joint deja ${cible}: rien a faire.\n`);
    return;
  }

  const version = await dependances.versionEnLigne(origine);

  if (version === undefined) {
    throw new Error(
      `${cible} ne dit pas sa version sur /sante: il ne repond pas. Rien n'a change.`,
    );
  }

  if (!page.code.includes(version)) {
    throw new Error(
      `${cible} sert le commit ${version}, la page publique un autre: il refuserait les joueurs. Le mettre d'abord a la version de la page (docs/deploiement.md). Rien n'a change.`,
    );
  }

  if (versionDesSources !== version) {
    throw new Error(
      `Les sources sont au commit ${versionDesSources}, ${cible} sert le commit ${version}: extraire ce commit (git checkout ${version}), compiler, et recommencer. Rien n'a change.`,
    );
  }

  ecrire(`\n== Envoi de la page du commit ${version}, pour ${cible}, sans la promouvoir\n`);
  const deploiement = await dependances.page.envoyer(origine, version);
  ecrire(`Page envoyee: ${deploiement}\n`);

  await promouvoirLaPage(deploiement, origine, version, dependances, rythme);
  ecrire(`\n== La page publique joint ${cible}, au commit ${version}\n`);
}
