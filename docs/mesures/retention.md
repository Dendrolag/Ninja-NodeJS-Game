# Rétention et calibration des succès

Relevés de l'étape 3.7, décision 7 de l'étude des succès (`docs/design/etude-succes.md`). Ils disent si les succès changent quelque chose au retour des joueurs, et donnent les chiffres qui permettront un jour de recalibrer leurs seuils.

## Ce qui est mesuré

Tout se lit dans les résultats enregistrés, sans pisteur. Seuls les comptes sont mesurés: un invité ne laisse aucun résultat.

- **Comptes actifs par semaine**: les comptes qui ont joué au moins une partie dans la semaine, du lundi au dimanche, à l'heure de Paris.
- **Retour à sept jours**: pour chaque semaine de première partie, la part des comptes qui ont rejoué sept jours ou plus après leur première partie. Une semaine dont la première partie date de moins de sept jours n'est pas encore mesurable, et n'apparaît pas.
- **Calibration**: prises et Black Ninjas détruits par partie, victoires par compte, parties par compte et par semaine active, chacun en moyenne, médiane, neuvième décile et maximum.

## Procédure

Depuis un poste qui a l'adresse de la base de production dans `DATABASE_URL`:

```bash
pnpm base:mesurer
```

La commande ne fait que lire. Recopier son texte ci-dessous, sous la date du relevé.

**Un relevé suffit, un mois après la mise en ligne des succès.** La commande relit l'historique des parties: les semaines d'avant la mise en ligne s'y lisent aussi bien que celles d'après, quel que soit le jour où elle est lancée. Un relevé plus tôt ne donne rien de plus. Noter seulement la date de la mise en ligne, qui sépare les cohortes d'avant et d'après.

Mise en ligne des succès (étape 3.7): **27 septembre 2026, 10 h 05 à Paris** (commit `d68bc15`, run de CI `36304108846`). Les cohortes des semaines suivantes sont celles d'après. Ce jour-là, la production ne comptait qu'un compte: un relevé ne dira quelque chose qu'une fois d'autres joueurs inscrits.

Comparer surtout le retour à sept jours des cohortes d'après la mise en ligne à celles d'avant. Avec peu de joueurs, un écart de quelques points ne dit rien: il faut plusieurs semaines de cohortes pour conclure.

## Relevés

Aucun relevé n'est encore fait: cette session n'avait pas accès à la base de production.
