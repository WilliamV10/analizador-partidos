/**
 * Explorar: elegir una estadística (goles, corners, tarjetas; total, por equipo o
 * 1er tiempo) y un valor con el deslizador para ver la probabilidad de exactamente N,
 * N o más y N o menos. En "Todos los partidos" ordena los partidos por esa probabilidad.
 *
 * "Ambos anotan" es de sí/no: no lleva deslizador y muestra su propio desglose.
 * "Jugadores" ordena a los jugadores (de un partido o de todos) por la probabilidad de
 * N o más tiros a puerta o totales.
 *
 * El deslizador actualiza los resultados en el lugar (sin pasar por el store) para no
 * cortar el arrastre; al soltarlo se guarda el valor.
 */
import {
  EXPLORER_GROUPS,
  EXPLORER_STATS,
  bttsBreakdown,
  distributionMean,
  explorerStat,
  isBinaryStat,
  isPlayerStat,
  playerRanking,
  TEAM_SERIES,
  recentMatches,
  statDistribution,
  valueProbabilities,
} from '../../domain/explorer.js';
import { TEXTS } from '../../texts.js';
import { card, chips, emptyState, growingList, iconButton, kvList, note, pageHead, segmented, selectField, stats, teamShort } from '../components.js';
import { h, replaceContent } from '../dom.js';
import { expandOnClick, playerShotsChart } from '../playerChart.js';
import { recentChart } from '../recentChart.js';
import { EMPTY, decimal, odds, percent } from '../formatters.js';
import { inLeague, leagueSelect, namesOf, tournamentLine } from './shared.js';

export const EXPLORER_SCOPES = Object.freeze({ MATCH: 'match', ALL: 'all' });

const fairOdds = (probability) => (probability > 0 ? odds(1 / probability) : EMPTY);

/** Unidad del deslizador: la del grupo o, en jugadores, la del tipo de tiro. */
const unitOf = (stat) => TEXTS.explorer.units[isPlayerStat(stat) ? stat.field : stat.group];

/** Valor mínimo del deslizador: en jugadores, "0 o más" siempre es 100 %. */
/**
 * El deslizador elige N y se muestra como la línea N − 0.5 (más de 2.5 = 3 o más). El mínimo es
 * 1 (línea 0.5): "más de −0.5" sería siempre 100 %.
 */
const minValueOf = () => 1;

/** Línea de apuesta que corresponde a N: 3 -> "2.5". */
export const lineOf = (value) => (value - 0.5).toFixed(1);

function sideLabel(stat, names) {
  if (isPlayerStat(stat)) return TEXTS.explorer.playerStats[stat.field];
  if (stat.source === 'halfTime' || stat.source === 'cornersFirstHalf') return TEXTS.explorer.firstHalf;
  if (stat.side === 'home') return names?.home ?? TEXTS.match.home;
  if (stat.side === 'away') return names?.away ?? TEXTS.match.away;
  return TEXTS.explorer.total;
}

/** Valor inicial: la línea más cercana a lo esperado (ej. 2.6 goles esperados -> línea 2.5). */
function defaultValue(distributions) {
  const means = distributions.filter(Boolean).map(distributionMean);
  return means.length ? Math.max(1, Math.round(means.reduce((sum, mean) => sum + mean, 0) / means.length)) : 1;
}

/** Barras de la distribución; las que superan la línea (N o más) se resaltan. */
function distributionChart(distribution, value, max) {
  const shown = distribution.slice(0, max + 1);
  const top = Math.max(...shown, 0.0001);
  return h(
    'div',
    { class: 'dist', role: 'img', 'aria-label': TEXTS.explorer.chartLabel },
    shown.map((probability, index) =>
      h(
        'div',
        { class: `dist__column${index >= value ? ' is-over' : ''}${index === value ? ' is-line' : ''}`, title: `${index}: ${percent(probability, 1)}` },
        h('span', { class: 'dist__bar', style: `height:${((probability / top) * 100).toFixed(1)}%` }),
        h('span', { class: 'dist__label' }, index === max ? `${index}+` : index),
      ),
    ),
  );
}

