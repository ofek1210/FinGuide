/**
 * Unit tests for the curated knowledge base (RAG content integrity).
 */

const { knowledgeArticles } = require('../../services/embeddings/knowledgeBase');

const ALLOWED_CATEGORIES = ['pension', 'tax', 'insurance', 'payslip', 'planning'];

describe('knowledgeBase', () => {
  it('exports a non-empty array of articles', () => {
    expect(Array.isArray(knowledgeArticles)).toBe(true);
    expect(knowledgeArticles.length).toBeGreaterThan(0);
  });

  it('every article has a title, category, source and content string', () => {
    knowledgeArticles.forEach((article) => {
      expect(typeof article.title).toBe('string');
      expect(article.title.length).toBeGreaterThan(0);
      expect(typeof article.source).toBe('string');
      expect(typeof article.content).toBe('string');
      expect(article.content.length).toBeGreaterThan(30);
    });
  });

  it('every article uses an allowed category', () => {
    knowledgeArticles.forEach((article) => {
      expect(ALLOWED_CATEGORIES).toContain(article.category);
    });
  });

  it('covers all core financial domains', () => {
    const categories = new Set(knowledgeArticles.map((a) => a.category));
    ['pension', 'tax', 'insurance', 'payslip', 'planning'].forEach((cat) => {
      expect(categories.has(cat)).toBe(true);
    });
  });

  it('has unique titles', () => {
    const titles = knowledgeArticles.map((a) => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
