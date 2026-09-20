# Task API EC1 F3 A4

| Caso | Método | Ruta | Datos o condición | Resultado |
|---:|---|---|---|---|
| 1 | GET | /api/tasks | Sin cuerpo | 200 |
| 2 | GET | /api/tasks/abc | Sin cuerpo | 400 INVALID_ID |
| 3 | GET | /api/tasks/999 | Sin cuerpo | 404 TASK_NOT_FOUND |
| 4 | POST | /api/tasks | JSON con title válido | 201 |
| 5 | POST | /api/tasks | Desactivar Content-Type o usar raw Text | 415 UNSUPPORTED_MEDIA_TYPE |
| 6 | POST | /api/tasks | `{ "title": "" }` | 422 VALIDATION_ERROR |
| 7 | POST | /api/tasks | `{ "title": 25 }` | 422 VALIDATION_ERROR |
| 8 | POST | /api/tasks | JSON incompleto o malformado | 400 INVALID_JSON |
| 9 | GET | /ruta-inexistente | Sin cuerpo | 404 ROUTE_NOT_FOUND |


## Desafío individual: PATCH /api/tasks/:id/status

Todas las pruebas usan el header `Content-Type: application/json`, salvo la 12.

| Caso | Método | Ruta | Datos o condición | Resultado |
|---:|---|---|---|---|
| 10 | PATCH | /api/tasks/2/status | `{ "completed": true }` | 200, `data.status` = "completed" |
| 11 | PATCH | /api/tasks/2/status | `{ "completed": "true" }` | 422 VALIDATION_ERROR |
| 12 | PATCH | /api/tasks/2/status | Content-Type `text/plain` | 415 UNSUPPORTED_MEDIA_TYPE |
| 13 | PATCH | /api/tasks/999/status | `{ "completed": true }` | 404 TASK_NOT_FOUND |

Script para la pestaña **Tests** de Postman (caso 10, positivo):

```js
pm.test("200 y tarea completada", () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().data.status).to.eql("completed");
});
```

Caso 11 (negativo, tipo incorrecto):

```js
pm.test("422 VALIDATION_ERROR", () => {
  pm.response.to.have.status(422);
  const error = pm.response.json().error;
  pm.expect(error.code).to.eql("VALIDATION_ERROR");
  pm.expect(error.details[0].field).to.eql("completed");
});
```

Caso 12 (negativo, sin JSON):

```js
pm.test("415 UNSUPPORTED_MEDIA_TYPE", () => {
  pm.response.to.have.status(415);
  pm.expect(pm.response.json().error.code).to.eql("UNSUPPORTED_MEDIA_TYPE");
});
```

Caso 13 (negativo, tarea inexistente):

```js
pm.test("404 TASK_NOT_FOUND", () => {
  pm.response.to.have.status(404);
  pm.expect(pm.response.json().error.code).to.eql("TASK_NOT_FOUND");
});
```