/** Cuotas de la casa para más y menos de la línea elegida, si existen. */
function quoteRows(analysis, stat, value, probabilities) {
  if (!stat.market) return [];
  const line = value - 0.5;
  const over = analysis.quotes.get(stat.market, 'over', line);
  const under = analysis.quotes.get(stat.market, 'under', line);
  return [
    over ? [TEXTS.explorer.houseOver(lineOf(value)), TEXTS.explorer.houseLine(percent(over.fairProbability), odds(over.odds), percent(probabilities.atLeast))] : null,
    under ? [TEXTS.explorer.houseUnder(lineOf(value)), TEXTS.explorer.houseLine(percent(under.fairProbability), odds(under.odds), percent(1 - probabilities.atLeast))] : null,
  ].filter(Boolean);
}

/** Otras estadísticas que se muestran en el detalle de cada partido de un equipo. */
const DETAIL_STATS = ['shots', 'shotsOnTarget', 'corners', 'yellows', 'possession', 'xg'];

const outcomeOf = (row) => (row.goalsFor > row.goalsAgainst ? 'win' : row.goalsFor === row.goalsAgainst ? 'draw' : 'loss');

/** Detalle de un partido de un equipo: rival, condición, resultado y lo hecho y concedido. */
function teamRowDetail(row, stat, series, matchTotal) {
  const names = TEXTS.recentChart.statNames;
  const tile = (label, mine, theirs, main = false) =>
    mine === null || mine === undefined
      ? null
      : { value: String(mine), label, hint: TEXTS.recentChart.conceded(theirs), tone: main ? 'accent' : '' };
  const mine = series.for(row);
  const theirs = series.against(row);
  // Con la estadística total, el recuadro principal es lo del partido (equipo + rival).
  const mainTile =
    matchTotal && mine !== null && mine !== undefined
      ? { value: String(mine + (theirs ?? 0)), label: TEXTS.recentChart.inMatch(names[stat.source]), hint: TEXTS.recentChart.split(mine, theirs), tone: 'accent' }
      : tile(names[stat.source], mine, theirs, true);
  return {
    title: TEXTS.recentChart.versus(row.opponent),
    subtitle: [row.date, row.competition, row.isHome ? TEXTS.recentChart.atHome : TEXTS.recentChart.away].filter(Boolean).join(' · '),
    result: { text: TEXTS.recentChart.resultValue(row.goalsFor, row.goalsAgainst, outcomeOf(row)), outcome: outcomeOf(row) },
    tiles: [
      mainTile,
      stat.source !== 'halfTime' && row.htGoalsFor !== null ? tile(names.halfTime, row.htGoalsFor, row.htGoalsAgainst) : null,
      ...DETAIL_STATS.filter((key) => key !== stat.source && row.stats[key]).map((key) => tile(names[key], row.stats[key].for, row.stats[key].against)),
    ].filter(Boolean),
  };
}

/**
 * Gráficas de los dos equipos para la estadística elegida, en cada partido reciente, con filtro
 * local/visita y detalle al tocar:
 *  - estadística total (ej. corners totales): lo del partido entero (equipo + rival), y se
 *    resaltan los partidos que llegan al valor del deslizador;
 *  - estadística de un equipo: lo que hizo ese equipo; se resalta con el valor del deslizador en
 *    la gráfica de ese equipo (en la del otro, en goles, los partidos en que anotó).
 * @returns {{ node: Node, refresh: () => void }[]}
 */
