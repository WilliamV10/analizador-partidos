/**
 * Apuestas seguras (surebets): repartir el dinero entre las selecciones de un mismo partido
 * en distintas casas para ganar pase lo que pase. Funciones puras; la pantalla está en
 * ui/screens/surebets.js y los datos vienen del JSON del script de surebets.
 *
 * Con cuotas o₁…oₙ, s = Σ 1/oᵢ. Si s < 1 hay apuesta segura con margen p = 1/s − 1, y a cada
 * selección le toca T · (1/oᵢ) / s del total T: cobra lo mismo gane la que gane.
 */

/**
 * Reparte el dinero.
 * @param {number[]} odds   cuotas decimales
 * @param {'win'|'total'} mode  'win': `amount` es la ganancia deseada; 'total': lo que se invierte
 * @param {number} amount
 * @param {number} step     redondeo de cada apuesta (1, 0.5, 0.01…)
 * @returns {{ sum: number, margin: number, total: number, stakes: number[], payouts: number[], profits: number[] }}
 */
export function splitStakes(odds, mode, amount, step) {
  const sum = odds.reduce((acc, value) => acc + 1 / value, 0);
  const margin = 1 / sum - 1;
  const round = (value) => Math.round(value / step) * step;
  const compute = (target) => {
    const stakes = odds.map((value) => round((target * (1 / value)) / sum));
    const total = stakes.reduce((acc, value) => acc + value, 0);
    const payouts = stakes.map((stake, index) => stake * odds[index]);
    return { sum, margin, total, stakes, payouts, profits: payouts.map((payout) => payout - total) };
  };
  let target = mode === 'win' ? (margin > 0 ? amount / margin : Number.NaN) : amount;
  let result = compute(target);
  // Con el redondeo, sube un poco el total hasta asegurar la ganancia pedida.
  if (mode === 'win' && margin > 0) {
    for (let tries = 0; tries < 400 && Math.min(...result.profits) < amount - 0.005; tries += 1) {
      target += step / 2;
      result = compute(target);
    }
  }
  return result;
}

/**
 * Lee el JSON del script de surebets: { seguras: [...], casi?: [...], sandwich?: [...], generado?, emparejados? }.
 * @param {string} text
 */
export function parseSurebets(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('el texto no es un JSON válido');
  }
  if (!data || !Array.isArray(data.seguras)) throw new Error('no es el JSON del script de apuestas seguras (falta "seguras")');
  const legsOk = (item) => Array.isArray(item?.legs) && item.legs.length >= 2 && item.legs.every((leg) => Number(leg.cuota) > 1);
  return {
    generated: data.generado ? Date.parse(data.generado) : null,
    compared: data.emparejados ?? null,
    safe: data.seguras.filter(legsOk),
    almost: (data.casi ?? []).filter(legsOk),
    sandwich: (data.sandwich ?? []).filter(legsOk),
  };
}

/**
 * Nombre legible de una selección del script ("1X2" + "1" -> "Gana Local").
 * @param {{ mk: string, sel: string }} leg
 * @param {string} title  "Local vs Visita"
 */
export function legName({ mk: market, sel: selection }, title) {
  const [home = 'Local', away = 'Visita'] = String(title ?? '').split(/ vs\.? /i);
  if (market === '1X2') return selection === '1' ? `Gana ${home}` : selection === 'X' ? 'Empate' : `Gana ${away}`;
  if (market === 'DC') return selection === '1X' ? `${home} o empate` : selection === 'X2' ? `Empate o ${away}` : `${home} o ${away} (no empate)`;
  if (market === 'DNB') return `${selection === '1' ? home : away} (sin empate)`;
  if (market === 'BTTS') return `Ambos anotan: ${selection}`;
  if (market === 'Par/Impar') return `Goles totales: ${selection}`;
  let match = String(market).match(/^OU1H (.+)/);
  if (match) return `1ª mitad: ${selection} de ${match[1]} goles`;
  match = String(market).match(/^OU (.+)/);
  if (match) return `${selection} de ${match[1]} goles`;
  match = String(market).match(/^AH (.+)/);
  if (match) {
    const line = Number(match[1]);
    const value = selection === 'Local' ? line : -line;
    return `Hándicap ${selection === 'Local' ? home : away} ${value > 0 ? '+' : ''}${value}`;
  }
  return `${market} ${selection}`;
}
