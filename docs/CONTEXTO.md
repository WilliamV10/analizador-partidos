# Analizador de partidos — Contexto del proyecto

> Documento maestro. Está escrito para que cualquier persona o IA pueda retomar el proyecto sin haber visto la conversación original. Si cambias algo importante del código o del modelo, actualiza este archivo.

---

## 1. Qué es

Una página web estática (HTML, CSS y JS puro, sin frameworks ni build) que recibe el JSON exportado por un script de Sofascore y calcula, para uno o varios partidos de fútbol:

- **Goles esperados** de cada equipo (por estadísticas, por cuotas y mezclados).
- **Probabilidades:** 1X2, doble oportunidad, empate no apuesta, Over/Under, ambos anotan, equipo anota, primer gol y marcadores más probables.
- **Valor de cada cuota:** probabilidad propia frente a la de la casa sin margen, valor esperado (EV) y nivel de confianza.
- **Estadísticas por bloque:** temporada actual, otra competición, casa/fuera, temporada pasada y H2H.
- **Alineaciones, bajas** y **alertas automáticas** sobre la calidad de los datos.

Todo se calcula en el navegador. No hay servidor ni llamadas a Sofascore (así se evita el CORS), y los datos del usuario no salen de su equipo.

**Lo que NO hace (y por qué existe la "capa 3", ver §9):** la página no sabe de noticias, rotaciones, motivación ni del nivel real de ligas exóticas. Para eso, el usuario pasa un resumen a Claude, que investiga y devuelve un *bloque de contexto* que la página aplica.

---

## 2. Flujo de trabajo completo

```
Sofascore (navegador)                Página (navegador)                 Claude (chat)
─────────────────────               ───────────────────               ─────────────
1. Abrir sofascore.com
2. Pegar el script v4 en la
   consola (F12) y ejecutarlo
3. Se descarga
   sofascore_FECHA_Npartidos.json ─► 4. Pegar o subir el JSON
                                     5. Análisis automático
                                     6. (Fase 5) "Copiar para Claude" ─► 7. Claude busca contexto
                                     9. Pegar el bloque de contexto ◄──── 8. Devuelve un bloque JSON
                                    10. Recalcula con el contexto
```

**Scripts de Sofascore** (están en `scripts/`: `sofascore_multi_v4.js` y `sofascore_partido_v2.js`):

- **v2:** un partido. Imprime el JSON en consola (`copy(JSON.stringify(window._sofa))`).
- **v4:** varios partidos. Se filtran por `FECHA`, `TORNEO`, `TORNEO_ID`, `HORA` o `IDS` y se descarga un archivo.
- El v4 va dentro de un bloque `{ }`, así que se puede pegar varias veces sin recargar. Hace varias peticiones a la vez (`PETICIONES_A_LA_VEZ`), no repite URLs y, si Sofascore responde 429/403, baja el ritmo, espera y reintenta solo.
- El endpoint `scheduled-events` devuelve 404. Por eso el script busca los partidos desde los endpoints del torneo.

---

## 3. Formatos de entrada

La página detecta el formato sola (`js/io/formatDetector.js`):

| Formato | Cómo se reconoce | Qué contiene |
|---|---|---|
| **v2 (un partido)** | La raíz tiene `partido` (texto), `local` y `visita` | El partido es la raíz. `posiciones` es una lista de textos |
| **v3 / v4 (varios)** | La raíz tiene `partidos: [...]` | `{version, generado, filtros, posiciones: {torneo: [...]}, partidos: [...]}` |

### Campos de cada partido

Son iguales en v2 y en cada elemento de `partidos`:

```jsonc
{
  "id": 16317994,
  "partido": "Atlas FC vs Club América",          // siempre "Local vs Visita"
  "torneo": "Liga MX, Apertura", "tablaDe": "Liga MX, Apertura", "jornada": 13,
  "temporadaActual": "...", "temporadaPasada": "...",
  "hora": "21/10/2026, 19:00:00",                  // texto en hora local del usuario
  "estado": "Not started",                         // "1st half", "2nd half"… si ya empezó
  "marcador": "---", "arbitro": "…", "estadio": "…",
  "arbitroStats": { "partidos": 120, "amarillas": 540, "rojas": 10, "dobleAmarilla": 4 }, // historial del árbitro (opcional)
  "forma": { "homeTeam": { "position": 5, "form": ["L","D","W","D","W"] }, "awayTeam": {…} },
  "h2hResumen": { "homeWins": 2, "awayWins": 5, "draws": 3 },
  "statsEnVivo": {},
  "alineacionesConfirmadas": true,                 // puede faltar (J1 League)
  "alineacionLocal": { "formation": "4-2-2-2",
                       "titulares": ["Camilo Vargas (G)", …],   // (G|D|M|F) = posición
                       "suplentes": ["…"],
                       "bajas": ["Duk - missing: Knee Injury", "X - doubtful: Strain Injury"] },
  "alineacionVisita": { … },
  "cuotas": ["Full time: 1 5/2, X 13/5, 2 24/25", "Match goals 2.5: Over 13/20, Under 6/5", …],
  "local": {
    "partidos":           [ PartidoPasado… ],      // temporada actual de este torneo
    "partidosTempPasada": [ PartidoPasado… ],      // temporada pasada de este torneo
    "ligaNombre": "Liga MX, Clausura",             // v4: otra competición
    "partidosLiga":       [ PartidoPasado… ],      // v4: liga local (o torneo anterior)
    "jugadores": [ { "nombre", "pj", "titular", "min", "tirosPuerta", "tiros", "goles", "xG", "asist" } ]
  },
  "visita": { … },
  "h2h": [ { "fecha", "torneo", "partido": "Club América 0-1 Atlas FC", "descanso": "0-0", "stats": {…} } ]
}
```

