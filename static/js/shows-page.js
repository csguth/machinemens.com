// Alpine component for the /shows/ agenda page.
// Fetches data/shows.json and splits shows into "upcoming" (today or later)
// and "past", sorted chronologically (upcoming ascending, past descending).
function showsPage() {
  return {
    upcoming: [],
    past: [],
    async init() {
      const res = await fetch('/data/shows.json');
      const shows = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      this.upcoming = shows
        .filter(show => show.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      this.past = shows
        .filter(show => show.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    formatDate(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const locales = { en: 'en-GB', nl: 'nl-NL', pt: 'pt-BR' };
      const locale = locales[document.documentElement.lang] || 'en-GB';
      return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
  };
}
