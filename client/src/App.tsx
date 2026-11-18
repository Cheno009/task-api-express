import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiHttpError, apiRequest } from './api.js';
import type {
ApiEnvelope,
LoginData,
Task,
TaskListResponse,
User
} from './types.js';
const TOKEN_KEY = 'task-api.access-token';
const messageFrom = (error: unknown): string => {
if (error instanceof ApiHttpError) {
const reference = error.requestId ? ` Referencia: ${error.requestId}.` : '';
return `${error.message}${reference}`;
}
return 'No fue posible comunicarse con la API.';
};
export default function App() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [token, setToken] = useState<string | null>(() =>
sessionStorage.getItem(TOKEN_KEY)
);
const [user, setUser] = useState<User | null>(null);
const [tasks, setTasks] = useState<Task[]>([]);
const [message, setMessage] = useState('Inicia sesión para consultar tus tareas.');
const [busy, setBusy] = useState(false);
const clearSession = useCallback((): void => {
sessionStorage.removeItem(TOKEN_KEY);
setToken(null);
setUser(null);
setTasks([]);
}, []);
const [reloadKey, setReloadKey] = useState(0);
const [loadedKey, setLoadedKey] = useState<string | null>(null);
// La carga se deriva en el render: hay token pero aún no llegó la respuesta
// de la petición actual (token + número de recarga).
const requestKey = token ? `${token}:${reloadKey}` : null;
const loading = requestKey !== null && loadedKey !== requestKey;
const isBusy = busy || loading;
useEffect(() => {
if (!token) return;
const key = `${token}:${reloadKey}`;
let cancelled = false;
Promise.all([
apiRequest<ApiEnvelope<{ user: User }>>('/api/auth/me', {}, token),
apiRequest<TaskListResponse>('/api/tasks?limit=10&sortBy=createdAt&order=desc', {}, token)
])
.then(([meResponse, taskResponse]) => {
if (cancelled) return;
setUser(meResponse.data.user);
setTasks(taskResponse.data);
setMessage(`Se recuperaron ${taskResponse.meta.total} tareas.`);
})
.catch((error: unknown) => {
if (cancelled) return;
if (error instanceof ApiHttpError && error.status === 401) clearSession();
setMessage(messageFrom(error));
})
.finally(() => {
if (!cancelled) setLoadedKey(key);
});
return () => {
cancelled = true;
};
}, [token, reloadKey, clearSession]);
const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
event.preventDefault();
setBusy(true);
setMessage('Comprobando credenciales...');
try {
const response = await apiRequest<ApiEnvelope<LoginData>>('/api/auth/login', {
method: 'POST',
body: JSON.stringify({ email, password })
});
sessionStorage.setItem(TOKEN_KEY, response.data.accessToken);
setToken(response.data.accessToken);
setPassword('');
} catch (error: unknown) {
setMessage(messageFrom(error));
} finally {
setBusy(false);
}
};
const handleLogout = (): void => {
clearSession();
setMessage('La sesión local se eliminó.');
};
return (
<main className="page-shell">
<header className="page-header">
<div>
<p className="eyebrow">EC3 F2 A11</p>
<h1>Task API Client</h1>
<p>Integración inicial de React con una API protegida por JWT.</p>
</div>
{user && <button onClick={handleLogout}>Cerrar sesión</button>}
</header>
{!token ? (
<section className="panel login-panel" aria-labelledby="login-title">
<h2 id="login-title">Iniciar sesión</h2>
<form onSubmit={(event) => void handleLogin(event)}>
<label htmlFor="email">Correo electrónico</label>
<input
id="email"
type="email"
value={email}
onChange={(event) => setEmail(event.target.value)}
autoComplete="username"
required
/>
<label htmlFor="password">Contraseña</label>
<input
id="password"
type="password"
value={password}
onChange={(event) => setPassword(event.target.value)}
autoComplete="current-password"
required
/>
<button type="submit" disabled={isBusy}>
{isBusy ? 'Ingresando...' : 'Ingresar'}
</button>
</form>
</section>
) : (
<section className="workspace" aria-busy={isBusy}>
<article className="panel identity-panel">
<h2>Identidad autenticada</h2>
{user ? (
<dl>
<div><dt>Nombre</dt><dd>{user.name}</dd></div>
<div><dt>Correo</dt><dd>{user.email}</dd></div>
<div><dt>Rol</dt><dd>{user.role}</dd></div>
</dl>
) : <p>Validando el token...</p>}
</article>
<article className="panel">
<div className="section-heading">
<h2>Tareas recuperadas</h2>
<button
onClick={() => setReloadKey((current) => current + 1)}
disabled={isBusy}
>
Actualizar
</button>
</div>
{tasks.length === 0 ? (
<p>No hay tareas para mostrar.</p>
) : (
<ul className="task-list">
{tasks.map((task) => (
<li key={task.id}>
<span>{task.title}</span>
<strong>{task.status}</strong>
</li>
))}
</ul>
)}
</article>
</section>
)}
<p className="status-message" role="status">{message}</p>
</main>
);
}