**PartidoPasado:** `{ competicion?, temporada, fecha, condicion: "local"|"visita", partido: "Local 0-2 Visita", descanso: "0-1", stats: { "ALL Expected goals": "1.81-2.18", … } }`

### Particularidades conocidas

- **Stats en formato "local-visita":** el adaptador las voltea a "a favor / en contra" según `condicion`. Claves usadas:
  - `ALL Expected goals`
  - `ALL Total shots`
  - `ALL Shots on target`
  - `ALL Corner kicks`
  - `1ST Corner kicks`
  - `ALL Yellow cards`
  - `ALL Ball possession`
- **Cuotas fraccionales:** decimal = fracción + 1 (`5/2` → 3.50).
- **Mercados repetidos:** en partidos en vivo Sofascore manda "Full time" dos veces (en vivo y previa). Se usa la **última** y se avisa.
- **Etiquetas mal puestas en v3:** por ejemplo, `"1st half: X 7/4, X 15/8, 2 13/8"`. Los mercados tipo 1X2 se etiquetan **por posición**.
- **Marcadores de penales:** algunas competiciones (J1) traen marcadores como 11-9. Se excluyen los partidos con 12 goles o más y se avisa.
- **`partidosLiga`:**
  - En Champions, es la liga local del equipo.
  - En Liga MX, es el torneo anterior (Clausura).
  - En J1 puede ser la ACL o copas. Ojo con su calidad.
- **H2H:** sin `condicion`. Se orienta comparando el nombre del local (con comparación aproximada si cambia el nombre).

---

## 4. Modelo interno

Lo definen los JSDoc de `js/types.js`. Los adaptadores convierten cualquier formato a esto, y el resto del código **solo** conoce estas estructuras.

- **`Match`:** id, source, title, tournament, round, kickoff, status, score, referee, venue, lineupsConfirmed, home, away, h2h, odds, duplicateMarkets, standings.
- **`Team`:** name, position, form, lineup, current, other, otherName, previous, players.
- **`TeamMatchRow`:** un partido visto desde un equipo. Campos: isHome, opponent, goalsFor, goalsAgainst, htGoalsFor/Against, stats `{ xg: {for, against}, … }` y block (`current` | `other` | `previous` | `h2h`). Las filas ajustadas de la fase 4 traen además `weight`.
- **`Outcome`:** `{ win, push, loss }`, la probabilidad de ganar, de devolución o de perder una apuesta. El hándicap asiático de cuarto de línea se resuelve promediando las dos líneas vecinas, así que no hace falta `halfWin`/`halfLoss` (ver §6.7).
- **`MatchContext`** (`domain/context.js`): el bloque de Claude ya normalizado (adjustments, cardsExtra, cornersExtra, notes, confidence).

---

## 5. Arquitectura

```
JSON ─► io (leer, detectar) ─► adapters (v2, v4) ─► Match[] ─┐
Bloque de Claude ─► app/importContext ─► MatchContext[] ──────┼─► domain/analyzeMatch ─► MatchAnalysis ─► ui (renderers)
Ajustes guardados ─► app/settings ─► config efectiva ─────────┘
```

