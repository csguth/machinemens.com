// Alpine component for the homepage "latest news" teaser.
// Fetches data/news.json and exposes the single most recent item, if any.
function newsTeaser() {
  return {
    latest: null,
    async init() {
      const res = await fetch('/data/news.json');
      const news = await res.json();
      const sorted = news.slice().sort((a, b) => b.date.localeCompare(a.date));
      this.latest = sorted[0] || null;
    },
    formatDate(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const locales = { en: 'en-GB', nl: 'nl-NL', pt: 'pt-BR' };
      const locale = locales[document.documentElement.lang] || 'en-GB';
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    }
  };
}
