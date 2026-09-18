/**
 * La projection: de l'etat du moteur vers ce qui part sur le reseau.
 *
 * C'est une frontiere, et elle a une raison d'etre precise. L'etat du moteur est
 * fait pour CALCULER: il porte le terrain, le generateur a graine, et le detail
 * interne de chaque entite au millieme de milliseconde. Ce qui part sur le reseau
 * est fait pour ETRE AFFICHE, vingt fois par seconde, par des clients qui n'ont
 * pas a savoir comment le jeu est calcule. Les deux formes n'ont aucune raison de
 * coincider, et les confondre couterait cher:
 *
 *   - Le TERRAIN pese des centaines de milliers de cases et ne change jamais. Le
 *     renvoyer a chaque battement multiplierait la bande passante par mille pour
 *     une information que le client deduit de la carte choisie.
 *   - La GRAINE permettrait de predire toutes les apparitions a venir. Un client
 *     modifie saurait ou le prochain bonus va tomber avant qu'il tombe.
 *   - Les COMPTEURS INTERNES d'un joueur (ses durees de bonus, son delai entre
 *     captures) ne regardent que le moteur.
 *
 * TOUT CE FICHIER EST PUR. Il ne lit ni horloge ni reseau: il transforme une
 * donnee en une autre. C'est ce qui le rend testable directement, sans monter le
 * moindre serveur, et c'est aussi ce qui rendra l'etape 2.3 simple: le delta
 * binaire remplacera la serialisation de ces types-la, sans toucher au reste.
 */

import type {
  BonusActive,
  BotNoirDetruit,
  CaptureParBotNoirSubie,
  CaptureReussie,
  CaptureSubie,
  CarteVideeVue,
  CompteDeSession,
  CoupDeKatanaVu,
  EntiteVue,
  InfosSalon,
  InstantanePartie,
  JoueurDuSalon,
  JoueurTrancheVu,
  LigneClassement,
  MalusRamasseParMoi,
  MalusSubi,
  ObjetVu,
  PartiePublique,
  TactiqueVue,
  TirDeCaptureVu,
  VieDeTraqueurPerdueVue,
  ZoneVue,
} from '@neon-ninja/shared';
import type {
  Bot,
  EtatPartie,
  EtatTactiqueDuJoueur,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
  LigneScore,
  ObjetRamassable,
  ZoneSpeciale,
} from '@neon-ninja/sim';
import {
  REGLES_DES_MODES,
  bonusActif,
  calculerScores,
  etatTactiqueDe,
  evaluerFinDePartie,
  guerrierDe,
  toutesLesEntites,
} from '@neon-ninja/sim';

import type { GameRoom } from './GameRoom.js';

/**
 * Construit l'instantane a diffuser aux membres d'une partie.
 *
 * Il est IDENTIQUE pour tout le monde, et c'est une decision de conception. Un
 * instantane par joueur permettrait d'y glisser ce qui ne concerne que lui, mais
 * interdirait de le construire et de le serialiser une seule fois pour toute la
 * salle, ce qui coute cher a vingt battements par seconde et rendrait le delta
 * binaire de l'etape 2.3 beaucoup plus difficile. Ce qui ne concerne qu'un joueur
 * passe donc par une notification qui lui est adressee.
 */
export function instantaneDe(etat: EtatPartie): InstantanePartie {
  return {
    tick: etat.tick,
    tempsRestantMs: evaluerFinDePartie(etat).tempsRestantMs,
    enPause: etat.enPause,
    entites: entitesVisibles(etat).map((entite) => entiteVue(etat, entite)),
    objets: Object.values(etat.objets).map(objetVu),
    zones: Object.values(etat.zones).map(zoneVue),
    classement: calculerScores(etat).map(ligneClassement),
  };
}

/**
 * Les entites que la partie montre: toutes, sauf les joueurs hors jeu.
 *
 * Un traqueur elimine de la Chasse (etape 7.3) reste membre et classe, mais il ne joue
 * plus: il disparait de la carte, et regarde la suite sans etre vu.
 */
function entitesVisibles(etat: EtatPartie): readonly (Joueur | Bot)[] {
  const horsJeu = REGLES_DES_MODES[etat.mode].horsJeu(etat);
  const entites = toutesLesEntites(etat);

  return horsJeu.size === 0 ? entites : entites.filter((entite) => !horsJeu.has(entite.id));
}

