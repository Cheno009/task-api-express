# Reflexión — CRUD persistente con MongoDB

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## 1. ¿Qué operación de Mongoose corresponde a cada letra de CRUD?
- **C (Create)**: `TaskModel.create(...)` en `createTask`, usada por `POST /api/tasks`.
- **R (Read)**: `TaskModel.find().sort({ createdAt: 1 })` en `listTasks` (`GET /api/tasks`) y `TaskModel.findById(id)` en `findTaskById` (`GET /api/tasks/:id`).
- **U (Update)**: `TaskModel.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true })` en `updateTask`, usada por `PATCH /api/tasks/:id` y también por `PATCH /api/tasks/:id/complete` a través de `completeTask`.
- **D (Delete)**: `TaskModel.findByIdAndDelete(id)` en `deleteTask`, usada por `DELETE /api/tasks/:id`.

## 2. ¿Por qué se usa PATCH y no un reemplazo completo del documento?
Porque el cliente solo quiere cambiar algunos campos. Con `PATCH` puede enviar únicamente `{ "title": "Nuevo" }` o `{ "priority": "low" }`, y el resto de la tarea (`status`, `createdAt`, etc.) queda igual. Un reemplazo completo (`PUT`) obligaría al cliente a enviar el documento entero; si olvidara un campo, ese campo se perdería o volvería a su valor por defecto. Además, `createdAt` y el `_id` los controla el servidor, así que no tiene sentido pedirle al cliente que los reenvíe.

## 3. ¿Qué problema evita $set?
`$set` le dice a MongoDB que modifique **solo** los campos indicados. Sin un operador, una actualización que se interprete como reemplazo podría sustituir el documento completo por `{ title: "Nuevo" }`, borrando `status`, `priority` y las fechas. Con `{ $set: changes }` los campos que no vienen en `changes` se conservan. También deja explícito en el código que la operación es una actualización parcial, que es justo lo que promete `PATCH`.

## 4. ¿Qué efecto tienen new true y runValidators true?
- `new: true` hace que `findByIdAndUpdate` devuelva el documento **después** de aplicar el cambio. Sin esta opción devuelve la versión anterior, y la API respondería con el título o la prioridad viejos aunque en Atlas ya estuviera actualizado.
- `runValidators: true` hace que Mongoose ejecute las reglas del esquema (`maxlength`, `enum`, etc.) también en la actualización. Por defecto solo se validan al crear con `create`/`save`; sin esta opción un `PATCH` podría guardar `priority: "urgent"` o `status: "x"`. Gracias a ella, si algo pasa el middleware, Mongoose lo rechaza y `mapPersistenceError` responde 422 `PERSISTENCE_VALIDATION_ERROR`.

## 5. ¿Por qué un cuerpo vacío debe rechazarse?
Porque un `PATCH` con `{}` no pide ningún cambio, así que casi siempre indica un error del cliente (olvidó enviar los datos o escribió mal el nombre del campo). Si se aceptara, la API respondería 200 como si hubiera actualizado algo, y el cliente creería que su cambio se guardó. Rechazarlo con 422 y el detalle `{ field: "body", message: "Incluye al menos title, status o priority." }` le explica exactamente qué falta. También evita una consulta inútil a la base de datos.

## 6. ¿Qué diferencia existe entre INVALID_ID y TASK_NOT_FOUND?
`INVALID_ID` (400) significa que el id no tiene formato de `ObjectId`, por ejemplo `/api/tasks/abc`. Lo detecta `validateTaskId` (registrado con `taskRouter.param('id', ...)`) antes de consultar MongoDB, porque es un error al construir la URL. `TASK_NOT_FOUND` (404) significa que el id tiene un formato válido pero no existe ninguna tarea con él, por ejemplo porque ya se eliminó. Solo se sabe después de consultar Atlas, y lo lanza el servicio cuando `findById`, `findByIdAndUpdate` o `findByIdAndDelete` devuelven `null`.

## 7. ¿Qué responsabilidad cumple validateTaskUpdate y cuál cumple TaskModel?
`validateTaskUpdate` protege la **entrada HTTP**: comprueba que el cuerpo sea un objeto, que no esté vacío, que solo traiga campos permitidos (`title`, `status`, `priority`) y que cada uno tenga un valor válido. Reúne todos los problemas en `details` para que el cliente los vea juntos, y deja en `res.locals.taskUpdate` solo los datos ya limpios (por ejemplo, el título recortado). `TaskModel` protege los **datos guardados**: su esquema define tipos, `required`, `maxlength`, `enum` y valores por defecto, y es la última defensa aunque alguien llame al servicio sin pasar por la ruta. El middleware da errores claros al cliente; el modelo garantiza que nada inválido llegue a Atlas.

## 8. ¿Cómo llega un error de updateTask al errorHandler de Express 5?
Por ejemplo, un `PATCH` a un id válido que no existe: `findByIdAndUpdate` devuelve `null`, `updateTask` lanza `new AppError(..., 404, "TASK_NOT_FOUND")` y el `catch` lo pasa por `mapPersistenceError`, que lo devuelve sin cambios porque ya es un `AppError`. Si el error viene de Mongoose (por ejemplo un `ValidationError` por `runValidators`), `mapPersistenceError` lo convierte en 422 `PERSISTENCE_VALIDATION_ERROR`; si es cualquier otro, en 503 `DATABASE_UNAVAILABLE`. Como `patchTask` hace `await updateTask(...)`, su promesa se rechaza. Express 5 captura automáticamente las promesas rechazadas de los handlers y llama a `next(error)`, sin `try/catch` en el controlador. Así llega al `errorHandler`, que responde con `{ error: { code, message, details, requestId } }`.

## 9. ¿Por qué DELETE responde 204 sin cuerpo?
`204 No Content` significa "la operación salió bien y no hay nada que devolver". Después de eliminar, la tarea ya no existe, así que no tiene sentido enviarla de vuelta; al cliente le basta el código de estado para saber que se borró. Por eso `removeTask` usa `res.status(204).send()`. Si la tarea no existe, en cambio, responde 404 `TASK_NOT_FOUND` con el cuerpo de error normal.

## 10. ¿Qué prueba demuestra que el CRUD es persistente y no solo funcional en memoria?
Crear o modificar una tarea, **reiniciar el servidor** y volver a consultarla. En el desafío se creó "Urgente" con `priority: "high"`, se cambió a `low` con `PATCH`, y después se levantó un proceso nuevo del servidor: `GET /api/tasks/:id` devolvió la tarea con el mismo `id`, `createdAt` y `priority: "low"`. Con un arreglo en memoria, el proceso nuevo empezaría vacío y respondería 404. Para el `DELETE` funciona igual: después de reiniciar, la tarea eliminada debe seguir respondiendo 404. También se puede confirmar viendo los documentos en el Data Explorer de Atlas. Una consulta hecha justo después de crear la tarea, sin reiniciar, no lo demuestra, porque eso también funcionaba en memoria.
