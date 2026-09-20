# Reflexión — Validación y errores

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## 1. ¿Qué diferencia existe entre validar el formato HTTP y proteger una regla del negocio?
Validar el formato HTTP es comprobar que la solicitud está bien formada: que el `Content-Type` sea JSON, que `completed` sea un boolean o que el `:id` sea un entero positivo. Eso lo hacen los middlewares (`requireJson`, `validateCompletion`, `validateTaskId`) sin conocer las tareas. Una regla del negocio depende del estado del sistema y vive en el servicio: por ejemplo, que la tarea exista (`findTaskById` lanza `TASK_NOT_FOUND`) o que el título no supere 120 caracteres al crear una tarea. Un `{ "completed": true }` puede tener formato perfecto y aun así fallar con 404 porque la tarea 999 no existe.

## 2. ¿Por qué conviene usar router.param para validar el id?
Porque la validación se escribe una sola vez (`taskRouter.param("id", validateTaskId)`) y se aplica a toda ruta que contenga `:id`: `GET /:id`, `PATCH /:id/complete`, `PATCH /:id/status` y `DELETE /:id`. Al agregar el endpoint `/:id/status` no tuve que tocar nada para validar el id, y ninguna ruta puede olvidarlo. `GET /api/tasks/abc` y `PATCH /api/tasks/abc/status` responden igual: 400 `INVALID_ID`.

## 3. ¿Qué ventaja ofrece guardar datos normalizados en res.locals?
El middleware entrega al controlador datos ya validados y limpios, con el tipo correcto, sin que el controlador vuelva a leer `req.params` o `req.body`. Por ejemplo, `res.locals.taskId` ya es un `number` (en `req.params.id` sigue siendo texto) y `res.locals.taskTitle` ya viene con `trim()`. Así la validación no se duplica y el controlador solo coordina: `setTaskCompletion(res.locals.taskId, res.locals.completed)`.

## 4. ¿Cuándo corresponde responder 400 y cuándo 422?
400 cuando la solicitud no se puede interpretar: JSON malformado (`{ "completed": tr`, código `INVALID_JSON`) o un id que no es un entero positivo (`/api/tasks/abc`, código `INVALID_ID`). 422 cuando el JSON es válido y se entiende, pero el contenido no cumple las reglas: `{ "completed": "true" }` o `{ "title": "" }`, código `VALIDATION_ERROR` con `details` indicando el campo. Aparte, 415 cuando falta el `Content-Type: application/json`.

## 5. ¿Por qué notFound delega el error en lugar de responder directamente?
Porque así el formato de todos los errores se genera en un único lugar, `errorHandler`. `notFound` solo crea un `AppError(404, "ROUTE_NOT_FOUND")` y llama a `next(error)`; el handler agrega el `requestId` y el formato `{ error: { code, message, requestId } }`. Si respondiera directamente, la respuesta de `GET /ruta-inexistente` podría diferir de las demás y habría que mantener el formato en dos sitios.

## 6. ¿Qué información no debe enviarse al cliente en un error 500?
No se debe enviar el mensaje interno de la excepción, el stack trace, rutas de archivos, consultas o datos de configuración, porque revelan cómo está construido el sistema y ayudan a un atacante. En la API, `errorHandler` responde solo `{ code: "INTERNAL_ERROR", message: "Ocurrió un error interno.", requestId }` y deja el error completo en el servidor con `console.error({ requestId, error })`.

## 7. ¿Cómo ayuda requestId durante la depuración?
`requestContext` genera un UUID por solicitud, lo guarda en `res.locals.requestId` y lo devuelve en el header `X-Request-Id` y en el cuerpo de todo error. Si un usuario reporta un 500 y me da su `requestId`, lo busco en los logs del servidor (donde `console.error` lo imprime junto al error real) y encuentro exactamente esa solicitud, sin exponer detalles internos al cliente.

## 8. ¿Qué prueba demuestra que la refactorización no rompió la API anterior?
Volver a ejecutar en Postman toda la colección anterior (casos 1 a 9 de `docs/pruebas-validacion.md` y las pruebas de la actividad previa) y comprobar que los códigos y formatos siguen igual: `GET /api/tasks` → 200, `GET /api/tasks/999` → 404 `TASK_NOT_FOUND`, `POST` con título válido → 201, `PATCH /api/tasks/1/complete` → 200, `DELETE` → 204. Que las pruebas antiguas pasen sin modificarlas, junto con las nuevas del endpoint `/status`, es la evidencia de que no hubo regresión.
