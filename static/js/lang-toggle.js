// Shared Alpine component for the EN/NL/PT trilingual toggle, used on <body>:
// x-data="langToggle()" x-init="init()".
// Reads/writes the shared localStorage key 'machinemens_lang' and sets the
// 'data-lang' attribute on <body>, which css/site.css uses to show/hide
// .en/.nl/.pt spans.
function langToggle() {
  function detect() {
    if (navigator.language.startsWith('pt')) return 'pt';
    if (navigator.language.startsWith('nl')) return 'nl';
    return 'en';
  }
  return {
    lang: localStorage.getItem('machinemens_lang') || detect(),
    init() {
      document.body.setAttribute('data-lang', this.lang);
      document.documentElement.lang = this.lang;
      this.$watch('lang', val => {
        document.body.setAttribute('data-lang', val);
        document.documentElement.lang = val;
        localStorage.setItem('machinemens_lang', val);
      });
    }
  };
}