/**
 * Unit tests for the document chunker (RAG layer).
 * Pure functions — no mocking required.
 */

const {
  chunkText,
  chunkPayslipAnalysis,
  chunkKnowledgeArticle,
} = require('../../services/embeddings/documentChunker');

describe('documentChunker.chunkText', () => {
  it('returns an empty array for empty/falsy text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText(null)).toEqual([]);
    expect(chunkText(undefined)).toEqual([]);
  });

  it('returns a single trimmed chunk for short text', () => {
    const chunks = chunkText('  hello world  ', { chunkSize: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('hello world');
    expect(chunks[0].metadata.startPos).toBe(0);
  });

  it('splits long text into multiple overlapping chunks', () => {
    const text = 'a'.repeat(1200);
    const chunks = chunkText(text, { chunkSize: 500, overlap: 100 });
    // step = 400 → starts at 0, 400, 800 → 3 chunks
    expect(chunks.length).toBe(3);
    expect(chunks[0].metadata.startPos).toBe(0);
    expect(chunks[1].metadata.startPos).toBe(400);
    expect(chunks[2].metadata.startPos).toBe(800);
  });

  it('produces deterministic ids for the same content + position', () => {
    const opts = { chunkSize: 500, metadata: { source: 'doc1' } };
    const a = chunkText('repeatable content', opts);
    const b = chunkText('repeatable content', opts);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).toMatch(/^[a-f0-9]{32}$/);
  });

  it('attaches provided metadata to every chunk', () => {
    const chunks = chunkText('x'.repeat(900), {
      chunkSize: 400,
      overlap: 50,
      metadata: { source: 'kb', category: 'tax' },
    });
    chunks.forEach((c) => {
      expect(c.metadata.source).toBe('kb');
      expect(c.metadata.category).toBe('tax');
    });
  });
});

describe('documentChunker.chunkPayslipAnalysis', () => {
  const analysisData = {
    summary: {
      date: '2025-03',
      grossSalary: 20000,
      baseSalary: 15000,
      netSalary: 14000,
      employeeName: 'דנה כהן',
      employerName: 'חברה בע"מ',
      tax: 2500,
      nationalInsurance: 800,
      pensionEmployee: 1200,
      pensionEmployer: 1300,
      trainingFundEmployee: 500,
    },
  };

  it('returns [] when analysisData has no summary', () => {
    expect(chunkPayslipAnalysis(null)).toEqual([]);
    expect(chunkPayslipAnalysis({})).toEqual([]);
  });

  it('always produces an income chunk with key salary fields', () => {
    const chunks = chunkPayslipAnalysis(analysisData, { documentId: 'doc42' });
    const income = chunks.find((c) => c.metadata.category === 'income');
    expect(income).toBeDefined();
    expect(income.text).toContain('20000');
    expect(income.text).toContain('דנה כהן');
    expect(income.metadata.documentId).toBe('doc42');
  });

  it('produces deductions and pension chunks when those fields exist', () => {
    const chunks = chunkPayslipAnalysis(analysisData, { documentId: 'doc42' });
    const categories = chunks.map((c) => c.metadata.category);
    expect(categories).toEqual(expect.arrayContaining(['income', 'deductions', 'pension']));
  });

  it('omits the deductions chunk when no deduction fields are present', () => {
    const chunks = chunkPayslipAnalysis(
      { summary: { date: '2025-03', grossSalary: 100 } },
      { documentId: 'd' },
    );
    expect(chunks.map((c) => c.metadata.category)).not.toContain('deductions');
  });
});

describe('documentChunker.chunkKnowledgeArticle', () => {
  it('splits an article into paragraph sections', () => {
    const article = `${'פסקה ראשונה עם מספיק תוכן כדי לעבור את הסף הנדרש לחלוטין.'}\n\n${'פסקה שנייה גם היא ארוכה מספיק כדי להיכלל בתוצאה הסופית.'}`;
    const chunks = chunkKnowledgeArticle(article, { title: 'מאמר', category: 'tax', source: 'kb' });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.title).toBe('מאמר');
    expect(chunks[0].metadata.sectionIndex).toBe(0);
    expect(chunks[1].metadata.sectionIndex).toBe(1);
  });

  it('filters out sections shorter than the minimum length', () => {
    const article = 'קצר\n\nפסקה ארוכה מספיק שעוברת את סף שלושים התווים בקלות רבה מאוד.';
    const chunks = chunkKnowledgeArticle(article, { source: 'kb' });
    expect(chunks).toHaveLength(1);
  });

  it('defaults source to knowledge_base and yields deterministic ids', () => {
    const article = 'פסקה ארוכה מספיק שעוברת את סף שלושים התווים בקלות רבה מאוד וללא בעיה.';
    const a = chunkKnowledgeArticle(article, {});
    const b = chunkKnowledgeArticle(article, {});
    expect(a[0].metadata.source).toBe('knowledge_base');
    expect(a[0].id).toBe(b[0].id);
  });
});