function teamCharts(analysis, stat, currentValue) {
  const series = TEAM_SERIES[stat.source];
  if (!series) return [];
  const unit = unitOf(stat);
  const count = analysis.config.explorer.teamGoalsMatches;
  const matchTotal = stat.side === 'total';
  const inMatch = (row) => {
    const mine = series.for(row);
    return mine === null || mine === undefined ? null : mine + (series.against(row) ?? 0);
  };
  const value = matchTotal ? inMatch : series.for;
  const thresholdFor = (side) => () => {
    if (matchTotal || stat.side === side) return currentValue();
    return stat.source === 'goals' ? 1 : null;
  };
  return ['home', 'away']
    .map((side) => {
      const team = analysis.match[side];
      const limit = thresholdFor(side);
      return recentChart({
        title: (matchTotal ? TEXTS.recentChart.matchTotalTitle : TEXTS.recentChart.teamTitle)(TEXTS.recentChart.statNames[stat.source], team.name),
        rows: recentMatches(team, count),
        value,
        threshold: limit,
        detail: (row) => teamRowDetail(row, stat, series, matchTotal),
        summary: (rows) => {
          const average = (read) => {
            const values = rows.map(read).filter((amount) => amount !== null && amount !== undefined);
            return values.length ? decimal(values.reduce((sum, amount) => sum + amount, 0) / values.length, 1) : EMPTY;
          };
          const threshold = limit();
          const reached =
            threshold === null
              ? { value: String(rows.length), label: TEXTS.recentChart.matchesCount }
              : { value: `${rows.filter((row) => value(row) >= threshold).length}/${rows.length}`, label: TEXTS.recentChart.reached(threshold, unit) };
          return matchTotal
            ? [
                { value: average(inMatch), label: TEXTS.recentChart.averageMatch, tone: 'accent' },
                { value: average(series.for), label: TEXTS.recentChart.averageFor },
                reached,
              ]
            : [
                { value: average(series.for), label: TEXTS.recentChart.averageFor, tone: 'accent' },
                { value: average(series.against), label: TEXTS.recentChart.averageAgainst },
                reached,
              ];
        },
      });
    })
    .filter(Boolean);
}

function matchResults(analysis, stat, value, max) {
  const distribution = statDistribution(analysis, stat.id);
  if (!distribution) return emptyState({ title: TEXTS.extra.noData });
  const probabilities = valueProbabilities(distribution, value);
  const unit = unitOf(stat);
  const quotes = quoteRows(analysis, stat, value, probabilities);
  return [
    stats(
      [
        { value: percent(probabilities.atLeast), label: TEXTS.explorer.over(lineOf(value), unit), hint: TEXTS.explorer.fair(fairOdds(probabilities.atLeast)), tone: 'accent' },
        { value: percent(1 - probabilities.atLeast), label: TEXTS.explorer.under(lineOf(value), unit), hint: TEXTS.explorer.fair(fairOdds(1 - probabilities.atLeast)) },
      ],
      2,
    ),
    card(
      { label: TEXTS.explorer.distributionLine(lineOf(value)) },
      distributionChart(distribution, value, max),
      kvList([[TEXTS.explorer.expected, decimal(distributionMean(distribution), 2)], ...quotes]),
    ),
  ];
}

function allMatchesResults(analyses, stat, value, onOpen) {
  const unit = unitOf(stat);
  const rows = analyses
    .map((analysis) => {
      const distribution = statDistribution(analysis, stat.id);
      return distribution ? { analysis, distribution, ...valueProbabilities(distribution, value) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.atLeast - a.atLeast);
  if (!rows.length) return emptyState({ title: TEXTS.extra.noData });
  return [
    note(TEXTS.explorer.rankingHint(lineOf(value), unit)),
    h(
      'ol',
      { class: 'rank-list' },
      rows.map((row, index) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: 'rank-item', onClick: () => onOpen(row.analysis.match.id) },
            h('span', { class: 'rank-item__index' }, index + 1),
            h(
              'span',
              { class: 'rank-item__text' },
              h('span', { class: 'rank-item__title' }, row.analysis.match.title),
              h(
                'span',
                { class: 'rank-item__sub' },
                TEXTS.explorer.rowDetail(decimal(distributionMean(row.distribution), 1), percent(1 - row.atLeast), lineOf(value)),
              ),
            ),
            h(
              'span',
              { class: 'rank-item__side' },
              h('strong', { class: 'stat__value stat__value--sm tone-accent' }, percent(row.atLeast)),
              h('span', { class: 'muted' }, TEXTS.explorer.fair(fairOdds(row.atLeast))),
            ),
          ),
        ),
      ),
    ),
  ];
}

