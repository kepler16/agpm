import Ajv, { type ErrorObject } from "ajv";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the schemas directory path (schemas are bundled with the package)
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, "../schemas");

// Create Ajv instance
const ajv = new Ajv.default({
  allErrors: true,
  verbose: true,
});

// Schema cache
let configSchema: object | undefined;
let lockSchema: object | undefined;

/**
 * Load and cache the config schema.
 */
async function getConfigSchema(): Promise<object> {
  if (!configSchema) {
    const content = await readFile(join(SCHEMAS_DIR, "agpm.json"), "utf-8");
    configSchema = JSON.parse(content) as object;
  }
  return configSchema;
}

/**
 * Load and cache the lock schema.
 */
async function getLockSchema(): Promise<object> {
  if (!lockSchema) {
    const content = await readFile(join(SCHEMAS_DIR, "agpm-lock.json"), "utf-8");
    lockSchema = JSON.parse(content) as object;
  }
  return lockSchema;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate an APM config against the schema.
 */
export async function validateConfig(config: unknown): Promise<ValidationResult> {
  const schema = await getConfigSchema();
  const validate = ajv.compile(schema);
  const valid = validate(config);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors || []).map((err: ErrorObject) => ({
    path: err.instancePath || "/",
    message: err.message || "Unknown validation error",
  }));

  return { valid: false, errors };
}

/**
 * Validate an APM lock file against the schema.
 */
export async function validateLock(lock: unknown): Promise<ValidationResult> {
  const schema = await getLockSchema();
  const validate = ajv.compile(schema);
  const valid = validate(lock);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors || []).map((err: ErrorObject) => ({
    path: err.instancePath || "/",
    message: err.message || "Unknown validation error",
  }));

  return { valid: false, errors };
}

/**
 * Format validation errors for display.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join("\n");
}
