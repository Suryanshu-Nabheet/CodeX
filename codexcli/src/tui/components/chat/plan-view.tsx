import { theme } from "../../theme.js";
import { Box, Text } from "ink";
import React from "react";

/**
 * Detect and parse "Updated Plan" / checklist blocks from assistant text.
 */

export type PlanItem = {
  text: string;
  status: "active" | "pending" | "done";
};

export type ParsedPlan = {
  title: string;
  summary?: string;
  items: Array<PlanItem>;
};

const PLAN_TITLE_RE = /^(?:#{1,3}\s*)?(?:updated\s+)?plan\b[:\s]*$/i;
const CHECK_RE =
  /^(?:[-*•]|\d+\.)\s*\[([ xX])\]\s+(.+)$|^[□▢■☑☐]\s+(.+)$/;
const BULLET_RE = /^[-*•]\s+(.+)$/;

export function tryParsePlan(text: string): ParsedPlan | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }

  let titleIdx = -1;
  let title = "Updated Plan";
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i]!.trim();
    if (PLAN_TITLE_RE.test(line) || /^updated\s+plan\b/i.test(line)) {
      titleIdx = i;
      title = line.replace(/^#+\s*/, "").replace(/:$/, "").trim() || title;
      break;
    }
  }

  const explicitChecks = lines.filter((l) => CHECK_RE.test(l.trim())).length;
  const checklistOnly = titleIdx === -1 && explicitChecks >= 2;

  if (titleIdx === -1 && !checklistOnly) {
    return null;
  }

  const start = titleIdx === -1 ? 0 : titleIdx + 1;
  let summary: string | undefined;
  const items: Array<PlanItem> = [];

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (PLAN_TITLE_RE.test(raw)) {
      continue;
    }

    const check = raw.match(CHECK_RE);
    const bullet =
      titleIdx !== -1 && !check ? raw.match(BULLET_RE) : null;
    if (check || bullet) {
      const done = Boolean(check?.[1] && /[xX]/.test(check[1]));
      const text = (
        check?.[2] ??
        check?.[3] ??
        bullet?.[1] ??
        ""
      ).trim();
      if (!text) {
        continue;
      }
      items.push({
        text,
        status: done ? "done" : "pending",
      });
      continue;
    }

    if (items.length === 0 && !summary && !raw.startsWith("#")) {
      summary = raw.replace(/^[└├│]\s*/, "").trim();
      continue;
    }
  }

  if (items.length === 0) {
    return null;
  }

  let activated = false;
  const normalized = items.map((item) => {
    if (item.status === "done") {
      return item;
    }
    if (!activated) {
      activated = true;
      return { ...item, status: "active" as const };
    }
    return item;
  });

  return { title, summary, items: normalized };
}

export function PlanView({ plan }: { plan: ParsedPlan }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        <Text color={theme.colors.muted}>{theme.glyphs.bullet} </Text>
        <Text bold color={theme.colors.brand}>
          {plan.title}
        </Text>
      </Text>
      {plan.summary ? (
        <Text dimColor>
          {"  "}
          {theme.glyphs.tree} {plan.summary}
        </Text>
      ) : null}
      {plan.items.map((item, idx) => {
        const color =
          item.status === "active"
            ? theme.colors.active
            : item.status === "done"
              ? theme.colors.success
              : theme.colors.muted;
        const mark =
          item.status === "done"
            ? theme.glyphs.checkboxDone
            : theme.glyphs.checkbox;
        return (
          <Text key={idx} color={color}>
            {"    "}
            {mark} {item.text}
          </Text>
        );
      })}
    </Box>
  );
}
