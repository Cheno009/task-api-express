# Reflexión — Modelado de tareas con MongoDB

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## 1. ¿Qué diferencia existe entre un documento, un esquema y un modelo?
Un **documento** es un registro concreto guardado en MongoDB, por ejemplo `{ _id: ObjectId("..."), title: "Estudiar", status: "pending", createdAt: ..., updatedAt: ... }` dentro de la colección `tasks`. El **esquema** (`taskSchema` en `src/models/task.ts`) es la definición de la forma que deben tener esos documentos: qué campos existen, su tipo y sus reglas (`required`, `trim`, `maxlength`, `enum`, `default`) y opciones como `timestamps`. El **modelo** (`TaskModel = model("Task", taskSchema)`) es la clase que Mongoose construye a partir del esquema y que se conecta con la colección; es lo que el servicio usa para consultar y escribir (`find`, `findById`, `create`, `findByIdAndUpdate`, `findByIdAndDelete`). En resumen: el esquema describe, el modelo opera y el documento es el dato.

## 2. ¿Por qué la API devuelve id en lugar de _id?
`_id` es un detalle de cómo MongoDB almacena los datos (además es un `ObjectId`, no un string). El cliente de la API no tiene por qué saber qué base de datos usamos, así que en `task.service.ts` la función `toTask` convierte cada documento al tipo `Task` del dominio con `id: document._id.toString()`. Así el contrato HTTP se mantiene igual que cuando las tareas estaban en memoria (`id`, `title`, `status`, `createdAt`, `updatedAt`), el cliente recibe un string fácil de usar en la URL y, si algún día cambiara el almacenamiento, la respuesta no tendría que cambiar. También evita filtrar otros campos internos del documento.

## 3. ¿Qué problema evita migrar todas las operaciones a una sola fuente de datos?
Evita tener datos inconsistentes. Si `POST` guardara en MongoDB pero `GET` siguiera leyendo el arreglo en memoria (o al revés), una tarea recién creada no aparecería en el listado, un `DELETE` podría "borrar" algo que sigue existiendo en la otra fuente y los ids ni siquiera tendrían el mismo formato (números contra `ObjectId`). Por eso se eliminó `src/data/tasks.ts` y todas las funciones de `task.service.ts` usan `TaskModel`: hay una sola verdad sobre qué tareas existen.

## 4. ¿Qué reglas aplica el middleware y cuáles repite el esquema?
Los middlewares validan la solicitud HTTP antes de llegar al controlador:
- `validateTaskId` (registrado con `taskRouter.param('id', ...)`): el `id` debe ser un `ObjectId` válido de 24 caracteres hexadecimales; si no, responde 400 `INVALID_ID`.
- `requireJson`: el cuerpo debe enviarse con `Content-Type: application/json` (415).
- `validateTaskTitle`: `title` debe ser string, no vacío después de `trim()` y de máximo 120 caracteres; si falla, responde 422 `VALIDATION_ERROR`. Guarda el título ya recortado en `res.locals.taskTitle`.

El esquema **repite** las reglas del título: `required`, `trim: true` y `maxlength: 120`. Además añade reglas propias del dato que el middleware no revisa: `status` solo puede ser `"pending"` o `"completed"` (`enum`) con valor por defecto `"pending"`, y `timestamps`. La repetición es intencional: el middleware da un error claro al cliente, y el esquema es la última defensa que protege la base de datos aunque alguien llame al servicio sin pasar por la ruta. Si el esquema rechaza algo, `mapPersistenceError` lo convierte en 422 `PERSISTENCE_VALIDATION_ERROR`.

## 5. ¿Qué diferencia existe entre INVALID_ID y TASK_NOT_FOUND?
`INVALID_ID` (400) significa que el id ni siquiera tiene el formato correcto, por ejemplo `GET /api/tasks/abc`. Se detecta en el middleware sin consultar MongoDB, porque es un error del cliente al construir la URL. `TASK_NOT_FOUND` (404) significa que el id sí es un `ObjectId` válido, pero no existe ninguna tarea con él (por ejemplo, ya fue eliminada). Este error solo se puede saber después de consultar la base de datos, y lo lanza el servicio cuando `findById`, `findByIdAndUpdate` o `findByIdAndDelete` devuelven `null`.

