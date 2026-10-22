// ===== Sofascore -> JSON de VARIOS partidos (v4) =====
// v4: ademas de la competicion del partido, trae los ultimos partidos de LIGA de cada equipo
// (con stats y tiros por jugador), y corrige las etiquetas de cuotas 1/X/2.
// Uso: abre cualquier pagina de sofascore.com, F12 -> "Console", pega todo y Enter.
// Busca los partidos del dia (y hora/torneo si los pones), saca la info de cada uno
// y al final descarga UN archivo .json con todos. Adjuntalo en el chat con Claude.
// Si vuelves a usarlo, recarga la pagina (F5) antes de pegarlo otra vez.

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

(async () => {
  const API = 'https://www.sofascore.com/api/v1/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const g = async (u, intento = 0) => {
    try {
      await sleep(120);
      const r = await fetch(API + u);
      if (r.status === 429 || r.status === 403) {
        if (intento < 3) { await sleep(3000 * (intento + 1)); return g(u, intento + 1); }
        return null;
      }
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const log = m => console.log('%c[sofa] ' + m, 'color:#0a7;font-weight:bold');
  const pad = n => String(n).padStart(2, '0');
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaLocal = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // ---------- 1) Buscar partidos ----------
  const dia = FECHA || fechaLocal(new Date());
  const vistos = new Map();
  const add = e => { if (e?.id) vistos.set(e.id, e); };

  if (IDS.length) {
    for (const id of IDS) add((await g(`event/${id}`))?.event);
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
    if (ut) {
      const seasons = (await g(`unique-tournament/${ut}/seasons`))?.seasons || [];
      const s = seasons[0]?.id;
      for (const tipo of ['next', 'last']) for (let p = 0; p < 2; p++) {
        const r = await g(`unique-tournament/${ut}/season/${s}/events/${tipo}/${p}`);
        (r?.events || []).forEach(add);
        if (!r?.hasNextPage) break;
      }
      const live = await g('sport/football/events/live');
      (live?.events || []).filter(e => e.tournament?.uniqueTournament?.id === ut).forEach(add);
    }
    // b) Enlaces de partidos de la pagina abierta (por si el torneo no los trae)
    const idsPagina = [...new Set([...document.querySelectorAll('a[href*="/match/"]')]
      .map(a => (a.href.match(/id:(\d+)/) || [])[1]).filter(Boolean))].filter(id => !vistos.has(+id)).slice(0, 60);
    for (const id of idsPagina) {
      const e = (await g(`event/${id}`))?.event;
      if (e && (!ut || e.tournament?.uniqueTournament?.id === ut)) add(e);
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
    const seasons = (await g(`unique-tournament/${ut}/seasons`))?.seasons || [];
    const idx = seasons.findIndex(s => s.id === season);
    const prevSeason = idx >= 0 ? seasons[idx + 1] : null;

    const [pre, h2h, lu, odds, live] = await Promise.all([
      g(`event/${eid}/pregame-form`), g(`event/${eid}/h2h`), g(`event/${eid}/lineups`),
      g(`event/${eid}/odds/1/all`), statsOf(eid)
    ]);
    const claveTabla = ev.tournament?.uniqueTournament?.name || ev.tournament?.name;
    if (!tablas[claveTabla]) {
      const t = await g(`unique-tournament/${ut}/season/${season}/standings/total`);
      tablas[claveTabla] = (t?.standings?.[0]?.rows || []).map(r =>
        `${r.position}. ${r.team.name} ${r.points}pts PJ${r.matches} ${r.wins}-${r.draws}-${r.losses} GF${r.scoresFor} GC${r.scoresAgainst}`);
    }

    const teamData = async tid => {
      const pages = [];
      for (let p = 0; p < 3; p++) { const r = await g(`team/${tid}/events/last/${p}`); if (!r?.events?.length) break; pages.push(...r.events); if (!r.hasNextPage) break; }
      const fin = pages.filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp);
      const actual = fin.filter(e => e.season?.id === season);
      const pasada = prevSeason ? fin.filter(e => e.season?.id === prevSeason.id).slice(0, PARTIDOS_TEMP_PASADA) : [];
      // Liga local: el torneo (distinto al del partido) con mas partidos recientes del equipo
      let ligaEvs = [], ligaNombre;
      if (PARTIDOS_LIGA > 0) {
        const cuenta = {};
        for (const e of fin) { const id = e.tournament?.uniqueTournament?.id; if (id && id !== ut) cuenta[id] = (cuenta[id] || 0) + 1; }
        const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 4) {
          ligaEvs = fin.filter(e => e.tournament?.uniqueTournament?.id === +top[0]).slice(0, PARTIDOS_LIGA);
          ligaNombre = ligaEvs[0]?.tournament?.uniqueTournament?.name;
        }
      }
      const partidos = [], partidosTempPasada = [], partidosLiga = [], jug = {};
      const conJugadores = [...actual.map(e => [e, partidos]), ...ligaEvs.map(e => [e, partidosLiga])];
      for (const [e, destino] of conJugadores) {
        destino.push(await fmtMatch(e, tid));
        const l = await g(`event/${e.id}/lineups`); const side = e.homeTeam.id === tid ? l?.home : l?.away;
        for (const p of side?.players || []) {
          const q = p.statistics || {}; if (!q.minutesPlayed) continue;
          const z = jug[p.player.id] ||= { nombre: p.player.name, pj: 0, titular: 0, min: 0, tirosPuerta: 0, tiros: 0, goles: 0, xG: 0, asist: 0 };
          z.pj++; if (!p.substitute) z.titular++; z.min += q.minutesPlayed;
          z.tirosPuerta += q.onTargetScoringAttempt || 0;
          z.tiros += (q.onTargetScoringAttempt || 0) + (q.shotOffTarget || 0) + (q.blockedScoringAttempt || 0);
          z.goles += q.goals || 0; z.asist += q.goalAssist || 0;
          z.xG = +(z.xG + (q.expectedGoals || 0)).toFixed(2);
        }
      }
      for (const e of pasada) partidosTempPasada.push(await fmtMatch(e, tid));
      return {
        partidos, partidosTempPasada, ligaNombre, partidosLiga,
        notaJugadores: 'Suma de partidos de esta competicion + liga local',
        notaTempPasada: prevSeason && !pasada.length ? 'Sin partidos de esta competicion la temporada pasada' : undefined,
        jugadores: Object.values(jug).filter(j => j.tiros > 0).sort((a, b) => b.tirosPuerta - a.tirosPuerta)
      };
    };
    const local = await teamData(ev.homeTeam.id);
    const visita = await teamData(ev.awayTeam.id);

    const h2hEvs = ((await g(`event/${ev.customId}/h2h/events`))?.events || [])
      .filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp).slice(0, 6);
    const h2hList = [];
    for (const e of h2hEvs) h2hList.push({
      fecha: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10), torneo: e.tournament?.name,
      partido: `${e.homeTeam.name} ${e.homeScore.current}-${e.awayScore.current} ${e.awayTeam.name}`,
      descanso: `${e.homeScore.period1}-${e.awayScore.period1}`, stats: await statsOf(e.id)
    });

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

  // ---------- 2) Procesar cada partido ----------
  const partidos = [];
  for (let i = 0; i < lista.length; i++) {
    const e = lista[i];
    log(`(${i + 1}/${lista.length}) ${e.homeTeam.name} vs ${e.awayTeam.name}...`);
    try { partidos.push(await analizar(e.id)); }
    catch (err) { partidos.push({ id: e.id, partido: `${e.homeTeam.name} vs ${e.awayTeam.name}`, error: String(err) }); }
  }

  const out = {
    version: 4, generado: new Date().toLocaleString(),
    filtros: { fecha: dia, torneo: TORNEO || 'todos', hora: HORA || 'todas' },
    posiciones: tablas, partidos
  };
  window._sofa = out;
  const txt = JSON.stringify(out);

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
