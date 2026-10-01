# Cierre ordenado del proceso

**Nombre: Miguel Angel Pineda Chenoweth**
**Grupo: 01**

## Qué se implementó

- `src/config/database.ts` exporta `disconnectDatabase()`, que ejecuta `await mongoose.disconnect()`.
- `src/server.ts` escucha `SIGINT` (Ctrl+C) y `SIGTERM` (la señal que envían Docker, Render, systemd, etc.) y ejecuta `shutdown()`:
  1. Una bandera `isShuttingDown` evita que el cierre se ejecute dos veces si llegan varias señales (por ejemplo, Ctrl+C presionado dos veces).
  2. Se cierra **primero el servidor HTTP** con `server.close()`: deja de aceptar conexiones nuevas y espera a que terminen las solicitudes en curso. Las conexiones keep-alive inactivas se liberan con `closeIdleConnections()`, y a las que siguen activas se les responde con `Connection: close`.
  3. **Después se cierra MongoDB** con `disconnectDatabase()`. Este paso se ejecuta aunque el anterior falle, para que el proceso no se quede colgado.
  4. Si el cierre tarda más de 10 segundos, un temporizador fuerza la salida con código 1.
  5. Todos los mensajes son fijos: nunca se imprime la URI, el error original ni un stack.
- Todo usa `async`/`await` y no hay ningún `any` explícito.

Además se corrigió un detalle del arranque: en Express 5, si el puerto está ocupado, `app.listen` llama al mismo callback con el error. Antes se imprimía "API disponible" aunque no fuera cierto. Ahora se muestra `No fue posible escuchar en el puerto 3000.`, se cierra MongoDB y el proceso termina con código 1.

## ¿Por qué conviene liberar la conexión?

- **Atlas tiene un límite de conexiones.** El plan gratuito (M0) permite pocas conexiones simultáneas. Si el proceso muere sin desconectarse, el servidor no se entera de inmediato y esas conexiones quedan ocupadas hasta que vencen. Con `pnpm dev` el proceso se reinicia muchas veces, así que se pueden acumular.
- **No se cortan operaciones a medias.** Si cerramos HTTP primero, las solicitudes que ya estaban en curso terminan de escribir en MongoDB antes de cortar la conexión. Si cerráramos MongoDB primero, una solicitud que llegara en ese momento fallaría con un 500 o dejaría datos incompletos.
- **El proceso termina por sí solo.** Una conexión de Mongoose abierta mantiene vivo el *event loop* de Node. Si no se desconecta, el proceso no termina de forma natural y la única salida es matarlo.
- **Los orquestadores lo esperan.** Docker o un servicio en la nube envían `SIGTERM` y esperan unos segundos antes de forzar con `SIGKILL`. Si respondemos a `SIGTERM` cerrando bien, los despliegues y reinicios no cortan solicitudes de los usuarios.

## Prueba: Ctrl+C termina el proceso sin error no controlado

### Pasos

1. Verificar que ningún otro proceso use el puerto (por ejemplo, cerrar otra terminal con `pnpm dev`).
2. Ejecutar `pnpm start`.
3. Esperar `API disponible en http://localhost:3000`.
4. En Postman hacer `GET http://localhost:3000/health/database` → `200`.
5. En la terminal presionar **Ctrl+C**.
6. Volver a enviar la solicitud en Postman.

### Salida esperada en la terminal

```
Conexión con MongoDB establecida.
API disponible en http://localhost:3000
Señal SIGINT recibida. Cerrando la API...
Servidor HTTP cerrado.
Conexión con MongoDB cerrada.
```

### Resultados

| Caso | Esperado | Obtenido | Resultado |
|---|---|---|---|
| `GET /health/database` antes de Ctrl+C | 200 | 200 | Aprobada |
| Ctrl+C (SIGINT) | Cierra HTTP, luego MongoDB, sale con código 0 | Igual | Aprobada |
| Solicitud después del cierre | Postman no puede conectarse (`ECONNREFUSED`) | Igual | Aprobada |
| Segunda señal durante el cierre | Se ignora, no se cierra dos veces | Un solo mensaje de cierre | Aprobada |
| `SIGTERM` | Mismo cierre ordenado, código 0 | Igual | Aprobada |
| La salida contiene la URI o un stack | No | No | Aprobada |
| Arranque con el puerto ocupado | Mensaje claro y código 1 | `No fue posible escuchar en el puerto 3000.` | Aprobada |
| Rutas anteriores (`/health`, `/api/tasks`, 404, 400) | Sin cambios | Sin cambios | Aprobada |

> Nota: en Windows, `pnpm` puede preguntar `¿Desea terminar el trabajo por lotes (S/N)?` después de Ctrl+C. Ese mensaje es de la consola y no del proceso; para entonces la API ya cerró.