/* ---------- Ambos anotan ---------- */

function bttsMatchResults(analysis) {
  const names = namesOf(analysis.match);
  const btts = bttsBreakdown(analysis);
  const yesQuote = analysis.quotes.get('btts', 'yes');
  const noQuote = analysis.quotes.get('btts', 'no');
  const houseLine = (quote, mine) => (quote ? TEXTS.explorer.houseLine(percent(quote.fairProbability), odds(quote.odds), percent(mine)) : EMPTY);
  return [
    stats(
      [
        { value: percent(btts.yes), label: TEXTS.explorer.bttsYes, hint: TEXTS.explorer.fair(fairOdds(btts.yes)), tone: 'accent' },
        { value: percent(1 - btts.yes), label: TEXTS.explorer.bttsNo, hint: TEXTS.explorer.fair(fairOdds(1 - btts.yes)) },
      ],
      2,
    ),
    card(
      { label: TEXTS.explorer.bttsDetail },
      kvList([
        [TEXTS.explorer.houseYes, houseLine(yesQuote, btts.yes)],
        [TEXTS.explorer.houseNo, houseLine(noQuote, 1 - btts.yes)],
        [TEXTS.explorer.bttsModel, percent(btts.model)],
        [TEXTS.explorer.bttsReal, btts.empirical === null ? EMPTY : TEXTS.explorer.bttsRealValue(percent(btts.empirical), Math.round(btts.n))],
        [TEXTS.goalRows.homeScores(names), percent(btts.homeScores)],
        [TEXTS.goalRows.awayScores(names), percent(btts.awayScores)],
      ]),
    ),
    stats(
      [
        { value: percent(btts.yesAndOver25), label: TEXTS.explorer.bttsAndOver, hint: TEXTS.explorer.fair(fairOdds(btts.yesAndOver25)) },
        { value: percent(btts.firstHalf), label: TEXTS.explorer.bttsFirstHalf, hint: TEXTS.explorer.fair(fairOdds(btts.firstHalf)) },
      ],
      2,
    ),
  ];
}

function bttsAllResults(analyses, onOpen) {
  const rows = analyses.map((analysis) => ({ analysis, btts: bttsBreakdown(analysis) })).sort((a, b) => b.btts.yes - a.btts.yes);
  return [
    note(TEXTS.explorer.bttsRankingHint),
    h(
      'ol',
      { class: 'rank-list' },
      rows.map(({ analysis, btts }, index) => {
        const quote = analysis.quotes.get('btts', 'yes');
        return h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: 'rank-item', onClick: () => onOpen(analysis.match.id) },
            h('span', { class: 'rank-item__index' }, index + 1),
            h(
              'span',
              { class: 'rank-item__text' },
              h('span', { class: 'rank-item__title' }, analysis.match.title),
              h(
                'span',
                { class: 'rank-item__sub' },
                TEXTS.explorer.bttsRowDetail(percent(btts.homeScores), percent(btts.awayScores), quote ? percent(quote.fairProbability) : null),
              ),
            ),
            h(
              'span',
              { class: 'rank-item__side' },
              h('strong', { class: 'stat__value stat__value--sm tone-accent' }, percent(btts.yes)),
              h('span', { class: 'muted' }, TEXTS.explorer.fair(fairOdds(btts.yes))),
            ),
          ),
        );
      }),
    ),
  ];
}

/* ---------- Jugadores ---------- */

