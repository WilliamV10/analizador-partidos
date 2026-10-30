// ===== Sofascore -> JSON de MUCHOS partidos de VARIAS competiciones (v5) =====
// Uso: abre cualquier pagina de sofascore.com, F12 -> "Console", pega todo y Enter.
// Al final descarga UN archivo .json: subelo en la pagina del analizador (Cargar JSON).
// Puedes pegarlo varias veces sin recargar la pagina (todo va dentro de un bloque { }).
//
// Dos modos:
//  - 'proximos':  partidos sin jugar de hoy y los proximos DIAS dias (para apostar).
//  - 'historico': partidos YA JUGADOS de los ultimos DIAS dias, con su resultado. La app
//                 los analiza solo con la informacion previa a cada partido y los liquida al
//                 momento (Historial -> origen "Historico"): sirve para medir el modelo sin esperar.
//
// Cuidado con Sofascore: el script va despacio a proposito (PETICIONES_POR_SEGUNDO) y, si
// Sofascore responde 429/403, baja el ritmo, espera y reintenta. Si aun asi sigue bloqueando,
// se detiene y descarga lo que alcanzo a juntar (no se pierde nada). Mejor varias tandas
// medianas que una gigante.

{ // bloque: permite volver a pegar el script sin el error de 'const' repetida
// ---------- CONFIGURACION ----------
const TORNEOS = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'MLS']; // nombres o ids (Premier = 17)
const MODO = 'proximos';        // 'proximos' o 'historico'
const DIAS = 2;                 // proximos: hoy + N dias. historico: ultimos N dias
const MAX_PARTIDOS = 80;        // tope total (los mas cercanos a hoy primero)
const PARTIDOS_TEMP_PASADA = 8; // partidos de la temporada pasada por equipo
const PARTIDOS_LIGA = 8;        // ultimos partidos de la liga local de cada equipo (0 = no traer)
const PETICIONES_A_LA_VEZ = 4;  // peticiones simultaneas (se ajusta solo hacia abajo si Sofascore frena)
const PETICIONES_POR_SEGUNDO = 6; // ritmo maximo: subirlo acelera pero arriesga el bloqueo
const PARTIDOS_A_LA_VEZ = 2;    // partidos que se procesan en paralelo
const SOLO_LISTAR = false;      // true = solo muestra que partidos encontraria
const DESCARGAR = true;

