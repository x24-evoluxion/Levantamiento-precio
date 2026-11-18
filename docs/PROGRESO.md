# PROGRESO

> Bitácora del proyecto. Cada agente, **al terminar su fase**, agrega una sección
> nueva **al final** usando la plantilla de abajo y actualiza la tabla de estado.
> El siguiente agente empieza en la primera fase que no tenga ✅.

## Estado

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Plan | ✅ |
| 1 | Esqueleto del proyecto | ⬜ |
| 2 | Base de datos y Storage | ⬜ |
| 3 | Lista de visitas y nueva visita | ⬜ |
| 4 | Ubicación | ⬜ |
| 5 | Subir fotos | ⬜ |
| 6 | Ver fotos de una visita | ⬜ |
| 7 | Pulido móvil y despliegue | ⬜ |

Leyenda: ⬜ pendiente · 🟡 en curso / incompleta · ✅ terminada

## Pendientes y dudas abiertas

- [ ] **Lista de competidores definitiva.** La actual es provisional. Falta uno
      ("POR CONFIRMAR"). Se corrige editando `supabase/seed_competidores.sql`
      (se crea en la Fase 2).
- [ ] **Markdown de referencia del jefe.** No está disponible todavía. Si llega,
      ponerlo en `docs/` y revisar si cambia algo del plan.
- [ ] Confirmar los **nombres** de las variables de `.env.local` (Fase 1).

---

## Plantilla (copia esto al final para tu fase)

```markdown
## Fase N — <nombre> (<fecha AAAA-MM-DD>)

**Qué se hizo:**
- ...

**Archivos creados o cambiados:**
- `ruta/archivo` — para qué sirve

**Pasos que hizo el usuario a mano:**
- ...

**Cómo probarlo:**
1. ...

**Decisiones tomadas (y por qué):**
- ...

**Problemas encontrados / pendientes para la siguiente fase:**
- ...

**Commit:** `<hash corto>` — <mensaje>
```

---

## Fase 0 — Plan (2026-11-18)

**Qué se hizo:**
- Se leyó `docs/transcript.txt` (la reunión donde se describe la app).
- Se escribió `docs/PLAN.md` con el alcance, las decisiones, el diseño de datos, las
  pantallas y las 8 fases.
- Se creó este archivo.

**Archivos creados o cambiados:**
- `docs/PLAN.md` — guía del proyecto para todos los agentes
- `docs/PROGRESO.md` — esta bitácora

**Pasos que hizo el usuario a mano:**
- Confirmó el stack: TypeScript + Next.js (App Router) + Tailwind CSS.
- Aprobó agregar la tabla `fotos`.
- Dio la lista provisional de competidores.

**Cómo probarlo:**
- No aplica (no hay código).

**Decisiones tomadas (y por qué):**
- **La visita se guarda de una sola vez** (competidor + ubicación). Así las reglas de
  Supabase solo tienen que permitir *crear* visitas, no *modificarlas*, y nadie puede
  alterar visitas de otros.
- **Bucket `fotos` público para lectura.** Es lo más simple para mostrar imágenes, y
  son fotos de anaqueles, no datos sensibles.
- **Competidores en un archivo SQL separado** que se puede ejecutar varias veces, para
  que el usuario los corrija fácilmente. "POR CONFIRMAR" queda con `activo = false`
  para que no aparezca en la app.
- **Solo la llave pública (anon) de Supabase.** La protección la dan las reglas RLS.

**Problemas encontrados / pendientes para la siguiente fase:**
- Ver "Pendientes y dudas abiertas" arriba.

**Agregado después de la revisión del usuario:** en la Fase 2, nombres de carpetas
y archivos con UUID, y bucket con límite de 5 MB que acepta solo imágenes (ver PLAN 4.2 y Fase 2).

**Commit:** `Fase 0: plan del proyecto y bitácora de progreso` (ver `git log`).