## 6. ¿Qué hacen timestamps y versionKey false?
`timestamps: true` hace que Mongoose agregue y mantenga automáticamente `createdAt` (al crear el documento) y `updatedAt` (cada vez que se modifica, por ejemplo al completar la tarea). Así ya no se calculan las fechas a mano en el servicio. `versionKey: false` desactiva el campo `__v` que Mongoose agrega por defecto para control de versiones interno; como la API no lo usa, se quita para que los documentos queden más limpios y no aparezca un campo que no forma parte del dominio.

## 7. ¿Por qué los controladores deben usar async y await?
Porque ahora las operaciones del servicio hablan con MongoDB por la red y devuelven promesas. Sin `await`, el controlador enviaría `res.json(...)` con una `Promise` pendiente en vez de la tarea, o respondería `204` antes de que el borrado termine. Con `async/await` el controlador espera el resultado real (`await listTasks()`, `await createTask(...)`, etc.) antes de responder. Además, al ser `async`, cualquier error que lance el servicio se convierte en una promesa rechazada, que es justo lo que Express 5 sabe capturar.

## 8. ¿Cómo llega un AppError asíncrono al errorHandler de Express 5?
Por ejemplo, en `GET /api/tasks/:id` con un id válido que no existe: `findTaskById` lanza `new AppError(..., 404, "TASK_NOT_FOUND")`; el `catch` del servicio lo pasa por `mapPersistenceError`, que lo devuelve tal cual porque ya es un `AppError`, y se vuelve a lanzar. Como el controlador `getTask` hace `await findTaskById(...)`, su promesa se rechaza. Express 5 detecta automáticamente las promesas rechazadas de los handlers y llama a `next(error)` sin que tengamos que escribir `try/catch` ni un `asyncHandler`. Express salta al `errorHandler` registrado al final de `app.ts`, que reconoce el error con `instanceof AppError` y responde `404` con `{ error: { code, message, details, requestId } }`.

## 9. ¿Qué prueba demuestra realmente que una tarea es persistente?
Crear una tarea con `POST /api/tasks`, anotar su `id`, **detener el servidor** (Ctrl+C) y volver a iniciarlo, y después hacer `GET /api/tasks/:id` (o `GET /api/tasks`) y comprobar que la tarea sigue ahí con el mismo `id`, `title` y `createdAt`. Con el arreglo en memoria la tarea habría desaparecido al reiniciar. También se puede confirmar abriendo la colección `tasks` en Atlas (Data Explorer) y viendo el documento. Una simple petición `GET` justo después del `POST`, sin reiniciar, no lo demuestra, porque eso también funcionaba en memoria.

## 10. ¿Qué información de Mongoose o Atlas nunca debe aparecer en la respuesta HTTP?
- La `MONGODB_URI` ni ninguna parte de ella: usuario, contraseña, nombre o dirección del cluster.
- Mensajes y stack traces originales de Mongoose o del driver (por ejemplo `MongoServerSelectionError`, `CastError`, errores de autenticación o de red), porque revelan detalles internos de la infraestructura.
- Nombres internos de la base de datos y colecciones, consultas ejecutadas o el objeto de error completo.
- Campos internos del documento como `_id` en formato `ObjectId` o `__v`.

Por eso `mapPersistenceError` traduce cualquier error desconocido a 503 `DATABASE_UNAVAILABLE` con un mensaje genérico, y el `errorHandler` responde 500 `INTERNAL_ERROR` para lo inesperado. El detalle real solo se registra en la consola del servidor (`console.error({ requestId, error })`), donde se puede relacionar con la respuesta gracias al `requestId`.
