# Analizador de partidos

Página web estática que analiza el JSON exportado por los scripts de Sofascore: goles esperados, probabilidades, valor de cada cuota, estadísticas por bloque, H2H, alineaciones y alertas. Todo se calcula en el navegador; no hay servidor ni llamadas externas.

> El contexto completo del proyecto (formatos, modelo, arquitectura, fases y convenciones) está en [`docs/CONTEXTO.md`](docs/CONTEXTO.md).

## Uso

1. Corre el script de Sofascore y guarda el JSON: v2 para un partido, v4 para varios de una competición, o **v5 para muchos partidos de varias competiciones**. El v5 tiene un modo **histórico**: descarga partidos ya jugados con su resultado para medir el modelo al instante (en el Historial aparecen con origen "Histórico").
2. Abre la página, pega el JSON o sube uno o varios archivos, y pulsa **Analizar**.
   Lo cargado se guarda en el navegador: al volver a abrir la página se recupera solo. **Limpiar** lo borra.
3. (Opcional) En **Contexto**, copia el resumen, pásaselo a Claude y pega el bloque que devuelve para recalcular con noticias, bajas y rotaciones.
4. (Opcional) En **Ajustes** cambias los parámetros del modelo; se guardan en tu navegador. El botón sol/luna de arriba cambia entre modo oscuro y claro.
5. En **Explorar** mueves un deslizador para ver la probabilidad de 2, 3, 4… goles, corners, tarjetas, remates o remates a puerta (total, por equipo o del 1er tiempo) y la de que ambos anoten, en un partido o en todos a la vez.
6. En **Combinada** armas tu combinada por **más valor** (la casa paga de más) o por **más probables** (ganador, doble oportunidad, ambos anotan, goles, hándicap, corners) y la copias.
7. **Historial** (con filtros por estado, mercado, nivel y equipo, y lista paginada; en **Pronósticos** ves cuánto acierta el modelo en ganador, ambos anotan y más/menos 2.5): las predicciones se guardan solas; registra tus apuestas con **+**. Después de los partidos, copia el script de resultados, córrelo en la consola de Sofascore y sube el archivo: todo se liquida solo y ves ganancia, ROI, CLV y calibración.

## Correr en local

Los módulos ES no cargan abriendo `index.html` con doble clic. Usa un servidor local:

```bash
npx serve .
# o: python3 -m http.server 8000  y abre http://localhost:8000
```

También funciona "Live Server" de VS Code.

## Tests

Requiere Node 18 o más, sin dependencias:

```bash
node --test
```

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio.
2. En **Settings → Pages**, elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Abre la URL que te da GitHub.

## Estructura

```
index.html          página
css/                tokens (colores y medidas), layout, componentes
js/config.js        parámetros del modelo
js/config/leagues.js  coeficientes por liga y peso por competición (editable)
js/texts.js         textos de la interfaz
js/io, js/adapters  lectura y conversión del JSON al modelo interno
js/domain           cálculos (funciones puras, con tests)
js/ui               interfaz (screens/ = una pantalla por archivo)
tests/              tests con node:test
scripts/            scripts de consola de Sofascore (v2 un partido, v4 varios, v5 varias competiciones y modo histórico)
docs/CONTEXTO.md    documento maestro
```

Son probabilidades, no certezas. Apuesta solo lo que estés dispuesto a perder.
