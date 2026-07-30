// Root redirect for "/" (bare domain). Because the site is multilingual with
// defaultContentLanguageInSubdir=true, there is no content at the root — every
// language lives under /en/, /nl/ or /pt/. This script picks the best language
// for the visitor and redirects there:
//   1. their previously saved preference (localStorage.machinemens_lang), else
//   2. their browser language (navigator languages), else
//   3. English as the fallback.
(function () {
  var supported = ['en', 'nl', 'pt'];

  function fromStorage() {
    try {
      var saved = localStorage.getItem('machinemens_lang');
      if (saved && supported.indexOf(saved) !== -1) return saved;
    } catch (e) { /* ignore */ }
    return null;
  }

  function fromBrowser() {
    var langs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var code = (langs[i] || '').slice(0, 2).toLowerCase();
      if (supported.indexOf(code) !== -1) return code;
    }
    return null;
  }

  var lang = fromStorage() || fromBrowser() || 'en';
  window.location.replace('/' + lang + '/');
})();
