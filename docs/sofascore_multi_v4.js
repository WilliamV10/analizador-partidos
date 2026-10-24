// ===== Sofascore -> JSON de VARIOS partidos (v4) =====
// v4: ademas de la competicion del partido, trae los ultimos partidos de LIGA de cada equipo
// (con stats y tiros por jugador), y corrige las etiquetas de cuotas 1/X/2.
// Uso: abre cualquier pagina de sofascore.com, F12 -> "Console", pega todo y Enter.
// Busca los partidos del dia (y hora/torneo si los pones), saca la info de cada uno
// y al final descarga UN archivo .json con todos. Adjuntalo en el chat con Claude.
// Puedes pegarlo varias veces sin recargar la pagina (todo va dentro de un bloque { }).
// Velocidad: hace varias peticiones a la vez (sin repetir ninguna). Si Sofascore responde
// 429/403 baja sola el ritmo, espera y reintenta; cuando todo va bien lo vuelve a subir.

{ // bloque: permite volver a pegar el script sin el error de 'const' repetida
// ---------- CONFIGURACION ----------
const FECHA = null;            // null = hoy. O una fecha: '2026-10-21'
const TORNEO = 'UEFA Champions League'; // nombre del torneo (se busca en Sofascore)
const TORNEO_ID = null;        // opcional: id del torneo en Sofascore (Champions = 7)
const HORA = null;             // null = todas. O la hora local exacta: '13:00'
const IDS = [];                // opcional: ids de partidos a mano, ej. [16363890, 16318042]
const MAX_PARTIDOS = 10;       // tope por seguridad
const PARTIDOS_TEMP_PASADA = 8; // partidos de la temporada pasada por equipo
const PARTIDOS_LIGA = 8;       // ultimos partidos de la liga local de cada equipo (0 = no traer)
const SOLO_LISTAR = false;     // true = solo muestra que partidos encontraria
const DESCARGAR = true;        // true = descarga el .json (recomendado, es grande)
const PETICIONES_A_LA_VEZ = 6; // peticiones simultaneas al inicio (se ajusta solo entre 1 y 10)

(async () => {
  const API = 'https://www.sofascore.com/api/v1/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = m => console.log('%c[sofa] ' + m, 'color:#0a7;font-weight:bold');
  const t0 = Date.now();

  // ---------- Peticiones: cola con limite adaptativo + cache ----------
  // - Nunca pide la misma URL dos veces (los partidos se repiten entre equipos, H2H, etc.).
  // - Si llega 429/403 reduce a la mitad las peticiones simultaneas y pausa a todas.
  // - Tras una racha sin errores vuelve a subir de a una.
  const MIN_CONC = 1, MAX_CONC = 10;
  let limite = Math.min(MAX_CONC, Math.max(MIN_CONC, PETICIONES_A_LA_VEZ));
  let activos = 0, pausaHasta = 0, okSeguidos = 0, hechas = 0, frenadas = 0;
  const cola = [];
  const siguiente = () => { while (activos < limite && cola.length) { activos++; cola.shift()(); } };
  const turno = () => new Promise(r => { cola.push(r); siguiente(); });
  const soltar = () => { activos--; siguiente(); };
  const pedir = async u => {
    for (let intento = 0; intento < 4; intento++) {
      await turno();
      let st = 0;
      try {
        const espera = pausaHasta - Date.now();
        if (espera > 0) await sleep(espera);
        const r = await fetch(API + u);
        st = r.status;
        if (r.ok) {
          const json = await r.json();
          hechas++;
          if (++okSeguidos >= 15 && limite < MAX_CONC) { limite++; okSeguidos = 0; }
          return json;
        }
        if (st !== 429 && st !== 403 && st < 500) return null; // 404 etc.: no existe, no reintentar
      } catch { st = -1; } finally { soltar(); }
      if (st === 429 || st === 403) {
        okSeguidos = 0;
        if (Date.now() >= pausaHasta) { // varias respuestas 429 juntas cuentan como un solo freno
          frenadas++;
          limite = Math.max(MIN_CONC, Math.floor(limite / 2));
          log(`Sofascore pidio frenar (${st}). Bajo a ${limite} peticion(es) a la vez y espero...`);
        }
        pausaHasta = Math.max(pausaHasta, Date.now() + 2500 * (intento + 1));
      } else await sleep(600 * (intento + 1)); // error de red o 5xx
    }
    return null;
  };
  const cache = new Map();
  const g = u => { if (!cache.has(u)) cache.set(u, pedir(u)); return cache.get(u); };

  const pad = n => String(n).padStart(2, '0');
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaLocal = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // Pide paginas 0..n-1 a la vez y se queda con las seguidas que existen (como si fuera una a una)
  const paginas = async (base, n) => {
    const rs = await Promise.all(Array.from({ length: n }, (_, p) => g(`${base}/${p}`)));
    const out = [];
    for (const r of rs) { if (!r?.events?.length) break; out.push(...r.events); if (!r.hasNextPage) break; }
    return out;
  };

  // ---------- 1) Buscar partidos ----------
  const dia = FECHA || fechaLocal(new Date());
  const vistos = new Map();
  const add = e => { if (e?.id) vistos.set(e.id, e); };

  if (IDS.length) {
    (await Promise.all(IDS.map(id => g(`event/${id}`)))).forEach(r => add(r?.event));
  } else {
    // a) Torneo: buscarlo y traer sus partidos proximos, recientes y en vivo
    let ut = TORNEO_ID;
    if (!ut && TORNEO) {
      const res = (await g(`search/all?q=${encodeURIComponent(TORNEO)}`))?.results || [];
      const cands = res.filter(r => r.type === 'uniqueTournament' && (r.entity?.category?.sport?.slug || 'football') === 'football')
        .map(r => r.entity);
      const exacto = cands.find(c => c.name?.toLowerCase() === TORNEO.toLowerCase());
      const elegido = exacto || cands.sort((a, b) => (b.userCount || 0) - (a.userCount || 0))[0];
      if (elegido) { ut = elegido.id; log(`Torneo: ${elegido.name} (id ${ut})`); }
      else log(`No encontre el torneo "${TORNEO}" en el buscador. Pon TORNEO_ID a mano.`);
    }
    // Enlaces de partidos de la pagina abierta (por si el torneo no los trae): se piden en paralelo
    const idsPagina = [...new Set([...document.querySelectorAll('a[href*="/match/"]')]
      .map(a => (a.href.match(/id:(\d+)/) || [])[1]).filter(Boolean))].slice(0, 60);
    const pagina = Promise.all(idsPagina.map(id => g(`event/${id}`)));
    if (ut) {
      const s = ((await g(`unique-tournament/${ut}/seasons`))?.seasons || [])[0]?.id;
      const [next, last, live] = await Promise.all([
        paginas(`unique-tournament/${ut}/season/${s}/events/next`, 2),
        paginas(`unique-tournament/${ut}/season/${s}/events/last`, 2),
        g('sport/football/events/live')
      ]);
      next.forEach(add); last.forEach(add);
      (live?.events || []).filter(e => e.tournament?.uniqueTournament?.id === ut).forEach(add);
    }
    for (const r of await pagina) {
      const e = r?.event;
      if (e && !vistos.has(e.id) && (!ut || e.tournament?.uniqueTournament?.id === ut)) add(e);
    }
  }

  let lista = [...vistos.values()].filter(e => {
    const dt = new Date(e.startTimestamp * 1000);
    return (IDS.length || fechaLocal(dt) === dia) && (!HORA || horaLocal(dt) === HORA);
  }).sort((a, b) => a.startTimestamp - b.startTimestamp);

  if (!lista.length) {
    console.error('No encontre partidos con esos filtros. Diagnostico:');
    const todos = [...vistos.values()];
    console.log(`  Partidos del torneo encontrados: ${todos.length}`);
    const delDia = todos.filter(e => fechaLocal(new Date(e.startTimestamp * 1000)) === dia);
    console.log(`  Del dia ${dia}: ${delDia.length}. Horas disponibles:`);
    delDia.forEach(e => console.log(`    ${horaLocal(new Date(e.startTimestamp * 1000))}  ${e.homeTeam.name} vs ${e.awayTeam.name}  (${e.tournament?.name})`));
    if (!delDia.length) {
      console.log('  Fechas proximas disponibles:');
      todos.slice(0, 15).forEach(e => console.log(`    ${fechaLocal(new Date(e.startTimestamp * 1000))} ${horaLocal(new Date(e.startTimestamp * 1000))}  ${e.homeTeam.name} vs ${e.awayTeam.name}`));
    }
    return;
  }
  log(`Encontre ${lista.length} partido(s):`);
  lista.forEach(e => console.log(`  ${horaLocal(new Date(e.startTimestamp * 1000))}  ${e.homeTeam.name} vs ${e.awayTeam.name}  (${e.tournament?.name})  id ${e.id}`));
  if (lista.length > MAX_PARTIDOS) { log(`Solo proceso los primeros ${MAX_PARTIDOS} (cambia MAX_PARTIDOS si quieres mas).`); lista = lista.slice(0, MAX_PARTIDOS); }
  if (SOLO_LISTAR) return;

  // ---------- Helpers ----------
  const statsOf = async id => {
    const s = await g(`event/${id}/statistics`); const o = {};
    if (s) for (const p of s.statistics) for (const gr of p.groups) for (const it of gr.statisticsItems) {
      if (!['ALL', '1ST', '2ND'].includes(p.period)) continue;
      if (['Corner kicks', 'Shots on target', 'Total shots', 'Expected goals', 'Yellow cards'].includes(it.name) ||
          (p.period === 'ALL' && it.name === 'Ball possession'))
        o[`${p.period} ${it.name}`] = `${it.home}-${it.away}`;
    }
    return o;
  };
  const fmtMatch = async (e, tid) => ({
    competicion: e.tournament?.uniqueTournament?.name || e.tournament?.name,
    temporada: e.season?.name,
    fecha: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10),
    condicion: e.homeTeam.id === tid ? 'local' : 'visita',
    partido: `${e.homeTeam.name} ${e.homeScore.current}-${e.awayScore.current} ${e.awayTeam.name}`,
    descanso: `${e.homeScore.period1}-${e.awayScore.period1}`,
    stats: await statsOf(e.id)
  });
  const lineupShort = side => side ? {
    formation: side.formation,
    titulares: side.players.filter(p => !p.substitute).map(p => `${p.player.name} (${p.position || ''})`),
    suplentes: side.players.filter(p => p.substitute).map(p => p.player.name),
    bajas: (side.missingPlayers || []).map(p => `${p.player.name} - ${p.type}: ${p.description || p.reason || ''}`)
  } : null;

  const tablas = {};
  const analizar = async eid => {
    const ev = (await g(`event/${eid}`))?.event;
    if (!ev) return { id: eid, error: 'no se pudo leer el partido' };
    const season = ev.season?.id, ut = ev.tournament?.uniqueTournament?.id;
    const claveTabla = ev.tournament?.uniqueTournament?.name || ev.tournament?.name;

    // Todo lo que solo depende del partido va en paralelo
    const [seasonsRes, pre, h2h, lu, odds, live, tabla, h2hRes] = await Promise.all([
      g(`unique-tournament/${ut}/seasons`),
      g(`event/${eid}/pregame-form`), g(`event/${eid}/h2h`), g(`event/${eid}/lineups`),
      g(`event/${eid}/odds/1/all`), statsOf(eid),
      g(`unique-tournament/${ut}/season/${season}/standings/total`),
      g(`event/${ev.customId}/h2h/events`)
    ]);
    const seasons = seasonsRes?.seasons || [];
    const idx = seasons.findIndex(s => s.id === season);
    const prevSeason = idx >= 0 ? seasons[idx + 1] : null;
    if (!tablas[claveTabla]) {
      tablas[claveTabla] = (tabla?.standings?.[0]?.rows || []).map(r =>
        `${r.position}. ${r.team.name} ${r.points}pts PJ${r.matches} ${r.wins}-${r.draws}-${r.losses} GF${r.scoresFor} GC${r.scoresAgainst}`);
    }

    const teamData = async tid => {
      const fin = (await paginas(`team/${tid}/events/last`, 3))
        .filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp);
      const actual = fin.filter(e => e.season?.id === season);
      const pasada = prevSeason ? fin.filter(e => e.season?.id === prevSeason.id).slice(0, PARTIDOS_TEMP_PASADA) : [];
      // Liga local: el torneo (distinto al del partido) con mas partidos recientes del equipo.
      // Sin amistosos, y solo partidos de esta temporada (desde ~45 dias antes del primer
      // partido de la competicion actual): si no, se cuela la liga del año pasado (ascendidos/descendidos).
      let ligaEvs = [], ligaNombre;
      if (PARTIDOS_LIGA > 0) {
        const esAmistoso = e => /friendl/i.test(`${e.tournament?.uniqueTournament?.name || ''} ${e.tournament?.name || ''}`);
        const inicio = (actual.length ? Math.min(...actual.map(e => e.startTimestamp)) : Date.now() / 1000 - 120 * 86400) - 45 * 86400;
        const validos = fin.filter(e => e.startTimestamp >= inicio && !esAmistoso(e));
        const cuenta = {};
        for (const e of validos) { const id = e.tournament?.uniqueTournament?.id; if (id && id !== ut) cuenta[id] = (cuenta[id] || 0) + 1; }
        const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 4) {
          ligaEvs = validos.filter(e => e.tournament?.uniqueTournament?.id === +top[0]).slice(0, PARTIDOS_LIGA);
          ligaNombre = ligaEvs[0]?.tournament?.uniqueTournament?.name;
        }
      }
      // Stats + alineaciones de todos los partidos a la vez (el orden del resultado se respeta)
      const conJug = async e => {
        const [m, l] = await Promise.all([fmtMatch(e, tid), g(`event/${e.id}/lineups`)]);
        return { m, side: e.homeTeam.id === tid ? l?.home : l?.away };
      };
      const [rActual, rLiga, partidosTempPasada] = await Promise.all([
        Promise.all(actual.map(conJug)), Promise.all(ligaEvs.map(conJug)),
        Promise.all(pasada.map(e => fmtMatch(e, tid)))
      ]);
      const jug = {};
      for (const { side } of [...rActual, ...rLiga]) for (const p of side?.players || []) {
        const q = p.statistics || {}; if (!q.minutesPlayed) continue;
        const z = jug[p.player.id] ||= { nombre: p.player.name, pj: 0, titular: 0, min: 0, tirosPuerta: 0, tiros: 0, goles: 0, xG: 0, asist: 0 };
        z.pj++; if (!p.substitute) z.titular++; z.min += q.minutesPlayed;
        z.tirosPuerta += q.onTargetScoringAttempt || 0;
        z.tiros += (q.onTargetScoringAttempt || 0) + (q.shotOffTarget || 0) + (q.blockedScoringAttempt || 0);
        z.goles += q.goals || 0; z.asist += q.goalAssist || 0;
        z.xG = +(z.xG + (q.expectedGoals || 0)).toFixed(2);
      }
      return {
        partidos: rActual.map(r => r.m), partidosTempPasada, ligaNombre, partidosLiga: rLiga.map(r => r.m),
        notaJugadores: 'Suma de partidos de esta competicion + liga local',
        notaTempPasada: prevSeason && !pasada.length ? 'Sin partidos de esta competicion la temporada pasada' : undefined,
        jugadores: Object.values(jug).filter(j => j.tiros > 0).sort((a, b) => b.tirosPuerta - a.tirosPuerta)
      };
    };

    const h2hEvs = (h2hRes?.events || [])
      .filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp).slice(0, 6);
    const [local, visita, h2hList] = await Promise.all([
      teamData(ev.homeTeam.id), teamData(ev.awayTeam.id),
      Promise.all(h2hEvs.map(async e => ({
        fecha: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10), torneo: e.tournament?.name,
        partido: `${e.homeTeam.name} ${e.homeScore.current}-${e.awayScore.current} ${e.awayTeam.name}`,
        descanso: `${e.homeScore.period1}-${e.awayScore.period1}`, stats: await statsOf(e.id)
      })))
    ]);

    return {
      id: eid,
      partido: `${ev.homeTeam.name} vs ${ev.awayTeam.name}`, torneo: ev.tournament?.name, tablaDe: claveTabla,
      jornada: ev.roundInfo?.round, temporadaActual: ev.season?.name, temporadaPasada: prevSeason?.name,
      hora: new Date(ev.startTimestamp * 1000).toLocaleString(), estado: ev.status?.description,
      marcador: `${ev.homeScore?.current ?? '-'}-${ev.awayScore?.current ?? '-'}`, arbitro: ev.referee?.name, estadio: ev.venue?.name,
      forma: pre, h2hResumen: h2h?.teamDuel, statsEnVivo: live,
      alineacionesConfirmadas: lu?.confirmed, alineacionLocal: lineupShort(lu?.home), alineacionVisita: lineupShort(lu?.away),
      cuotas: (odds?.markets || []).map(m => {
        let nombres = m.choices.map(c => c.name);
        if (m.choices.length === 3 && ['Full time', '1st half', '2nd half'].includes(m.marketName)) nombres = ['1', 'X', '2'];
        if (m.choices.length === 3 && m.marketName === 'First team to score') nombres = [ev.homeTeam.name, 'Sin gol', ev.awayTeam.name];
        return `${m.marketName}${m.choiceGroup ? ' ' + m.choiceGroup : ''}: ` + m.choices.map((c, i) => `${nombres[i]} ${c.fractionalValue}`).join(', ');
      }),
      local, visita, h2h: h2hList
    };
  };

  // ---------- 2) Procesar todos los partidos a la vez (la cola limita las peticiones) ----------
  let listos = 0;
  const progreso = setInterval(() => log(`... ${listos}/${lista.length} partidos, ${hechas} peticiones, ${limite} a la vez, ${Math.round((Date.now() - t0) / 1000)} s`), 5000);
  const partidos = await Promise.all(lista.map(async e => {
    const nombre = `${e.homeTeam.name} vs ${e.awayTeam.name}`;
    try {
      const r = await analizar(e.id);
      log(`(${++listos}/${lista.length}) ${nombre} listo`);
      return r;
    } catch (err) {
      log(`(${++listos}/${lista.length}) ${nombre} con error`);
      return { id: e.id, partido: nombre, error: String(err) };
    }
  }));
  clearInterval(progreso);

  const out = {
    version: 4, generado: new Date().toLocaleString(),
    filtros: { fecha: dia, torneo: TORNEO || 'todos', hora: HORA || 'todas' },
    posiciones: tablas, partidos
  };
  window._sofa = out;
  const txt = JSON.stringify(out);
  log(`${hechas} peticiones en ${Math.round((Date.now() - t0) / 1000)} s${frenadas ? ` (Sofascore freno ${frenadas} vez/veces)` : ''}.`);

  if (DESCARGAR) {
    const nombre = `sofascore_${dia}${HORA ? '_' + HORA.replace(':', '') : ''}_${partidos.length}partidos.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    log(`Listo: se descargo ${nombre} (${Math.round(txt.length / 1024)} KB). Adjuntalo en el chat.`);
  } else {
    console.log(txt);
    log(`Listo (${Math.round(txt.length / 1024)} KB). Copialo con: copy(JSON.stringify(window._sofa))`);
  }
})();
}
