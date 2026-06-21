# DraftXI — Roadmap

## ✅ Hecho

- [x] Pipeline de datos: 491 selecciones generadas (Mundiales 1930–2022)
- [x] Draft loop completo: roll → pick 11 jugadores con posiciones y compatibilidad
- [x] Sistema de química con bonuses por país/confederación
- [x] Stats en 3 modos: simple / medio (3 stats clave por posición) / completo
- [x] Lazy loading: catalog.json al inicio + squad JSON por demanda
- [x] Filtros de pool: top naciones + rango de años
- [x] Jugadores sin posición disponible aparecen inhabilitados (gris)
- [x] Hover card con stats respetando el modo elegido
- [x] Ghost al arrastrar jugador: posiciones + nombre + rating
- [x] Rating proyectado en slots al arrastrar
- [x] Engine de simulación con PRNG semillado
- [x] Página de resultados: eventos, premios, stats individuales
- [x] Historial de partidas en localStorage
- [x] Deploy en Vercel + GitHub (CI/CD automático)

---

## 🔧 Gameplay — Fase 1

- [ ] **Más formaciones presets** — 4-3-2-1, 3-4-3, 5-3-2, 4-5-1, 4-1-2-3, 3-4-2-1
- [ ] **Custom formation builder** — UI de lista: elegís cuántos de cada posición, el sistema las posiciona
- [ ] **Penalidad de balance** — formaciones raras (5 DC, 0 mediocampistas) reciben penalización oculta en simulación
- [ ] **Ventana de transferencias** — tras fase de grupos, 1 cambio permitido (nuevo roll, reemplazás un jugador)
- [ ] **Mejoras al engine** — asistencias no se acumulan en eventos, stats individuales no impactan la simulación todavía
- [ ] **Lesiones entre partidos** — mecanismo de lesión entre jornadas (sin banco en partido): combinarlo con la ventana de transferencias o una tirada de reemplazo obligatoria antes del siguiente partido
- [ ] **Stats globales del torneo** — los equipos CPU también acumulan goles/asistencias para competir por premios individuales (goleador, figura), generando una tabla de premios con jugadores de todos los equipos

---

## 🎨 UI / UX

- [ ] **Onboarding / tutorial** — modal o card explicativa al inicio del primer juego: qué es la química, importancia del equilibrio ofensivo/defensivo, cuándo conviene priorizar química vs. rating, qué significa cada posición
- [ ] **Dark / light mode** — toggle que persiste entre sesiones
- [ ] **Share card** — imagen del XI para compartir (html-to-image ya está instalado)
- [ ] **Historial visible** — UI para ver las últimas partidas guardadas en localStorage
- [ ] **Feedback widget** — formulario discreto in-game para sugerencias y correcciones de datos

---

## 🔗 Permalinks

- [ ] **`/game/{id}`** — link permanente por partida, visible sin cuenta

---

## 🧪 Técnico

- [ ] **Tests unitarios del engine** — simulation.ts, chemistry.ts, positions.ts
- [ ] **Inconsistencia Alemania** — archivos curados usan `GER`, generados usan `DEU`; el filtro "top naciones" cubre ambos slugs pero el countryCode difiere
- [ ] **JSON estáticos vs base de datos** — los 491 archivos JSON en `public/data/` están bien para el MVP (se sirven como assets estáticos desde Vercel CDN). A futuro, si se suman más torneos (Copa América, Euros) o los archivos crecen mucho, migrar a Supabase Storage + tabla de índice. Por ahora no hay DB ni Supabase conectados.
- [ ] **Calibración de ratings y posiciones (3 capas)** — los datos generados tienen errores sistemáticos (Lloris 2022 → 69, Mbappé → 98). Escala de referencia: 99=GOAT all-time (Maradona/Messi/Pelé), 97–98=leyenda del juego, 95–96=mejor del mundo en su año, 90–94=crack de primer nivel, 85–89=muy buen internacional, 78–84=titular regular en Mundial, 70–77=jugador de plantel.
  - **Capa 1 — Script de normalización (automático):** recorre los 491 JSONs, aplica curva de distribución relativa por squad × multiplicador histórico. Multiplicador: campeón=1.18, finalista=1.12, semis=1.07, cuartos=1.02, octavos=0.97, grupos=0.91, débil=0.85. Distribución: top 20% del squad → 85–93, titulares → 77–84, suplentes → 69–76. Preserva orden relativo dentro del squad. Hardcodea resultados históricos 1930–2022. Escribe `public/data/overrides.json` sin tocar los JSONs originales.
  - **Capa 2 — Tool de revisión local (`/admin/ratings`):** página solo-dev con todos los jugadores filtrables (por selección/año/posición). Botones **OK / Muy alto / Muy bajo** aplican ±8 y guardan en `overrides.json`. ~15–20 jugadores/minuto; enfoque en selecciones top 1978–2026.
  - **Capa 3 — Feedback comunitario (Fase 2, Supabase):** botón discreto en hover card ("¿Rating incorrecto?") → OK / Muy alto / Muy bajo + texto libre → tabla `rating_suggestions`. Notificación al admin cuando ≥15 usuarios dan la misma señal para un jugador. Sirve para afinar lo que se escape en la capa 2.
- [ ] **Selecciones Mundial 2026** — torneo en curso al momento de esta nota (jun 2026). Los datos no están disponibles aún en APIs públicas. Agregar cuando haya una fuente confiable post-torneo o durante el torneo si aparece la API de Zafronix actualizada.

---

## 🚀 Fase 2 (más adelante)

- [ ] Modo Liga con selecciones (ida / ida y vuelta)
- [ ] Multijugador con amigos (lobby + draft simultáneo)
- [ ] Cuentas opcionales (Supabase Auth)
- [ ] Historial sincronizado + perfil público
- [ ] Daily challenge + ranking global
- [ ] Snake draft con timer
