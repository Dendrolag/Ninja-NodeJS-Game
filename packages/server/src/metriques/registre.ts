/**
 * Les metriques du serveur: compteurs, jauges et histogrammes, ecrits au format texte de
 * Prometheus (etape 5.15).
 *
 * POURQUOI UN MODULE A NOUS. La bibliotheque d'usage, prom-client, alloue a chaque
 * observation selon ses etiquettes: elle cherche la serie de la combinaison demandee dans
 * une table, en fabriquant sa cle. Ici, une serie se demande une fois, hors du battement,
 * et se garde: observer ne coute ensuite qu'une addition, ou le parcours de quelques
 * bornes d'un histogramme. Rien n'est alloue, rien n'est trie.
 *
 * LE SERVEUR N'ENVOIE RIEN. Il compte, et ecrit le tout en texte quand l'agent de la
 * machine le lui demande, toutes les quinze secondes (route /metriques, sur un port local
 * seulement). C'est la seule chose qui coute un peu: quelques milliers de lignes, quatre
 * fois par minute.
 *
 * DES ETIQUETTES BORNEES. Une etiquette multiplie les series: une par partie ou par
 * joueur ferait exploser l'offre gratuite de Grafana Cloud, et sortir des donnees
 * personnelles. Les etiquettes sont donc des listes fermees (mode, carte, appareil); ce
 * qui identifie une partie ou un joueur va dans le journal.
 */

/** Des valeurs d'etiquettes, dans l'ordre des noms de la famille. */
export type ValeursDEtiquettes = readonly string[];

/** Une serie qui compte: elle ne fait que monter, et repart de zero au redemarrage. */
export class Compteur {
  /** La valeur, lue a l'ecriture. */
  valeur = 0;

  /** Ajoute une quantite, un par defaut. Une quantite negative ou illisible est ignoree. */
  ajouter(quantite = 1): void {
    if (quantite > 0 && Number.isFinite(quantite)) {
      this.valeur += quantite;
    }
  }
}

/** Une serie qui monte et descend: une mesure a un instant. */
export class Jauge {
  /** La valeur, lue a l'ecriture. */
  valeur = 0;

  /** Pose la valeur. */
  poser(valeur: number): void {
    this.valeur = Number.isFinite(valeur) ? valeur : 0;
  }
}

/**
 * Une repartition: combien d'observations sous chaque borne, leur somme et leur nombre.
 *
 * Les cases sont fixees a la creation. Une observation parcourt les bornes jusqu'a la
 * premiere qui la contient, et ajoute un a cette case; l'ecriture cumule.
 */
export class Histogramme {
  /** Le nombre d'observations de chaque case; la derniere recoit tout ce qui depasse. */
  readonly cases: Float64Array;
  somme = 0;
  nombre = 0;

  constructor(readonly bornes: readonly number[]) {
    this.cases = new Float64Array(bornes.length + 1);
  }

  /** Range une observation. Une valeur negative ou illisible est ignoree. */
  observer(valeur: number): void {
    if (!(valeur >= 0) || !Number.isFinite(valeur)) {
      return;
    }

    let rang = 0;

    while (rang < this.bornes.length && valeur > (this.bornes[rang] ?? 0)) {
      rang += 1;
    }

    this.cases[rang] = (this.cases[rang] ?? 0) + 1;
    this.somme += valeur;
    this.nombre += 1;
  }

  /**
   * Ajoute des observations deja rangees ailleurs, case par case: celles d'un bulletin de
   * la page, qui a les memes bornes.
   *
   * @param cases Le nombre d'observations de chaque case, autant que celles-ci.
   * @param somme Leur somme.
   */
  fusionner(cases: readonly number[], somme: number): void {
    let total = 0;

    for (let rang = 0; rang < this.cases.length; rang += 1) {
      const nombre = cases[rang] ?? 0;
      this.cases[rang] = (this.cases[rang] ?? 0) + nombre;
      total += nombre;
    }

    this.somme += somme;
    this.nombre += total;
  }
}

/** Les trois natures de serie. */
type Nature = 'counter' | 'gauge' | 'histogram';

/** Une serie de l'une des trois natures. */
type Serie = Compteur | Jauge | Histogramme;

/**
 * Une famille de series: un nom, une aide, des noms d'etiquettes, et une serie par
 * combinaison de valeurs demandee.
 */
export class Famille<S extends Serie> {
  private readonly series = new Map<string, { readonly valeurs: ValeursDEtiquettes; serie: S }>();

  constructor(
    readonly nom: string,
    readonly aide: string,
    readonly nature: Nature,
    readonly etiquettes: readonly string[],
    private readonly fabriquer: () => S,
  ) {}

  /**
   * La serie de ces valeurs d'etiquettes, creee a sa premiere demande.
   *
   * A DEMANDER HORS DU BATTEMENT, et a garder: la cle se fabrique a chaque demande.
   *
   * @throws Si le nombre de valeurs n'est pas celui des etiquettes.
   */
  serie(...valeurs: ValeursDEtiquettes): S {
    if (valeurs.length !== this.etiquettes.length) {
      throw new Error(
        `La famille ${this.nom} attend ${String(this.etiquettes.length)} etiquettes, recu ${String(valeurs.length)}.`,
      );
    }

    const cle = valeurs.join('\u0000');
    const trouvee = this.series.get(cle);

    if (trouvee !== undefined) {
      return trouvee.serie;
    }

    const serie = this.fabriquer();
    this.series.set(cle, { valeurs: [...valeurs], serie });

    return serie;
  }