/**
 * L'arme d'un traqueur de la Chasse, telle qu'elle part sur le reseau (etape 7.3).
 *
 * ELLE VOYAGE DANS L'ETAT TACTIQUE D'UN JOUEUR, pour que le flux d'etat ne change pas de
 * forme: l'orientation est celle ou il vise, et SES CHARGES SONT SES VIES. Rien ne revient
 * avec le temps: l'attente d'une charge vaut zero. Le client lit le mode de la partie pour
 * savoir ce qu'il affiche. Une proie n'a pas d'arme.
 */
function armeDuTraqueur(etat: EtatPartie, id: IdentifiantEntite): TactiqueVue | undefined {
  const traqueur = etat.chasse?.traqueurs[id];

  return traqueur === undefined
    ? undefined
    : { orientation: traqueur.orientation, charges: traqueur.vies, avantProchaineChargeMs: 0 };
}

/**
 * L'arme d'un joueur du Massacre, telle qu'elle part sur le reseau (etape 7.4).
 *
 * ELLE VOYAGE DANS L'ETAT TACTIQUE D'UN JOUEUR, comme celle d'un traqueur de la Chasse: le
 * flux d'etat ne change pas de forme. L'orientation est celle ou il frappe; une charge si
 * son coup est pret, zero sinon, et l'attente avant le prochain. Le combo n'y figure pas: il
 * se lit dans les coups de katana, qui disent au joueur ou il en est.
 */
function armeDuGuerrier(etat: EtatPartie, id: IdentifiantEntite): TactiqueVue {
  const guerrier = guerrierDe(etat, id);

  return {
    orientation: guerrier.orientation,
    charges: guerrier.avantProchainCoupMs > 0 ? 0 : 1,
    avantProchaineChargeMs: guerrier.avantProchainCoupMs,
  };
}

/** L'etat tactique d'un joueur, tel qu'il part sur le reseau. */
function tactiqueVue(tactique: EtatTactiqueDuJoueur): TactiqueVue {
  return {
    orientation: tactique.orientation,
    charges: tactique.charges,
    avantProchaineChargeMs: tactique.avantProchaineChargeMs,
  };
}

/**
 * Convertit une entite du moteur en ce que tout le monde a le droit d'en voir.
 *
 * Dans une partie Tactique, un joueur montre en plus ou il vise et ce qu'il lui reste
 * de charges (etape 7.1); dans une Chasse, un traqueur montre ou il vise et ses vies
 * (etape 7.3); dans un Massacre, chaque joueur montre ou il frappe et si son coup est pret
 * (etape 7.4). Ailleurs, rien de ces modes ne part.
 */
function entiteVue(etat: EtatPartie, entite: Joueur | Bot): EntiteVue {
  const commun = {
    id: entite.id,
    x: entite.position.x,
    y: entite.position.y,
    couleur: entite.couleur,
    direction: entite.direction,
  };

  if (entite.type === 'joueur') {
    return {
      ...commun,
      type: 'joueur',
      pseudo: entite.pseudo,
      invincible: bonusActif(entite, 'invincibilite'),
      protege: entite.protectionSpawnRestanteMs > 0,
      ...armeVue(etat, entite.id),
    };
  }

  return { ...commun, type: entite.type };
}

/** L'arme d'un joueur, si son mode lui en donne une: champ omis sinon. */
function armeVue(etat: EtatPartie, id: IdentifiantEntite): { readonly tactique?: TactiqueVue } {
  if (etat.mode === 'tactique') {
    return { tactique: tactiqueVue(etatTactiqueDe(etat, id)) };
  }

  if (etat.mode === 'massacre') {
    return { tactique: armeDuGuerrier(etat, id) };
  }

  const arme = etat.mode === 'chasse' ? armeDuTraqueur(etat, id) : undefined;

  return arme === undefined ? {} : { tactique: arme };
}

/** Convertit un objet pose en ce que le client doit dessiner. */
function objetVu(objet: ObjetRamassable): ObjetVu {
  return {
    id: objet.id,
    categorie: objet.categorie,
    nature: objet.nature,
    x: objet.position.x,
    y: objet.position.y,
    dureeDeVieRestanteMs: objet.dureeDeVieRestanteMs,
  };
}

