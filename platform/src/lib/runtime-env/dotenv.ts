import {
  getRuntimeEnvDefinition,
  isSupportedRuntimeEnvKey,
  RUNTIME_ENV_NAME_PATTERN,
  type RuntimeEnvDefinition,
  type RuntimeEnvKey,
} from "./definitions";

export type RuntimeEnvDotenvIssueCode =
  | "invalid-name"
  | "unknown-key"
  | "reserved-key"
  | "duplicate-key"
  | "missing-assignment";

export interface RuntimeEnvDotenvIssue {
  code: RuntimeEnvDotenvIssueCode;
  key: string | null;
  lineNumber: number;
  message: string;
}

export interface RuntimeEnvDotenvAcceptedEntry {
  key: RuntimeEnvKey;
  value: string;
  lineNumber: number;
  definition: RuntimeEnvDefinition;
}

export interface RuntimeEnvDotenvPreview {
  accepted: RuntimeEnvDotenvAcceptedEntry[];
  persistableValues: Partial<Record<RuntimeEnvKey, string>>;
  warnings: RuntimeEnvDotenvIssue[];
  errors: RuntimeEnvDotenvIssue[];
}

function parseDotenvValue(rawValue: string): string {
  const trimmed = rawValue.trim();

  if (trimmed.length < 2) {
    return trimmed;
  }

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    const inner = trimmed.slice(1, -1);
    if (quote === "'") {
      return inner;
    }

    return inner
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r")
      .replaceAll("\\t", "\t")
      .replaceAll('\\"', '"')
      .replaceAll("\\\\", "\\");
  }

  return trimmed.replace(/\s+#.*$/, "").trimEnd();
}

function createIssue(
  code: RuntimeEnvDotenvIssueCode,
  key: string | null,
  lineNumber: number,
  message: string,
): RuntimeEnvDotenvIssue {
  return { code, key, lineNumber, message };
}

export function parseRuntimeEnvDotenv(content: string): RuntimeEnvDotenvPreview {
  const acceptedByKey = new Map<RuntimeEnvKey, RuntimeEnvDotenvAcceptedEntry>();
  const warnings: RuntimeEnvDotenvIssue[] = [];
  const errors: RuntimeEnvDotenvIssue[] = [];
  const seenAcceptedKeys = new Set<RuntimeEnvKey>();

  content.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      return;
    }

    const assignmentIndex = line.indexOf("=");
    if (assignmentIndex === -1) {
      errors.push(createIssue(
        "missing-assignment",
        null,
        lineNumber,
        "Line must use KEY=value dotenv syntax.",
      ));
      return;
    }

    const key = line.slice(0, assignmentIndex).trim();
    const rawValue = line.slice(assignmentIndex + 1);

    if (!RUNTIME_ENV_NAME_PATTERN.test(key)) {
      errors.push(createIssue(
        "invalid-name",
        key || null,
        lineNumber,
        "Environment variable names must start with a letter or underscore and contain only letters, numbers, and underscores.",
      ));
      return;
    }

    const definition = getRuntimeEnvDefinition(key);
    if (definition === null) {
      errors.push(createIssue(
        "unknown-key",
        key,
        lineNumber,
        "This environment variable is not supported by the Abra runtime env registry.",
      ));
      return;
    }

    if (definition.reserved || !isSupportedRuntimeEnvKey(key)) {
      const message = definition.reservedReason === "dedicated-flow"
        ? "This is managed in Settings → Telegram bot, not here."
        : "This environment variable is reserved for the platform and cannot be imported.";
      errors.push(createIssue("reserved-key", key, lineNumber, message));
      return;
    }

    if (seenAcceptedKeys.has(key)) {
      warnings.push(createIssue(
        "duplicate-key",
        key,
        lineNumber,
        "Duplicate environment variable; the last supported value wins.",
      ));
    }

    seenAcceptedKeys.add(key);
    acceptedByKey.set(key, {
      key,
      value: parseDotenvValue(rawValue),
      lineNumber,
      definition,
    });
  });

  const accepted = Array.from(acceptedByKey.values());
  const persistableValues = accepted.reduce<Partial<Record<RuntimeEnvKey, string>>>((values, entry) => {
    values[entry.key] = entry.value;
    return values;
  }, {});

  return {
    accepted,
    persistableValues,
    warnings,
    errors,
  };
}
