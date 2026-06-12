function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const langMap: Record<string, string> = {
  node: "javascript",
  python: "python",
  go: "go",
  java: "java",
  rust: "rust",
};

const rules: Record<string, [RegExp, string][]> = {
  javascript: [
    [/"[^"]*"/g, "string"],
    [/'[^']*'/g, "string"],
    [/`[^`]*`/g, "string"],
    [new RegExp("//.*$", "gm"), "comment"],
    [
      /\b(import|export|from|const|let|var|new|function|class|return|async|await|if|else|for|while|switch|case|break|default|try|catch|throw|typeof|instanceof|in|of|extends|void)\b/g,
      "keyword",
    ],
    [/\b(true|false|null|undefined)\b/g, "builtin"],
    [/\b\d+\b/g, "number"],
    [/\b[A-Z][a-zA-Z0-9]*\b/g, "class-name"],
  ],
  python: [
    [/"[^"]*"/g, "string"],
    [/'[^']*'/g, "string"],
    [new RegExp("#.*$", "gm"), "comment"],
    [
      /\b(from|import|as|class|def|return|if|else|elif|for|while|try|except|with|pass|lambda|True|False|None)\b/g,
      "keyword",
    ],
    [/\b\d+\b/g, "number"],
    [/\b[A-Z][a-zA-Z0-9]*\b/g, "class-name"],
  ],
  go: [
    [/"[^"]*"/g, "string"],
    [/`[^`]*`/g, "string"],
    [new RegExp("//.*$", "gm"), "comment"],
    [
      /\b(package|import|func|var|const|type|struct|interface|return|if|else|for|range|switch|case|default|break|continue|defer|go|chan|map|make|new|append|copy|len|cap)\b/g,
      "keyword",
    ],
    [
      /\b(int|string|bool|float64|float32|int64|int32|byte|rune|error|context|Context)\b/g,
      "builtin",
    ],
    [/\b\d+\b/g, "number"],
    [/\b[A-Z][a-zA-Z0-9]*\b/g, "class-name"],
  ],
  java: [
    [/"[^"]*"/g, "string"],
    [new RegExp("//.*$", "gm"), "comment"],
    [new RegExp("<!---?[\\s\\S]*?-->", "g"), "comment"],
    [
      /\b(import|package|class|public|private|static|final|void|return|if|else|for|while|switch|case|break|default|try|catch|throw|new|extends|implements|interface|abstract|this|super)\b/g,
      "keyword",
    ],
    [/\b(true|false|null)\b/g, "builtin"],
    [/\b\d+\b/g, "number"],
    [/\b[A-Z][a-zA-Z0-9]*\b/g, "class-name"],
  ],
  rust: [
    [/"[^"]*"/g, "string"],
    [new RegExp("//.*$", "gm"), "comment"],
    [
      /\b(use|mod|fn|let|mut|const|static|struct|enum|trait|impl|type|return|if|else|match|for|while|loop|break|continue|pub|crate|self|Self|super|where|move|ref|box|unsafe|async|await|dyn|as|in)\b/g,
      "keyword",
    ],
    [/\b(true|false)\b/g, "builtin"],
    [/\b\d+\b/g, "number"],
    [/\b[A-Z][a-zA-Z0-9]*\b/g, "class-name"],
  ],
  bash: [
    [/"[^"]*"/g, "string"],
    [/'[^']*'/g, "string"],
    [new RegExp("#.*$", "gm"), "comment"],
    [/\b(npm|pip|cargo|go|install|add|get|build|run|test)\b/g, "keyword"],
    [/\b\d+\b/g, "number"],
  ],
  text: [
    [/"[^"]*"/g, "string"],
    [/'[^']*'/g, "string"],
    [/\b\d+\b/g, "number"],
  ],
};

export function highlightCode(code: string, lang: string): string {
  let text = escapeHtml(code);
  const mapped = langMap[lang] || lang;
  const langRules = rules[mapped] || rules.text;

  const placeholders: { key: string; value: string }[] = [];
  let id = 0;

  const save = (html: string) => {
    const key = `__PH${id++}__`;
    placeholders.push({ key, value: html });
    return key;
  };

  // Pass 1: strings and comments
  for (const [pattern, type] of langRules) {
    if (type === "string" || type === "comment") {
      text = text.replace(pattern, (m) =>
        save(`<span class="token-${type}">${m}</span>`),
      );
    }
  }

  // Pass 2: other tokens
  for (const [pattern, type] of langRules) {
    if (type !== "string" && type !== "comment") {
      text = text.replace(
        pattern,
        (m) => `<span class="token-${type}">${m}</span>`,
      );
    }
  }

  // Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    text = text.replace(placeholders[i].key, placeholders[i].value);
  }

  return text;
}
