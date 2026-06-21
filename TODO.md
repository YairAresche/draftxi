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

---

## 🎨 UI / UX

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

---

## 🚀 Fase 2 (más adelante)

- [ ] Modo Liga con selecciones (ida / ida y vuelta)
- [ ] Multijugador con amigos (lobby + draft simultáneo)
- [ ] Cuentas opcionales (Supabase Auth)
- [ ] Historial sincronizado + perfil público
- [ ] Daily challenge + ranking global
- [ ] Snake draft con timer
