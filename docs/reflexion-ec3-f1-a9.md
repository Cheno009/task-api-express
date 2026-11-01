# Reflexión — Registro, login y JWT

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## 1. ¿Por qué un hash de contraseña no debe poder descifrarse?
Porque el servidor nunca necesita conocer la contraseña original, solo comprobar que la que llega en el login es la misma. Un hash es de **una sola vía**: `hashPassword` guarda el resultado de `bcrypt.hash(password, 12)` y `verifyPassword` usa `bcrypt.compare`, que vuelve a calcular el hash con la contraseña recibida y compara los resultados, sin revertir nada. Si la contraseña se pudiera descifrar, existiría una clave capaz de recuperar todas las contraseñas: quien robara la colección `users` y esa clave tendría las contraseñas reales, que muchas personas repiten en otros servicios. Con bcrypt, lo único que puede hacer un atacante es probar candidatas una por una, y las 12 rondas (`BCRYPT_ROUNDS`) hacen que cada intento sea lento a propósito.

## 2. ¿Qué diferencia existe entre una sal aleatoria y la clave usada para firmar HS256?
- **Sal**: es un valor aleatorio, distinto para cada hash, que `bcrypt.hash` genera solo. **No es secreta**: se guarda dentro del propio `passwordHash` (en `$2b$12$...` va después del costo). Sirve para que dos usuarios con la misma contraseña tengan hashes diferentes y para que no se puedan usar tablas de hashes ya calculados.
- **Clave de HS256**: es `JWT_SECRET`, un único valor para toda la aplicación, de al menos 32 bytes (lo exige `parseJwtSecret`). **Sí es secreta**: vive en `.env` y nunca sale del servidor. Sirve para firmar y verificar tokens; quien la conozca podría fabricar un token válido con `role: "admin"`.

En resumen, la sal hace único cada hash aunque se conozca, y la clave demuestra que el token lo emitió esta API solo mientras nadie más la conozca.

## 3. ¿Por qué passwordHash tiene select false y aun así el login puede recuperarlo?
`select: false` en `userSchema` hace que `passwordHash` quede **fuera por defecto** de las consultas: un `UserModel.findOne({ email })` normal no lo trae, y así es más difícil exponerlo por descuido. No impide leerlo, solo obliga a pedirlo de forma explícita. Eso hace `findUserDocumentByEmail(email, true)` con `query.select("+passwordHash")`, donde el `+` agrega el campo a la selección. Solo `loginUser` pasa `true`, porque es el único caso que necesita comparar el hash; `registerUser` consulta sin él para saber si el correo existe. Además, `toUser` construye la respuesta sin ese campo, lo cual también importa porque `select: false` afecta a las consultas, no al documento que devuelve `UserModel.create`.

## 4. ¿Por qué unique no sustituye la validación HTTP del correo?
Porque `unique: true` no es una regla de validación, sino un **índice** de MongoDB: solo garantiza que no haya dos valores iguales. No revisa el formato, así que `"no-es-un-correo"` se guardaría sin problema si llegara al modelo, ya que el esquema no tiene ningún patrón para `email`. Esa regla está en `readEmail`, que comprueba que sea texto, que tenga máximo 254 caracteres y que cumpla `EMAIL_PATTERN`, y responde 422 `AUTH_VALIDATION_ERROR` antes de calcular un hash o consultar Atlas. Se complementan: la validación HTTP revisa que el dato tenga sentido, y `unique` resuelve lo que el middleware no puede saber. Por ejemplo, si dos registros simultáneos con el mismo correo pasan la consulta de `registerUser`, MongoDB rechaza el segundo con el error `11000`, que el repositorio convierte en 409 `USER_EMAIL_EXISTS`.

## 5. ¿Qué riesgo evita rechazar el campo role durante el registro?
Evita una **escalada de privilegios por asignación masiva**. Si el cuerpo se pasara directamente al modelo, cualquiera podría enviar `{ "name": "Ana", "email": "ana@correo.com", "password": "...", "role": "admin" }` y crearse una cuenta de administrador, y como `role` viaja en el JWT, recibiría un token de administrador en el login. Hay dos defensas: `validateAllowedFields` solo permite `name`, `email` y `password`, por lo que `role` se rechaza con 422 y el detalle `{ field: "role", message: "El campo no está permitido." }`, y `registerUser` asigna siempre `role: "user"`, sin leerlo del cliente.

## 6. ¿Por qué correo inexistente y contraseña incorrecta devuelven el mismo mensaje?
Para no revelar qué correos tienen cuenta (**enumeración de usuarios**). Si la API respondiera "el correo no existe" en un caso y "contraseña incorrecta" en el otro, un atacante podría comprobar una lista de correos y concentrar sus intentos en los que sí existen. Por eso `loginUser` responde en ambos casos 401 `INVALID_CREDENTIALS` con "El correo o la contraseña son incorrectos.". El mensaje no basta por sí solo, porque el tiempo de respuesta también delataría la diferencia: sin bcrypt, un correo inexistente respondería mucho más rápido. Para evitarlo, `DUMMY_PASSWORD_HASH` hace que `verifyPassword` se ejecute siempre, exista o no el usuario.

