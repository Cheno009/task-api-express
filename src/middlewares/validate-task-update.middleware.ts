import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdate,
} from "../models/task.js";
import type { FieldIssue } from "../types/api-error.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === "string" && TASK_STATUSES.some((status) => status === value);

export const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" &&
  TASK_PRIORITIES.some((priority) => priority === value);

const ALLOWED_FIELDS = ["title", "status", "priority"];

export const validateTaskUpdate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const body: unknown = req.body;
  if (!isRecord(body)) {
    next(
      new AppError(
        "La solicitud contiene datos inválidos.",
        422,
        "VALIDATION_ERROR",
        [{ field: "body", message: "Debe ser un objeto JSON." }],
      ),
    );
    return;
  }

  const issues: FieldIssue[] = [];
  const update: TaskUpdate = {};
  const fields = Object.keys(body);

  if (fields.length === 0) {
    issues.push({
      field: "body",
      message: "Incluye al menos title, status o priority.",
    });
  }

  for (const field of fields) {
    if (!ALLOWED_FIELDS.includes(field)) {
      issues.push({ field, message: "El campo no está permitido." });
    }
  }

  if ("title" in body) {
    const title = body.title;
    if (typeof title !== "string" || !title.trim()) {
      issues.push({ field: "title", message: "Debe ser texto no vacío." });
    } else if (title.trim().length > 120) {
      issues.push({
        field: "title",
        message: "No debe superar 120 caracteres.",
      });
    } else {
      update.title = title.trim();
    }
  }

  if ("status" in body) {
    if (!isTaskStatus(body.status)) {
      issues.push({
        field: "status",
        message: "Debe ser pending o completed.",
      });
    } else {
      update.status = body.status;
    }
  }

  if ("priority" in body) {
    if (!isTaskPriority(body.priority)) {
      issues.push({
        field: "priority",
        message: "Debe ser low, medium o high.",
      });
    } else {
      update.priority = body.priority;
    }
  }

  if (issues.length > 0) {
    next(
      new AppError(
        "La solicitud contiene datos inválidos.",
        422,
        "VALIDATION_ERROR",
        issues,
      ),
    );
    return;
  }

  res.locals.taskUpdate = update;
  next();
};
