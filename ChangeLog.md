# Historial de cambios
## [1.0.0] - 2026-10-14
### Agregado
- Cliente React con registro, inicio y cierre de sesión.
- Operaciones de creación, consulta, edición, cambio de estado y eliminación por rol.
- Filtros, búsqueda, ordenamiento y paginación desde la interfaz.
- Configuración reproducible de despliegue mediante `render.yaml`.
- Prueba de humo para verificar una liberación sin revelar credenciales.
### Conservado
- TypeScript estricto, módulos ECMAScript y resolución NodeNext en el backend.
- Persistencia con Mongoose 8.24.4 y MongoDB Atlas.
- Contrato uniforme de respuestas y errores.
- JWT, roles, Helmet, CORS, limitación de solicitudes y OpenAPI.
### Seguridad
- Secretos únicamente mediante variables de entorno.
- Origen CORS específico en producción.
- Configuración explícita del proxy de confianza.