Una limitación: `POST /api/auth/register` sí revela que un correo está registrado, porque responde 409 `USER_EMAIL_EXISTS`. La protección de este punto cubre el login, no el registro.

## 7. ¿Qué información contiene el JWT de esta actividad y qué información se excluye?
`createAccessToken` genera un token con este contenido (los valores son de ejemplo):

```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "role": "user",
    "sub": "6650f1c2a4b3e8d9f0123456",
    "iss": "task-api-express",
    "aud": "task-api-client",
    "iat": 1793491200,
    "exp": 1793494800
  }
}
```

- `sub` es el id del usuario y `role` su rol: es lo mínimo para identificarlo y autorizarlo.
- `iss`, `aud`, `iat` y `exp` indican quién emitió el token, para quién es, cuándo se creó y cuándo expira (`JWT_EXPIRES_IN`, por defecto `1h`).

Se excluyen `password`, `passwordHash`, `JWT_SECRET`, `name`, `email` y las fechas del usuario. La razón es que un JWT está **firmado, no cifrado**: cualquiera que tenga el token puede decodificar su contenido en Base64URL, sin necesitar la clave. La firma evita que se modifique, no que se lea. Por eso solo lleva lo indispensable.

## 8. ¿Qué validan issuer, audience, algorithms y exp?
En `verifyAccessToken`, `jwtVerify` comprueba la firma con `secretKey` y además:
- `issuer`: que `iss` sea `task-api-express`, es decir, que lo haya emitido esta API.
- `audience`: que `aud` sea `task-api-client`, es decir, que el token esté destinado a este cliente y no a otro sistema.
- `algorithms: ["HS256"]`: que el token use el algoritmo esperado. Así el atacante no puede elegirlo cambiando el encabezado, por ejemplo con `alg: "none"`.
- `exp`: que el token no haya expirado. A diferencia de los anteriores, no se pasa como opción: `jose` lo comprueba solo cuando el token trae ese campo, y aquí siempre lo trae porque `createAccessToken` usa `setExpirationTime`. Limita el tiempo durante el que sirve un token robado.

Si algo falla, `jose` lanza un `JOSEError` y el servicio lo convierte en 401 `INVALID_TOKEN`, con un mensaje que no indica qué comprobación falló. También se revisa que `sub` sea texto y que `role` sea válido con `isUserRole`.

## 9. ¿Cómo llega un error de MongoDB desde el repositorio hasta errorHandler en Express 5?
Por ejemplo, un `POST /api/auth/register` con un correo que otra solicitud acaba de registrar:
1. `UserModel.create` falla en MongoDB con el código `11000` por el índice `unique`.
2. `execute`, en `user.repository.ts`, atrapa el error y lanza el resultado de `mapPersistenceError`, que lo convierte en 409 `USER_EMAIL_EXISTS`. Un `ValidationError` se convierte en 422 `PERSISTENCE_VALIDATION_ERROR` y cualquier otro error, como una caída de red, en 503 `DATABASE_UNAVAILABLE`.
3. `registerUser` no tiene `try/catch`, así que el `AppError` sigue subiendo a través de su `await`.
4. `postRegister` hace `await registerUser(...)`, por lo que su promesa se rechaza.
5. Express 5 captura automáticamente la promesa rechazada y llama a `next(error)`.
6. `errorHandler`, registrado al final de `app.ts`, lo reconoce con `instanceof AppError` y responde `{ error: { code, message, details, requestId } }`.

Como el error se traduce en el repositorio, el cliente nunca ve el mensaje original de MongoDB, y el servicio y el controlador no necesitan saber qué base de datos se usa.

## 10. ¿Por qué las rutas de tareas permanecen públicas en A9 y qué cambiará en A10?
Porque A9 solo construye la **identidad**: registrar usuarios, verificar credenciales y emitir tokens. Todavía nada exige un token: en `task.routes.ts` no hay ningún middleware de autenticación, `verifyAccessToken` está listo pero ninguna ruta lo llama, y `TaskModel` no tiene un campo que relacione cada tarea con su dueño. Cualquier cliente puede seguir usando `GET /api/tasks` o `DELETE /api/tasks/:id` sin iniciar sesión, igual que antes. Separarlo en dos pasos permite comprobar primero que el login y el token funcionan, sin romper las tareas al mismo tiempo.

En A10 se espera pasar de autenticar a **autorizar**: un middleware leerá `Authorization: Bearer <token>`, llamará a `verifyAccessToken` y dejará `userId` y `role` disponibles para la solicitud, respondiendo 401 si el token falta o no es válido. Con eso, las rutas de tareas dejarán de ser públicas y cada tarea podrá asociarse a su dueño, de modo que un usuario solo vea y modifique las suyas.