```
index.html          esqueleto: barra superior, formulario de carga, contenedor de pantallas, barra inferior, diálogo de apuesta
css/
  tokens.css        ÚNICO lugar con colores, tipografías, radios y espacios (light-dark(): oscuro y claro)
  layout.css        reset, barra superior, barra inferior (celular), pantallas, lista lateral + detalle (escritorio)
  components.css    componentes en BEM, en el mismo orden que ui/components.js
js/
  main.js           punto de entrada: carga → importación → análisis → estado → interfaz
  themeInit.js      script clásico en <head>: aplica el tema guardado antes de pintar
  config.js         TODOS los parámetros del modelo
  config/leagues.js capa 2: coeficientes de liga, peso por competición, localía por liga
  texts.js          TODOS los textos de la interfaz (español), incluido el texto para Claude
  types.js          modelo interno (JSDoc)
  utils/            math.js (mean, weightedMean, clamp…), text.js (normalizeName, namesMatch)
  io/               importError, formatDetector, jsonParser, fileReader, historyDb, sessionStore (última carga)
  adapters/         common (compartido), v2Adapter, v4Adapter
  app/              casos de uso: importMatches, analyzeMatches, importContext, settings,
                    history (registros + almacén), importResults (resultados y respaldos)
  domain/           SOLO funciones puras (sin DOM):
    odds.js           cuotas → decimal, quitar margen
    marketCatalog.js  nombres de Sofascore → tipos canónicos, grupos de mercado, índice de cotizaciones
    matchRows.js      partido crudo → TeamMatchRow
    events.js         predicados (ambos anotan, over, anotó…)
    aggregates.js     resúmenes por bloque (promedios ponderados por `weight`)
    poisson.js        grilla de marcadores
    lambdas.js        goles esperados (estadísticas, mercado, mezcla)
    probabilities.js  1X2, DC, totales, ambos anotan, primer gol, marcadores
    empirical.js      mezcla del modelo con lo ocurrido realmente
    handicap.js       hándicap asiático (diferencia de goles, líneas de cuarto)
    halfTime.js       primer tiempo (proporción de goles antes del descanso)
    counts.js         corners y tarjetas (binomial negativa + empírico)
    players.js        estado en la alineación y proyección de tiros por jugador
    adjustments.js    calendario, coeficiente de liga y peso por competición
    absences.js       bajas cuantificadas
    context.js        buscar y aplicar el bloque de Claude
    selections.js     Outcome de cada selección de cada mercado
    value.js          EV, probabilidad justa, nivel de confianza
    ranking.js        ranking global de picks con filtros
    combos.js         combinadas: candidatos, precio y sugeridas
    explorer.js       distribución de goles, corners y tarjetas para la pantalla Explorar
    history.js        registros del historial (predicciones y apuestas), unión y pendientes
    settlement.js     liquidación con el resultado real y cuota de cierre
    performance.js    ganancia, ROI, acierto, CLV y calibración
    alerts.js         códigos de alerta
    analyzeMatch.js   orquestador
  ui/
    dom.js            h() seguro (nunca innerHTML)
    components.js     piezas visuales: card, stat(s), chips, segmented, tabs, badges, barras, tablas, botones
    icons.js          ÚNICA fuente de íconos SVG (icon('nombre') y <span data-icon> en el HTML)
    navigation.js     lista de pantallas: alimenta la barra superior y la inferior
    formatters.js     %, cuotas, fechas
    store.js          estado + suscripción
    preferences.js    localStorage que nunca lanza
    theme.js          tema (oscuro, claro o sistema), se elige en Ajustes
    loaderPanel.js    eventos del formulario de carga y tarjeta "Último análisis"
    claudePrompt.js   texto compacto para Claude
    historyController.js  acciones del historial (registrar, liquidar, respaldo)
    betDialog.js      diálogo "Registrar apuesta"
    resultsScriptSource.js  script de consola de resultados (función autosuficiente, se pasa a texto)
    resultsScript.js  arma ese script con los ids pendientes
    download.js       descargar un texto como archivo
    screens/          una pantalla por archivo: day, match, explorer, combo, context, settings, history
                      shared.js (nombres, mejor pick, tarjeta de partido)
      matchTabs/      pestañas del partido: summary, value, markets, counts, players, teams
tests/              node --test (sin dependencias), fixtures sintéticos en tests/fixtures
scripts/            scripts de consola de Sofascore que generan el JSON (v2 y v4)
docs/CONTEXTO.md    este archivo
```

### Interfaz

- **Pantallas** (`ui/navigation.js`): Día · Partido · Explorar · Combinada · Contexto · Historial · Ajustes, más la de carga. En el celular van en la barra inferior (6 lugares; Historial se abre con su ícono de la barra superior); en escritorio (≥ 900 px) en la barra superior, y el partido se ve con la lista del día al costado.
- **Explorar:** se elige goles, corners o tarjetas (total, local, visita o 1er tiempo) y un valor N con el deslizador: probabilidad de exactamente N, N o más y N o menos, con su cuota justa, la distribución completa y la cuota de la casa si existe esa línea. En "Todos" ordena los partidos por la probabilidad de N o más. El cálculo está en `domain/explorer.js` (grilla final para goles; binomial negativa con el esperado final para corners y tarjetas; sin la mezcla con lo ocurrido). Los topes del deslizador están en `config.explorer.maxValue`. El deslizador actualiza los resultados en el lugar y la pantalla no se redibuja mientras se mueve. Sin partidos cargados, las de análisis muestran la carga.
- **Cómo se dibuja:** `main.js` guarda todo en el store; cada cambio redibuja la pantalla activa con su función de `ui/screens/`. Ajustes solo se redibuja al entrar, al restaurar o al cambiar el tema (así los deslizadores no pierden el foco). El formulario de carga y los cuadros de texto de contexto y resultados son nodos fijos: no pierden lo pegado.
- **Para agregar algo:** una pantalla = archivo en `ui/screens/` + entrada en `navigation.js` y `SCREEN_VIEWS` (main.js). Una pestaña del partido = archivo en `ui/screens/matchTabs/` + entrada en `MATCH_TABS` (match.js). Un color o medida = token en `tokens.css`. Un texto = `texts.js`.
- **Combinada:** el usuario la arma (o parte de una sugerida) con reglas propias (cuota mínima, nivel, un pick por partido) y la copia como texto. `domain/combos.js` da los candidatos y el precio.
- **Contexto:** se puede copiar solo los partidos "por revisar" (alerta de divergencia) y desactivar el ajuste de cada partido con su casilla.
- **Historial:** pantalla aparte, disponible aunque no haya partidos cargados (ver §9 bis). `io/historyDb.js` guarda en IndexedDB.
- **Última carga:** `io/sessionStore.js` guarda en IndexedDB (base `analizador-sesion`) los JSON tal como se subieron, el modo y el bloque de Claude. Al abrir la página se vuelven a analizar solos. «Limpiar» la borra y cargar otros datos la reemplaza.
- **Pestañas del partido:** Resumen (avisos, probabilidad final, goles esperados, marcadores, mejor pick, claves, contexto) · Valor (tarjetas Mi prob. vs Casa, filtros por mercado, "+" para registrar) · Mercados (resultado, goles, quién anota, hándicap, medio tiempo y primer gol) · Corners y tarjetas (esperado, línea de la casa, partidos contra la línea, todas las líneas) · Jugadores (1+ y 2+ a puerta, quién no empieza) · Equipos y H2H (bloques, últimos resultados, H2H, XI y bajas).
- Responsive sin desbordes: probado a 320, 360, 390, 768 y 1440 px. Las tablas largas tienen scroll propio.

