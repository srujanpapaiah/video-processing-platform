import { AppError } from "./base.error";
import { ZodError } from "zod";

export class ValidationError extends AppError {
  public readonly details: { field: string; message: string }[];

  constructor(error: ZodError) {
    const details = error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    super("Validation failed", 422);
    this.details = details;
  }
}
