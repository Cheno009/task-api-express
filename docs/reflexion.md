#  Reflexión — EC1 F1 A2
**Nombre:Miguel Angel Pineda Chenoweth**
**Grupo:01**

## 1. ¿Qué responsabilidad cumple Express y qué responsabilidad conserva el servicio?
Express se encarga de la parte HTTP: recibir la petición, interpretar la ruta, el método y los datos que vienen en params, query o body, y devolver una respuesta con el código de estado correcto. El servicio conserva la lógica de negocio, es decir, las reglas de cómo se crea, busca, actualiza o elimina una tarea, sin saber nada de request ni response.

## 2. ¿Por qué no conviene escribir toda la lógica dentro de task.routes.ts?
Porque mezclaría la responsabilidad de manejar rutas con la lógica de negocio, haciendo el archivo difícil de mantener y de probar. Si la lógica está en el servicio, se puede reutilizar en otros lugares (por ejemplo otra ruta o incluso otro framework) sin duplicar código.

## 3. ¿Qué diferencia existe entre req.params y req.body?
req.params contiene los valores que vienen en la propia URL, como el id de una tarea en /tasks/:id, mientras que req.body contiene los datos que el cliente envía en el cuerpo de la petición, normalmente en formato JSON, como el título o la descripción de una tarea nueva.

## 4. ¿Por qué el título recibido desde un cliente se considera unknown antes de validarlo?
Porque no se puede confiar en que el cliente envíe el tipo de dato correcto; podría mandar un número, un objeto o incluso nada. Al tratarlo como unknown, TypeScript obliga a validar y comprobar su tipo antes de usarlo, evitando errores en tiempo de ejecución.

## 5. ¿Qué ventaja ofrece centralizar los errores en un middleware?
Permite manejar todos los errores de la aplicación en un solo lugar, con un formato de respuesta consistente, en lugar de repetir el mismo bloque try/catch y la misma lógica de respuesta en cada ruta.

## 6. ¿Cuándo debe utilizarse 201 en lugar de 200?
Se usa 201 cuando la petición creó un nuevo recurso, como al hacer un POST que agrega una tarea nueva. El 200 se usa cuando la operación fue exitosa pero no creó nada nuevo, por ejemplo al consultar o actualizar un recurso existente.

## 7. ¿Por qué DELETE responde 204 sin un objeto JSON?
Porque al eliminar un recurso ya no hay nada que devolver; el recurso dejó de existir. El código 204 indica que la operación fue exitosa pero no hay contenido en la respuesta.

## 8. ¿Qué ocurrirá con las tareas cuando el servidor se reinicie y por qué?
Las tareas se perderán, porque se están guardando en memoria (en un arreglo o variable dentro del código) y no en un almacenamiento persistente. Al reiniciar el servidor, esa memoria se limpia y los datos vuelven al estado inicial.

## 9. ¿Qué archivos podrán conservarse cuando se incorpore MongoDB Atlas?
Probablemente se conserven los archivos de models, routes y utils, ya que definen la forma de los datos, las rutas de la API y las funciones genéricas. Lo que cambiará principalmente es la capa de data/services, pues ahí es donde se hacía el manejo en memoria y pasará a hacerse contra la base de datos.