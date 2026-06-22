# Prompt para curación de datos — DraftXI

Pegá este mensaje al inicio de un chat nuevo con Claude.
El modelo va a responder de a un mundial por mensaje, esperando que le pidas el siguiente.

---

## PROMPT (copiar y pegar completo)

```
Sos un experto en fútbol histórico de selecciones nacionales en Copas del Mundo.
Voy a pedirte datos de jugadores para un juego de draft histórico llamado DraftXI.

Necesito que me des las 10 selecciones principales de todos los Mundiales desde 1978 hasta 2026,
pero de a UN mundial por respuesta. Esperá que yo te diga "siguiente" para continuar con el próximo.

Las 10 selecciones son siempre las mismas:
Argentina, Brasil, Uruguay, España, Italia, Francia, Alemania, Holanda, Inglaterra, Portugal.
Si alguna no clasificó ese año, simplemente omitila del array.
Alemania: para años ANTERIORES a 1990 usá "Alemania Occidental" como country.

POSICIONES disponibles (usar EXACTAMENTE estos códigos, sin variantes):
POR, LD, LI, DFC, MCD, MC, MCO, MD, MI, EI, ED, DC

ESCALA de ratings (sé preciso, son críticos para el balance del juego):
97    = GOAT absoluto del torneo (Maradona 86, Ronaldo 02, Mbappé 22)
93-96 = estrella mundial en su año pico (Messi 14, Zidane 98, Ronaldo 06)
88-92 = crack de primer nivel internacional
83-87 = muy buen titular en Mundial
77-82 = titular sólido
70-76 = plantel regular
63-69 = suplente / relleno

Incluí aproximadamente 23 jugadores por selección (titulares + suplentes principales).
Respondé SOLO con JSON válido, sin texto extra antes ni después.

FORMATO exacto:
[
  {
    "country": "Argentina",
    "year": 1978,
    "players": [
      {
        "name": "Ubaldo Fillol",
        "position": "POR",
        "altPositions": [],
        "rating": 85
      },
      {
        "name": "Mario Kempes",
        "position": "DC",
        "altPositions": [{"position":"EI","compatibility":"puede"}],
        "rating": 93
      }
    ]
  },
  {
    "country": "Brasil",
    "year": 1978,
    "players": [...]
  }
]

Empezá con el Mundial 1978. Cuando yo diga "siguiente", continuá con 1982, luego 1986, y así hasta 2026.
```

---

## Workflow de integración

1. Cuando Claude responda, guardá el JSON en:
   `scripts/curated/batch-[AÑO].json`

2. Correlo:
   ```
   node scripts/integrate-curated.mjs batch-[AÑO]
   ```

3. Commiteá el curated file y el overrides.json actualizado:
   ```
   git add scripts/curated/batch-[AÑO].json public/data/overrides.json
   git commit -m "Add curated squads for WC [AÑO]"
   ```

4. Al día siguiente, mandá "siguiente" en el mismo chat y repetí.

## Mundiales a cubrir (orden sugerido)

- [ ] 1978
- [ ] 1982
- [ ] 1986
- [ ] 1990
- [ ] 1994
- [ ] 1998
- [ ] 2002
- [ ] 2006
- [ ] 2010
- [ ] 2014
- [ ] 2018
- [ ] 2022
- [ ] 2026
