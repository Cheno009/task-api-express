import type { NextFunction, Request, Response } from "express";
import {
  completeTask,
  createTask,
  deleteTask,
  findTaskById,
  listTasks,
  setTaskCompletion,
  updateTaskTitle,
} from "../services/task.service.js";
import { AppError } from "../errors/app-error.js";
const parseId = (value: string | string[] | undefined): number => {
  if (typeof value !== "string") {
    throw new AppError("El id debe ser un entero positivo.", 400, "INVALID_ID");
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("El id debe ser un entero positivo.", 400, "INVALID_ID");
  }
  return id;
};
export const getTasks = (_req: Request, res: Response): void => {
  res.status(200).json({ data: listTasks() });
};
export const getTask = (
_req: Request,
res: Response
): void => {
res.status(200).json({ data: findTaskById(res.locals.taskId) });
};

export const postTask = (
_req: Request,
res: Response
): void => {
const task = createTask(res.locals.taskTitle);
res.status(201).json({ data: task });
};

export const patchTaskTitle = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const task = updateTaskTitle(parseId(req.params.id), req.body.title);
    res.status(200).json({ data: task });
  } catch (error: unknown) {
    next(error);
  }
};

export const patchTaskComplete = (
_req: Request,
res: Response
): void => {
const task = completeTask(res.locals.taskId);
res.status(200).json({ data: task });
};

export const patchTaskStatus = (
_req: Request,
res: Response
): void => {
const task = setTaskCompletion(res.locals.taskId, res.locals.completed);
res.status(200).json({ data: task });
};

export const removeTask = (
_req: Request,
res: Response
): void => {
deleteTask(res.locals.taskId);
res.status(204).send();
};
