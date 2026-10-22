/**
 * Script de consola que trae los resultados de Sofascore.
 *
 * IMPORTANTE: esta función NO corre en la página. Se convierte a texto con
 * toString() (ver resultsScript.js) y se pega en la consola de sofascore.com.
 * Por eso debe ser autosuficiente: sin imports ni variables de fuera.
 *
 * @param {(string|number)[]} ids
 * @param {string} blockType  "tipo" del JSON que reconoce la página
 */
export async function sofascoreResultsScript(ids, blockType) {
  const API = 'https://www.sofascore.com/api/v1/';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const log = (message) => console.log('%c[resultados] ' + message, 'color:#4f46e5;font-weight:bold');

  const get = async (path, attempt = 0) => {
    try {
      await sleep(120);
      const response = await fetch(API + path);
      if ((response.status === 429 || response.status === 403) && attempt < 3) {
        await sleep(3000 * (attempt + 1));
        return get(path, attempt + 1);
      }
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };

  const pair = (home, away) => (home === undefined || home === null ? null : home + '-' + away);

  const statistic = (statistics, name) => {
    for (const period of statistics?.statistics ?? []) {
      if (period.period !== 'ALL') continue;
      for (const group of period.groups) {
        const item = group.statisticsItems.find((candidate) => candidate.name === name);
        if (item) return pair(item.home, item.away);
      }
    }
    return null;
  };

  const firstGoal = (incidents) => {
    const goals = (incidents?.incidents ?? [])
      .filter((incident) => incident.incidentType === 'goal')
      .sort((a, b) => a.time + (a.addedTime ?? 0) / 100 - (b.time + (b.addedTime ?? 0) / 100));
    if (!goals.length) return null;
    return goals[0].isHome ? 'home' : 'away';
  };

  const oddsLines = (odds, event) =>
    (odds?.markets ?? []).map((market) => {
      let names = market.choices.map((choice) => choice.name);
      if (market.choices.length === 3 && ['Full time', '1st half', '2nd half'].includes(market.marketName)) names = ['1', 'X', '2'];
      if (market.choices.length === 3 && market.marketName === 'First team to score') {
        names = [event.homeTeam.name, 'Sin gol', event.awayTeam.name];
      }
      const group = market.choiceGroup ? ' ' + market.choiceGroup : '';
      return market.marketName + group + ': ' + market.choices.map((choice, index) => names[index] + ' ' + choice.fractionalValue).join(', ');
    });

  const results = [];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const event = (await get('event/' + id))?.event;
    if (!event) {
      results.push({ id, error: 'no se pudo leer el partido' });
      continue;
    }
    log('(' + (index + 1) + '/' + ids.length + ') ' + event.homeTeam.name + ' vs ' + event.awayTeam.name);
    const finished = event.status?.type === 'finished';
    const entry = { id, partido: event.homeTeam.name + ' vs ' + event.awayTeam.name, terminado: finished, estado: event.status?.description };
    if (finished) {
      const home = event.homeScore ?? {};
      const away = event.awayScore ?? {};
      const [statistics, incidents, odds] = await Promise.all([
        get('event/' + id + '/statistics'),
        get('event/' + id + '/incidents'),
        get('event/' + id + '/odds/1/all'),
      ]);
      entry.marcador = pair(home.normaltime ?? home.current, away.normaltime ?? away.current);
      entry.descanso = pair(home.period1, away.period1);
      entry.corners = statistic(statistics, 'Corner kicks');
      entry.amarillas = statistic(statistics, 'Yellow cards');
      entry.primerGol = firstGoal(incidents);
      entry.cuotas = oddsLines(odds, event);
    }
    results.push(entry);
  }

  const output = { tipo: blockType, version: 1, generado: new Date().toISOString(), partidos: results };
  window._sofaResultados = output;
  const text = JSON.stringify(output);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = 'resultados_sofascore_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  const finishedCount = results.filter((result) => result.terminado).length;
  log('Listo: ' + finishedCount + ' de ' + results.length + ' terminados. Se descargó ' + link.download + '.');
  log('Súbelo en la página (Historial → Cargar resultados) o copia con: copy(JSON.stringify(window._sofaResultados))');
}
