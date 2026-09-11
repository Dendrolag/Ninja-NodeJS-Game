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
  CompteDeSession,
  EntiteVue,
  InfosSalon,
  InstantanePartie,
  JoueurDuSalon,
  LigneClassement,
  MalusRamasseParMoi,
  MalusSubi,
  ObjetVu,
  PartiePublique,
  ZoneVue,
} from '@neon-ninja/shared';
import type {
  Bot,
  EtatPartie,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
  LigneScore,
  ObjetRamassable,
  ZoneSpeciale,
} from '@neon-ninja/sim';
import { bonusActif, calculerScores, evaluerFinDePartie, toutesLesEntites } from '@neon-ninja/sim';

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
    entites: toutesLesEntites(etat).map(entiteVue),
    objets: Object.values(etat.objets).map(objetVu),
    zones: Object.values(etat.zones).map(zoneVue),
    classement: calculerScores(etat).map(ligneClassement),
  };
}

/** Convertit une entite du moteur en ce que tout le monde a le droit d'en voir. */
function entiteVue(entite: Joueur | Bot): EntiteVue {
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
    };
  }

  return { ...commun, type: entite.type };
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
}): JoueurDuSalon {
  return {
    id: joueur.id,
    pseudo: joueur.pseudo,
    hote: joueur.hote,
    ...(joueur.compte === undefined ? {} : { compte: { niveau: joueur.compte.niveau } }),
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
  | { readonly nom: 'malusSubi'; readonly pour: IdentifiantEntite; readonly charge: MalusSubi };

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
  }
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
