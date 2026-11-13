# NEWTÓNICA — Feria de Ciencias Escolar

Plataforma de inscripción y evaluación para la feria de ciencias del Colegio San
Mateo Apóstol. Los estudiantes arman su grupo y se inscriben a un proyecto o a un
reto sin necesidad de crear cuenta; el comité organiza convocatorias, cupos,
rúbricas y calificaciones desde un panel aparte.

**En vivo:** https://ctm.nncoms.com

## Cómo funciona

El evento se organiza por **períodos** (una feria por año). Dentro de un período
hay dos cosas en las que un estudiante puede participar:

- **Proyectos** — cupos limitados, grupos de hasta `maxMembers` integrantes y
  una lista de grados habilitados. Todos los proyectos de un período comparten
  la misma rúbrica.
- **Retos** — cada reto tiene su propia rúbrica, con sus criterios y niveles.

La página pública tiene tres estados que el comité controla desde el panel:
abierta, cuenta regresiva hacia una fecha, o cerrada con un mensaje. Eso evita
tener que desplegar de nuevo cada vez que se abre o cierra una convocatoria.

## La parte interesante: inscripción sin cuenta, sin sobrecupo

Los estudiantes de un colegio no tienen usuario ni correo institucional, así que
pedirles registrarse para inscribirse a una feria sobra. La inscripción es
anónima: se elige el proyecto, se buscan los integrantes en el listado del
período y se envía.

Eso deja dos problemas que se resuelven en las reglas de Firestore
([`firestore.rules`](firestore.rules)), no en el cliente — porque una validación
que vive solo en el navegador no es una validación:

**Que un proyecto no supere sus cupos.** La escritura de `usedSlots` se acepta
únicamente si el valor resultante sigue dentro de `totalSlots`. La regla aplica
también al comité: no hay forma de dejar un proyecto sobrevendido. Si el comité
quiere admitir más grupos tiene que subir `totalSlots`, y como la comparación usa
el valor nuevo, ampliar cupos e inscribir en la misma operación funciona.

**Que un estudiante no quede en dos grupos.** El campo `registered` del
estudiante funciona como una reserva: solo puede pasar de `false` a `true`, y
solo el comité puede devolverlo. Como la inscripción se escribe en un lote
atómico, si dos grupos intentan tomar al mismo estudiante a la vez, el segundo
falla entero en vez de dejar al chico contado dos veces.

Fuera de esos dos campos, un visitante anónimo no puede tocar nada: crear
solicitudes sí, aceptarlas o rechazarlas no.

## Evaluación

Las rúbricas se definen desde el panel: criterios con peso, niveles de desempeño
con puntaje (por ejemplo `EXPERTO = 4`) y un descriptor por cada cruce de
criterio y nivel. Se les puede agregar una fila final de notas, que en la
práctica se usa para la penalización por entrega tardía.

La nota se calcula sobre esa estructura, así que cambiar la rúbrica no exige
tocar código.

## Panel del comité

Detrás de `/login`, protegido con Firebase Authentication y un guard de ruta:

| Sección | Qué hace |
|---|---|
| Períodos | Crear la feria del año y marcar cuál está activa |
| Proyectos | Cupos, máximo de integrantes y grados habilitados |
| Retos | Alta de retos con su rúbrica propia |
| Estudiantes | Listado del período, con carga masiva desde Excel |
| Inscripciones | Aceptar o rechazar grupos; al rechazar, se liberan los integrantes |
| Configuración | Nombre, lema, logo y el estado de la página pública |

Los grados se normalizan al cargarlos (`primero`, `1`, `1°` terminan en la misma
forma), porque los listados llegan escritos de maneras distintas según quién
arme el Excel.

## Cómo correrlo

```bash
npm install
npm start
```

Queda en `http://localhost:4200/`.

La configuración de Firebase vive en `src/environments/`. La `apiKey` web de
Firebase es pública por diseño: identifica el proyecto, no autoriza nada. Lo que
protege los datos son las reglas de Firestore, que están en este repositorio y
se pueden auditar.

Para desplegar:

```bash
npm run build
firebase deploy
```

## Estructura

```
src/app/
├── registration/     # Lado público: proyectos, retos e inscripción
├── admin/            # Panel del comité, con su propio módulo y login
├── services/         # Acceso a Firestore, uno por colección
├── models/           # Período, proyecto, reto, estudiante, rúbrica, config
├── guards/           # Protección de /admin
├── pipes/            # Formato de grados y URLs seguras
└── utils/            # Normalización de grados y cálculo de rúbricas
firestore.rules       # Donde realmente viven las reglas del juego
```

## Tecnologías

Angular 16 · TypeScript · Firebase (Firestore, Authentication, Hosting) ·
SheetJS para la carga masiva de estudiantes

## Datos

El repositorio no incluye datos de ningún estudiante. Los volcados de
operación quedan fuera por `.gitignore`.
