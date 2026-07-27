// Alpine component for the /music/ discography page.
// Fetches data/releases.json and renders each release with a "Listen/Get"
// toggle that reveals per-album store links (currently Spotify only; more
// stores are added by extending the "stores" object per release in the JSON).
function musicPage() {
  const storeLabels = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    youtubeMusic: 'YouTube Music',
    deezer: 'Deezer',
    bandcamp: 'Bandcamp'
  };

  return {
    releases: [],
    async init() {
      const res = await fetch('/data/releases.json');
      this.releases = await res.json();
    },
    storeLabel(key) {
      return storeLabels[key] || key;
    }
  };
}
