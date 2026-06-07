import { Note, NoteBlock } from "@/lib/types";

export const blockToMarkdown = (block: NoteBlock): string => {
  switch (block.type) {
    case "heading1": return `# ${block.content}`;
    case "heading2": return `## ${block.content}`;
    case "heading3": return `### ${block.content}`;
    case "bullet": return `- ${block.content}`;
    case "numbered": return `1. ${block.content}`;
    case "todo": return `- [${block.checked ? "x" : " "}] ${block.content}`;
    case "quote": return `> ${block.content}`;
    case "code": return `\`\`\`\n${block.content}\n\`\`\``;
    case "divider": return "---";
    case "callout": return `> 💡 ${block.content}`;
    case "toggle":
      return `<details>\n<summary>${block.content}</summary>\n${block.toggleContent || ""}\n</details>`;
    case "image": return block.imageUrl ? `![Image](${block.imageUrl})` : "";
    case "bookmark":
      return block.bookmarkUrl ? `[${block.bookmarkTitle || block.bookmarkUrl}](${block.bookmarkUrl})` : "";
    case "video": return block.videoUrl ? `[Video](${block.videoUrl})` : "";
    case "equation": return `$$${block.content}$$`;
    case "progress": return `Progress: ${block.progressValue || 0}%`;
    case "faq":
      return (block.faqItems || [])
        .map((q) => `**Q: ${q.question}**\nA: ${q.answer}`)
        .join("\n\n");
    case "flashcard":
      return (block.flashcards || []).map((c) => `- ${c.content}`).join("\n");
    case "table": {
      if (!block.tableData?.length) return "";
      const header = `| ${block.tableData[0].join(" | ")} |`;
      const sep = `| ${block.tableData[0].map(() => "---").join(" | ")} |`;
      const rows = block.tableData.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
      return `${header}\n${sep}\n${rows}`;
    }
    default: return block.content || "";
  }
};

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

export const noteToMarkdown = (note: Note): string => {
  const body = note.blocks
    .map(blockToMarkdown)
    .map(stripHtml)
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
  return `# ${note.title || "Untitled"}\n\n${body}`;
};