(async () => {
  const API = 'https://www.sofascore.com/api/v1/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = m => console.log('%c[sofa v5] ' + m, 'color:#0a7;font-weight:bold');
  const t0 = Date.now();
  const historico = MODO === 'historico';

  // ---------- Peticiones: cola con limite de simultaneas, ritmo maximo y cache ----------
  const MIN_CONC = 1;
  const MAX_BLOQUEOS_SEGUIDOS = 8; // tantos 429/403 seguidos sin ninguna respuesta buena = bloqueado
  let limite = Math.max(MIN_CONC, PETICIONES_A_LA_VEZ);
  const intervalo = 1000 / Math.max(1, PETICIONES_POR_SEGUNDO);
  let activos = 0, pausaHasta = 0, proximaSalida = 0, hechas = 0, frenadas = 0, bloqueado = false, seguidos = 0;
  const marcarBloqueado = () => { if (!bloqueado) { bloqueado = true; log('Sofascore sigue bloqueando: paro y descargo lo que ya tengo.'); } };
  const cola = [];
  const siguiente = () => { while (activos < limite && cola.length) { activos++; cola.shift()(); } };
  const turno = () => new Promise(r => { cola.push(r); siguiente(); });
  const soltar = () => { activos--; siguiente(); };
  const pedir = async u => {
    for (let intento = 0; intento < 4; intento++) {
      if (bloqueado) return null;
      await turno();
      let st = 0;
      try {
        // respeta la pausa por bloqueo y el ritmo maximo
        const ahora = Date.now();
        const salida = Math.max(ahora, pausaHasta, proximaSalida);
        proximaSalida = salida + intervalo;
        if (salida > ahora) await sleep(salida - ahora);
        if (bloqueado) return null;
        const r = await fetch(API + u);
        st = r.status;
        if (r.ok) { hechas++; seguidos = 0; return await r.json(); }
        if (st !== 429 && st !== 403 && st < 500) return null; // 404 etc.
      } catch { st = -1; } finally { soltar(); }
      if (st === 429 || st === 403) {
        if (++seguidos >= MAX_BLOQUEOS_SEGUIDOS) { marcarBloqueado(); return null; }
        if (Date.now() >= pausaHasta) {
          frenadas++;
          limite = Math.max(MIN_CONC, Math.floor(limite / 2));
          log(`Sofascore pidio frenar (${st}). Bajo a ${limite} peticion(es) a la vez y espero...`);
        }
        pausaHasta = Math.max(pausaHasta, Date.now() + 5000 * (intento + 1));
      } else await sleep(800 * (intento + 1));
    }
    marcarBloqueado();
    return null;
  };
  const cache = new Map();
  const g = u => { if (!cache.has(u)) cache.set(u, pedir(u)); return cache.get(u); };

  const pad = n => String(n).padStart(2, '0');
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaLocal = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const paginas = async (base, n) => {
    const rs = await Promise.all(Array.from({ length: n }, (_, p) => g(`${base}/${p}`)));
    const out = [];
    for (const r of rs) { if (!r?.events?.length) break; out.push(...r.events); if (!r.hasNextPage) break; }
    return out;
  };

  // ---------- 1) Torneos ----------
  const torneos = [];
  for (const t of TORNEOS) {
    if (typeof t === 'number') {
      const info = (await g(`unique-tournament/${t}`))?.uniqueTournament;
      torneos.push({ id: t, nombre: info?.name ?? String(t), pais: info?.category?.name ?? '' });
      continue;
    }
    const res = (await g(`search/all?q=${encodeURIComponent(t)}`))?.results || [];
    const cands = res.filter(r => r.type === 'uniqueTournament' && (r.entity?.category?.sport?.slug || 'football') === 'football').map(r => r.entity);
    const elegido = cands.find(c => c.name?.toLowerCase() === t.toLowerCase()) || cands.sort((a, b) => (b.userCount || 0) - (a.userCount || 0))[0];
    if (elegido) torneos.push({ id: elegido.id, nombre: elegido.name, pais: elegido.category?.name ?? '' });
    else log(`No encontre "${t}". Usa su id (numero) en TORNEOS.`);
  }
  torneos.forEach(t => log(`Torneo: ${t.nombre} (${t.pais}, id ${t.id})`));

  // ---------- 2) Partidos de la ventana de fechas ----------
  const ahora = Date.now() / 1000;
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
  const desde = historico ? ahora - DIAS * 86400 : inicioHoy.getTime() / 1000;
  const hasta = historico ? ahora : inicioHoy.getTime() / 1000 + (DIAS + 1) * 86400;
  const vistos = new Map();
  await Promise.all(torneos.map(async t => {
    const s = ((await g(`unique-tournament/${t.id}/seasons`))?.seasons || [])[0]?.id;
    if (!s) return;
    const evs = await paginas(`unique-tournament/${t.id}/season/${s}/events/${historico ? 'last' : 'next'}`, historico ? 4 : 3);
    evs.filter(e => e.startTimestamp >= desde && e.startTimestamp < hasta)
      .filter(e => (historico ? e.status?.type === 'finished' : e.status?.type === 'notstarted'))
      .forEach(e => vistos.set(e.id, e));
  }));
  let lista = [...vistos.values()].sort((a, b) => historico ? b.startTimestamp - a.startTimestamp : a.startTimestamp - b.startTimestamp);
  log(`Encontre ${lista.length} partido(s) ${historico ? 'jugados' : 'por jugar'} en la ventana.`);
  if (lista.length > MAX_PARTIDOS) { log(`Solo proceso ${MAX_PARTIDOS} (cambia MAX_PARTIDOS si quieres mas).`); lista = lista.slice(0, MAX_PARTIDOS); }
  lista.forEach(e => console.log(`  ${fechaLocal(new Date(e.startTimestamp * 1000))} ${horaLocal(new Date(e.startTimestamp * 1000))}  ${e.homeTeam.name} vs ${e.awayTeam.name}  (${e.tournament?.name})`));
  if (!lista.length || SOLO_LISTAR) return;

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
  const par = (a, b) => (a === undefined || a === null ? null : `${a}-${b}`);
  const statTotal = (stats, name) => stats[`ALL ${name}`] ?? null;
  const primerGol = inc => {
    const goles = (inc?.incidents ?? []).filter(i => i.incidentType === 'goal')
      .sort((a, b) => a.time + (a.addedTime ?? 0) / 100 - (b.time + (b.addedTime ?? 0) / 100));
    return goles.length ? (goles[0].isHome ? 'home' : 'away') : 'none';
  };

  const tablas = {};
  const analizar = async eid => {
    const ev = (await g(`event/${eid}`))?.event;
    if (!ev) return { id: eid, error: 'no se pudo leer el partido' };
    // En modo historico solo se usa lo anterior al partido (sin mirar el resultado).
    const corte = historico ? ev.startTimestamp : Infinity;
    const season = ev.season?.id, ut = ev.tournament?.uniqueTournament?.id;
    const claveTabla = ev.tournament?.uniqueTournament?.name || ev.tournament?.name;
    const [seasonsRes, pre, h2h, lu, odds, tabla, h2hRes, finales, incidencias] = await Promise.all([
      g(`unique-tournament/${ut}/seasons`),
      g(`event/${eid}/pregame-form`), g(`event/${eid}/h2h`), g(`event/${eid}/lineups`),
      g(`event/${eid}/odds/1/all`),
      g(`unique-tournament/${ut}/season/${season}/standings/total`),
      g(`event/${ev.customId}/h2h/events`),
      historico ? statsOf(eid) : null,
      historico ? g(`event/${eid}/incidents`) : null,
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
        .filter(e => e.status?.type === 'finished' && e.startTimestamp < corte)
        .sort((a, b) => b.startTimestamp - a.startTimestamp);
      const actual = fin.filter(e => e.season?.id === season);
      const pasada = prevSeason ? fin.filter(e => e.season?.id === prevSeason.id).slice(0, PARTIDOS_TEMP_PASADA) : [];
      let ligaEvs = [], ligaNombre;
      if (PARTIDOS_LIGA > 0) {
        const esAmistoso = e => /friendl/i.test(`${e.tournament?.uniqueTournament?.name || ''} ${e.tournament?.name || ''}`);
        const inicio = (actual.length ? Math.min(...actual.map(e => e.startTimestamp)) : Math.min(corte, ahora) - 120 * 86400) - 45 * 86400;
        const validos = fin.filter(e => e.startTimestamp >= inicio && !esAmistoso(e));
        const cuenta = {};
        for (const e of validos) { const id = e.tournament?.uniqueTournament?.id; if (id && id !== ut) cuenta[id] = (cuenta[id] || 0) + 1; }
        const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 4) {
          ligaEvs = validos.filter(e => e.tournament?.uniqueTournament?.id === +top[0]).slice(0, PARTIDOS_LIGA);
          ligaNombre = ligaEvs[0]?.tournament?.uniqueTournament?.name;
        }
      }
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
      .filter(e => e.status?.type === 'finished' && e.startTimestamp < corte)
      .sort((a, b) => b.startTimestamp - a.startTimestamp).slice(0, 6);
    const [local, visita, h2hList] = await Promise.all([
      teamData(ev.homeTeam.id), teamData(ev.awayTeam.id),
      Promise.all(h2hEvs.map(async e => ({
        fecha: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10), torneo: e.tournament?.name,
        partido: `${e.homeTeam.name} ${e.homeScore.current}-${e.awayScore.current} ${e.awayTeam.name}`,
        descanso: `${e.homeScore.period1}-${e.awayScore.period1}`, stats: await statsOf(e.id)
      })))
    ]);

    const out = {
      id: eid,
      partido: `${ev.homeTeam.name} vs ${ev.awayTeam.name}`, torneo: ev.tournament?.name, tablaDe: claveTabla,
      jornada: ev.roundInfo?.round, temporadaActual: ev.season?.name, temporadaPasada: prevSeason?.name,
      hora: new Date(ev.startTimestamp * 1000).toLocaleString(), estado: ev.status?.description,
      marcador: historico ? '---' : `${ev.homeScore?.current ?? '-'}-${ev.awayScore?.current ?? '-'}`,
      arbitro: ev.referee?.name, estadio: ev.venue?.name,
      arbitroStats: ev.referee?.games ? { partidos: ev.referee.games, amarillas: ev.referee.yellowCards, rojas: ev.referee.redCards, dobleAmarilla: ev.referee.yellowRedCards } : undefined,
      forma: pre, h2hResumen: h2h?.teamDuel, statsEnVivo: {},
      alineacionesConfirmadas: lu?.confirmed, alineacionLocal: lineupShort(lu?.home), alineacionVisita: lineupShort(lu?.away),
      cuotas: (odds?.markets || []).filter(m => !m.isLive).map(m => {
        let nombres = m.choices.map(c => c.name);
        if (m.choices.length === 3 && ['Full time', '1st half', '2nd half'].includes(m.marketName)) nombres = ['1', 'X', '2'];
        if (m.choices.length === 3 && m.marketName === 'First team to score') nombres = [ev.homeTeam.name, 'Sin gol', ev.awayTeam.name];
        return `${m.marketName}${m.choiceGroup ? ' ' + m.choiceGroup : ''}: ` + m.choices.map((c, i) => `${nombres[i]} ${c.fractionalValue}`).join(', ');
      }),
      local, visita, h2h: h2hList
    };
    if (historico) {
      // Resultado a 90' para que la app liquide al momento (mismo formato que el script de resultados).
      out.resultado = {
        terminado: ev.status?.type === 'finished',
        marcador: par(ev.homeScore?.normaltime ?? ev.homeScore?.current, ev.awayScore?.normaltime ?? ev.awayScore?.current),
        descanso: par(ev.homeScore?.period1, ev.awayScore?.period1),
        corners: statTotal(finales, 'Corner kicks'),
        amarillas: statTotal(finales, 'Yellow cards'),
        primerGol: incidencias ? primerGol(incidencias) : null,
      };
    }
    return out;
  };

  // ---------- 3) Procesar (pocos partidos a la vez; la cola limita las peticiones) ----------
  const resultados = new Array(lista.length);
  let siguienteIdx = 0, listos = 0;
  const progreso = setInterval(() => log(`... ${listos}/${lista.length} partidos, ${hechas} peticiones, ${limite} a la vez, ${Math.round((Date.now() - t0) / 1000)} s`), 10000);
  const trabajador = async () => {
    while (!bloqueado && siguienteIdx < lista.length) {
      const i = siguienteIdx++;
      const e = lista[i];
      try { resultados[i] = await analizar(e.id); }
      catch (err) { resultados[i] = { id: e.id, partido: `${e.homeTeam.name} vs ${e.awayTeam.name}`, error: String(err) }; }
      if (bloqueado) { resultados[i] = undefined; break; } // datos a medias: mejor no usarlos
      listos++;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, PARTIDOS_A_LA_VEZ) }, trabajador));
  clearInterval(progreso);

  const partidos = resultados.filter(r => r && !r.error);
  const faltan = lista.filter((_, i) => !resultados[i] || resultados[i].error).map(e => `${e.homeTeam.name} vs ${e.awayTeam.name}`);
  const out = {
    version: 5, generado: new Date().toLocaleString(), modo: MODO,
    filtros: { torneos: torneos.map(t => t.nombre).join(', '), modo: MODO, dias: DIAS },
    incompleto: faltan.length > 0, faltan,
    posiciones: tablas, partidos
  };
  window._sofa = out;
  const txt = JSON.stringify(out);
  log(`${partidos.length} partidos en ${Math.round((Date.now() - t0) / 1000)} s, ${hechas} peticiones${frenadas ? ` (Sofascore freno ${frenadas} vez/veces)` : ''}.`);
  if (faltan.length) log(`Faltaron ${faltan.length} partido(s): vuelve a correrlo mas tarde o con menos DIAS/torneos.`);

  if (DESCARGAR) {
    const nombre = `sofascore_v5_${MODO}_${fechaLocal(new Date())}_${partidos.length}partidos.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    log(`Listo: se descargo ${nombre} (${Math.round(txt.length / 1024)} KB). Subelo en el analizador.`);
  } else {
    log(`Listo (${Math.round(txt.length / 1024)} KB). Copialo con: copy(JSON.stringify(window._sofa))`);
  }
})();
}
