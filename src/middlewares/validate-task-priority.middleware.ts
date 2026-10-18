import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { isTaskPriority } from "./validate-task-update.middleware.js";

export const validateTaskPriority = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const priority: unknown = req.body?.priority;
  // Es opcional: si no se envía, el servicio y el esquema usan "medium".
  if (priority === undefined) {
    next();
    return;
  }
  if (!isTaskPriority(priority)) {
    next(
      new AppError(
        "La solicitud contiene datos inválidos.",
        422,
        "VALIDATION_ERROR",
        [{ field: "priority", message: "Debe ser low, medium o high." }],
      ),
    );
    return;
  }
  res.locals.taskPriority = priority;
  next();
};
