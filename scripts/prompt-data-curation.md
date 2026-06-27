# Prompt para curación de datos — DraftXI

Pegá este mensaje al inicio de un chat nuevo con Claude.
El modelo va a responder de a DOS mundiales por mensaje, esperando que le pidas el siguiente par.

---

## PROMPT (copiar y pegar completo)

```
Sos un experto en fútbol histórico de selecciones nacionales en Copas del Mundo.
Voy a pedirte datos de jugadores para un juego de draft histórico llamado DraftXI.

Necesito que me des las 10 selecciones principales de todos los Mundiales desde 1978 hasta 2026,
de a DOS mundiales por respuesta. Esperá que yo te diga "siguiente" para continuar con el próximo par.

Las 10 selecciones son siempre las mismas:
Argentina, Brasil, Uruguay, España, Italia, Francia, Alemania, Holanda, Inglaterra, Portugal.

═══════════════════════════════════════════
REGLAS DE DATOS — LEER ANTES DE GENERAR
═══════════════════════════════════════════

REGLA 1 — CLASIFICACIÓN:
Si un país NO clasificó ese año, NO lo incluyas. Ni placeholder, ni entrada vacía, ni `"players": []`.
Si no clasificó, simplemente omitís ese país del JSON por completo.
Verificá caso por caso: Francia no clasificó en 1990 ni en 1994. Inglaterra no clasificó en 1994.
Portugal no clasificó en 1978, 1990 ni 1994. Uruguay no clasificó en 1998 ni en 2006. Holanda no clasificó en 2002 ni en 2018. Italia no clasificó en 2018 ni en 2022.

REGLA 2 — RETIROS DE LA SELECCIÓN:
Un jugador retirado de la selección NO puede aparecer en torneos posteriores a su retiro.
Casos CONOCIDOS a evitar:
  - Gerd Müller: último Mundial fue 1974 → NO aparece en 1978 ni después
  - Michel Platini: se retiró en 1987 → NO aparece en 1990 ni después
  - Karl-Heinz Rummenigge: retirado de selección en 1986 → NO aparece en 1990
  - Dino Zoff: retirado en 1982 → NO aparece en 1986 ni después
  - Johan Cruyff: se negó a ir al Mundial 1978 → NO aparece en 1978
  - Franz Beckenbauer: se retiró en 1977 → NO aparece en 1978 ni después
  - Si un jugador es conocido principalmente como ENTRENADOR en esa época
    (ej: Dick Advocaat era seleccionador asistente en 1990), NO lo incluyas como jugador.

REGLA 3 — SELECCIÓN CORRECTA:
Que un jugador haya militado en clubes de un país NO lo hace elegible para esa selección.
Errores a evitar:
  - Martin Laudrup es DANÉS (jugó en Barça y Real Madrid pero nunca en España)
  - Marcelo Balboa es ESTADOUNIDENSE (apellido argentino pero nació en EE.UU. y jugó para USA)
  - Clarence Seedorf es HOLANDÉS, NO alemán ni español

REGLA 4 — DUPLICADOS:
Antes de enviar, recorrés el array completo de cada squad y verificás que ningún nombre aparezca
más de una vez. Los duplicados pueden tener el mismo nombre, variantes del nombre, o apodos.
Ejemplos del tipo de error a evitar:
  - "Toninho Cerezo" y "Cerezo" = mismo jugador
  - "Gabriele Oriali" y "Lele Oriali" = mismo jugador (Lele es apodo)
  - "Alberigo Evani" y "Antonio Evani" = mismo jugador (Alberigo es el nombre real)
  - "Dani Alves" y "Daniel Alves" = mismo jugador
  - "Raphael Varane" y "Raphaël Varane" = mismo jugador (acento diferente)
  - Un jugador que aparece dos veces con el mismo nombre pero distinta posición = duplicado

REGLA 5 — EDAD MÍNIMA:
Un jugador debe tener AL MENOS 17 años para ser convocado a un Mundial.
Calculá: si un jugador nació en 197X y el Mundial es en 198X, verificá que la edad sea posible.
Ejemplo: Míchel Salgado nació en 1971 → tenía 15 en 1986 y 19 en 1990. No fue convocado.
Si tenés dudas sobre si un jugador menor de 21 años estuvo en ese squad, no lo incluyas.

REGLA 6 — JUGADORES INVENTADOS:
Solo incluí jugadores que sepas con SEGURIDAD que existieron y estuvieron en ese squad.
Si no recordás con certeza un jugador para completar los 23, bajá a 20-21 jugadores.
Es mejor un squad incompleto que uno con jugadores inventados.
NUNCA generes nombres plausibles pero ficticios para rellenar (ej: "Fritz Walter Jr.", "D. Schmidt").

═══════════════════════════════════════════
POSICIONES Y RATINGS
═══════════════════════════════════════════

POSICIONES disponibles (usar EXACTAMENTE estos códigos, sin variantes):
POR, LD, LI, DFC, MCD, MC, MCO, MD, MI, EI, ED, DC

ESCALA de ratings — los ratings deben reflejar el rendimiento REAL en ese torneo, no el peak histórico:
97    = GOAT absoluto del torneo (Maradona 86, Ronaldo 02, Mbappé 22)
93-96 = estrella mundial en su año pico (Zidane 98, Ronaldo 06, Messi 14)
88-92 = crack de primer nivel internacional
83-87 = muy buen titular en Mundial
77-82 = titular sólido
70-76 = plantel regular
63-69 = suplente / relleno

NOTA SOBRE EDAD Y RATING: Los ratings deben reflejar el rendimiento REAL en ESE torneo,
no el peak histórico del jugador. Ejemplos:
  - Platini en 1978 tenía 23 años → 80-83 (emergente, aún no es crack)
  - Platini en 1984/86 → 93-95 (en su mejor momento)
  - Rummenigge en 1978 tenía 22 años → 83-85
  - Maldini en 1990 tenía 22 años → 84-85 (prometedor, no el ídolo que será)
  - Ronaldo en 1994 tenía 17 años y NO jugó ni un minuto → 72-74

altPositions: Incluí 1-2 posiciones alternativas para jugadores polivalentes. No dejes altPositions
vacío para todos — los mediocampistas y delanteros históricos casi siempre jugaban en más de una posición.

IMPORTANTE — valores de compatibility: los únicos valores válidos son "puede" y "forzado".
NUNCA uses "natural" ni ningún otro valor.
  - "puede": puede jugar ahí con ~15% de penalización
  - "forzado": puede jugar ahí con ~35% de penalización (posición muy distinta a la natural)

═══════════════════════════════════════════
CHECKLIST OBLIGATORIO ANTES DE ENVIAR
═══════════════════════════════════════════

Antes de escribir el JSON, revisá MENTALMENTE cada squad respondiendo estas preguntas:

□ ¿Este país clasificó para este Mundial? (si no → omitirlo completamente del JSON, sin entrada vacía)
□ ¿Algún jugador se retiró de la selección ANTES de este torneo? (si sí → sacarlo)
□ ¿Algún jugador representa REALMENTE a esta selección nacional? (no confundir con su club)
□ ¿Recorrí el array completo buscando nombres duplicados o variantes del mismo jugador? (si sí → eliminar el duplicado)
□ ¿Algún jugador era demasiado joven para estar en este squad? (menor de 17 años → sacarlo)
□ ¿Estoy seguro de que este jugador existió y estuvo en ese squad? (si hay duda → no incluirlo)
□ ¿Los ratings reflejan el torneo específico, no el peak del jugador?
□ ¿Todos los valores de compatibility en altPositions son "puede" o "forzado"? (NUNCA "natural")

═══════════════════════════════════════════
FORMATO
═══════════════════════════════════════════

Incluí aproximadamente 20-23 jugadores por selección (titulares + suplentes principales).
Respondé SOLO con JSON válido, sin texto extra antes ni después.

[
  {
    "country": "Argentina",
    "year": 1998,
    "players": [
      {
        "name": "Carlos Roa",
        "position": "POR",
        "altPositions": [],
        "rating": 83
      },
      {
        "name": "Gabriel Batistuta",
        "position": "DC",
        "altPositions": [{"position":"EI","compatibility":"forzado"}],
        "rating": 92
      }
    ]
  },
  {
    "country": "Brasil",
    "year": 1998,
    "players": [...]
  },
  {
    "country": "Argentina",
    "year": 2002,
    "players": [...]
  }
]

Empezá con el Mundial 2022 solo (un JSON con las selecciones que clasificaron).
Italia NO clasificó para 2022, así que son 9 selecciones en total.
```

