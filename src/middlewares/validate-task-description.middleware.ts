/* import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { TASK_DESCRIPTION_MAX_LENGTH } from "../models/task.js";

const invalidDescription = (message: string): AppError =>
  new AppError("La solicitud contiene datos inválidos.", 422, "VALIDATION_ERROR", [
    { field: "description", message },
  ]);

export const validateTaskDescription = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const description: unknown = req.body?.description;
  // Es opcional: si no se envía, la tarea se crea sin descripción.
  if (description === undefined) {
    next();
    return;
  }
  if (typeof description !== "string") {
    next(invalidDescription("Debe ser texto."));
    return;
  }
  const trimmed = description.trim();
  if (trimmed.length > TASK_DESCRIPTION_MAX_LENGTH) {
    next(
      invalidDescription(
        `No debe superar ${TASK_DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
    );
    return;
  }
  // Una descripción vacía tras el recorte se trata como ausente.
  if (trimmed) {
    res.locals.taskDescription = trimmed;
  }
  next();
}; */
