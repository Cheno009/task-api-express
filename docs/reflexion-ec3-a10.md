# Reflexión — Autenticación, roles y seguridad HTTP

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## 1. ¿Por qué un token decodificable no necesariamente es un token válido?
Porque decodificar y verificar son cosas distintas. Las tres partes de un JWT están en Base64URL, así que cualquiera puede leer el encabezado y el payload sin conocer `JWT_SECRET`. Eso solo muestra lo que el token **dice**, no prueba que sea cierto. Un token es válido cuando `verifyAccessToken` lo acepta: `jwtVerify` comprueba la firma HS256 con `secretKey`, que `alg` sea `HS256`, que `iss` sea `task-api-express`, que `aud` sea `task-api-client` y que no haya pasado `exp`. Además, el servicio revisa que `sub` sea texto y que `role` cumpla `isUserRole`.

Por ejemplo, si alguien toma su token, cambia el payload a `"role": "admin"` y lo vuelve a codificar, el resultado se sigue decodificando sin problema, pero la firma ya no coincide. `authenticate` responde 401 `INVALID_TOKEN`. Lo mismo ocurre con un token expirado o firmado por otro sistema con otra clave.

## 2. ¿Cuándo corresponde responder 401 y cuándo 403?
- **401 Unauthorized** significa "no sé quién eres": falta la identidad o no se puede comprobar. En el proyecto aparece cuando no se envía `Authorization` (`AUTHENTICATION_REQUIRED`), cuando el encabezado no tiene el formato `Bearer <token>` (`INVALID_AUTHORIZATION_HEADER`) y cuando el token tiene la firma alterada, ya expiró o tiene otro `iss`/`aud` (`INVALID_TOKEN`). También se usa en el login con credenciales incorrectas (`INVALID_CREDENTIALS`).
- **403 Forbidden** significa "sé quién eres, pero no puedes hacer esto": el token es válido, pero el rol no alcanza. En el proyecto lo devuelve `requireRole("admin")` cuando un usuario con `role: "user"` intenta `DELETE /api/tasks/:id` (`FORBIDDEN`).

La diferencia orienta al cliente: ante un 401 debe iniciar sesión otra vez, mientras que ante un 403 un nuevo login no sirve, porque lo que falta es permiso.

## 3. ¿Por qué CORS no sustituye la autenticación?
Porque CORS es una regla que aplica el **navegador**, no el servidor. `corsPolicy` solo decide si se envían los encabezados `Access-Control-Allow-*` para `CORS_ORIGIN` (`http://localhost:5173`). Con eso, el navegador permite o bloquea que el JavaScript de otra página lea la respuesta, pero no impide que la solicitud llegue a la API:
- `curl`, Postman o un script de Node ignoran CORS por completo. De hecho, `corsOptions` acepta las solicitudes sin `Origin` (`!origin`), que son justamente las de esas herramientas.
- Cuando el origen no está permitido, `callback(null, false)` no rechaza la solicitud, solo omite los encabezados. Si la solicitud no necesita preflight, Express la procesa de todos modos y es el navegador quien oculta la respuesta.
- CORS no dice **quién** hace la solicitud, solo **desde qué página**.

La protección real de `/api/tasks` es `taskRouter.use(authenticate)`, que exige un token válido venga de donde venga la solicitud. CORS solo complementa esa protección en el navegador.

## 4. ¿Qué riesgo existe si DELETE se registra antes de requireRole?
En Express los middlewares se ejecutan en el orden en que se registran. Con `taskRouter.delete("/:id", requireRole("admin"), removeTask)`, primero se revisa el rol y solo un `admin` llega a `removeTask`. Si el orden fuera `taskRouter.delete("/:id", removeTask, requireRole("admin"))`, `removeTask` eliminaría la tarea en Atlas y respondería `204`. Como el controlador no llama a `next()`, `requireRole` nunca se ejecutaría. El resultado sería que **cualquier usuario autenticado podría borrar tareas** y la regla del rol existiría en el código sin aplicarse nunca.

Lo mismo pasa con `authenticate`: si la ruta `DELETE` se registrara antes de `taskRouter.use(authenticate)`, quedaría pública incluso sin token. Además, `requireRole` depende de `res.locals.auth`, que solo existe después de `authenticate`. Si no se encuentra, responde 401 en lugar de dejar pasar la solicitud.

## 5. ¿Por qué debes iniciar sesión después de cambiar el rol en MongoDB?
Porque el rol que revisa la API no se lee de MongoDB en cada solicitud, sino del **token**. `createAccessToken` copia `role` en el payload al hacer login, y `authenticate` solo verifica el JWT y guarda `{ userId, role }` en `res.locals.auth`, sin consultar la base de datos. Si se ejecuta `pnpm role:set ana@correo.com admin`, el documento cambia en Atlas, pero el token que Ana ya tiene sigue diciendo `"role": "user"` y `DELETE` le seguirá respondiendo 403. Solo un nuevo `POST /api/auth/login` emite un token con el rol actualizado.