### Reglas de código limpio (obligatorias)

1. **`domain/` es puro:** no toca el DOM, no lee archivos y no usa estado global. Recibe datos y config y devuelve datos.
2. **Sin números mágicos:** cualquier parámetro del modelo va en `config.js` (o en `config/leagues.js` si es una tabla por liga).
3. **Sin textos sueltos:** todo texto visible va en `texts.js`. El dominio devuelve **códigos** (alertas, niveles, estados) y la interfaz los traduce.
4. **Los adaptadores aíslan a Sofascore.** Si el script cambia, solo se tocan `adapters/` (y quizá `marketCatalog.js`).
5. **Funciones pequeñas con un propósito y nombres en inglés.** La interfaz y la documentación van en español.
6. **Seguridad:** el DOM se crea con `h()` y nodos de texto, nunca con `innerHTML`, para que un JSON manipulado no pueda inyectar HTML. Los ajustes guardados se validan y se limitan al leerlos.
7. **Errores con códigos:** `ImportError(code, params)`. Un partido con datos raros no tumba a los demás (`analyzeMatches`).
8. **JSDoc** en las funciones públicas.

---

## 6. El modelo matemático

### 6.1 Goles esperados por estadísticas (`lambdas.statsLambdas`)

- `ataque(equipo) = 0.35 × goles a favor + 0.65 × xG a favor` sobre el bloque **reciente** (temporada actual + otra competición). El xG pesa más porque tiene menos ruido (`lambda.xgWeight`).
- `defensa(equipo) = 0.35 × goles en contra + 0.65 × xG en contra`.
- **Modelo multiplicativo** (`lambda.multiplicative`): `global_local = ataque(local) × defensa(visita) ÷ media × 1.10`, donde `media` = goles por equipo y partido de la tabla (Σ GF / Σ PJ). La visita usa × 0.90; la Liga MX usa 1.15 / 0.86 (ver `config/leagues.js`). Sin tabla útil (< 6 equipos) se usa `promedio(ataque, defensa)`.
- `split_local = ataque(local en casa) × defensa(visita fuera) ÷ (media × 1.10)` (la visita divide por `media × 0.90`). Solo se usa si ambos tienen ≥ 4 partidos.
- `λ_stats = 0.65 × global + 0.35 × split`. Si no hay split, se usa el global.
- Si no hay datos, se usa `fallbackGoals` (1.35). El resultado se limita a 0.2–4.5.
- Antes de promediar se aplican los ajustes de la fase 4 (§6.8) y después las bajas (§6.9).

### 6.2 Goles esperados por mercado (`fitMarketLambdas`)

Se buscan los λ (local, visita) cuya grilla de Poisson (con la misma corrección de Dixon-Coles de §6.4) reproduce mejor el **1X2 sin margen** y el **Over/Under** de la línea más cercana a 2.5. Búsqueda en grilla: gruesa (paso 0.05, rango 0.2–4.5) y luego fina (paso 0.01).

### 6.3 Goles esperados finales

`λ_mezcla = 0.6 × λ_mercado + 0.4 × λ_stats` (sin cuotas 1X2, `λ_mezcla = λ_stats` y se avisa). Si hay contexto de Claude, `λ_final = λ_mezcla × ajustes` (§9); si no, `λ_final = λ_mezcla`.

### 6.4 Poisson

Grilla de marcadores de 0 a 10 goles por equipo, normalizada a 1, con la **corrección de Dixon-Coles** (`poisson.dixonColesRho` = −0.08): `P(0-0) × (1 − λL·λV·ρ)`, `P(0-1) × (1 + λL·ρ)`, `P(1-0) × (1 + λV·ρ)`, `P(1-1) × (1 − ρ)`. Con ρ < 0 suben el 0-0 y el 1-1 y bajan el 1-0 y el 0-1, que dos Poisson independientes reparten mal. El primer tiempo usa Poisson sin corrección. De ahí salen el 1X2, la doble oportunidad, la distribución del total, ambos anotan, cada equipo anota, el primer gol, los marcadores más probables y la diferencia de goles (hándicap).

Primer gol: `P(sin goles) = P(0-0)`, y `P(local primero) = (1 − P(0-0)) × λL / (λL + λV)`.

### 6.5 Mezcla con lo empírico (`empirical.js`)

Se aplica a los mercados de sí/no (ambos anotan, Over X.5, local anota, visita anota) y a las líneas de corners y tarjetas:

