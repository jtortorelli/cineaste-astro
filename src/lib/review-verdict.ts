import { defineHastPlugin } from "satteri";
import type { Element, ElementContent, Parents } from "hast";

type Kind = "liked" | "disliked";

const VERDICTS: Record<string, Kind> = {
  "what i liked": "liked",
  "what i didn't like": "disliked",
  "what i disliked": "disliked",
};

function labelOf(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/:\s*$/, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'");
}

function kindOf(text: string): Kind | null {
  return VERDICTS[labelOf(text)] ?? null;
}

function isBlank(node: ElementContent): boolean {
  return node.type === "text" && !node.value.trim();
}

function nextElement(
  children: ElementContent[],
  index: number,
): { node: Element; index: number } | null {
  for (let i = index + 1; i < children.length; i++) {
    const child = children[i];
    if (isBlank(child)) continue;
    return child.type === "element" ? { node: child, index: i } : null;
  }
  return null;
}

function previousElement(children: ElementContent[], index: number): Element | null {
  for (let i = index - 1; i >= 0; i--) {
    const child = children[i];
    if (isBlank(child)) continue;
    return child.type === "element" ? child : null;
  }
  return null;
}

/** True when this heading continues a verdict block that started earlier. */
function continuesVerdict(
  children: ElementContent[],
  index: number,
  text: (node: Element) => string,
): boolean {
  const previous = previousElement(children, index);
  if (!previous) return false;
  if (/^h[1-6]$/.test(previous.tagName) && kindOf(text(previous))) return true;
  if (previous.tagName !== "ul" && previous.tagName !== "ol") return false;
  const beforeList = previousElement(children, children.indexOf(previous));
  return Boolean(beforeList && /^h[1-6]$/.test(beforeList.tagName) && kindOf(text(beforeList)));
}

function tagged(node: Element, ...classes: string[]): Element {
  const copy = structuredClone(node);
  copy.properties = { ...copy.properties, className: classes };
  return copy;
}

/**
 * Group "What I Liked" / "What I Didn't Like" with the lists that follow them
 * so the pair can sit side by side on a wide screen.
 */
export const reviewVerdictHeadings = defineHastPlugin({
  name: "review-verdict",
  element: {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    visit(node, ctx) {
      if (!kindOf(ctx.textContent(node))) return;

      const parent = ctx.parent(node) as Parents | undefined;
      const start = ctx.indexOf(node);
      if (!parent || start == null) return;
      const children = parent.children;
      const text = (heading: Element) => ctx.textContent(heading);
      if (continuesVerdict(children, start, text)) return;

      const groups: { heading: Element; list: Element | null; kind: Kind }[] = [];
      let index = start;
      while (index < children.length) {
        while (index < children.length && isBlank(children[index])) index++;
        const heading = children[index];
        if (!heading || heading.type !== "element") break;
        const headingKind = kindOf(text(heading));
        if (!headingKind) break;

        const list = nextElement(children, index);
        const hasList = list && (list.node.tagName === "ul" || list.node.tagName === "ol");
        groups.push({ heading, list: hasList ? list.node : null, kind: headingKind });
        index = hasList && list ? list.index + 1 : index + 1;
      }

      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["verdicts"] },
        children: groups.map((group) => ({
          type: "element",
          tagName: "section",
          properties: { className: ["verdict-group", group.kind] },
          children: group.list
            ? [tagged(group.heading, "verdict", group.kind), structuredClone(group.list)]
            : [tagged(group.heading, "verdict", group.kind)],
        })),
      };

      ctx.replaceNode(node, wrapper);
      for (const group of groups) {
        if (group.heading !== node) ctx.removeNode(group.heading);
        if (group.list) ctx.removeNode(group.list);
      }
    },
  },
});
