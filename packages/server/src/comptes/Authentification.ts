/**
 * L'authentification: inscrire, connecter, reconnaitre une session. Et, depuis
 * l'etape 3.3, enregistrer la fin d'une partie pour les comptes qui l'ont jouee.
 * Depuis l'etape 3.4, gerer le mot de passe: le changer, obtenir un code de secours,
 * et reinitialiser avec ce code un mot de passe oublie. Depuis l'etape 3.5, lire la
 * fiche d'un autre compte.
 *
 * C'est l'implementation, avec la base, de l'annuaire et du service de
 * annuaire.ts. Elle assemble des briques qui ont chacune leur fichier: la
 * validation (paquet partage), le hachage (motDePasse.ts), les jetons (jetons.ts),
 * la limite de tentatives (limiteur.ts) et les requetes (base/). Elle ne parle ni
 * HTTP ni Socket.IO: les routes et la couche reseau l'appellent.
 *
 * TROIS REGLES A GARDER EN TETE.
 *
 *   1. UNE SEULE REPONSE POUR UN PSEUDO INCONNU ET UN MAUVAIS MOT DE PASSE:
 *      « Pseudo ou mot de passe incorrect. » Et le meme temps de reponse: sans
 *      compte a verifier, le mot de passe est quand meme compare a une empreinte
 *      leurre, pour que la duree ne revele pas lequel des deux etait faux.
 *   2. LA LIMITE DE TENTATIVES PASSE AVANT LE MOT DE PASSE. Une tentative de trop
 *      est refusee sans calcul ni requete: le mot de passe n'est pas examine, si
 *      bien qu'un bon mot de passe trouve pendant la penalite ne sert a rien. Toute
 *      verification d'un secret passe par les memes seaux, ceux de la connexion:
 *      changer son mot de passe, demander un code de secours et reinitialiser
 *      n'ouvrent pas un essai de plus que se connecter (etape 3.4).
 *   3. LE NIVEAU SE DEDUIT DE L'XP A CHAQUE LECTURE (niveauDeXp, paquet partage).
 *      Il n'est jamais stocke, ni en base ni dans la session.
 */

import { timingSafeEqual } from 'node:crypto';

import type {
  CodeDeSecoursEmis,
  ErreurValidation,
  FicheJoueur,
  LimiteDebit,
  MaProgression,
  PartieDuProfil,
  ProfilDuCompte,
  SessionInscrite,
  SessionOuverte,
} from '@neon-ninja/shared';
import {
  LIMITES_COMPTES,
  PARTIES_DU_PROFIL,
  formaterCodeDeSecours,
  niveauDeXp,
  palierDePoints,
  reperePseudo,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeInscription,
  validerDemandeReinitialisation,
  validerPseudo,
} from '@neon-ninja/shared';

import {
  creerCompte,
  identifiantsParPseudo,
  profilDuCompte,
  profilParPseudo,
  trouverCompteParPseudo,
} from '../base/comptes.js';
import type { BaseDeDonnees } from '../base/connexion.js';
import type {
  NouveauResultat,
  NouvellePartie,
  ProgressionAppliquee,
  ResultatDePartie,
} from '../base/parties.js';
import { enregistrerPartie, lireHistorique, statistiquesParMode } from '../base/parties.js';
import {
  aUnCodeDeSecours,
  codeParPseudo,
  consommerCodeDeSecours,
  remplacerCodeDeSecours,
  remplacerMotDePasse,
  secretsDuCompte,
} from '../base/secrets.js';
import { compteDeLaSession, fermerSession, ouvrirSession } from '../base/sessions.js';
import type { Horloge } from '../horloge.js';
import { horlogeSysteme } from '../horloge.js';
import type {
  IdentiteDeCompte,
  MotifDeRefus,
  ReponseDeCompte,
  ServiceDeComptes,
} from './annuaire.js';
import { empreinteDuCode, fabriquerCodeDeSecours } from './codeDeSecours.js';
import { empreinteDuJeton, fabriquerJeton } from './jetons.js';
import { LimiteurDeTentatives } from './limiteur.js';
import type { ParametresScrypt } from './motDePasse.js';
import { PARAMETRES_SCRYPT, hacherMotDePasse, verifierMotDePasse } from './motDePasse.js';
import { statistiquesDeJoueur } from './statistiques.js';