- **Lo ocurrido realmente** = aciertos en los partidos del local **en casa**, más los del visitante **fuera**, más el H2H con peso 0.5 por partido (el H2H solo en goles).
- `peso = min(0.3, n / (n + 30))`. El modelo vale como 30 partidos virtuales y la realidad pesa como máximo 30% (un porcentaje de 10 partidos tiene ±15% de error).
- `final = (1 − peso) × modelo + peso × real`.

### 6.6 Valor (`value.js`)

- **Probabilidad justa de la casa:** las implícitas `1/cuota`, normalizadas dentro del mercado. En doble oportunidad suman 2.
- **Mi probabilidad:** `win / (win + loss)`, sin contar la devolución.
- **EV** = `win × (cuota − 1) − loss`. **Ventaja** = mi prob − prob justa.

| Nivel | Regla |
|---|---|
| Sin valor | EV ≤ 0, **o** prob < 30% (cuotas largas), **o** cuota < 1.15 |
| Alta | EV ≥ 8% **y** muestra ≥ 8 **y** las fuentes coinciden |
| Media | EV ≥ 4% |
| Media-baja | EV > 0 |

**"Las fuentes coinciden":**

- **Goles, ambos anotan, corners y tarjetas:** |modelo − real| ≤ 10 pts. Si no, el nivel se limita a **Media**.
- **1X2, DC, DNB, primer gol, hándicap y 1X2 del primer tiempo:** |prob. por estadísticas − prob. justa de la casa| ≤ 12 pts. Si no, se limita a **Media-baja**.
- **Ventaja sospechosa (todos los mercados):** si la prob. propia supera a la justa de la casa en más de 15 pts (`value.maxEdge`), el nivel se limita a **Media-baja**: casi siempre es un error o un dato que falta.

### 6.7 Mercados de la fase 3

| Mercado | Cómo se calcula |
|---|---|
| **Hándicap asiático** (`handicap.js`) | Distribución de la diferencia de goles desde la grilla. Línea entera: devolución con diferencia exacta. Línea de cuarto (±0.25, ±0.75): promedio de las dos líneas vecinas (media apuesta en cada una); equivale a `win·(c−1) + halfWin·(c−1)/2 − halfLoss/2 − loss`. La línea del mercado es la del local; la visita usa la opuesta |
| **Primer tiempo** (`halfTime.js`) | `λ_HT = λ × proporción`, con `proporción = (goles al descanso + 20 × 0.45) / (goles totales + 20)` sobre los partidos recientes de ambos equipos. 1X2 y Over 0.5/1.5/2.5 del primer tiempo |
| **Corners** (`counts.js`) | `esperado_local = promedio(corners del local en casa, corners que concede la visita fuera)` (si hay < 4 partidos con dato, se usan todos los recientes). Total esperado = `0.5 × total implícito en la cuota de la casa + 0.5 × estadísticas` (`counts.marketWeight`; el implícito sale de la línea más pareja sin margen). Total con **binomial negativa** (varianza = 1.3 × media) y mezcla empírica. También por equipo y del 1er tiempo (`1ST Corner kicks`). `cornersExtra` de Claude se suma al total |
| **Tarjetas** | Igual que corners con amarillas (dispersión 1.4). Si el JSON trae `arbitroStats`, el total por estadísticas se mezcla antes con las amarillas por partido del árbitro: `peso = min(0.35, partidos / (partidos + 40))`. Después va la mezcla con la cuota. `tarjetasExtra` de Claude se suma al total |
| **Jugadores** (`players.js`) | `λ = ritmo/90 × min_esperados/90 × √(lo que concede el rival / media de liga)`; titular 80', suplente 25', duda 40', baja 0'. Sin alineación, minutos/partidos jugados. Con menos de 450' el ritmo se encoge hacia la media del puesto (encogimiento continuo). `P(1+) = 1 − e^(−λ)`, `P(2+) = 1 − e^(−λ)(1+λ)`, para tiros a puerta y tiros totales |

### 6.8 Ajustes de la fase 4 (`adjustments.js`)

Solo afectan al λ por estadísticas; las tablas siguen mostrando lo ocurrido.

- **Calendario:** `fuerza(rival) = puntos por partido del rival / media de la liga`, limitada a 0.5–1.8, con exponente 0.5. Goles y xG a favor se multiplican por ella y los en contra se dividen. Rivales que no están en la tabla: fuerza 1.
- **Nivel de liga:** en el bloque "otra competición", el factor es `coef(otra) / coef(competición del partido)` (tabla en `config/leagues.js`; si falta uno de los dos, 1).
- **Peso por competición:** amistosos 0, previas 0.6, copas 0.7, el resto 1. Se usa como peso en los promedios. Los partidos de peso 0 se quitan antes de todo (no cuentan en corners, tarjetas, porcentajes empíricos, primer tiempo ni muestra).
- **Antigüedad** (`recency`): el peso de cada partido se multiplica por `0.5 ^ (días / 120)`, contando los días desde el partido más reciente de los datos. Un partido de hace 4 meses pesa la mitad que el de la última jornada.

### 6.9 Bajas cuantificadas (`absences.js`)

`parte = xG del jugador / xG de todos los jugadores del equipo` (goles si no hay xG). El λ por estadísticas baja en `Σ parte × (1 − 0.5 de reemplazo) × peso`, donde peso = 1 para baja, 0.5 para duda y 1 para banca o "no convocado" solo con XI confirmado. Se ignoran aportes < 5% y el factor nunca baja de 0.7. El λ de mercado no se toca, para no contarlo dos veces.

