/**
 * Script de consola que trae los resultados de Sofascore.
 *
 * IMPORTANTE: esta función NO corre en la página. Se convierte a texto con
 * toString() (ver resultsScript.js) y se pega en la consola de sofascore.com.
 * Por eso debe ser autosuficiente: sin imports ni variables de fuera.
 *
 * Cuidado con el bloqueo de Sofascore: pide de a una, a un ritmo fijo y con tiempo límite
 * por petición. Si responde 429/403, avisa en la consola, espera cada vez más y reintenta;
 * si sigue bloqueando, para y descarga lo que ya tiene (los que faltan siguen pendientes en
 * la página y salen en el próximo script). `window._sofaParar = true` también para y descarga.
 *
 * @param {(string|number)[]} ids
 * @param {string} blockType  "tipo" del JSON que reconoce la página
 */
export async function sofascoreResultsScript(ids, blockType) {
  const API = 'https://www.sofascore.com/api/v1/';
  /** Pausa entre peticiones (≈3 por segundo). */
  const GAP_MS = 350;
  /** Tiempo máximo de una petición: sin esto, una respuesta que nunca llega deja el script colgado. */
  const TIMEOUT_MS = 15000;
  /** Espera tras un 429/403; se multiplica por los bloqueos seguidos. */
  const BLOCK_WAIT_MS = 10000;
  /** Bloqueos seguidos (sin ninguna respuesta buena) para darse por bloqueado. */
  const MAX_BLOCKS = 5;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const log = (message) => console.log('%c[resultados] ' + message, 'color:#4f46e5;font-weight:bold');

  let blocks = 0;
  let blocked = false;
  window._sofaParar = false;
  const stopped = () => blocked || window._sofaParar === true;

  /** Errores de red o sin respuesta que se reintentan; los 429/403 se cuentan aparte (MAX_BLOCKS). */
  const MAX_ERRORS = 3;
  const get = async (path) => {
    let errors = 0;
    while (errors < MAX_ERRORS && !stopped()) {
      await sleep(GAP_MS);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let status = 0;
      try {
        const response = await fetch(API + path, { signal: controller.signal });
        status = response.status;
        if (response.ok) {
          blocks = 0;
          return await response.json();
        }
        if (status !== 429 && status !== 403) return null;
      } catch {
        errors += 1;
        log('Sin respuesta de Sofascore (' + path + '), reintento...');
        continue;
      } finally {
        clearTimeout(timer);
      }
      blocks += 1;
      if (blocks >= MAX_BLOCKS) {
        blocked = true;
        log('Sofascore sigue bloqueando: paro y descargo lo que ya tengo. Espera unos minutos y copia el script de nuevo.');
        return null;
      }
      const wait = BLOCK_WAIT_MS * blocks;
      log('Sofascore pidió frenar (' + status + '). Espero ' + wait / 1000 + ' s y sigo...');
      await sleep(wait);
    }
    return null;
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

  log('Leyendo ' + ids.length + ' partidos de a uno (para que Sofascore no bloquee). Para cortar y descargar lo que haya: window._sofaParar = true');
  const results = [];
  for (let index = 0; index < ids.length && !stopped(); index += 1) {
    const id = ids[index];
    const event = (await get('event/' + id))?.event;
    if (stopped()) break;
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
      const statistics = await get('event/' + id + '/statistics');
      const incidents = await get('event/' + id + '/incidents');
      const odds = await get('event/' + id + '/odds/1/all');
      // Si se bloqueó a mitad del partido, mejor no usar datos a medias: queda pendiente.
      if (stopped()) break;
      entry.marcador = pair(home.normaltime ?? home.current, away.normaltime ?? away.current);
      entry.descanso = pair(home.period1, away.period1);
      entry.corners = statistic(statistics, 'Corner kicks');
      entry.amarillas = statistic(statistics, 'Yellow cards');
      entry.primerGol = firstGoal(incidents);
      entry.cuotas = oddsLines(odds, event);
    }
    results.push(entry);
  }

  const read = new Set(results.map((result) => result.id));
  const missing = ids.filter((id) => !read.has(id));
  const output = { tipo: blockType, version: 1, generado: new Date().toISOString(), incompleto: missing.length > 0, faltan: missing, partidos: results };
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
  if (missing.length) log('Faltaron ' + missing.length + ' partidos: siguen pendientes en la página. Sube este archivo y, en unos minutos, copia el script otra vez.');
  log('Súbelo en la página (Historial → Cargar resultados) o copia con: copy(JSON.stringify(window._sofaResultados))');
}