/**
 * Duree de validite d'une session: trente jours.
 *
 * Un jeu entre amis auquel on revient d'une semaine sur l'autre ne doit pas
 * redemander le mot de passe a chaque fois. Au-dela, la session expire et il faut
 * se reconnecter. Se deconnecter la ferme aussitot.
 */
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Les limites de tentatives. Celles du paquet partage par defaut. */
export interface LimitesDesComptes {
  readonly connexionParPseudo: LimiteDebit;
  readonly connexionParAdresse: LimiteDebit;
  readonly inscriptionParAdresse: LimiteDebit;
  /** Les fiches lues par un meme compte (etape 3.5). Absente: celle du paquet partage. */
  readonly ficheParCompte?: LimiteDebit;
}

/** Ce qu'il faut pour authentifier. */
export interface OptionsAuthentification {
  readonly db: BaseDeDonnees;
  /** L'horloge des limites de tentatives. Celle du systeme par defaut. */
  readonly horloge?: Horloge;
  /** Duree de validite d'une session. DUREE_SESSION_MS par defaut. */
  readonly dureeSessionMs?: number;
  /** Les limites de tentatives. LIMITES_COMPTES par defaut. */
  readonly limites?: LimitesDesComptes;
  /** Les parametres de scrypt des nouvelles empreintes. PARAMETRES_SCRYPT par defaut. */
  readonly parametresScrypt?: ParametresScrypt;
}

/** Le motif unique d'identifiants refuses, qu'il s'agisse du pseudo ou du mot de passe. */
const IDENTIFIANTS_INCORRECTS = 'Pseudo ou mot de passe incorrect.';

/**
 * Le motif unique d'une reinitialisation refusee: pseudo inconnu, compte sans code,
 * code faux ou deja servi (etape 3.4).
 */
export const CODE_DE_SECOURS_INCORRECT = 'Pseudo ou code de secours incorrect.';

/** Le motif d'un mot de passe actuel faux, exige par une demande faite depuis le profil. */
export const MOT_DE_PASSE_INCORRECT = 'Mot de passe incorrect.';

/** Le motif d'une fiche demandee pour un pseudo qu'aucun compte ne porte (etape 3.5). */
export const JOUEUR_INCONNU = 'Aucun compte ne porte ce pseudo.';

/** L'authentification des comptes, avec la base. */
export class Authentification implements ServiceDeComptes {
  private readonly db: BaseDeDonnees;
  private readonly dureeSessionMs: number;
  private readonly parametresScrypt: ParametresScrypt;
  private readonly connexionsParPseudo: LimiteurDeTentatives;
  private readonly connexionsParAdresse: LimiteurDeTentatives;
  private readonly inscriptionsParAdresse: LimiteurDeTentatives;
  private readonly fichesParCompte: LimiteurDeTentatives;

  /** L'empreinte leurre, calculee une fois, a la premiere connexion qui en a besoin. */
  private empreinteLeurre: Promise<string> | undefined;

  /** Ceux qui ecoutent les sessions fermees d'un compte: la couche reseau (etape 3.4). */
  private readonly ecouteursDesFermetures = new Set<(compteId: string) => void>();

  constructor(options: OptionsAuthentification) {
    const horloge = options.horloge ?? horlogeSysteme;
    const limites = options.limites ?? LIMITES_COMPTES;

    this.db = options.db;
    this.dureeSessionMs = options.dureeSessionMs ?? DUREE_SESSION_MS;
    this.parametresScrypt = options.parametresScrypt ?? PARAMETRES_SCRYPT;
    this.connexionsParPseudo = new LimiteurDeTentatives(limites.connexionParPseudo, horloge);
    this.connexionsParAdresse = new LimiteurDeTentatives(limites.connexionParAdresse, horloge);
    this.inscriptionsParAdresse = new LimiteurDeTentatives(limites.inscriptionParAdresse, horloge);
    this.fichesParCompte = new LimiteurDeTentatives(
      limites.ficheParCompte ?? LIMITES_COMPTES.ficheParCompte,
      horloge,
    );
  }