### 6.10 Combinadas (`combos.js`)

Un pick por partido, EV > 0, nivel ≥ media, cuota ≥ 1.50 (excepciones en `combos.minOddsByType`), de 2 a 4 selecciones; se prueban los 2 mejores picks de cada partido. Asumiendo independencia: `cuota = Π cuotas`, `prob = Π prob`, `EV = Π (win·cuota + push) − 1` (exacto con devoluciones). Se muestran las 3 más probables y las 3 de más valor.

---

## 7. Parámetros (`js/config.js`)

| Parámetro | Valor | Qué controla |
|---|---|---|
| `lambda.marketWeight` | 0.6 | Peso de las cuotas en λ final |
| `lambda.xgWeight` | 0.65 | Peso del xG frente a los goles reales |
| `lambda.multiplicative` | sí | Ataque × defensa ÷ media de la liga |
| `lambda.homeAdvantage` / `awayDisadvantage` | 1.10 / 0.90 | Localía en el cálculo estadístico global |
| `lambda.venueSplitWeight` | 0.35 | Peso de casa/fuera en λ estadístico |
| `lambda.minVenueSample` | 4 | Partidos mínimos para usar casa/fuera |
| `lambda.fallbackGoals` | 1.35 | λ sin datos |
| `lambda.fit` | 0.2–4.5, pasos 0.05 / 0.01 | Búsqueda de λ de mercado |
| `poisson.maxGoals` / `dixonColesRho` | 10 / −0.08 | Tamaño de la grilla, corrección de empates bajos |
| `recency.*` | activo, vida media 120 días | Peso por antigüedad |
| `empirical.priorStrength` / `maxWeight` / `h2hWeight` | 30 / 0.3 / 0.5 | Mezcla con lo empírico |
| `data.anomalousTotalGoals` / `smallSample` | 12 / 6 | Marcadores de penales, muestra chica |
| `value.*` | 0.08 / 0.04 / 0.30 / 1.15 / 0.10 / 0.12 / 8 / 0.15 | Niveles de confianza (§6.6) |
| `schedule.*` | activo, exp. 0.5, 0.5–1.8, ≥ 6 equipos | Ajuste por calendario |
| `leagues.*` | `config/leagues.js` | Coeficientes, pesos por competición, localía por liga |
| `absences.*` | activo, reemplazo 0.5, duda 0.5, ≥ 5%, mín. 0.7 | Bajas cuantificadas |
| `alerts.divergenceGoals` / `divergenceProbability` | 0.6 / 0.15 | Alerta de divergencia |
| `halfTime.*` | 0.45, 20 goles virtuales, líneas 0.5–2.5 | Primer tiempo |
| `counts.*` | peso de cuotas 0.5, dispersión 1.3 / 1.3 / 1.4, líneas, árbitro 0.35 / 40 | Corners, corners 1T, amarillas |
| `players.*` | 80'/25'/40', 450', medias por puesto, 4.5 TaP / 12.5 tiros | Proyección de jugadores |
| `context.maxAdjustment` | 0.3 | Tope de cada ajuste de Claude |
| `combos.*` | 2–4, ≥ media, ≥ 1.50, 2 candidatos, 3 mostradas | Combinadas |
| `display.*` | líneas de goles y hándicap, 8 marcadores, mapa 6×6 | Lo que se muestra |

**Pantalla de ajustes:** `app/settings.js` define qué parámetros se pueden editar desde la página, con sus límites. Se guardan en `localStorage` (`analizador.settings`) solo los que difieren del valor por defecto; al leerlos se validan y limitan.

---

## 8. Alertas automáticas (`domain/alerts.js`)

| Código | Nivel | Cuándo |
|---|---|---|
| `matchStarted` | ⚠️ | `estado` ≠ "Not started" (las cuotas pueden ser en vivo) |
| `lineupsNotConfirmed` | ⚠️ | Hay alineación, pero probable |
| `noLineups` | ⚠️ | Ningún equipo tiene titulares |
| `noResultOdds` | ⚠️ | No hay 1X2: solo estadísticas |
| `smallSample` | ⚠️ | Bloque reciente < 6 partidos |
| `marketDivergence` | ⚠️ | Goles totales (estadísticas vs. mercado) difieren ≥ 0.6 o alguna prob. 1X2 ≥ 15 pts → "Revisar con Claude" |
| `keyPlayerOut` | ⚠️ | El goleador o el máximo rematador está de baja, en duda, o (con XI confirmado) en la banca o fuera de la convocatoria |
| `anomalousExcluded` | ℹ️ | Se excluyeron marcadores de penales |
| `duplicateMarkets` | ℹ️ | Cuotas repetidas: se usó la última |

---

## 9. Las tres capas de conocimiento

**Capa 1: automática (los datos).** Las cuotas ya incluyen la fuerza real del equipo (pesan 60%). Ajuste por calendario, bajas cuantificadas y la alerta de divergencia, que es la forma en que la página **detecta cuándo le falta información**.

**Capa 2: tablas editables** (`js/config/leagues.js`). Coeficiente por liga (Premier 1.00, LaLiga 0.97, Serie A 0.95, Bundesliga 0.93, Ligue 1 0.88, Liga MX 0.80, Eredivisie 0.78, Süper Lig 0.75, J1 0.70, Eliteserien 0.65, Liga de Expansión 0.55…), peso por tipo de competición y ventaja de local por liga.