/** Fila del ranking de jugadores: al tocarla se abre la gráfica de sus remates por partido. */
function playerRow({ analysis, side, projection, expected, probability }, index, onOpen, stat, value) {
  const team = namesOf(analysis.match)[side];
  const trigger = h(
    'button',
    { type: 'button', class: 'rank-item' },
    h('span', { class: 'rank-item__index' }, index + 1),
    h(
      'span',
      { class: 'rank-item__text' },
      h('span', { class: 'rank-item__title' }, TEXTS.explorer.playerTitle(projection.name, team)),
      h(
        'span',
        { class: 'rank-item__sub' },
        TEXTS.explorer.playerDetail(analysis.match.title, TEXTS.playerStatus[projection.status], decimal(expected, 2)),
      ),
    ),
    h(
      'span',
      { class: 'rank-item__side' },
      h('strong', { class: 'stat__value stat__value--sm tone-accent' }, percent(probability)),
      h('span', { class: 'muted' }, TEXTS.explorer.fair(fairOdds(probability))),
    ),
  );
  const panel = expandOnClick(trigger, () => [
    playerShotsChart(projection, { kind: stat.field, threshold: () => value }),
    h('button', { type: 'button', class: 'link', onClick: () => onOpen(analysis.match.id) }, TEXTS.explorer.openPlayersTab),
  ]);
  return h('li', {}, trigger, panel);
}

function playerResults(analyses, stat, value, config, onOpen) {
  const rows = playerRanking(analyses, stat.id, value);
  if (!rows.length) return emptyState({ title: TEXTS.players.empty });
  return [
    note(TEXTS.explorer.playersHint(lineOf(value), unitOf(stat))),
    growingList({
      items: rows,
      render: (row, index) => playerRow(row, index, onOpen, stat, value),
      first: config.explorer.playersShown,
      batch: config.explorer.playersShown,
      tag: 'ol',
      className: 'rank-list',
      moreLabel: TEXTS.explorer.morePlayers,
    }),
  ];
}

function sliderCard({ value, min, max, unit, onPreview, onCommit }) {
  let current = value;
  const fill = () => input.style.setProperty('--fill', `${(((current - min) / (max - min)) * 100).toFixed(1)}%`);
  const label = h('span', { class: 'explorer__value' }, TEXTS.explorer.valueLabel(lineOf(current), unit));
  const input = h('input', {
    class: 'slider',
    type: 'range',
    min: String(min),
    max: String(max),
    step: '1',
    value: String(current),
    'aria-label': TEXTS.explorer.sliderLabel(unit),
  });
  const update = (next, commit) => {
    current = Math.max(min, Math.min(max, next));
    input.value = String(current);
    fill();
    label.textContent = TEXTS.explorer.valueLabel(lineOf(current), unit);
    onPreview(current);
    if (commit) onCommit(current);
  };
  input.addEventListener('input', () => update(Number(input.value), false));
  input.addEventListener('change', () => update(Number(input.value), true));
  fill();
  return card(
    {},
    h(
      'div',
      { class: 'explorer__control' },
      iconButton({ icon: 'minus', label: TEXTS.explorer.less, variant: 'icon-button--boxed', onClick: () => update(current - 1, true) }),
      label,
      iconButton({ icon: 'plus', label: TEXTS.explorer.more, variant: 'icon-button--boxed', onClick: () => update(current + 1, true) }),
    ),
    input,
  );
}

function matchSelect(analyses, selectedId, onSelect) {
  return selectField({
    label: TEXTS.explorer.match,
    value: selectedId,
    options: analyses.map((analysis) => ({ id: analysis.match.id, label: analysis.match.title })),
    onChange: onSelect,
  });
}

/**
 * @param {Object} state   explorerStat, explorerScope, explorerValue, selectedId, analyses, config
 * @param {Object} actions setExplorerStat, setExplorerScope, setExplorerValue, selectExplorerMatch
 */
