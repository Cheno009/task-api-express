export const getAppName = (): string =>
 process.env.APP_NAME?.trim() || 'Task Manager Backend';