**Capa 3: contexto de Claude.** En el panel "Contexto de Claude", **Copiar para Claude** genera un texto compacto (λ, 1X2 propio y de la casa, Over 2.5, ambos anotan, bajas, alertas, mejor pick) con las instrucciones y una plantilla del bloque. Claude investiga y devuelve:

```json
{
  "tipo": "contexto-claude",
  "version": 1,
  "partidos": [
    {
      "id": 16317994,
      "partido": "Atlas FC vs Club América",
      "ajustes": { "ataqueLocal": 0, "ataqueVisita": -0.08, "defensaLocal": 0, "defensaVisita": 0 },
      "tarjetasExtra": 0.5,
      "cornersExtra": 0,
      "notas": ["América rota pensando en la Concachampions", "Clásico: históricamente más tarjetas"],
      "confianza": "media"
    }
  ]
}
```

**Reglas del bloque:**

- **Coincidencia:** por `id` y, si no hay id, por `partido` (comparación aproximada de ambos nombres).
- **`ajustes`:** multiplicadores relativos sobre el **λ final** (−0.08 = −8%), cada uno limitado a ±30%. `defensaX` cambia los goles que **recibe** ese equipo: `λL × (1+ataqueLocal) × (1+defensaVisita)`.
- **Claude debe ajustar solo por información que el mercado probablemente todavía no refleja.**
- **`tarjetasExtra` y `cornersExtra`:** se suman al total esperado.
- **`notas` y `confianza`:** se muestran en el Resumen del partido; la cabecera lleva un badge "Contexto de Claude".
- Se puede pegar tal cual viene del chat (con la cerca de código json). Si se pega en el panel de carga, la página avisa que va en el de contexto.

---

## 9 bis. Historial y medición del modelo

La página es estática, así que todo se guarda **en el navegador** (IndexedDB, base `analizador-partidos`) y los resultados se traen con un script de consola, igual que los datos.

**Registros** (`domain/history.js`): uno por selección analizada, con clave `partido|mercado|línea|selección`.

- **Predicciones del modelo:** cada análisis guarda solas todas sus selecciones (probabilidad, cuota, EV, nivel), solo de partidos que **no han empezado** (con el partido en juego las cuotas serían en vivo). Volver a analizar actualiza lo pendiente y nunca pisa lo liquidado.
- **Apuestas del usuario:** botón **+** junto a cada pick (pestaña Valor y ranking). Se guarda la cuota tomada y el monto en unidades; con ✓ se edita o se quita.

**Resultados** (flujo semiautomático):

1. Historial → **Copiar script**: la página arma un script con los ids pendientes (hasta 40, `history.maxScriptMatches`).
2. Se pega en la consola de sofascore.com. Por cada partido trae estado, marcador a 90' (`normaltime`), descanso, corners, amarillas, primer gol (incidencias) y las últimas cuotas. Descarga `resultados_sofascore_FECHA.json` con `"tipo": "resultados-sofascore"`.
3. Se sube o pega en el Historial: se **liquida todo lo pendiente** de los partidos terminados. Los no terminados quedan pendientes para el próximo script.

**Liquidación** (`domain/settlement.js`): a 90 minutos. Estados: ganada, media ganada, devuelta, media perdida y perdida (las dos medias solo en hándicap de cuarto). Si falta un dato (ej. corners), esa selección queda pendiente.

**Rendimiento** (`domain/performance.js`):

- **Mis apuestas:** con la cuota y el monto registrados. **Picks del modelo:** todos los picks con valor, a 1 unidad y a la cuota del análisis.
- Ganancia, ROI, acierto (sin contar devoluciones), por nivel de confianza y por mercado.
- **CLV** = cuota tomada / cuota de cierre − 1. La cuota de cierre es la que devuelve Sofascore en el script de resultados; si no la trae para ese mercado, queda vacía.
- **Calibración:** todas las predicciones liquidadas por rangos de 10%: predicho vs. ocurrido.

**Respaldo:** Exportar/Importar un JSON (`"tipo": "historial-analizador"`) para pasar el historial a otro navegador o equipo. Al importar gana el registro con más información (liquidado > con apuesta > más nuevo).

**Sin probar con la API real:** los campos `normaltime`, `incidents` (primer gol) y si las cuotas siguen disponibles después del partido. Si algo no llega, el script lo deja vacío y la liquidación de ese mercado queda pendiente.

---

## 10. Fases y estado