export function renderExplorer(state, actions) {
  const analyses = inLeague(state.analyses, state.league);
  const stat = explorerStat(state.explorerStat);
  const scope = analyses.length > 1 ? state.explorerScope : EXPLORER_SCOPES.MATCH;
  const analysis = analyses.find((candidate) => candidate.match.id === state.selectedId) ?? analyses[0];
  const names = scope === EXPLORER_SCOPES.MATCH ? namesOf(analysis.match) : null;
  const binary = isBinaryStat(stat);
  const players = isPlayerStat(stat);
  const min = minValueOf(stat);
  const max = binary ? 0 : state.config.explorer.maxValue[stat.id];
  const unit = unitOf(stat);
  const pool = scope === EXPLORER_SCOPES.MATCH ? [analysis] : analyses;
  const suggested = players ? stat.start : defaultValue(pool.map((candidate) => statDistribution(candidate, stat.id)));
  const initial = binary ? 0 : Math.max(min, Math.min(max, state.explorerValue ?? suggested));

  const results = h('div', { class: 'stack', 'aria-live': 'polite' });
  // Gráficas de cada equipo: fuera de `results` para que el deslizador no les borre el filtro
  // ni la barra elegida; solo se vuelven a dibujar con el nuevo umbral.
  let currentValue = initial;
  const charts = scope === EXPLORER_SCOPES.MATCH && !binary && !players ? teamCharts(analysis, stat, () => currentValue) : [];
  const draw = (value) => {
    currentValue = value;
    charts.forEach((chart) => chart.refresh());
    if (players) {
      replaceContent(results, playerResults(pool, stat, value, state.config, actions.openMatchPlayers));
      return;
    }
    if (binary) {
      replaceContent(results, scope === EXPLORER_SCOPES.MATCH ? bttsMatchResults(analysis) : bttsAllResults(analyses, actions.selectExplorerMatch));
      return;
    }
    replaceContent(
      results,
      scope === EXPLORER_SCOPES.MATCH ? matchResults(analysis, stat, value, max) : allMatchesResults(analyses, stat, value, actions.selectExplorerMatch),
    );
  };
  draw(initial);

  const statsOfGroup = EXPLORER_STATS.filter((candidate) => candidate.group === stat.group);
  return [
    pageHead({ eyebrow: tournamentLine(analyses), title: TEXTS.explorer.title }),
    note(TEXTS.explorer.intro),
    analyses.length > 1
      ? segmented(
          [
            { id: EXPLORER_SCOPES.MATCH, label: TEXTS.explorer.thisMatch },
            { id: EXPLORER_SCOPES.ALL, label: TEXTS.explorer.allMatches(analyses.length) },
          ],
          scope,
          actions.setExplorerScope,
          TEXTS.explorer.scopeLabel,
        )
      : null,
    h(
      'div',
      { class: 'grid grid--wide' },
      h(
        'div',
        { class: 'stack' },
        h(
          'div',
          { class: 'stack stack--tight' },
          leagueSelect(state.analyses, state.league, actions.setLeague),
          scope === EXPLORER_SCOPES.MATCH && analyses.length > 1 ? matchSelect(analyses, analysis.match.id, actions.selectExplorerMatch) : null,
          selectField({
            label: TEXTS.explorer.groupLabel,
            value: stat.group,
            options: EXPLORER_GROUPS.map((group) => ({ id: group, label: TEXTS.explorer.groups[group] })),
            onChange: (group) => actions.setExplorerStat(EXPLORER_STATS.find((candidate) => candidate.group === group).id),
          }),
        ),
        statsOfGroup.length > 1
          ? chips(
              statsOfGroup.map((candidate) => ({ id: candidate.id, label: sideLabel(candidate, names) })),
              stat.id,
              actions.setExplorerStat,
              TEXTS.explorer.sideLabel,
            )
          : null,
        binary ? null : sliderCard({ value: initial, min, max, unit, onPreview: draw, onCommit: actions.setExplorerValue }),
      ),
      h('div', { class: 'stack' }, results, charts.map((chart) => chart.node)),
    ),
    note(TEXTS.explorer.method),
  ];
}