  // ------------------------------------------------------------------------
  // Le service: ce que les routes HTTP demandent
  // ------------------------------------------------------------------------

  async inscrire(brut: unknown, adresse: string): Promise<ReponseDeCompte<SessionInscrite>> {
    const demande = validerDemandeInscription(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const tentative = this.inscriptionsParAdresse.tenter(adresse);
    if (!tentative.accepte) {
      return tropDeTentatives(tentative.reessayerDansMs);
    }

    const empreinte = await hacherMotDePasse(demande.valeur.motDePasse, this.parametresScrypt);
    const code = fabriquerCodeDeSecours();
    const compte = await creerCompte(this.db, demande.valeur.pseudo, {
      empreinteMotDePasse: empreinte,
      empreinteCodeDeSecours: empreinteDuCode(code),
    });

    // Le pseudo vient d'etre valide par la meme regle: le seul refus possible de
    // creerCompte est donc un pseudo deja pris.
    if (!compte.valide) {
      return refusee('pseudoPris', compte.erreurs);
    }

    const session = await this.ouvrirUneSession(compte.valeur.id, compte.valeur.pseudo, 0);

    return acceptee({ ...session, codeDeSecours: formaterCodeDeSecours(code) });
  }

  async connecter(brut: unknown, adresse: string): Promise<ReponseDeCompte<SessionOuverte>> {
    const demande = validerDemandeConnexion(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const { pseudo, motDePasse } = demande.valeur;

    const attente = this.attenteAvantDEssayer(adresse, pseudo);
    if (attente !== undefined) {
      return tropDeTentatives(attente);
    }

    const identifiants = await identifiantsParPseudo(this.db, pseudo);
    const empreinte = identifiants?.empreinte ?? (await this.leurre());
    const correct = await verifierMotDePasse(motDePasse, empreinte);

    if (identifiants?.empreinte === undefined || !correct) {
      return refusee('identifiantsIncorrects', [
        { champ: 'connexion', motif: IDENTIFIANTS_INCORRECTS },
      ]);
    }

    return acceptee(
      await this.ouvrirUneSession(
        identifiants.compteId,
        identifiants.pseudo,
        identifiants.xpTotale,
      ),
    );
  }

  async deconnecter(jeton: string): Promise<void> {
    await fermerSession(this.db, empreinteDuJeton(jeton));
  }

  async maProgression(jeton: string): Promise<ReponseDeCompte<MaProgression>> {
    const compte = await this.compteDeLaSession(jeton);

    return compte === undefined ? sessionAbsente() : acceptee(compte.progression);
  }

  async profil(jeton: string): Promise<ReponseDeCompte<ProfilDuCompte>> {
    const compte = await this.compteDeLaSession(jeton);

    if (compte === undefined) {
      return sessionAbsente();
    }

    const [statistiques, historique, codeDeSecours] = await Promise.all([
      statistiquesParMode(this.db, compte.id),
      lireHistorique(this.db, compte.id, PARTIES_DU_PROFIL),
      aUnCodeDeSecours(this.db, compte.id),
    ]);

    return acceptee({
      ...compte.progression,
      statistiques: statistiquesDeJoueur(statistiques),
      dernieresParties: historique.map(partieDuProfil),
      codeDeSecours,
    });
  }

  /**
   * Dans l'ordre: la session, la limite de lecture du compte qui demande, le pseudo,
   * puis la base. Un invite n'apprend donc rien, pas meme qu'un pseudo est mal forme.
   */
  async ficheJoueur(jeton: string, brut: unknown): Promise<ReponseDeCompte<FicheJoueur>> {
    const lecteur = await this.compteDeSession(jeton);
    if (lecteur === undefined) {
      return sessionAbsente();
    }

    const tentative = this.fichesParCompte.tenter(lecteur);
    if (!tentative.accepte) {
      return tropDeTentatives(tentative.reessayerDansMs);
    }

    const pseudo = validerPseudo(brut);
    if (!pseudo.valide) {
      return refusee('demandeInvalide', pseudo.erreurs);
    }

    const profil = await profilParPseudo(this.db, pseudo.valeur);
    if (profil === undefined) {
      return refusee('joueurInconnu', [{ champ: 'pseudo', motif: JOUEUR_INCONNU }]);
    }

    return acceptee({
      pseudo: profil.pseudo,
      inscritLe: profil.creeLe.toISOString(),
      niveau: niveauDeXp(profil.xpTotale),
      palier: palierDePoints(profil.pointsLigue),
      statistiques: statistiquesDeJoueur(await statistiquesParMode(this.db, profil.id)),
    });
  }

  async changerMotDePasse(
    jeton: string,
    brut: unknown,
    adresse: string,
  ): Promise<ReponseDeCompte<CodeDeSecoursEmis>> {
    const demande = validerDemandeChangementMotDePasse(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const verification = await this.verifierLeMotDePasseActuel(
      jeton,
      demande.valeur.motDePasse,
      adresse,
    );
    if (!verification.acceptee) {
      return verification;
    }

    const { compteId, empreinte } = verification.valeur;
    const code = fabriquerCodeDeSecours();
    const remplace = await remplacerMotDePasse(this.db, compteId, {
      ancienneEmpreinte: empreinte,
      nouvelleEmpreinte: await hacherMotDePasse(
        demande.valeur.nouveauMotDePasse,
        this.parametresScrypt,
      ),
      empreinteCode: empreinteDuCode(code),
      sessionGardee: empreinteDuJeton(jeton),
    });

    // Un autre changement est passe entre-temps: le mot de passe verifie n'est plus
    // celui du compte.
    if (!remplace) {
      return motDePasseIncorrect();
    }

    this.annoncerSessionsFermees(compteId);

    return acceptee({ codeDeSecours: formaterCodeDeSecours(code) });
  }

  async nouveauCodeDeSecours(
    jeton: string,
    brut: unknown,
    adresse: string,
  ): Promise<ReponseDeCompte<CodeDeSecoursEmis>> {
    const demande = validerDemandeCodeDeSecours(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const verification = await this.verifierLeMotDePasseActuel(
      jeton,
      demande.valeur.motDePasse,
      adresse,
    );
    if (!verification.acceptee) {
      return verification;
    }

    const code = fabriquerCodeDeSecours();
    await remplacerCodeDeSecours(this.db, verification.valeur.compteId, empreinteDuCode(code));

    return acceptee({ codeDeSecours: formaterCodeDeSecours(code) });
  }

  async reinitialiser(brut: unknown, adresse: string): Promise<ReponseDeCompte<SessionInscrite>> {
    const demande = validerDemandeReinitialisation(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const { pseudo, codeDeSecours, nouveauMotDePasse } = demande.valeur;

    const attente = this.attenteAvantDEssayer(adresse, pseudo);
    if (attente !== undefined) {
      return tropDeTentatives(attente);
    }

    const compte = await codeParPseudo(this.db, reperePseudo(pseudo));
    const presente = empreinteDuCode(codeDeSecours);

    if (compte?.empreinteCode === undefined || !memesEmpreintes(presente, compte.empreinteCode)) {
      return codeDeSecoursIncorrect();
    }

    const code = fabriquerCodeDeSecours();
    const consomme = await consommerCodeDeSecours(this.db, compte.compteId, {
      ancienCode: presente,
      nouveauCode: empreinteDuCode(code),
      empreinteMotDePasse: await hacherMotDePasse(nouveauMotDePasse, this.parametresScrypt),
    });

    // Une autre reinitialisation vient de consommer ce code: il ne vaut plus rien.
    if (!consomme) {
      return codeDeSecoursIncorrect();
    }

    this.annoncerSessionsFermees(compte.compteId);

    const session = await this.ouvrirUneSession(compte.compteId, compte.pseudo, compte.xpTotale);

    return acceptee({ ...session, codeDeSecours: formaterCodeDeSecours(code) });
  }

  // ------------------------------------------------------------------------
  // L'annuaire: ce que la couche reseau demande
  // ------------------------------------------------------------------------

  async compteDeSession(jeton: string): Promise<string | undefined> {
    return compteDeLaSession(this.db, empreinteDuJeton(jeton));
  }

  async identiteDe(compteId: string): Promise<IdentiteDeCompte | undefined> {
    const profil = await profilDuCompte(this.db, compteId);

    return profil === undefined
      ? undefined
      : { pseudo: profil.pseudo, niveau: niveauDeXp(profil.xpTotale) };
  }

  async pseudoDeCompte(pseudo: string): Promise<boolean> {
    return (await trouverCompteParPseudo(this.db, pseudo)) !== undefined;
  }

  async enregistrerFinDePartie(
    partie: NouvellePartie,
    resultats: readonly NouveauResultat[],
  ): Promise<readonly ProgressionAppliquee[]> {
    return (await enregistrerPartie(this.db, partie, resultats)).progressions;
  }

  surSessionsFermees(ecouteur: (compteId: string) => void): () => void {
    this.ecouteursDesFermetures.add(ecouteur);

    return () => {
      this.ecouteursDesFermetures.delete(ecouteur);
    };
  }

  // ------------------------------------------------------------------------
  // Briques
  // ------------------------------------------------------------------------

  /**
   * Le compte dont ce jeton ouvre une session valable, et sa progression, ou
   * undefined.
   *
   * Le niveau se deduit de l'XP a cette lecture, et n'est garde nulle part.
   */
  private async compteDeLaSession(
    jeton: string,
  ): Promise<{ readonly id: string; readonly progression: MaProgression } | undefined> {
    const compteId = await this.compteDeSession(jeton);
    const profil = compteId === undefined ? undefined : await profilDuCompte(this.db, compteId);

    if (profil === undefined) {
      return undefined;
    }

    return {
      id: profil.id,
      progression: {
        pseudo: profil.pseudo,
        niveau: niveauDeXp(profil.xpTotale),
        xpTotale: profil.xpTotale,
        pieces: profil.pieces,
        pointsLigue: profil.pointsLigue,
        inscritLe: profil.creeLe.toISOString(),
      },
    };
  }

  /**
   * Dans combien de temps une tentative sur ce compte, depuis cette adresse, sera
   * admise; undefined si elle l'est maintenant, et elle est alors comptee.
   *
   * L'adresse d'abord: une tentative refusee a ce titre ne consomme rien du seau du
   * compte vise, que l'attaquant ne doit pas pouvoir vider a distance plus vite que
   * sa propre limite ne le permet.
   */
  private attenteAvantDEssayer(adresse: string, pseudo: string): number | undefined {
    const parAdresse = this.connexionsParAdresse.tenter(adresse);
    if (!parAdresse.accepte) {
      return parAdresse.reessayerDansMs;
    }

    const parPseudo = this.connexionsParPseudo.tenter(reperePseudo(pseudo));

    return parPseudo.accepte ? undefined : parPseudo.reessayerDansMs;
  }

  /**
   * Verifie le mot de passe actuel du compte dont ce jeton ouvre la session, pour une
   * demande faite depuis le profil (etape 3.4).
   *
   * Dans l'ordre: la session, la limite de tentatives, puis le mot de passe, compare
   * a une empreinte leurre pour un compte qui n'en a pas.
   *
   * @returns Le compte et l'empreinte verifiee, ou le refus a rendre tel quel.
   */
  private async verifierLeMotDePasseActuel(
    jeton: string,
    motDePasse: string,
    adresse: string,
  ): Promise<ReponseDeCompte<{ readonly compteId: string; readonly empreinte: string }>> {
    const compteId = await this.compteDeSession(jeton);
    const secrets = compteId === undefined ? undefined : await secretsDuCompte(this.db, compteId);

    if (compteId === undefined || secrets === undefined) {
      return sessionAbsente();
    }

    const attente = this.attenteAvantDEssayer(adresse, secrets.pseudo);
    if (attente !== undefined) {
      return tropDeTentatives(attente);
    }

    const empreinte = secrets.empreinteMotDePasse;
    const correct = await verifierMotDePasse(motDePasse, empreinte ?? (await this.leurre()));

    if (empreinte === undefined || !correct) {
      return motDePasseIncorrect();
    }

    return acceptee({ compteId, empreinte });
  }

  /**
   * Previent les ecouteurs que des sessions de ce compte viennent d'etre fermees.
   *
   * Un ecouteur qui echoue ne change rien a la reponse: le mot de passe est deja
   * change. L'echec est journalise.
   */
  private annoncerSessionsFermees(compteId: string): void {
    for (const ecouteur of [...this.ecouteursDesFermetures]) {
      try {
        ecouteur(compteId);
      } catch (erreur) {
        console.error('Un ecouteur des sessions fermees a echoue:', erreur);
      }
    }
  }

  /** Ouvre une session pour ce compte, et rend ce que le client doit en savoir. */
  private async ouvrirUneSession(
    compteId: string,
    pseudo: string,
    xpTotale: number,
  ): Promise<SessionOuverte> {
    const jeton = fabriquerJeton();
    await ouvrirSession(this.db, compteId, empreinteDuJeton(jeton), this.dureeSessionMs);

    return { jeton, compte: { pseudo, niveau: niveauDeXp(xpTotale) } };
  }

  /**
   * Une empreinte qui ne correspond a aucun mot de passe propose, pour faire durer
   * la verification d'un pseudo inconnu autant que celle d'un compte existant.
   *
   * Le texte hache est tire au hasard, comme un jeton: personne ne le connait.
   */
  private async leurre(): Promise<string> {
    this.empreinteLeurre ??= hacherMotDePasse(fabriquerJeton(), this.parametresScrypt);

    return this.empreinteLeurre;
  }
}

/** Une reponse acceptee. */
function acceptee<T>(valeur: T): ReponseDeCompte<T> {
  return { acceptee: true, valeur };
}

/** Une reponse refusee. */
function refusee<T>(motif: MotifDeRefus, erreurs: readonly ErreurValidation[]): ReponseDeCompte<T> {
  return { acceptee: false, motif, erreurs };
}

/** Une reponse refusee parce que le mot de passe actuel est faux. */
function motDePasseIncorrect<T>(): ReponseDeCompte<T> {
  return refusee('motDePasseIncorrect', [{ champ: 'motDePasse', motif: MOT_DE_PASSE_INCORRECT }]);
}

/**
 * Une reinitialisation refusee. Le meme motif pour un pseudo inconnu, un compte sans
 * code et un code faux: le refus n'apprend pas quels pseudos sont des comptes.
 */
function codeDeSecoursIncorrect<T>(): ReponseDeCompte<T> {
  return refusee('identifiantsIncorrects', [
    { champ: 'reinitialisation', motif: CODE_DE_SECOURS_INCORRECT },
  ]);
}

/** Deux empreintes hexadecimales sont-elles egales, comparees en temps constant. */
function memesEmpreintes(gauche: string, droite: string): boolean {
  const a = Buffer.from(gauche, 'hex');
  const b = Buffer.from(droite, 'hex');

  return a.length === b.length && timingSafeEqual(a, b);
}

/** Une reponse refusee faute de session valable. */
function sessionAbsente<T>(): ReponseDeCompte<T> {
  return refusee('sessionAbsente', [
    { champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' },
  ]);
}

/** Une ligne de l'historique, a la forme du contrat. */
function partieDuProfil(ligne: ResultatDePartie): PartieDuProfil {
  return {
    mode: ligne.mode,
    carte: ligne.carte,
    modeMiroir: ligne.modeMiroir,
    placement: ligne.placement,
    nombreJoueurs: ligne.nombreJoueurs,
    points: ligne.points,
    xpGagnee: ligne.xpGagnee,
    piecesGagnees: ligne.piecesGagnees,
    variationPointsLigue: ligne.variationPointsLigue,
    termineeLe: ligne.termineeLe.toISOString(),
  };
}

/** Une reponse refusee pour exces de tentatives, avec le delai avant de reessayer. */
function tropDeTentatives<T>(reessayerDansMs: number): ReponseDeCompte<T> {
  const secondes = Math.max(1, Math.ceil(reessayerDansMs / 1000));

  return {
    acceptee: false,
    motif: 'tropDeTentatives',
    erreurs: [
      {
        champ: 'tentatives',
        motif: `Trop de tentatives. Réessayez dans ${String(secondes)} seconde${secondes > 1 ? 's' : ''}.`,
      },
    ],
    reessayerDansMs,
  };
}
