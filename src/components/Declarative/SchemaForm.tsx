import { useCallback, useMemo, useState } from "react";
import type { FormSchema, FormProperty } from "../../core/sandbox/protocol";

interface SchemaFormProps {
  schema: FormSchema;
  submitLabel?: string;
  /** Called with the collected values when the form is submitted. */
  onSubmit: (values: Record<string, unknown>) => void;
}

type FieldValue = string | number | boolean;

function initialValue(prop: FormProperty): FieldValue {
  if (prop.default !== undefined) return prop.default;
  if (prop.type === "boolean") return false;
  if (prop.type === "number" || prop.type === "integer") return 0;
  if (prop.enum && prop.enum.length > 0) return prop.enum[0];
  return "";
}

/**
 * Renders a form from a JSON-Schema-subset (FormSchema) — the standard, module
 * authors generate it from zod (`z.toJSONSchema()`) or by hand. Pure: it owns no
 * business logic, it just collects values and hands them back via onSubmit.
 */
export function SchemaForm({ schema, submitLabel, onSubmit }: SchemaFormProps) {
  const entries = useMemo(() => Object.entries(schema.properties), [schema]);
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(entries.map(([key, prop]) => [key, initialValue(prop)]))
  );

  const required = schema.required ?? [];
  const canSubmit = required.every((key) => {
    const v = values[key];
    return typeof v === "boolean" || (v !== "" && v !== undefined);
  });

  const setField = useCallback((key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit(values);
  }, [canSubmit, onSubmit, values]);

  return (
    <form className="dv-form" onSubmit={handleSubmit}>
      {entries.map(([key, prop]) => (
        <label key={key} className="dv-form-field">
          {prop.type !== "boolean" && (
            <span className="dv-form-label">{prop.title ?? key}</span>
          )}
          {renderInput(key, prop, values[key], setField)}
          {prop.description && <span className="dv-form-hint">{prop.description}</span>}
        </label>
      ))}
      <button type="submit" className="dv-btn dv-btn--primary" disabled={!canSubmit}>
        {submitLabel ?? "Submit"}
      </button>
    </form>
  );
}

function renderInput(
  key: string,
  prop: FormProperty,
  value: FieldValue,
  setField: (key: string, value: FieldValue) => void
): React.ReactNode {
  if (prop.enum && prop.enum.length > 0) {
    return (
      <select className="dv-input" value={String(value)} onChange={(e) => setField(key, e.target.value)}>
        {prop.enum.map((opt, i) => (
          <option key={opt} value={opt}>{prop.enumLabels?.[i] ?? opt}</option>
        ))}
      </select>
    );
  }
  if (prop.type === "boolean") {
    return (
      <span className="dv-form-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => setField(key, e.target.checked)} />
        <span className="dv-form-label">{prop.title ?? key}</span>
      </span>
    );
  }
  if (prop.type === "number" || prop.type === "integer") {
    return (
      <input
        className="dv-input" type="number" value={Number(value)}
        min={prop.minimum} max={prop.maximum}
        step={prop.type === "integer" ? 1 : "any"}
        onChange={(e) => setField(key, e.target.valueAsNumber || 0)}
      />
    );
  }
  if (prop.format === "textarea") {
    return (
      <textarea
        className="dv-input dv-input--area" value={String(value)} maxLength={prop.maxLength}
        onChange={(e) => setField(key, e.target.value)}
      />
    );
  }
  return (
    <input
      className="dv-input"
      type={prop.format === "password" ? "password" : prop.format === "email" ? "email" : "text"}
      value={String(value)} minLength={prop.minLength} maxLength={prop.maxLength}
      onChange={(e) => setField(key, e.target.value)}
    />
  );
}