/** Convertit une zone speciale en ce que le client doit dessiner. */
function zoneVue(zone: ZoneSpeciale): ZoneVue {
  return {
    id: zone.id,
    type: zone.type,
    x: zone.centre.x,
    y: zone.centre.y,
    rayon: zone.rayon,
    dureeRestanteMs: zone.dureeRestanteMs,
  };
}

/**
 * Convertit une ligne de score du moteur en ligne de classement du reseau.
 *
 * Le detail de qui a capture qui reste au moteur: c'est un tableau croise dont la
 * taille grandit avec le carre du nombre de joueurs, et le legacy l'envoyait
 * entierement a chaque capture (le champ captureDetails de playerCapturedEnemy).
 * L'ecran de fin de partie de l'etape 4.3 le demandera s'il en a besoin.
 */
function ligneClassement(ligne: LigneScore): LigneClassement {
  return {
    id: ligne.id,
    pseudo: ligne.pseudo,
    couleur: ligne.couleur,
    points: ligne.points,
    botsPortes: ligne.botsPortes,
    pointsBotsNoirs: ligne.pointsBotsNoirs,
    captures: ligne.captures,
    botsNoirsDetruits: ligne.botsNoirsDetruits,
  };
}

/** Le classement d'une partie, tel qu'il part sur le reseau. */
export function classementDe(etat: EtatPartie): readonly LigneClassement[] {
  return calculerScores(etat).map(ligneClassement);
}

/**
 * L'etat du salon d'une room, tel qu'il part sur le reseau.
 *
 * Il ne part qu'aux membres de la partie. Le code d'invitation d'une partie
 * privee peut donc y figurer: ce sont eux qui le partagent.
 */
export function salonDe(room: GameRoom): InfosSalon {
  return {
    idRoom: room.id,
    statut: room.statut,
    mode: room.mode,
    visibilite: room.visibilite,
    ...(room.code === undefined ? {} : { code: room.code }),
    capacite: room.capacite,
    joueurs: room.joueurs.map(joueurDuSalon),
    reglages: room.reglages,
  };
}

/**
 * Une partie publique ouverte, telle que la liste des parties la montre.
 *
 * Seulement de quoi choisir: le pseudo de l'hote, le mode, la carte et le nombre
 * de places. Ni le code, qu'une partie publique n'a pas, ni le detail des joueurs.
 */
export function partiePubliqueDe(room: GameRoom): PartiePublique {
  return {
    idRoom: room.id,
    hote: room.joueurs.find((joueur) => joueur.hote)?.pseudo ?? '',
    mode: room.mode,
    carte: room.reglages.carte,
    modeMiroir: room.reglages.modeMiroir,
    joueurs: room.joueurs.length,
    capacite: room.capacite,
  };
}

/**
 * Un membre du salon, tel que les autres le voient.
 *
 * Un compte montre son niveau, et rien d'autre: l'identifiant du compte en base
 * reste au serveur. Un invite n'a pas de champ compte.
 */
export function joueurDuSalon(joueur: {
  readonly id: IdentifiantEntite;
  readonly pseudo: string;
  readonly hote: boolean;
  readonly compte?: CompteDeSession;
  readonly equipe?: JoueurDuSalon['equipe'];
}): JoueurDuSalon {
  return {
    id: joueur.id,
    pseudo: joueur.pseudo,
    hote: joueur.hote,
    ...(joueur.compte === undefined ? {} : { compte: { niveau: joueur.compte.niveau } }),
    // L'equipe d'un membre, dans une partie Equipes seulement (etape 7.2).
    ...(joueur.equipe === undefined ? {} : { equipe: joueur.equipe }),
  };
}

/**
 * Une notification a envoyer, et a qui.
 *
 * Le moteur constate des faits sans se soucier de qui doit l'apprendre. C'est ici
 * qu'un fait devient un ou plusieurs messages adresses. La forme choisie, une
 * liste de messages portant chacun leur destinataire, permet de garder cette
 * traduction PURE: elle ne connait aucune socket, elle rend une donnee, et la
 * couche Socket.IO n'a plus qu'a la parcourir.
 */