---

## Workflow de integración

1. Cuando Claude responda, guardá el JSON en:
   `scripts/curated/batch-[AÑO1]-[AÑO2].json`
   Ejemplo: `scripts/curated/batch-1998-2002.json`

2. Correlo:
   ```
   node scripts/integrate-curated.mjs
   ```

3. Si aparece `⚠ No encontrado: XXXX-pais.json`, creá el source file desde cero.

4. Commiteá:
   ```
   git add scripts/curated/ public/data/ && git commit -m "Add curated squads for WC YYYY+YYYY"
   ```

5. Mandá "siguiente" y repetí.

## Mundiales a cubrir (pares)

- [x] 1978 — batch-1978.json
- [x] 1982 + 1986 — batch-1982-1986.json
- [x] 1990 + 1994 — batch-1990-1994.json
- [x] 1998 + 2002 — batch-1998-2002.json
- [x] 2006 + 2010 — batch-2006-2010.json
- [x] 2014 + 2018 — batch-2014-2018.json
- [x] 2022 + 2026 — batch-2022-2026.json (Italia no clasificó 2022; source files 2026 creados manualmente)

## Clasificaciones conocidas — selecciones que NO estuvieron

| País       | Años sin clasificar (de 1978 a 2022)         |
|------------|----------------------------------------------|
| Francia    | 1990, 1994                                   |
| Inglaterra | 1978, 1994                                   |
| Portugal   | 1978, 1990, 1994                             |
| Holanda    | 2002, 2018                                   |
| Uruguay    | 1998, 2006                                   |
| Italia     | 2018, 2022                                   |

> Usá esta tabla como referencia rápida. Si tenés dudas, es mejor omitir que inventar.
