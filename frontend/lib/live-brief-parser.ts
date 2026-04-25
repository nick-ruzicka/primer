"use client";

import type {
  BriefSection,
  InlineNode,
  Paragraph,
} from "./fixtures/northstar-beauty-brief";

/**
 * Incremental markdown → BriefSection[] parser for the live `brief_chunk`
 * stream. The agent emits markdown matching 04_AGENT_SPEC.md shape; we buffer
 * deltas and, as each section boundary lands, convert its body into our
 * structured InlineNode form so the existing Brief component renders it.
 */

export interface ParseResult {
  /** All sections whose `## 0N · ...` header AND body have fully arrived. */
  complete: BriefSection[];
  /** If a section header has been seen but the body is still streaming, tracks that id. */
  streamingId: "01" | "02" | "03" | "04" | "05" | null;
}

const SECTION_KEYS: Record<string, BriefSection["key"]> = {
  "01": "read",
  "02": "why",
  "03": "what_to_do",
  "04": "discovery",
  "05": "talk_track",
};

// Matches `## 01 · The read` (no hedge suffix — dropped in spec §7 cleanup).
// Also tolerates legacy `## 01 · Title — hedge` from older cache hits by
// capturing title up to end-of-line (drop optional ` — ...` tail).
const SECTION_HEADER_RE = /^##\s+(0[1-5])\s+·\s+([^\n]+?)(?:\s+—[^\n]*)?\s*$/gm;

export function parseStreamingBrief(markdown: string): ParseResult {
  const headers: {
    id: BriefSection["id"];
    title: string;
    index: number;
  }[] = [];
  let match: RegExpExecArray | null = SECTION_HEADER_RE.exec(markdown);
  SECTION_HEADER_RE.lastIndex = 0;
  while ((match = SECTION_HEADER_RE.exec(markdown)) !== null) {
    headers.push({
      id: match[1] as BriefSection["id"],
      title: match[2].trim(),
      index: match.index,
    });
  }

  const complete: BriefSection[] = [];
  let streamingId: ParseResult["streamingId"] = null;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const bodyStart = h.index + markdown.slice(h.index).indexOf("\n") + 1;
    const bodyEnd =
      i + 1 < headers.length ? headers[i + 1].index : markdown.length;
    const body = markdown.slice(bodyStart, bodyEnd);
    // A section counts as "complete enough to render" if the next header exists
    // (hard boundary), or — for the trailing section, where there's no next
    // header — if the body has trailing whitespace OR is substantive enough
    // that the agent has clearly moved past the header. The agent's final
    // chunk often lacks a trailing blank line, which used to prevent the last
    // section from ever revealing.
    const isLast = i === headers.length - 1;
    const looksDone =
      !isLast || /\n\s*\n\s*$/.test(body) || body.trim().length >= 30;
    if (isLast && body.trim().length < 10) {
      streamingId = h.id;
      continue;
    }
    if (looksDone) {
      const section = buildSection(h.id, h.title, body);
      if (section) {
        complete.push(section);
      }
    } else {
      streamingId = h.id;
    }
  }

  return { complete, streamingId };
}

function buildSection(
  id: BriefSection["id"],
  title: string,
  body: string,
): BriefSection | null {
  const key = SECTION_KEYS[id];
  if (!key) return null;

  const trimmed = body.trim();
  // First blockquote `> ...` is the preview. Strip it from body.
  let preview = "";
  let rest = trimmed;
  const previewMatch = trimmed.match(/^>\s*(.+?)(?:\n|$)/);
  if (previewMatch) {
    preview = previewMatch[1].trim();
    rest = trimmed.slice(previewMatch[0].length).trim();
  }

  const base: BriefSection = {
    id,
    key,
    title,
    preview,
  };

  // Parse body shape by section kind
  if (id === "03") {
    base.actions = parseActions(rest);
    return base;
  }
  if (id === "04" || id === "05") {
    // 04 = discovery questions, 05 = talk track. Both render as a numbered
    // question list; the section key disambiguates the artifact.
    base.questions = parseQuestions(rest);
    return base;
  }
  // 01 / 02: paragraphs
  base.paragraphs = parseParagraphs(rest);
  return base;
}

function parseParagraphs(body: string): Paragraph[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith(">"))
    .map(tokenizeInline);
}

function parseActions(body: string) {
  // Expect lines of the form:
  //   A1. **body**
  //      _italicized rationale_
  // OR: `1. **body**\n   _rationale_`
  const actions: NonNullable<BriefSection["actions"]> = [];
  const blocks = body.split(/\n(?=\s*(?:A?\d{1,2}[.)]\s))/);
  for (const block of blocks) {
    const m = block.match(
      /^\s*(A?\d{1,2})[.)]\s+\*\*(.+?)\*\*\s*(?:\n\s*_([\s\S]+?)_)?/,
    );
    if (!m) continue;
    const [, idRaw, bodyText, rationale] = m;
    const id = idRaw.startsWith("A") ? idRaw : `A${idRaw}`;
    actions.push({
      id,
      body: tokenizeInline(bodyText),
      rationale: rationale ? tokenizeInline(rationale) : [],
    });
  }
  return actions;
}

function parseQuestions(body: string): Paragraph[] {
  const lines: Paragraph[] = [];
  for (const line of body.split(/\n/)) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(?:\d+[.)]|-)\s+(.+)$/);
    if (m) lines.push(tokenizeInline(m[1]));
  }
  return lines;
}

/**
 * Tokenize a string into InlineNode[]: text / bold / italic / citation.
 * Order of precedence: citation markers (·N) first, then **bold**, then _italic_.
 */
export function tokenizeInline(text: string): Paragraph {
  const out: InlineNode[] = [];
  // Citation capture handles `·14`, `·14,15`, `·14, 15`, and `·14 ,15`. The
  // `·14, ·15` variant is picked up as two back-to-back matches (the second
  // `·` re-enters the pattern), which still produces two chips.
  const regex = /\*\*([^*]+)\*\*|_([^_]+)_|·(\d+(?:\s*[,，]\s*\d+)*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const [, bold, italic, cite] = match;
    if (bold) out.push({ kind: "bold", value: bold });
    else if (italic) out.push({ kind: "italic", value: italic });
    else if (cite) {
      const nums = cite.split(/\s*[,，]\s*/).map((n) => Number(n));
      nums.forEach((n, i) => {
        if (i > 0) out.push({ kind: "text", value: " " });
        out.push({ kind: "cite", n });
      });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}
