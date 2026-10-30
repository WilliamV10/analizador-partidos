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
  statDistribution,
  valueProbabilities,
} from '../../domain/explorer.js';
import { TEXTS } from '../../texts.js';
import { card, chips, emptyState, growingList, iconButton, kvList, note, pageHead, segmented, selectField, stats } from '../components.js';
import { h, replaceContent } from '../dom.js';
import { EMPTY, decimal, odds, percent } from '../formatters.js';
import { namesOf, tournamentLine } from './shared.js';

export const EXPLORER_SCOPES = Object.freeze({ MATCH: 'match', ALL: 'all' });

const fairOdds = (probability) => (probability > 0 ? odds(1 / probability) : EMPTY);

/** Unidad del deslizador: la del grupo o, en jugadores, la del tipo de tiro. */
const unitOf = (stat) => TEXTS.explorer.units[isPlayerStat(stat) ? stat.field : stat.group];

/** Valor mínimo del deslizador: en jugadores, "0 o más" siempre es 100 %. */
const minValueOf = (stat) => (isPlayerStat(stat) ? 1 : 0);

function sideLabel(stat, names) {
  if (isPlayerStat(stat)) return TEXTS.explorer.playerStats[stat.field];
  if (stat.source === 'halfTime' || stat.source === 'cornersFirstHalf') return TEXTS.explorer.firstHalf;
  if (stat.side === 'home') return names?.home ?? TEXTS.match.home;
  if (stat.side === 'away') return names?.away ?? TEXTS.match.away;
  return TEXTS.explorer.total;
}

/** Valor inicial: el más cercano a lo esperado. */
function defaultValue(distributions) {
  const means = distributions.filter(Boolean).map(distributionMean);
  return means.length ? Math.round(means.reduce((sum, mean) => sum + mean, 0) / means.length) : 0;
}

/** Barras de la distribución; las de N o más se resaltan. */
function distributionChart(distribution, value, max) {
  const shown = distribution.slice(0, max + 1);
  const top = Math.max(...shown, 0.0001);
  return h(
    'div',
    { class: 'dist', role: 'img', 'aria-label': TEXTS.explorer.chartLabel },
    shown.map((probability, index) =>
      h(
        'div',
        { class: `dist__column${index >= value ? ' is-over' : ''}${index === value ? ' is-current' : ''}`, title: `${index}: ${percent(probability, 1)}` },
        h('span', { class: 'dist__bar', style: `height:${((probability / top) * 100).toFixed(1)}%` }),
        h('span', { class: 'dist__label' }, index === max ? `${index}+` : index),
      ),
    ),
  );
}

/** Cuotas de la casa para "más de N−0.5" y "menos de N+0.5", si existen. */
function quoteRows(analysis, stat, value, probabilities) {
  if (!stat.market) return [];
  const over = value > 0 ? analysis.quotes.get(stat.market, 'over', value - 0.5) : null;
  const under = analysis.quotes.get(stat.market, 'under', value + 0.5);
  return [
    over ? [TEXTS.explorer.houseOver(value - 0.5), TEXTS.explorer.houseLine(percent(over.fairProbability), odds(over.odds), percent(probabilities.atLeast))] : null,
    under ? [TEXTS.explorer.houseUnder(value + 0.5), TEXTS.explorer.houseLine(percent(under.fairProbability), odds(under.odds), percent(probabilities.atMost))] : null,
  ].filter(Boolean);
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
        { value: percent(probabilities.exactly), label: TEXTS.explorer.exactly(value, unit), hint: TEXTS.explorer.fair(fairOdds(probabilities.exactly)) },
        { value: percent(probabilities.atLeast), label: TEXTS.explorer.atLeast(value, unit), hint: TEXTS.explorer.fair(fairOdds(probabilities.atLeast)), tone: 'accent' },
        { value: percent(probabilities.atMost), label: TEXTS.explorer.atMost(value, unit), hint: TEXTS.explorer.fair(fairOdds(probabilities.atMost)) },
      ],
      3,
    ),
    card(
      { label: TEXTS.explorer.distribution },
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
    note(TEXTS.explorer.rankingHint(value, unit)),
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
                TEXTS.explorer.rowDetail(decimal(distributionMean(row.distribution), 1), percent(row.exactly), value),
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

function playerRow({ analysis, side, projection, expected, probability }, index, onOpen) {
  const team = namesOf(analysis.match)[side];
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
    ),
  );
}

function playerResults(analyses, stat, value, config, onOpen) {
  const rows = playerRanking(analyses, stat.id, value);
  if (!rows.length) return emptyState({ title: TEXTS.players.empty });
  return [
    note(TEXTS.explorer.playersHint(value, unitOf(stat))),
    growingList({
      items: rows,
      render: (row, index) => playerRow(row, index, onOpen),
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
  const label = h('span', { class: 'explorer__value' }, TEXTS.explorer.valueLabel(current, unit));
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
    label.textContent = TEXTS.explorer.valueLabel(current, unit);
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
  const { analyses } = state;
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
  const draw = (value) => {
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
      results,
    ),
    note(TEXTS.explorer.method),
  ];
}
