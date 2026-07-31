// Alpine component for the homepage "next show" teaser.
// Fetches data/shows.json and exposes the single soonest upcoming show, if any.
function showsTeaser() {
  return {
    nextShow: null,
    async init() {
      const res = await fetch('/data/shows.json');
      const shows = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = shows
        .filter(show => show.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      this.nextShow = upcoming[0] || null;
    },
    formatDate(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const locales = { en: 'en-GB', nl: 'nl-NL', pt: 'pt-BR' };
      const locale = locales[document.documentElement.lang] || 'en-GB';
      return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
  };
}
