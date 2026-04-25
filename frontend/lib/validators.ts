/**
 * Runtime validation for SSE event payloads.
 * Catches schema mismatches early and provides clear error messages.
 */

import type {
  CitationMeta,
  IntelligenceSection,
  ValidationWarning,
} from "./types";

/**
 * Validate intelligence event has required shape.
 * Returns the validated section or null if invalid.
 */
export function validateIntelligenceEvent(data: unknown): IntelligenceSection | null {
  if (!data || typeof data !== "object") {
    console.warn("[primer] intelligence event: invalid type", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.id !== "string") {
    console.warn("[primer] intelligence event: missing or invalid 'id'", obj);
    return null;
  }
  if (typeof obj.title !== "string") {
    console.warn("[primer] intelligence event: missing or invalid 'title'", obj);
    return null;
  }
  if (!Array.isArray(obj.items)) {
    console.warn("[primer] intelligence event: 'items' is not an array", obj);
    return null;
  }

  // All checks passed
  return obj as IntelligenceSection;
}

/**
 * Validate brief_chunk event has required delta field.
 */
export function validateBriefChunk(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    console.warn("[primer] brief_chunk: invalid type", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.delta !== "string") {
    console.warn("[primer] brief_chunk: missing or invalid 'delta'", obj);
    return null;
  }

  return obj.delta;
}

/**
 * Validate citation has required fields for its provenance type.
 */
export function validateCitation(data: unknown): CitationMeta | null {
  if (!data || typeof data !== "object") {
    console.warn("[primer] citation: invalid type", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check common required fields
  const requiredFields = ["citation_number", "evid", "source_system", "provenance"];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      console.warn(`[primer] citation: missing required field '${field}'`, obj);
      return null;
    }
  }

  // Validate provenance-specific fields
  const provenance = obj.provenance as string;
  if (provenance === "surfaced") {
    // Surfaced citations should have snippet and optional url
    if (typeof obj.snippet !== "string") {
      console.warn("[primer] citation: surfaced citation missing 'snippet'", obj);
      return null;
    }
  } else if (provenance === "raw" || provenance === "scored") {
    // Raw/scored citations should have field and value_display
    if (typeof obj.field !== "string") {
      console.warn(`[primer] citation: ${provenance} citation missing 'field'`, obj);
      return null;
    }
    if (typeof obj.value_display !== "string") {
      console.warn(`[primer] citation: ${provenance} citation missing 'value_display'`, obj);
      return null;
    }
  } else {
    console.warn(`[primer] citation: unknown provenance '${provenance}'`, obj);
    return null;
  }

  return obj as CitationMeta;
}

/**
 * Validate validation_warning event structure.
 */
export function validateWarning(data: unknown): ValidationWarning | null {
  if (!data || typeof data !== "object") {
    console.warn("[primer] validation_warning: invalid type", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.message !== "string") {
    console.warn("[primer] validation_warning: missing or invalid 'message'", obj);
    return null;
  }

  if (!["critical", "watch"].includes(String(obj.severity))) {
    console.warn("[primer] validation_warning: invalid 'severity'", obj.severity);
    return null;
  }

  return obj as ValidationWarning;
}

/**
 * Validate done event contains metadata.
 */
export function validateDoneEvent(
  data: unknown
): { total_tokens?: number; duration_ms?: number } | null {
  if (!data || typeof data !== "object") {
    console.warn("[primer] done event: invalid type", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;

  // At least one metadata field should exist
  if (!("total_tokens" in obj) && !("duration_ms" in obj)) {
    console.warn("[primer] done event: missing metadata fields", obj);
    return null;
  }

  return obj as { total_tokens?: number; duration_ms?: number };
}
