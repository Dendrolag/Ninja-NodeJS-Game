/**
 * L'authentification: inscrire, connecter, reconnaitre une session. Et, depuis
 * l'etape 3.3, enregistrer la fin d'une partie pour les comptes qui l'ont jouee.
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
 *      bien qu'un bon mot de passe trouve pendant la penalite ne sert a rien.
 *   3. LE NIVEAU SE DEDUIT DE L'XP A CHAQUE LECTURE (niveauDeXp, paquet partage).
 *      Il n'est jamais stocke, ni en base ni dans la session.
 */

import type {
  ErreurValidation,
  LimiteDebit,
  MaProgression,
  SessionOuverte,
} from '@neon-ninja/shared';
import {
  LIMITES_COMPTES,
  niveauDeXp,
  reperePseudo,
  validerDemandeConnexion,
  validerDemandeInscription,
} from '@neon-ninja/shared';

import {
  creerCompte,
  identifiantsParPseudo,
  profilDuCompte,
  trouverCompteParPseudo,
} from '../base/comptes.js';
import type { BaseDeDonnees } from '../base/connexion.js';
import type { NouveauResultat, NouvellePartie, ProgressionAppliquee } from '../base/parties.js';
import { enregistrerPartie } from '../base/parties.js';
import { compteDeLaSession, fermerSession, ouvrirSession } from '../base/sessions.js';
import type { Horloge } from '../horloge.js';
import { horlogeSysteme } from '../horloge.js';
import type {
  IdentiteDeCompte,
  MotifDeRefus,
  ReponseDeCompte,
  ServiceDeComptes,
} from './annuaire.js';
import { empreinteDuJeton, fabriquerJeton } from './jetons.js';
import { LimiteurDeTentatives } from './limiteur.js';
import type { ParametresScrypt } from './motDePasse.js';
import { PARAMETRES_SCRYPT, hacherMotDePasse, verifierMotDePasse } from './motDePasse.js';

/**
 * Duree de validite d'une session: trente jours.
 *
 * Un jeu entre amis auquel on revient d'une semaine sur l'autre ne doit pas
 * redemander le mot de passe a chaque fois. Au-dela, la session expire et il faut
 * se reconnecter. Se deconnecter la ferme aussitot.
 */
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Les trois limites de tentatives. Celles du paquet partage par defaut. */
export interface LimitesDesComptes {
  readonly connexionParPseudo: LimiteDebit;
  readonly connexionParAdresse: LimiteDebit;
  readonly inscriptionParAdresse: LimiteDebit;
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

/** L'authentification des comptes, avec la base. */
export class Authentification implements ServiceDeComptes {
  private readonly db: BaseDeDonnees;
  private readonly dureeSessionMs: number;
  private readonly parametresScrypt: ParametresScrypt;
  private readonly connexionsParPseudo: LimiteurDeTentatives;
  private readonly connexionsParAdresse: LimiteurDeTentatives;
  private readonly inscriptionsParAdresse: LimiteurDeTentatives;

  /** L'empreinte leurre, calculee une fois, a la premiere connexion qui en a besoin. */
  private empreinteLeurre: Promise<string> | undefined;

  constructor(options: OptionsAuthentification) {
    const horloge = options.horloge ?? horlogeSysteme;
    const limites = options.limites ?? LIMITES_COMPTES;

    this.db = options.db;
    this.dureeSessionMs = options.dureeSessionMs ?? DUREE_SESSION_MS;
    this.parametresScrypt = options.parametresScrypt ?? PARAMETRES_SCRYPT;
    this.connexionsParPseudo = new LimiteurDeTentatives(limites.connexionParPseudo, horloge);
    this.connexionsParAdresse = new LimiteurDeTentatives(limites.connexionParAdresse, horloge);
    this.inscriptionsParAdresse = new LimiteurDeTentatives(limites.inscriptionParAdresse, horloge);
  }

  // ------------------------------------------------------------------------
  // Le service: ce que les routes HTTP demandent
  // ------------------------------------------------------------------------

  async inscrire(brut: unknown, adresse: string): Promise<ReponseDeCompte<SessionOuverte>> {
    const demande = validerDemandeInscription(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const tentative = this.inscriptionsParAdresse.tenter(adresse);
    if (!tentative.accepte) {
      return tropDeTentatives(tentative.reessayerDansMs);
    }

    const empreinte = await hacherMotDePasse(demande.valeur.motDePasse, this.parametresScrypt);
    const compte = await creerCompte(this.db, demande.valeur.pseudo, {
      empreinteMotDePasse: empreinte,
    });

    // Le pseudo vient d'etre valide par la meme regle: le seul refus possible de
    // creerCompte est donc un pseudo deja pris.
    if (!compte.valide) {
      return refusee('pseudoPris', compte.erreurs);
    }

    return acceptee(await this.ouvrirUneSession(compte.valeur.id, compte.valeur.pseudo, 0));
  }

  async connecter(brut: unknown, adresse: string): Promise<ReponseDeCompte<SessionOuverte>> {
    const demande = validerDemandeConnexion(brut);
    if (!demande.valide) {
      return refusee('demandeInvalide', demande.erreurs);
    }

    const { pseudo, motDePasse } = demande.valeur;

    // L'adresse d'abord: une tentative refusee a ce titre ne consomme rien du
    // seau du compte vise, que l'attaquant ne doit pas pouvoir vider a distance
    // plus vite que sa propre limite ne le permet.
    const parAdresse = this.connexionsParAdresse.tenter(adresse);
    if (!parAdresse.accepte) {
      return tropDeTentatives(parAdresse.reessayerDansMs);
    }

    const parPseudo = this.connexionsParPseudo.tenter(reperePseudo(pseudo));
    if (!parPseudo.accepte) {
      return tropDeTentatives(parPseudo.reessayerDansMs);
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
    const compteId = await this.compteDeSession(jeton);
    const profil = compteId === undefined ? undefined : await profilDuCompte(this.db, compteId);

    if (profil === undefined) {
      return refusee('sessionAbsente', [
        { champ: 'session', motif: 'Session absente ou expirée. Connectez-vous.' },
      ]);
    }

    return acceptee({
      pseudo: profil.pseudo,
      niveau: niveauDeXp(profil.xpTotale),
      xpTotale: profil.xpTotale,
      pieces: profil.pieces,
      pointsLigue: profil.pointsLigue,
      inscritLe: profil.creeLe.toISOString(),
    });
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

  // ------------------------------------------------------------------------
  // Briques
  // ------------------------------------------------------------------------

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