  /** Le nombre de series de la famille. */
  get taille(): number {
    return this.series.size;
  }

  /** Les series, avec leurs valeurs d'etiquettes, pour l'ecriture. */
  *parcourir(): Generator<{ readonly valeurs: ValeursDEtiquettes; readonly serie: S }> {
    yield* this.series.values();
  }
}

/**
 * Le registre: toutes les familles du serveur, et leur ecriture.
 *
 * Des etiquettes communes s'ajoutent a toutes les series: la version du jeu, constante pour
 * un processus. Elle ne multiplie donc rien, et chaque mise en ligne se lit sur les courbes.
 */
export class Registre {
  private readonly familles: Famille<Serie>[] = [];
  private readonly communes: string;

  /** @param etiquettesCommunes Les etiquettes de toutes les series, par exemple la version. */
  constructor(etiquettesCommunes: Readonly<Record<string, string>> = {}) {
    this.communes = Object.entries(etiquettesCommunes)
      .map(([nom, valeur]) => `${nom}="${echapper(valeur)}"`)
      .join(',');
  }

  /** Une famille de compteurs. Son nom finit par _total, comme le veut l'usage. */
  compteurs(nom: string, aide: string, etiquettes: readonly string[] = []): Famille<Compteur> {
    return this.ajouter(new Famille(nom, aide, 'counter', etiquettes, () => new Compteur()));
  }

  /** Une famille de jauges. */
  jauges(nom: string, aide: string, etiquettes: readonly string[] = []): Famille<Jauge> {
    return this.ajouter(new Famille(nom, aide, 'gauge', etiquettes, () => new Jauge()));
  }

  /** Une famille d'histogrammes, aux bornes croissantes. */
  histogrammes(
    nom: string,
    aide: string,
    bornes: readonly number[],
    etiquettes: readonly string[] = [],
  ): Famille<Histogramme> {
    return this.ajouter(
      new Famille(nom, aide, 'histogram', etiquettes, () => new Histogramme(bornes)),
    );
  }

  /** Le nom de chaque famille, ecrite ou non. */
  get nomsDesFamilles(): readonly string[] {
    return this.familles.map((famille) => famille.nom);
  }

  /** Le nombre de series ecrites, histogrammes comptes case par case. */
  get nombreDeSeries(): number {
    let total = 0;

    for (const famille of this.familles) {
      for (const { serie } of famille.parcourir()) {
        total += serie instanceof Histogramme ? serie.cases.length + 2 : 1;
      }
    }

    return total;
  }

  /** Toutes les series, au format texte de Prometheus. */
  ecrire(): string {
    const lignes: string[] = [];

    for (const famille of this.familles) {
      if (famille.taille === 0) {
        continue;
      }

      lignes.push(`# HELP ${famille.nom} ${famille.aide.replace(/\n/gu, ' ')}`);
      lignes.push(`# TYPE ${famille.nom} ${famille.nature}`);

      for (const { valeurs, serie } of famille.parcourir()) {
        const etiquettes = famille.etiquettes.map(
          (nom, rang) => `${nom}="${echapper(valeurs[rang] ?? '')}"`,
        );

        if (serie instanceof Histogramme) {
          this.ecrireLHistogramme(lignes, famille.nom, etiquettes, serie);
        } else {
          lignes.push(`${famille.nom}${this.accolades(etiquettes)} ${nombre(serie.valeur)}`);
        }
      }
    }

    return `${lignes.join('\n')}\n`;
  }

  private ajouter<S extends Serie>(famille: Famille<S>): Famille<S> {
    if (this.familles.some((existante) => existante.nom === famille.nom)) {
      throw new Error(`La famille ${famille.nom} existe deja.`);
    }

    this.familles.push(famille as unknown as Famille<Serie>);

    return famille;
  }

  private ecrireLHistogramme(
    lignes: string[],
    nom: string,
    etiquettes: readonly string[],
    histogramme: Histogramme,
  ): void {
    let cumul = 0;

    for (let rang = 0; rang < histogramme.cases.length; rang += 1) {
      cumul += histogramme.cases[rang] ?? 0;
      const borne = histogramme.bornes[rang];
      const le = borne === undefined ? '+Inf' : nombre(borne);
      lignes.push(`${nom}_bucket${this.accolades([...etiquettes, `le="${le}"`])} ${nombre(cumul)}`);
    }

    lignes.push(`${nom}_sum${this.accolades(etiquettes)} ${nombre(histogramme.somme)}`);
    lignes.push(`${nom}_count${this.accolades(etiquettes)} ${nombre(histogramme.nombre)}`);
  }

  /** Les etiquettes d'une ligne, communes comprises, entre accolades. */
  private accolades(etiquettes: readonly string[]): string {
    const toutes = this.communes === '' ? etiquettes : [...etiquettes, this.communes];

    return toutes.length === 0 ? '' : `{${toutes.join(',')}}`;
  }
}

/** Echappe une valeur d'etiquette: barre oblique inverse, guillemet, retour a la ligne. */
function echapper(valeur: string): string {
  return valeur.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/\n/gu, '\\n');
}

/** Un nombre, tel que Prometheus le lit: sans exposant inutile, au millieme pres. */
function nombre(valeur: number): string {
  return Number.isInteger(valeur) ? String(valeur) : String(Math.round(valeur * 1000) / 1000);
}
