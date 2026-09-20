import { tasks } from "../data/tasks.js";
import { AppError } from "../errors/app-error.js";
import type { Task } from "../models/task.js";
export const listTasks = (): readonly Task[] => tasks;
export const findTaskById = (id: number): Task => {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    throw new AppError(
      `No existe una tarea con el id ${id}.`,
      404,
      "TASK_NOT_FOUND",
    );
  }
  return task;
};

export const createTask = (title: unknown): Task => {
  if (typeof title !== "string" || !title.trim()) {
    throw new AppError(
      "La solicitud contiene datos inválidos.",
      422,
      "VALIDATION_ERROR",
      [{ field: "title", message: "Debe ser texto no vacío." }],
    );
  }
  if (title.trim().length > 120) {
    throw new AppError(
      "La solicitud contiene datos inválidos.",
      422,
      "VALIDATION_ERROR",
      [{ field: "title", message: "No debe superar 120 caracteres." }],
    );
  }
  const task: Task = {
    id: Math.max(0, ...tasks.map((item) => item.id)) + 1,
    title: title.trim(),
    status: "pending",
    createdAt: new Date(),
  };
  tasks.push(task);
  return task;
};
export const updateTaskTitle = (id: number, title: unknown): Task => {
  if (typeof title !== "string" || !title.trim()) {
    throw new AppError(
      "La solicitud contiene datos inválidos.",
      422,
      "VALIDATION_ERROR",
      [{ field: "title", message: "Debe ser texto no vacío." }],
    );
  }
  if (title.trim().length > 120) {
    throw new AppError(
      "La solicitud contiene datos inválidos.",
      422,
      "VALIDATION_ERROR",
      [{ field: "title", message: "No debe superar 120 caracteres." }],
    );
  }
  const task = findTaskById(id);
  task.title = title.trim();
  return task;
};
export const completeTask = (id: number): Task => {
  const task = findTaskById(id);
  task.status = "completed";
  return task;
};

export const setTaskCompletion = (id: number, completed: boolean): Task => {
  const task = findTaskById(id);
  task.status = completed ? "completed" : "pending";
  return task;
};

export const deleteTask = (id: number): void => {
const index = tasks.findIndex((item) => item.id === id);
if (index === -1) {
throw new AppError(
`No existe una tarea con el id ${id}.`,
404,
'TASK_NOT_FOUND'
);
}
tasks.splice(index, 1);
};