export type Notification =
  | {
      readonly nom: 'captureSubie';
      readonly pour: IdentifiantEntite;
      readonly charge: CaptureSubie;
    }
  | {
      readonly nom: 'captureReussie';
      readonly pour: IdentifiantEntite;
      readonly charge: CaptureReussie;
    }
  | {
      readonly nom: 'captureParBotNoir';
      readonly pour: IdentifiantEntite;
      readonly charge: CaptureParBotNoirSubie;
    }
  | {
      readonly nom: 'botNoirDetruit';
      readonly pour: IdentifiantEntite;
      readonly charge: BotNoirDetruit;
    }
  | { readonly nom: 'bonusActive'; readonly pour: IdentifiantEntite; readonly charge: BonusActive }
  | {
      readonly nom: 'malusRamasse';
      readonly pour: IdentifiantEntite;
      readonly charge: MalusRamasseParMoi;
    }
  | { readonly nom: 'malusSubi'; readonly pour: IdentifiantEntite; readonly charge: MalusSubi }
  | {
      readonly nom: 'tirDeCapture';
      readonly pour: IdentifiantEntite;
      readonly charge: TirDeCaptureVu;
    }
  | {
      readonly nom: 'vieDeTraqueurPerdue';
      readonly pour: IdentifiantEntite;
      readonly charge: VieDeTraqueurPerdueVue;
    }
  | {
      readonly nom: 'coupDeKatana';
      readonly pour: IdentifiantEntite;
      readonly charge: CoupDeKatanaVu;
    }
  | {
      readonly nom: 'joueurTranche';
      readonly pour: IdentifiantEntite;
      readonly charge: JoueurTrancheVu;
    }
  | {
      readonly nom: 'carteVidee';
      readonly pour: IdentifiantEntite;
      readonly charge: CarteVideeVue;
    };

/**
 * Traduit les faits d'un battement en notifications adressees.
 *
 * L'etat passe en parametre est celui d'APRES le battement: c'est lui qui porte
 * les compteurs a jour et les pseudos, y compris ceux d'un joueur qui vient de
 * changer de couleur. Un joueur qui a quitte la partie dans le meme battement
 * n'est plus la: sa notification est simplement omise, plutot que d'inventer un
 * pseudo vide.
 */
export function notificationsDe(etat: EtatPartie): readonly Notification[] {
  return etat.evenements.flatMap((evenement) => notificationsDUnFait(etat, evenement));
}

/** Traduit un fait en zero, une ou plusieurs notifications. */
function notificationsDUnFait(
  etat: EtatPartie,
  evenement: EvenementPartie,
): readonly Notification[] {
  switch (evenement.type) {
    case 'captureJoueur':
      return capturesDeJoueur(etat, evenement);

    case 'captureParBotNoir':
      return [
        {
          nom: 'captureParBotNoir',
          pour: evenement.victime,
          charge: { botsPerdus: evenement.botsPerdus },
        },
      ];

    case 'botNoirDetruit':
      return [
        {
          nom: 'botNoirDetruit',
          pour: evenement.joueur,
          charge: {
            points: evenement.points,
            x: evenement.position.x,
            y: evenement.position.y,
          },
        },
      ];

    case 'bonusRamasse':
      return [
        {
          nom: 'bonusActive',
          pour: evenement.joueur,
          charge: { nature: evenement.nature, dureeMs: evenement.dureeMs },
        },
      ];

    case 'malusRamasse':
      return malusRamasse(etat, evenement);

    case 'tirDeCapture':
      // Un tir se voit de toute la partie: chaque joueur present en est prevenu.
      return Object.keys(etat.joueurs).map((pour): Notification => ({
        nom: 'tirDeCapture',
        pour,
        charge: {
          tireur: evenement.joueur,
          x: evenement.position.x,
          y: evenement.position.y,
          orientation: evenement.orientation,
          captures: evenement.captures,
        },
      }));

    case 'vieDeTraqueurPerdue':
      return [
        {
          nom: 'vieDeTraqueurPerdue',
          pour: evenement.joueur,
          charge: { viesRestantes: evenement.viesRestantes },
        },
      ];

    case 'coupDeKatana': {
      // Un coup se voit de toute la partie, et le sang qu'il fait couler aussi.
      const charge: CoupDeKatanaVu = {
        frappeur: evenement.joueur,
        x: evenement.position.x,
        y: evenement.position.y,
        orientation: evenement.orientation,
        morts: evenement.morts.map((mort) => ({
          id: mort.bot,
          x: mort.position.x,
          y: mort.position.y,
          noir: mort.noir,
          points: mort.points,
          couleur: mort.couleur,
        })),
        combo: evenement.combo,
        multiplicateur: evenement.multiplicateur,
      };

      return aTous(etat, 'coupDeKatana', charge);
    }

    case 'joueurTranche':
      return joueurTranche(etat, evenement);

    case 'carteVidee':
      return aTous(etat, 'carteVidee', {
        bonus: evenement.bonus,
        tempsRestantMs: evenement.tempsRestantMs,
      });
  }
}

