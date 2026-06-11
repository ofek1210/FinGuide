/**
 * Lightweight markdown-to-safe-HTML renderer for AI chat messages.
 * Handles: **bold**, *italic*, `code`, ## headings, bullet lists (- / •), numbered lists, newlines.
 * Does NOT use dangerouslySetInnerHTML with user-supplied content — only AI-generated content.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(raw: string): string {
  if (!raw) return "";

  // Strip leading RTL/LTR marks
  let text = raw.replace(/^[\u200F\u200E]+/, "");

  // Escape HTML
  text = escapeHtml(text);

  // ## Heading → <strong class="ai-heading">
  text = text.replace(/^##\s+(.+)$/gm, '<strong class="ai-heading">$1</strong>');

  // **bold**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // *italic* (but not bullet *)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // `inline code`
  text = text.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');

  // Bullet list lines (- item or • item)
  text = text.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');

  // Numbered list lines (1. item)
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="ai-list">${match}</ul>`);

  // Line breaks → <br>
  text = text.replace(/\n/g, "<br>");

  return text;
}
