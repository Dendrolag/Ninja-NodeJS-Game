/**
 * Le comportement des bots: l'errance des uns, la chasse des autres.
 *
 * Portage des classes Bot (legacy/server.js:941) et BlackBot (:1130), ainsi que
 * de createBots (:1547), addBot (:1553), updateBots (:1558) et spawnBlackBots
 * (:1333). C'est la derniere piece du gameplay a rejoindre le moteur pur.
 *
 * COMMENT ERRE UN BOT ORDINAIRE, en quatre phrases.
 *
 *   - Il alterne des phases de marche et de pause, d'une a trois secondes.
 *   - Quand il marche, il suit son cap et en change spontanement toutes les une a
 *     trois secondes.
 *   - Quand un mur lui barre la route, il ne glisse pas le long comme un joueur:
 *     il choisit un autre cap. C'est ce qui donne aux bots leur demarche de
 *     billard, et c'est le comportement du legacy.
 *   - Un controle periodique verifie qu'il avance vraiment. S'il ne bouge plus,
 *     il change de cap, puis se degage de force, puis reapparait ailleurs.
 *
 * COMMENT CHASSE UN BOT NOIR.
 *
 *   - Toutes les demi-secondes, il cherche la proie la plus interessante dans son
 *     rayon de detection: un joueur vulnerable d'abord, un bot deja capture par
 *     quelqu'un ensuite. Un bot neutre ne l'interesse pas, il n'y a rien a y
 *     prendre.
 *   - Entre deux recherches, un joueur qui entre dans son rayon lui fait lacher
 *     le bot qu'il poursuivait.
 *   - Il fonce en ligne droite sur sa proie et l'attrape a vingt pixels. Un joueur
 *     attrape perd une part de ses bots et reapparait ailleurs; un bot attrape
 *     redevient neutre.
 *   - Sans proie, il erre comme un bot ordinaire.
 *
 * CINQ DEFAUTS DE L'AUDIT SONT TRAITES ICI.
 *
 *   - X12: une capture par bot noir ne cree plus de bots. Le legacy repeignait en
 *     neutre les bots perdus PUIS en creait autant de nouveaux, si bien que la
 *     population derivait a la hausse pendant toute la partie.
 *   - X14: le rayon de detection et la part de bots perdue sont lus dans les
 *     reglages de la partie, et non dans les valeurs par defaut.
 *   - X26: le moment d'apparition des bots noirs est un reglage qui agit.
 *   - X27: un bot noir lance a la poursuite ne traverse plus les murs.
 *   - X28: un bot avance a la vitesse des bots, ni plus ni moins.
 *
 * CE QUI N'EST PAS PORTE. Bot.unstuck (:1034) n'est appelee nulle part et
 * s'appuie sur une methode inexistante: c'est du code mort, signale au defaut X10
 * de l'audit. Le bornage des coordonnees a la carte (:1093) ne sert plus a rien:
 * hors de la carte tout est mur, donc aucun deplacement n'en sort. Le champ
 * destroyed teste par updateBots (:1569) n'est jamais ecrit nulle part.
 */

import type { Position, Vecteur } from '@neon-ninja/shared';
import { BOTS, BOTS_NOIRS, COULEUR_BOT_NEUTRE, DUREES, VITESSES, reel } from '@neon-ninja/shared';