/** La meme notification, pour chaque joueur present. */
function aTous<N extends 'coupDeKatana' | 'carteVidee'>(
  etat: EtatPartie,
  nom: N,
  charge: Extract<Notification, { nom: N }>['charge'],
): readonly Notification[] {
  return Object.keys(etat.joueurs).map((pour) => ({ nom, pour, charge }) as Notification);
}

/**
 * Un joueur tue par un autre, dans le Massacre: une notification pour chaque joueur
 * present, parce que tout le monde voit le sang. Omise si l'un des deux a quitte la partie
 * dans le meme battement, plutot que d'inventer un pseudo vide.
 */
function joueurTranche(
  etat: EtatPartie,
  evenement: Extract<EvenementPartie, { type: 'joueurTranche' }>,
): readonly Notification[] {
  const attaquant = etat.joueurs[evenement.attaquant];
  const victime = etat.joueurs[evenement.victime];

  if (attaquant === undefined || victime === undefined) {
    return [];
  }

  const charge: JoueurTrancheVu = {
    attaquant: attaquant.id,
    attaquantPseudo: attaquant.pseudo,
    victime: victime.id,
    victimePseudo: victime.pseudo,
    x: evenement.position.x,
    y: evenement.position.y,
    orientation: evenement.orientation,
    pointsVoles: evenement.pointsVoles,
  };

  return Object.keys(etat.joueurs).map((pour): Notification => ({
    nom: 'joueurTranche',
    pour,
    charge,
  }));
}

/**
 * Une capture de joueur fait DEUX notifications, jamais une.
 *
 * L'attaquant et la victime n'apprennent pas la meme chose, et c'est deja ce que
 * faisait le legacy avec playerCaptured et playerCapturedEnemy. La difference est
 * qu'ici les deux messages sont fabriques au meme endroit, a partir du meme fait:
 * ils ne peuvent pas diverger.
 */
function capturesDeJoueur(
  etat: EtatPartie,
  evenement: Extract<EvenementPartie, { type: 'captureJoueur' }>,
): readonly Notification[] {
  const attaquant = etat.joueurs[evenement.attaquant];
  const victime = etat.joueurs[evenement.victime];
  const notifications: Notification[] = [];

  if (victime !== undefined && attaquant !== undefined) {
    notifications.push({
      nom: 'captureSubie',
      pour: victime.id,
      charge: {
        parPseudo: attaquant.pseudo,
        nouvelleCouleur: evenement.nouvelleCouleurVictime,
        botsPerdus: evenement.botsTransferes,
      },
    });
  }

  if (attaquant !== undefined && victime !== undefined) {
    notifications.push({
      nom: 'captureReussie',
      pour: attaquant.id,
      charge: {
        victimePseudo: victime.pseudo,
        botsGagnes: evenement.botsTransferes,
        capturesTotal: attaquant.captures,
      },
    });
  }

  return notifications;
}

/**
 * Un malus ramasse fait une notification pour le ramasseur et une par victime.
 *
 * Elles ne disent PAS la meme chose, et surtout elles ne vont pas aux memes
 * personnes: le ramasseur est epargne par ce qu'il vient de declencher. C'est le
 * comportement a preserver numero 4 de CLAUDE.md, et la separation des deux
 * messages est ce qui rend impossible de l'oublier.
 */
function malusRamasse(
  etat: EtatPartie,
  evenement: Extract<EvenementPartie, { type: 'malusRamasse' }>,
): readonly Notification[] {
  const ramasseur = etat.joueurs[evenement.joueur];
  const notifications: Notification[] = [
    {
      nom: 'malusRamasse',
      pour: evenement.joueur,
      charge: { nature: evenement.nature, dureeMs: evenement.dureeMs },
    },
  ];

  for (const victime of evenement.victimes) {
    notifications.push({
      nom: 'malusSubi',
      pour: victime,
      charge: {
        nature: evenement.nature,
        dureeMs: evenement.dureeMs,
        parPseudo: ramasseur?.pseudo ?? '',
      },
    });
  }

  return notifications;
}
