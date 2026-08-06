// Alpine component for the /news/ page.
// Fetches data/news.json and exposes items sorted by date, newest first.
function newsPage() {
  return {
    items: [],
    async init() {
      const res = await fetch('/data/news.json');
      const news = await res.json();
      this.items = news.slice().sort((a, b) => b.date.localeCompare(a.date));
    },
    formatDate(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const locales = { en: 'en-GB', nl: 'nl-NL', pt: 'pt-BR' };
      const locale = locales[document.documentElement.lang] || 'en-GB';
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    }
  };
}