import { trajetTenable } from './collisions.js';
import { resoudreDeplacement } from './deplacement.js';
import { aLaLongueur, directionDuVecteur } from './direction.js';
import type { Bot, BotNoir, EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import {
  ajouterBot,
  estInvulnerable,
  identifiantSuivant,
  positionDApparition,
  positionsOccupees,
} from './etat.js';

/**
 * Un bot en cours de mise a jour, et l'etat dans lequel il evolue.
 *
 * Le bot voyage a cote de l'etat plutot que dedans: tant que son battement n'est
 * pas fini, il n'a pas a etre range. C'est aussi ce qui permet a une capture de
 * modifier l'etat sans que le bot en cours ne soit ecrase au passage.
 */
interface Avancement {
  readonly etat: EtatPartie;
  readonly bot: Bot;
}

/** Le meme, quand on sait que le bot est noir. */
interface AvancementDeBotNoir {
  readonly etat: EtatPartie;
  readonly bot: BotNoir;
}

/**
 * Fait avancer tous les bots d'un battement, puis fait entrer les bots noirs si
 * leur heure est venue.
 *
 * Portage de updateBots (legacy/server.js:1558), y compris son ordre: les bots
 * noirs qui apparaissent ne jouent qu'a partir du battement suivant.
 *
 * Les bots sont parcourus dans leur ordre d'arrivee, chacun agissant sur l'etat
 * laisse par le precedent. C'est ce qui rend le resultat reproductible.
 */
export function avancerLesBots(etat: EtatPartie, dtMs: number): EtatPartie {
  let courant = etat;

  for (const id of Object.keys(etat.bots)) {
    const bot = courant.bots[id];

    // Un bot peut avoir disparu depuis le debut du parcours: rien ne le fait
    // aujourd'hui, mais la regle du jeu peut changer et l'oubli couterait cher.
    if (bot === undefined) {
      continue;
    }

    const avancement =
      bot.type === 'botNoir' ? avancerUnBotNoir(courant, bot, dtMs) : errer(courant, bot, dtMs);

    courant = poser(avancement.etat, avancement.bot);
  }

  return faireApparaitreLesBotsNoirs(courant);
}

/** Range un bot dans l'etat, a la place qu'il occupait. */
function poser(etat: EtatPartie, bot: Bot): EtatPartie {
  return { ...etat, bots: { ...etat.bots, [bot.id]: bot } };
}

/**
 * Peuple la carte de bots ordinaires.
 *
 * Portage de createBots (legacy/server.js:1547) et addBot (:1553). Les
 * identifiants viennent du compteur de l'etat, la ou le legacy les fabriquait
 * avec Date.now() et Math.random(): a graine egale, deux parties peuplent donc la
 * carte exactement de la meme facon.
 *
 * Cette fonction n'est pas appelee par creerEtatInitial: c'est le serveur qui
 * decide du moment ou une partie se peuple, au lancement et non a la creation du
 * salon.
 *
 * @param nombre Combien de bots poser. Par defaut, celui des reglages.
 */
export function peuplerDeBots(
  etat: EtatPartie,
  nombre: number = etat.reglages.nombreBotsInitial,
): EtatPartie {
  let courant = etat;

  for (let pose = 0; pose < nombre; pose += 1) {
    courant = ajouterUnBot(courant, 'bot');
  }

  return courant;
}

/**
 * Fait entrer les bots noirs en jeu quand la partie a assez avance.
 *
 * Portage de spawnBlackBots (legacy/server.js:1333). Deux choses a savoir:
 *
 *   - Le moment d'apparition est un reglage. Le legacy en avait un lui aussi,
 *     blackBotStartPercent, mais il ne le lisait nulle part et coupait la partie
 *     en deux en dur (defaut X26). La valeur par defaut, cinquante pour cent,
 *     reproduit donc exactement le jeu tel qu'il se joue.
 *   - Les bots noirs reviennent. La condition du legacy porte sur leur absence,
 *     pas sur une apparition deja faite: detruire le dernier bot noir en fait
 *     donc renaitre une fournee complete. C'est du jeu, pas un defaut, et c'est
 *     conserve.
 */
export function faireApparaitreLesBotsNoirs(etat: EtatPartie): EtatPartie {
  const reglages = etat.reglages.botsNoirs;

  if (!reglages.actifs) {
    return etat;
  }

  if (etat.tempsEcouleMs < (etat.dureeMs * reglages.momentApparitionPourCent) / 100) {
    return etat;
  }

  if (Object.values(etat.bots).some((bot) => bot.type === 'botNoir')) {
    return etat;
  }

  let courant = etat;

  for (let pose = 0; pose < reglages.nombre; pose += 1) {
    courant = ajouterUnBot(courant, 'botNoir');
  }

  return courant;
}

/** Pose un bot de plus, avec un identifiant tire du compteur de l'etat. */
function ajouterUnBot(etat: EtatPartie, type: 'bot' | 'botNoir'): EtatPartie {
  const identifiant = identifiantSuivant(etat, type);

  return ajouterBot(
    { ...etat, compteurIdentifiants: identifiant.compteur },
    { id: identifiant.valeur, type },
  );
}

/**
 * Un battement d'errance: on bascule marche et pause, on verifie qu'on avance,
 * et on avance.
 *
 * Portage de Bot.update (legacy/server.js:961), dans son ordre exact.
 */
function errer(etat: EtatPartie, bot: Bot, dtMs: number): Avancement {
  const apresBascule = basculerEntreMarcheEtPause(etat, bot, dtMs);
  const apresControle = controlerLeBlocage(apresBascule.etat, apresBascule.bot, dtMs);

  return apresControle.bot.enMouvement
    ? avancerDroitDevant(apresControle.etat, apresControle.bot, dtMs)
    : apresControle;
}

/**
 * Alterne marche et pause, et retire une nouvelle duree a chaque bascule.
 *
 * Si le temps ecoule couvre plusieurs durees, elles se produisent toutes: le
 * comportement ne depend donc pas du decoupage du temps. La boucle se termine
 * toujours, une duree valant au moins une seconde.
 *
 * En entrant en pause, le bot s'arrete de regarder devant lui et son suivi de
 * blocage repart de zero: c'est ce que fait le legacy (:973), et c'est sense, un
 * bot en pause n'est pas un bot bloque.
 */
function basculerEntreMarcheEtPause(etat: EtatPartie, bot: Bot, dtMs: number): Avancement {
  let courant: Avancement = { etat, bot };
  let restant = bot.avantChangementDEtatMs - dtMs;

  while (restant <= 0) {
    const enMouvement = !courant.bot.enMouvement;
    const tirage = reel(courant.etat.alea, BOTS.DUREE_ETAT_MINIMUM_MS, BOTS.DUREE_ETAT_MAXIMUM_MS);
    restant += tirage.valeur;

    courant = {
      etat: { ...courant.etat, alea: tirage.alea },
      bot: enMouvement
        ? { ...courant.bot, enMouvement }
        : {
            ...courant.bot,
            enMouvement,
            direction: 'immobile',
            positionAuDernierControle: courant.bot.position,
            controlesSansAvancer: 0,
          },
    };
  }

  return { etat: courant.etat, bot: { ...courant.bot, avantChangementDEtatMs: restant } };
}

/**
 * Verifie de temps en temps que le bot avance vraiment, et le debloque sinon.
 *
 * Portage du controle de Bot.update (legacy/server.js:981). Le controle ne
 * s'exerce que sur un bot qui essaie d'avancer, mais son compte a rebours
 * continue de descendre pendant une pause: la verification a donc lieu des la
 * reprise, exactement comme dans le legacy ou l'instant du dernier controle
 * n'etait pas repousse pendant les pauses.
 *
 * L'escalade est celle du legacy: au-dela de trois controles sans avancer, le bot
 * change de cap; au-dela de cinq, il se degage de force.
 */
function controlerLeBlocage(etat: EtatPartie, bot: Bot, dtMs: number): Avancement {
  const restant = bot.avantControleDeBlocageMs - dtMs;

  if (!bot.enMouvement || restant > 0) {
    return { etat, bot: { ...bot, avantControleDeBlocageMs: restant } };
  }

  const parcourue = Math.hypot(
    bot.position.x - bot.positionAuDernierControle.x,
    bot.position.y - bot.positionAuDernierControle.y,
  );

  let sansAvancer = parcourue < BOTS.DEPLACEMENT_MINIMUM_PX ? bot.controlesSansAvancer + 1 : 0;
  let courant: Avancement = { etat, bot };

  if (sansAvancer > BOTS.CONTROLES_AVANT_CHANGEMENT_DE_CAP) {
    courant = changerDeCap(courant.etat, courant.bot);

    if (sansAvancer > BOTS.CONTROLES_AVANT_DEGAGEMENT) {
      courant = seDegager(courant.etat, courant.bot);
      sansAvancer = 0;
    }
  }

  return {
    etat: courant.etat,
    bot: {
      ...courant.bot,
      controlesSansAvancer: sansAvancer,
      positionAuDernierControle: courant.bot.position,
      avantControleDeBlocageMs: periodeDeControle(courant.bot),
    },
  };
}

/** A quelle cadence un bot verifie qu'il n'est pas bloque. Le bot noir est plus attentif. */
function periodeDeControle(bot: Bot): number {
  return bot.type === 'botNoir'
    ? BOTS.CONTROLE_DE_BLOCAGE_BOT_NOIR_MS
    : BOTS.CONTROLE_DE_BLOCAGE_MS;
}

/**
 * Fait avancer un bot le long de son cap, en changeant de cap quand c'est l'heure
 * ou quand un mur s'y oppose.
 *
 * Portage de Bot.move (legacy/server.js:1068). La distance parcourue est
 * proportionnelle au temps ecoule, la ou le legacy avancait d'un pas fixe a
 * chaque battement de sa boucle.
 *
 * Un bot bloque ne glisse pas le long du mur, contrairement a un joueur: il
 * change de cap et ne bouge pas de ce battement-ci. Il garde aussi la direction
 * qu'il regardait, comme dans le legacy.
 */
function avancerDroitDevant(etat: EtatPartie, bot: Bot, dtMs: number): Avancement {
  let courant: Avancement = { etat, bot };
  let restant = bot.avantChangementDeCapMs - dtMs;

  while (restant <= 0) {
    courant = changerDeCap(courant.etat, courant.bot);

    const tirage = reel(
      courant.etat.alea,
      BOTS.INTERVALLE_DE_CAP_MINIMUM_MS,
      BOTS.INTERVALLE_DE_CAP_MAXIMUM_MS,
    );
    restant += tirage.valeur;
    courant = { ...courant, etat: { ...courant.etat, alea: tirage.alea } };
  }

  const suivant = courant.bot;
  const pas = aLaLongueur(suivant.cap, (vitesseDe(suivant) * dtMs) / 1000);
  const arrivee = { x: suivant.position.x + pas.x, y: suivant.position.y + pas.y };

  if (!trajetTenable(courant.etat.terrain, suivant.position, arrivee)) {
    const detourne = changerDeCap(courant.etat, suivant);

    return { etat: detourne.etat, bot: { ...detourne.bot, avantChangementDeCapMs: restant } };
  }

  return {
    etat: courant.etat,
    bot: {
      ...suivant,
      position: arrivee,
      // La direction se lit sur le cap et non sur le pas: a tres petit dt, le pas
      // passerait sous le seuil d'immobilite et le bot semblerait s'arreter.
      direction: directionDuVecteur(suivant.cap),
      avantChangementDeCapMs: restant,
    },
  };
}

/** A quelle vitesse avance un bot. Le bot noir va exactement aussi vite (defaut X13). */
function vitesseDe(bot: Bot): number {
  return bot.type === 'botNoir' ? VITESSES.BOT_NOIR_PX_PAR_SECONDE : VITESSES.BOT_PX_PAR_SECONDE;
}

/**
 * Cherche un nouveau cap, a moins de quatre-vingt-dix degres du precedent.
 *
 * Portage de Bot.changeDirection (legacy/server.js:1097): huit tirages au plus,
 * chacun verifie a dix pixels devant, et un demi-tour si aucun ne convient. Les
 * ecarts sont volontairement modestes, c'est ce qui donne aux bots une trajectoire
 * qui serpente plutot qu'un mouvement brownien.
 */
function changerDeCap(etat: EtatPartie, bot: Bot): Avancement {
  const capActuel = Math.atan2(bot.cap.y, bot.cap.x);
  let alea = etat.alea;

  for (let tentative = 0; tentative < BOTS.TENTATIVES_DE_CAP_MAXIMUM; tentative += 1) {
    const ecart = reel(alea, -Math.PI / 2, Math.PI / 2);
    alea = ecart.alea;

    const cap = capUnitaire(capActuel + ecart.valeur);

    if (capPraticable(etat, bot.position, cap, BOTS.PORTEE_DU_TEST_DE_CAP_PX)) {
      return { etat: { ...etat, alea }, bot: { ...bot, cap } };
    }
  }

  return {
    etat: { ...etat, alea },
    bot: { ...bot, cap: { x: -bot.cap.x, y: -bot.cap.y } },
  };
}

/**
 * Degage un bot coince, en le poussant dans la premiere des huit directions
 * cardinales qui passe.
 *
 * Portage de Bot.findEscapePath (legacy/server.js:1007). En dernier recours, le
 * bot reapparait ailleurs sur la carte et repart dans une direction neuve.
 */
function seDegager(etat: EtatPartie, bot: Bot): Avancement {
  for (const angle of BOTS.ANGLES_DE_DEGAGEMENT_DEGRES) {
    const cap = capUnitaire((angle * Math.PI) / 180);
    const bond = {
      x: bot.position.x + cap.x * BOTS.DISTANCE_DE_DEGAGEMENT_PX,
      y: bot.position.y + cap.y * BOTS.DISTANCE_DE_DEGAGEMENT_PX,
    };

    if (trajetTenable(etat.terrain, bot.position, bond)) {
      return { etat, bot: { ...bot, position: bond, cap } };
    }
  }

  const place = positionDApparition(etat.alea, etat.terrain, positionsOccupees(etat));

  return changerDeCap({ ...etat, alea: place.alea }, { ...bot, position: place.valeur });
}

/** Le vecteur unitaire d'un cap donne en radians. */
function capUnitaire(radians: number): Vecteur {
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

/** Peut-on avancer d'une distance donnee dans ce cap sans rencontrer de mur ? */
function capPraticable(
  etat: EtatPartie,
  depart: Position,
  cap: Vecteur,
  distance: number,
): boolean {
  const essai = { x: depart.x + cap.x * distance, y: depart.y + cap.y * distance };

  return trajetTenable(etat.terrain, depart, essai);
}

/**
 * Un battement de bot noir: choisir une proie, puis la poursuivre ou errer.
 *
 * Portage de BlackBot.update (legacy/server.js:1148).
 */
function avancerUnBotNoir(etat: EtatPartie, botNoir: BotNoir, dtMs: number): Avancement {
  const refroidi: BotNoir = {
    ...botNoir,
    avantProchaineCaptureMs: Math.max(botNoir.avantProchaineCaptureMs - dtMs, 0),
  };
  const vise = choisirUneProie(etat, refroidi, dtMs);

  return vise.bot.cible === undefined
    ? errer(vise.etat, vise.bot, dtMs)
    : poursuivre(vise.etat, vise.bot, dtMs);
}

/**
 * Decide qui le bot noir poursuit pendant ce battement.
 *
 * Portage du debut de BlackBot.update (legacy/server.js:1152). Deux regimes:
 *
 *   - Sans proie, ou toutes les demi-secondes, il refait le tour de ce qui
 *     l'entoure et prend le meilleur.
 *   - Entre deux tours d'horizon, il se contente de verifier que sa proie est
 *     toujours la et toujours a portee. Un joueur qui entre dans son rayon lui
 *     fait cependant lacher le bot qu'il poursuivait: un joueur vaut toujours
 *     mieux qu'un bot.
 */
function choisirUneProie(etat: EtatPartie, bot: BotNoir, dtMs: number): AvancementDeBotNoir {
  const restant = bot.avantRechercheDeCibleMs - dtMs;

  if (bot.cible === undefined || restant <= 0) {
    return {
      etat,
      bot: {
        ...bot,
        cible: laProieLaPlusInteressante(etat, bot),
        avantRechercheDeCibleMs: BOTS_NOIRS.INTERVALLE_DE_RECHERCHE_MS,
      },
    };
  }

  const poursuivie = proieDe(etat, bot.cible);
  const cible =
    poursuivie !== undefined && poursuivie.type === 'bot'
      ? (leJoueurLePlusProcheAPortee(etat, bot) ?? bot.cible)
      : bot.cible;

  return {
    etat,
    bot: { ...bot, cible: cibleEncoreValable(etat, bot, cible), avantRechercheDeCibleMs: restant },
  };
}

/** La proie garde-t-elle sa place ? Elle doit exister encore, et rester a portee. */
function cibleEncoreValable(
  etat: EtatPartie,
  bot: BotNoir,
  cible: IdentifiantEntite,
): IdentifiantEntite | undefined {
  const proie = proieDe(etat, cible);

  if (proie === undefined) {
    return undefined;
  }

  return distanceEntre(bot.position, proie.position) > etat.reglages.botsNoirs.rayonDetectionPx
    ? undefined
    : cible;
}

/** Retrouve une proie, joueur ou bot, par son identifiant. */
function proieDe(etat: EtatPartie, cible: IdentifiantEntite): Joueur | Bot | undefined {
  return etat.joueurs[cible] ?? etat.bots[cible];
}

/**
 * Le meilleur choix de proie dans le rayon de detection.
 *
 * Portage de BlackBot.findNewTarget (legacy/server.js:1185). Un joueur prime
 * toujours sur un bot, et parmi les candidats de meme nature, le plus proche
 * l'emporte. Un joueur protege par son apparition ou par l'invincibilite n'est
 * pas une proie; un bot deja neutre non plus, il n'y a rien a y prendre.
 *
 * Les bots noirs s'ignorent entre eux, comme dans le legacy, ou ils vivaient dans
 * une table que la recherche de proie ne parcourait pas.
 */
function laProieLaPlusInteressante(etat: EtatPartie, bot: BotNoir): IdentifiantEntite | undefined {
  const joueur = leJoueurLePlusProcheAPortee(etat, bot);

  if (joueur !== undefined) {
    return joueur;
  }

  const rayon = etat.reglages.botsNoirs.rayonDetectionPx;
  let meilleur: IdentifiantEntite | undefined;
  let meilleureDistance = Infinity;

  for (const autre of Object.values(etat.bots)) {
    if (autre.type !== 'bot' || autre.couleur === COULEUR_BOT_NEUTRE) {
      continue;
    }

    const distance = distanceEntre(bot.position, autre.position);
    if (distance < rayon && distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleur = autre.id;
    }
  }

  return meilleur;
}

/**
 * Le joueur vulnerable le plus proche dans le rayon de detection.
 *
 * Le legacy posait la question de deux facons differentes: la recherche complete
 * ecartait les joueurs invulnerables (:1200), mais la verification faite entre
 * deux recherches ne regardait que l'invincibilite (:1161) et laissait donc un
 * bot noir se lancer aux trousses d'un joueur qui vient d'apparaitre, pour se
 * voir refuser la capture une fois arrive. La question est ici posee une seule
 * fois, de la facon complete.
 */
function leJoueurLePlusProcheAPortee(
  etat: EtatPartie,
  bot: BotNoir,
): IdentifiantEntite | undefined {
  const rayon = etat.reglages.botsNoirs.rayonDetectionPx;
  let meilleur: IdentifiantEntite | undefined;
  let meilleureDistance = Infinity;

  for (const joueur of Object.values(etat.joueurs)) {
    if (estInvulnerable(joueur)) {
      continue;
    }

    const distance = distanceEntre(bot.position, joueur.position);
    if (distance < rayon && distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleur = joueur.id;
    }
  }

  return meilleur;
}

/**
 * Fonce sur la proie, et l'attrape si elle est a portee de bras.
 *
 * Portage de BlackBot.pursueTarget (legacy/server.js:1227), avec deux
 * differences, toutes deux dues au fait que le moteur avance par duree et non
 * par pas fixe.
 *
 * 1. Le deplacement passe par la resolution ordinaire: le bot noir ne traverse
 *    plus les murs (defaut X27).
 * 2. Son pas ne depasse jamais la distance qui le separe de sa proie, et la prise
 *    se juge sur la distance une fois le pas fait. Le legacy avancait de cinq
 *    pixels puis jugeait sur la distance d'avant, ce qui revient au meme quand le
 *    pas est court; avec un pas de temps grossier, un chasseur qui ne s'arrete
 *    pas sur sa proie la depasserait sans la voir.
 */
function poursuivre(etat: EtatPartie, bot: BotNoir, dtMs: number): Avancement {
  const proie = bot.cible === undefined ? undefined : proieDe(etat, bot.cible);

  if (proie === undefined) {
    return { etat, bot };
  }

  const chasseur = seRapprocherDe(etat, bot, proie.position, dtMs);

  return distanceEntre(chasseur.position, proie.position) < BOTS_NOIRS.SEUIL_DE_CAPTURE_PX
    ? attraper(etat, chasseur, proie)
    : { etat, bot: chasseur };
}

/**
 * Avance vers un point, sans jamais le depasser.
 *
 * Un bot noir exactement sur sa proie n'a aucune direction a suivre: il reste ou
 * il est, en gardant son cap. La prise, elle, se juge apres coup, et elle a bien
 * lieu: c'est le sens du legacy, qui sautait le calcul de direction sans sauter
 * la prise.
 */
function seRapprocherDe(etat: EtatPartie, bot: BotNoir, but: Position, dtMs: number): BotNoir {
  const ecart = { x: but.x - bot.position.x, y: but.y - bot.position.y };
  const distance = Math.hypot(ecart.x, ecart.y);

  if (distance === 0) {
    return bot;
  }

  const cap = { x: ecart.x / distance, y: ecart.y / distance };
  const elan = Math.min((VITESSES.BOT_NOIR_PX_PAR_SECONDE * dtMs) / 1000, distance);

  return {
    ...bot,
    cap,
    position: resoudreDeplacement(etat.terrain, bot.position, aLaLongueur(cap, elan)),
    direction: directionDuVecteur(cap),
  };
}

/**
 * Le bot noir attrape ce qu'il poursuivait.
 *
 * Portage de BlackBot.captureEntity (legacy/server.js:1257). Le delai de deux
 * secondes se consomme dans tous les cas ou la prise a lieu, y compris sur un bot
 * deja neutre, qui ne change alors rien: c'est le comportement du legacy, ou la
 * mise a jour du delai suivait les deux branches.
 *
 * Un joueur protege, lui, ne consomme rien: le bot noir reste arme et pourra
 * attraper quelqu'un d'autre au battement suivant.
 */
function attraper(etat: EtatPartie, bot: BotNoir, proie: Joueur | Bot): Avancement {
  if (bot.avantProchaineCaptureMs > 0) {
    return { etat, bot };
  }

  if (proie.type === 'botNoir') {
    return { etat, bot };
  }

  if (proie.type === 'joueur') {
    return estInvulnerable(proie)
      ? { etat, bot }
      : { etat: depouiller(etat, bot, proie), bot: apresLaPrise(bot) };
  }

  const rendu =
    proie.couleur === COULEUR_BOT_NEUTRE
      ? etat
      : poser(etat, { ...proie, couleur: COULEUR_BOT_NEUTRE });

  return { etat: rendu, bot: apresLaPrise(bot) };
}

/** Apres une prise, le bot noir lache sa proie et rearme son delai. */
function apresLaPrise(bot: BotNoir): BotNoir {
  return {
    ...bot,
    cible: undefined,
    avantProchaineCaptureMs: BOTS_NOIRS.DELAI_ENTRE_CAPTURES_MS,
  };
}

/**
 * Un joueur attrape par un bot noir perd une part de ses bots et reapparait.
 *
 * Portage de la branche joueur de captureEntity (legacy/server.js:1261). Trois
 * points a retenir:
 *
 *   - La victime GARDE sa couleur, contrairement a une capture par un joueur. Le
 *     legacy appelle respawn([], true), ou le second argument dit precisement
 *     cela. Elle ne perd donc pas tout, seulement la part fixee par les reglages.
 *   - Les bots perdus redeviennent neutres, et AUCUN bot n'est cree. Le legacy en
 *     creait autant qu'il en avait repeint, ce qui faisait grossir la population
 *     a chaque capture: c'est le defaut X12 de l'audit.
 *   - La part perdue vient des reglages de la partie, pas des valeurs par defaut
 *     (defaut X14).
 */
function depouiller(etat: EtatPartie, botNoir: BotNoir, victime: Joueur): EtatPartie {
  const portes = Object.values(etat.bots).filter(
    (bot) => bot.type === 'bot' && bot.couleur === victime.couleur,
  );
  const perdus = Math.floor(
    (portes.length * etat.reglages.botsNoirs.partDeBotsPerduePourCent) / 100,
  );

  const bots = { ...etat.bots };
  for (const bot of portes.slice(0, perdus)) {
    bots[bot.id] = { ...bot, couleur: COULEUR_BOT_NEUTRE };
  }

  const place = positionDApparition(etat.alea, etat.terrain, positionsOccupees(etat));

  return {
    ...etat,
    bots,
    joueurs: {
      ...etat.joueurs,
      [victime.id]: {
        ...victime,
        position: place.valeur,
        direction: 'immobile',
        protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
        capturesParBotNoirSubies: victime.capturesParBotNoirSubies + 1,
      },
    },
    evenements: [
      ...etat.evenements,
      {
        type: 'captureParBotNoir',
        botNoir: botNoir.id,
        victime: victime.id,
        botsPerdus: perdus,
        position: victime.position,
      },
    ],
    alea: place.alea,
  };
}

/** Distance entre deux positions, en pixels. */
function distanceEntre(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}
