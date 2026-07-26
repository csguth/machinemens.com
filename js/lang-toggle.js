// Shared Alpine component for the EN/NL bilingual toggle, used on <body>:
// x-data="langToggle()" x-init="init()".
// Reads/writes the shared localStorage key 'machinemens_lang' and toggles the
// 'show-nl' class on <body>, which css/site.css uses to show/hide .en/.nl spans.
function langToggle() {
  return {
    lang: localStorage.getItem('machinemens_lang') || (navigator.language.startsWith('nl') ? 'nl' : 'en'),
    init() {
      document.body.classList.toggle('show-nl', this.lang === 'nl');
      document.documentElement.lang = this.lang;
      this.$watch('lang', val => {
        document.body.classList.toggle('show-nl', val === 'nl');
        document.documentElement.lang = val;
        localStorage.setItem('machinemens_lang', val);
      });
    }
  };
}