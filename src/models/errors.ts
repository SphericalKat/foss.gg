export const isUniqueConstraintError = (message: string): boolean =>
  /unique constraint/iu.test(message);
