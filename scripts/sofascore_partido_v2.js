// ===== Analisis de partido Sofascore -> JSON  (v2) =====
// Uso: abre la pagina del partido en sofascore.com, F12 -> "Console",
// pega todo este codigo y Enter. Tarda 20-60 s. Al final el JSON aparece en la
// consola. Para copiarlo escribe:  copy(JSON.stringify(window._sofa))  y Enter,
// y pegalo (Ctrl+V) en el chat.
// Novedades v2: incluye la temporada pasada de la misma liga, tabla de posiciones
// y xG por jugador.

const EVENT_ID = null;          // pon el id si no detecta bien el partido (ej: 16318042)
const PARTIDOS_TEMP_PASADA = 12; // cuantos partidos de la temporada pasada por equipo
const DESCARGAR = false;         // true = ademas descarga el .json

(async () => {
  const API = 'https://www.sofascore.com/api/v1/';
  const g = async u => { try { const r = await fetch(API + u); return r.ok ? await r.json() : null; } catch { return null; } };
  const log = m => console.log('%c[sofa] ' + m, 'color:#0a7');

  // ---------- 1) Detectar el partido ----------
  let eid = EVENT_ID || (location.hash.match(/id:(\d+)/) || [])[1];
  if (!eid) {
    const custom = location.pathname.split('/').filter(Boolean).pop();
    const evs = (await g(`event/${custom}/h2h/events`))?.events || [];
    const live = evs.find(e => e.status?.type === 'inprogress');
    const next = evs.filter(e => e.status?.type === 'notstarted').sort((a, b) => a.startTimestamp - b.startTimestamp)[0];
    const last = evs.filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp)[0];
    eid = (live || next || last)?.id;
  }
  if (!eid) { console.error('No encontre el partido. Pon EVENT_ID manualmente.'); return; }
  const ev = (await g(`event/${eid}`))?.event;
  const season = ev.season?.id;
  const ut = ev.tournament?.uniqueTournament?.id;
  log(`${ev.homeTeam.name} vs ${ev.awayTeam.name} (id ${eid})`);

  // Temporada pasada de la misma liga
  const seasons = (await g(`unique-tournament/${ut}/seasons`))?.seasons || [];
  const idx = seasons.findIndex(s => s.id === season);
  const prevSeason = idx >= 0 ? seasons[idx + 1] : null;

  // ---------- Helpers ----------
  const statsOf = async id => {
    const s = await g(`event/${id}/statistics`); const o = {};
    if (s) for (const p of s.statistics) for (const gr of p.groups) for (const it of gr.statisticsItems) {
      if (['Corner kicks', 'Shots on target', 'Total shots', 'Expected goals', 'Ball possession', 'Yellow cards'].includes(it.name))
        o[`${p.period} ${it.name}`] = `${it.home}-${it.away}`;
    }
    return o;
  };
  const fmtMatch = async (e, tid) => ({
    temporada: e.season?.name || e.season?.year,
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

  // ---------- 2) Datos del partido ----------
  const [pre, h2h, lu, odds, live, tabla] = await Promise.all([
    g(`event/${eid}/pregame-form`), g(`event/${eid}/h2h`), g(`event/${eid}/lineups`),
    g(`event/${eid}/odds/1/all`), statsOf(eid),
    g(`unique-tournament/${ut}/season/${season}/standings/total`)
  ]);
  const posiciones = (tabla?.standings?.[0]?.rows || []).map(r =>
    `${r.position}. ${r.team.name} ${r.points}pts PJ${r.matches} ${r.wins}-${r.draws}-${r.losses} GF${r.scoresFor} GC${r.scoresAgainst}`);

  // ---------- 3) Partidos por equipo ----------
  const teamData = async tid => {
    const pages = [];
    for (let p = 0; p < 3; p++) { const r = await g(`team/${tid}/events/last/${p}`); if (!r?.events?.length) break; pages.push(...r.events); if (!r.hasNextPage) break; }
    const fin = pages.filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp);
    const actual = fin.filter(e => e.season?.id === season);
    const pasada = prevSeason ? fin.filter(e => e.season?.id === prevSeason.id).slice(0, PARTIDOS_TEMP_PASADA) : [];

    const partidos = [], partidosTempPasada = [], jug = {};
    for (const e of actual) {
      partidos.push(await fmtMatch(e, tid));
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
    log(`equipo ${tid}: ${partidos.length} partidos esta temporada, ${partidosTempPasada.length} de la pasada`);
    return {
      partidos, partidosTempPasada,
      notaTempPasada: prevSeason && !pasada.length ? 'Sin partidos de esta liga la temporada pasada (posible ascendido)' : undefined,
      jugadores: Object.values(jug).filter(j => j.tiros > 0).sort((a, b) => b.tirosPuerta - a.tirosPuerta)
    };
  };
  const local = await teamData(ev.homeTeam.id);
  const visita = await teamData(ev.awayTeam.id);

  // ---------- 4) H2H ----------
  const h2hEvs = ((await g(`event/${ev.customId}/h2h/events`))?.events || [])
    .filter(e => e.status?.type === 'finished').sort((a, b) => b.startTimestamp - a.startTimestamp).slice(0, 8);
  const h2hList = [];
  for (const e of h2hEvs) h2hList.push({
    fecha: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10), torneo: e.tournament?.name,
    partido: `${e.homeTeam.name} ${e.homeScore.current}-${e.awayScore.current} ${e.awayTeam.name}`,
    descanso: `${e.homeScore.period1}-${e.awayScore.period1}`, stats: await statsOf(e.id)
  });

  const out = {
    version: 2,
    partido: `${ev.homeTeam.name} vs ${ev.awayTeam.name}`, torneo: ev.tournament?.name, jornada: ev.roundInfo?.round,
    temporadaActual: ev.season?.name, temporadaPasada: prevSeason?.name,
    hora: new Date(ev.startTimestamp * 1000).toLocaleString(), estado: ev.status?.description,
    marcador: `${ev.homeScore?.current ?? '-'}-${ev.awayScore?.current ?? '-'}`, arbitro: ev.referee?.name, estadio: ev.venue?.name,
    forma: pre, h2hResumen: h2h?.teamDuel, statsEnVivo: live,
    alineacionesConfirmadas: lu?.confirmed, alineacionLocal: lineupShort(lu?.home), alineacionVisita: lineupShort(lu?.away),
    cuotas: (odds?.markets || []).map(m => `${m.marketName}${m.choiceGroup ? ' ' + m.choiceGroup : ''}: ` +
      m.choices.map(c => `${c.name} ${c.fractionalValue}`).join(', ')),
    posiciones, local, visita, h2h: h2hList
  };
  window._sofa = out;
  const txt = JSON.stringify(out);

  if (DESCARGAR) {
    const nombre = (ev.homeTeam.name + '_vs_' + ev.awayTeam.name).replace(/\W+/g, '_') + '.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    log('Se descargo ' + nombre);
  }

  // Imprime el JSON en la consola
  console.log(txt);
  log('Listo (' + Math.round(txt.length / 1024) + ' KB). El JSON esta arriba.');
  log('Para copiarlo: escribe  copy(JSON.stringify(window._sofa))  y Enter, luego pega (Ctrl+V) en el chat.');
  log('O haz clic en "Copy" debajo del texto largo de arriba.');
})();