El caso contrario es más delicado: si a un administrador se le quita el rol, su token anterior conserva `"role": "admin"` hasta que expira (`JWT_EXPIRES_IN`, `1h`). Por eso conviene que los tokens duren poco. Evitarlo del todo requeriría consultar el rol en MongoDB en cada solicitud o tener una forma de revocar tokens.

## 6. ¿Cómo llega un error asíncrono de authenticate al errorHandler en Express 5?
Por ejemplo, un `GET /api/tasks` con un token expirado:
1. `taskRouter.use(authenticate)` ejecuta el middleware, que es una función `async`.
2. `getBearerToken` extrae el token. Si faltara el encabezado, lanzaría ahí mismo `AUTHENTICATION_REQUIRED`, pero como está dentro de una función `async`, ese `throw` también se convierte en una promesa rechazada.
3. `await verifyAccessToken(token)`: `jwtVerify` lanza un `JOSEError` por `exp`, y el `catch` de `token.service.ts` lo convierte en `AppError` 401 `INVALID_TOKEN`.
4. Como `authenticate` no tiene `try/catch`, su promesa se rechaza y `next()` nunca se llama, así que la solicitud no llega al controlador.
5. Express 5 captura automáticamente la promesa rechazada y llama a `next(error)`, sin necesitar un `asyncHandler`.
6. `errorHandler` lo reconoce con `instanceof AppError` y responde 401 con `{ error: { code, message, details, requestId } }`.

En Express 4 este mismo rechazo no se habría capturado: la solicitud quedaría colgada y Node mostraría un `unhandledRejection`.

## 7. ¿Qué limitación tiene el almacén en memoria del rate limiter al escalar la API?
`authRateLimiter` no define `store`, así que `express-rate-limit` usa su almacén por defecto, que guarda los contadores en la memoria del proceso de Node. Funciona con un solo servidor, pero tiene estas limitaciones:
- **Cada instancia cuenta por separado.** Con tres copias de la API detrás de un balanceador, un atacante podría hacer hasta `3 × AUTH_RATE_LIMIT_MAX` (30) intentos de login en 15 minutos, según a qué instancia llegue cada solicitud.
- **Se pierde al reiniciar.** Un despliegue o una caída del proceso pone todos los contadores en cero.
- **Ocupa memoria del proceso**, que crece con la cantidad de IPs distintas que se registran.

Para escalar hace falta un almacén compartido, como Redis (`rate-limit-redis`) o MongoDB, para que todas las instancias consulten el mismo contador. Hay un problema relacionado: detrás de un proxy, la app no configura `trust proxy`, por lo que `req.ip` sería la IP del proxy y todos los clientes compartirían un solo límite.

## 8. ¿Qué cambios requeriría autorizar por propietario de la tarea?
- **Modelo:** agregar `ownerId` a `TaskPersistence` y `taskSchema` (`type: Schema.Types.ObjectId`, `ref: "User"`, `required: true`, con índice), porque hoy `TaskModel` no sabe a quién pertenece cada tarea.
- **Creación:** `postTask` debe pasar `res.locals.auth.userId` a `createTask`. El dueño nunca debe venir del cuerpo, por lo que `validateTaskTitle` y `validateTaskUpdate` deben seguir rechazando `ownerId`, igual que el registro rechaza `role`.
- **Consultas:** `listTasks`, `findTaskById`, `updateTask`, `completeTask` y `deleteTask` deben recibir el `userId` y filtrar con `{ _id: id, ownerId: userId }` en lugar de `findById(id)`, por ejemplo con `TaskModel.findOneAndUpdate({ _id: id, ownerId }, { $set: changes }, ...)`. Si la comprobación se hiciera en el controlador después de consultar, sería fácil olvidarla en alguna ruta.
- **Respuesta ante tareas ajenas:** conviene responder 404 `TASK_NOT_FOUND` en lugar de 403, para no revelar que ese id existe y pertenece a otra persona.
- **Administrador:** decidir si `admin` puede ver o borrar cualquier tarea. En ese caso, el filtro solo debería agregar `ownerId` cuando `role !== "admin"`. También habría que revisar si `DELETE` sigue siendo exclusivo de `admin` o si cada dueño puede borrar sus propias tareas.
- **Datos existentes:** las tareas creadas antes no tienen `ownerId`, así que habría que migrarlas (asignarles un dueño) o eliminarlas antes de marcar el campo como `required`.