- [x] **Fase 1 — MVP:** carga, detección v2/v3/v4, Poisson, λ, mezcla empírica, 1X2, DC, DNB, Over/Under, ambos anotan, primer gol, valor, estadísticas por bloque, H2H, alineaciones, alertas.
- [x] **Rediseño visual:** tokens con `light-dark()`, Inter, barra superior fija, panel de carga plegable, cabecera con escudos generados, KPIs, barras de probabilidad en tablas, mapa de calor de marcadores, pestañas, carrusel de partidos en el celular.
- [x] **Rediseño 2 (propuesta "Analizador"):** tema oscuro con acento lima, Barlow Condensed + Inter, barra inferior en el celular y navegación superior con lista lateral en escritorio, una pantalla por sección (Día, Partido, Combinada, Contexto, Historial, Ajustes). El mapa de calor de marcadores y el ranking filtrable se reemplazaron por los 8 marcadores más probables y los mejores picks del día.
- [x] **Fase 2 — Varios partidos:** resumen del día, ranking global con filtros (mercado, nivel, cuota mínima), combinadas automáticas, pestañas dentro del partido.
- [x] **Fase 3 — Más mercados:** hándicap asiático, primer tiempo, corners (total, por equipo, 1er tiempo), tarjetas, jugadores (1+ y 2+ tiros y tiros a puerta).
- [x] **Fase 4 — Inteligencia de datos:** calendario, bajas cuantificadas, coeficientes de liga, peso por competición, localía por liga, alertas `marketDivergence` y `keyPlayerOut`.
- [x] **Fase 5 — Contexto y publicación:** bloque de contexto de Claude y "Copiar para Claude", panel de ajustes en `localStorage`, selector de tema, pulido para celular. Lista para GitHub Pages (§11).
- [x] **Historial:** registro automático de predicciones, botón para registrar apuestas, script de resultados generado por la página, liquidación automática, ROI, CLV, calibración y respaldo (§9 bis).
- [ ] **Siguiente:** script v5 (cuota de apertura, árbitro, calendario), Dixon-Coles, peso por antigüedad y fuerza de equipos con los resultados de toda la liga.
- [ ] **Fase 6 (opcional):** llamada directa a la API de Anthropic con la clave del usuario guardada solo en su navegador. Costo aparte; no usar en equipos compartidos.

**Pendientes conocidos:** los nombres de los mercados de hándicap asiático, corners y tarjetas (`Asian handicap`, `Corners 2-Way N.5`, `Cards in match N.5`) no se han comprobado con un JSON real; si llegan con otros nombres, solo hay que ajustar `DEFINITIONS` en `marketCatalog.js`. Los tests cubren sobre todo la fase 1.

---

## 11. Cómo correr, probar y publicar

- **Local:** los módulos ES no cargan con `file://`. Usa un servidor:
  - `npx serve .` (Node) o `python3 -m http.server 8000`, y abre la URL que indica, **o**
  - "Live Server" de VS Code.
- **Tests:** `node --test` (Node 18 o más). No requiere `npm install`.
- **GitHub Pages:**
  1. Sube la carpeta a un repo.
  2. En *Settings → Pages*, elige *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
  3. Abre la URL que te da GitHub.
- La fuente Inter se carga de Google Fonts; sin conexión se usa la del sistema.

---

## 12. Limitaciones conocidas

- **Poisson independiente:** subestima un poco los empates en partidos cerrados. Se compensa en parte con el peso de las cuotas.
- **No hay datos de árbitro ni de rojas** en el JSON: tarjetas = solo amarillas.
- **Partido en vivo:** las cuotas pueden ser en vivo. Hay alerta, pero el modelo no usa el marcador actual.
- **Independencia entre partidos** en las combinadas.
- **Coincidencia de nombres aproximada** (rivales en la tabla, jugadores en la alineación): puede fallar con nombres muy cortos o muy distintos entre fuentes.
- **Coeficientes de liga** por nombre: ligas homónimas (p. ej. "Bundesliga" de Austria) necesitan ajustar `config/leagues.js`.

---

## 13. Preferencias del usuario (para cualquier IA que ayude)

- **Idioma:** español. Respuestas concisas, con **tablas**, terminando con una línea de juego responsable.
- **Prioridad:** un buen análisis antes que la rapidez. Prefiere tandas de 7–10 partidos.
- **Picks:**
  - Solo con **valor real**: mi probabilidad > probabilidad de la cuota.
  - En combinadas: cuota **≥ 1.50**, o **≥ 1.15** para "equipo anota". Si algo no tiene valor, se deja fuera.
  - Acepta picks más arriesgados (DNB, hándicap, doble oportunidad) si son probables y tienen valor.
- **Mercados que le interesan:** goles, ambos anotan, Over/Under, corners por equipo y mitad, tiros y tiros a puerta por jugador, H2H, bajas, alineaciones, "lo más probable".
- **Ligas de menor nivel** (por ejemplo J1): enfocarse en goles, ambos anotan, Over 1.5/2.5 y qué equipo anota, no en corners ni jugadores.
- Usa el celular; la página debe funcionar bien a 390 px de ancho.

---

## 14. Glosario de mercados

| Sofascore | Español | Tipo interno | Claves |
|---|---|---|---|
| Full time | 1X2 | `result` | home, draw, away |
| Double chance | Doble oportunidad | `doubleChance` | homeDraw, drawAway, homeAway |
| Draw no bet | Empate no apuesta | `drawNoBet` | home, away |
| Both teams to score | Ambos anotan | `btts` | yes, no |
| Match goals N.5 | Goles N.5 | `total` (line) | over, under |
| First team to score | Primer gol | `firstGoal` | home, none, away |
| 1st half | 1X2 primer tiempo | `resultFirstHalf` | home, draw, away |
| Asian handicap ±N | Hándicap asiático | `asianHandicap` (línea del local) | home, away |
| Corners 2-Way N.5 | Corners | `corners` (line) | over, under |
| Cards in match N.5 | Tarjetas | `cards` (line) | over, under |
