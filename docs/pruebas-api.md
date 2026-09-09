# Pruebas de Task API

| Método | Ruta | Datos enviados | Esperado | Obtenido | Resultado |
|---|---|---|---:|---:|---|
| GET | /health | No aplica | 200 | 200 | Aprobada |
| GET | /api/tasks | No aplica | 200 | 200 | Aprobada |
| POST | /api/tasks/3 | title válido | 201 | 201 | Aprobada |
| POST | /api/tasks/4 | title vacío | 400 | 400 | Aprobada |
| GET | /api/tasks/3 | No aplica | 200 | 200 | Aprobada |
| PATCH | /api/tasks/3/complete | No aplica | 200 | 200 | Aprobada |
| DELETE | /api/tasks/3 | No aplica | 200 | 200 | Aprobada |
| GET | /api/tasks/3 | No aplica | 404 | 404 | Aprobada |
| PATCH | /api/tasks/2 | title válido | 200 | 200 | Aprobada |
| PATCH | /api/tasks/2 | title vacío | 400 | 400 | Aprobada |
