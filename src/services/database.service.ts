import mongoose from "mongoose";
import { AppError } from "../errors/app-error.js";
export interface DatabaseHealth {
  status: "connected";
}
const databaseUnavailable = (): AppError => {
  return new AppError(
    "La base de datos no está disponible.",
    503,
    "DATABASE_UNAVAILABLE",
  );
};
export const checkDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const database = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !database) {
    throw databaseUnavailable();
  }
  try {
    await database.admin().ping();
    return { status: "connected" };
  } catch {
    throw databaseUnavailable();
  }
};

export type DatabaseConnectionState =
  | "disconnected"
  | "connected"
  | "connecting"
  | "disconnecting"
  | "unknown";

export interface DatabaseStatus {
  status: "up" | "down";
  state: DatabaseConnectionState;
}

const connectionStates: Record<number, DatabaseConnectionState> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const getDatabaseStatus = (): DatabaseStatus => {
  const readyState = mongoose.connection.readyState as number;
  return {
    status: readyState === 1 ? "up" : "down",
    state: connectionStates[readyState] ?? "unknown",
  };
};
