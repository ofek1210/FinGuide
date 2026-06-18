import { useState } from "react";
import { MessageCircle, Sparkles, Send, Download, CheckCircle2 } from "lucide-react";
import { generateMonthlyReport } from "../../api/copilot.api";
import "./DashboardWhatsAppReport.css";

function markdownToPlain(md: string): string {
  return md
    .replace(/^##+ /gm, "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^- /gm, "• ");
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

export default function DashboardWhatsAppReport() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const result = await generateMonthlyReport();
      if (result.ok && result.data.success) {
        setReport(result.data.data.report);
      } else {
        setError("לא הצלחנו ליצור את הדוח");
      }
    } catch {
      setError("שגיאה בעת יצירת הדוח");
    } finally {
      setLoading(false);
    }
  };

  const shareWhatsApp = () => {
    if (!report) return;
    const plainText = markdownToPlain(report);
    const header = `📊 *FinGuide — דוח פיננסי חודשי*\n📅 ${new Date().toLocaleDateString("he-IL")}\n\n`;
    const footer = "\n\n⚠️ _דוח זה נוצר אוטומטית ואינו מהווה ייעוץ פיננסי מקצועי._";
    const fullText = header + plainText + footer;

    // Use Web Share API if available (works on mobile + desktop)
    if (navigator.share) {
      navigator.share({ title: "FinGuide — דוח חודשי", text: fullText }).then(() => setSent(true)).catch(() => {
        // Fallback to WhatsApp Web
        openWhatsAppWeb(fullText);
      });
    } else {
      openWhatsAppWeb(fullText);
    }
  };

  const openWhatsAppWeb = (text: string) => {
    // Use api.whatsapp.com which works better across all browsers
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
  };

  const downloadPdf = () => {
    if (!report) return;
    const html = report
      .replace(/^## (.+)/gm, "<h2>$1</h2>")
      .replace(/^### (.+)/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)/gm, "<li>$1</li>")
      .replace(/(<li>.+<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/\n/g, "<br>");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>FinGuide — דוח חודשי</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}h1{font-size:22px;border-bottom:2px solid #818CF8;padding-bottom:8px}h2{font-size:18px;color:#334155;margin-top:20px}h3{font-size:15px;color:#475569}ul{padding-right:20px}li{margin-bottom:4px}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}</style></head>
<body><h1>📊 FinGuide — דוח פיננסי חודשי</h1><p style="color:#64748b;font-size:12px;">נוצר: ${new Date().toLocaleDateString("he-IL")}</p>${html}<div class="footer">⚠️ דוח זה נוצר אוטומטית ואינו מהווה ייעוץ פיננסי מקצועי.</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <section className="dash-wa-report">
      <div className="dash-wa-report-header">
        <div className="dash-wa-report-icon">
          <MessageCircle size={24} />
        </div>
        <div className="dash-wa-report-text">
          <h3>שלח דוח חודשי לוואטסאפ</h3>
          <p>
            AI מנתח את כל הנתונים שלך — שכר, פנסיה, ביטוח, מיסים — ויוצר סיכום מותאם אישית שתוכל/י לשלוח לעצמך או לשתף עם יועץ.
          </p>
        </div>
        <div className="dash-wa-report-badge">
          <Sparkles size={14} />
          <span>AI</span>
        </div>
      </div>

      {error && <p className="dash-wa-error">{error}</p>}

      {!report ? (
        <button
          className="dash-wa-generate-btn"
          onClick={generate}
          disabled={loading}
        >
          <Sparkles size={16} />
          <span>{loading ? "יוצר דוח..." : "צור דוח חודשי חכם"}</span>
        </button>
      ) : (
        <div className="dash-wa-actions">
          <button className="dash-wa-send-btn" onClick={shareWhatsApp}>
            <Send size={16} />
            <span>{sent ? "נשלח! ✓" : "שלח בוואטסאפ"}</span>
          </button>
          <button className="dash-wa-pdf-btn" onClick={downloadPdf}>
            <Download size={16} />
            <span>הורד PDF</span>
          </button>
          <button className="dash-wa-refresh-btn" onClick={generate} disabled={loading}>
            {loading ? "מעדכן..." : "↻ צור מחדש"}
          </button>
        </div>
      )}

      {sent && (
        <div className="dash-wa-success">
          <CheckCircle2 size={15} />
          <span>הדוח נשלח בהצלחה! בדקו בוואטסאפ</span>
        </div>
      )}

      {report && (
        <details className="dash-wa-preview" open>
          <summary>👁️ תצוגה מקדימה של הדוח</summary>
          <div
            className="dash-wa-preview-content"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }}
          />
        </details>
      )}
    </section>
  );
}
