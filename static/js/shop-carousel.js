// Minimal, dependency-free carousel for the homepage "Merch" teaser
// (index.html #shop-carousel-track). Native CSS scroll-snap already gives
// swipe/scroll support for free — this script keeps the dot indicators in
// sync, wires up the prev/next buttons + arrow-key navigation, and
// auto-advances the slides on a timer (pausing while the user is
// hovering/touching/focusing the carousel, or has reduced-motion set).
(function () {
  const track = document.getElementById('shop-carousel-track');
  const dotsContainer = document.getElementById('shop-carousel-dots');
  const prevBtn = document.getElementById('shop-carousel-prev');
  const nextBtn = document.getElementById('shop-carousel-next');
  if (!track || !dotsContainer) return;

  const AUTOPLAY_DELAY_MS = 5000;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slides = Array.from(track.children);
  if (slides.length === 0) return;

  const dots = slides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Slide ' + (index + 1) + ' / ' + slides.length);
    dot.className = 'rounded-full transition-all h-2 w-2 bg-cream/50 ring-1 ring-black/20';
    dot.addEventListener('click', () => scrollToSlide(index));
    dotsContainer.appendChild(dot);
    return dot;
  });

  function scrollToSlide(index) {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    slides[clamped].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  function currentActiveIndex() {
    const found = dots.findIndex((dot) => dot.getAttribute('aria-selected') === 'true');
    return found === -1 ? 0 : found;
  }

  function setActiveDot(index) {
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('bg-cream', active);
      dot.classList.toggle('w-6', active);
      dot.classList.toggle('bg-cream/50', !active);
      dot.classList.toggle('w-2', !active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    // Hide the prev arrow on the first slide and the next arrow on the last —
    // there's nowhere to go, so the control shouldn't be there.
    if (prevBtn) prevBtn.classList.toggle('hidden', index <= 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', index >= slides.length - 1);
  }

  // Keeps the active dot in sync while the user swipes/drags the track
  // directly, not just when using the prev/next buttons or dots.
  const observer = new IntersectionObserver(
    (entries) => {
      const mostVisible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!mostVisible) return;
      const index = slides.indexOf(mostVisible.target);
      if (index !== -1) setActiveDot(index);
    },
    { root: track, threshold: 0.6 }
  );
  slides.forEach((slide) => observer.observe(slide));

  if (prevBtn) prevBtn.addEventListener('click', () => { scrollToSlide(currentActiveIndex() - 1); restartAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { scrollToSlide(currentActiveIndex() + 1); restartAutoplay(); });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollToSlide(currentActiveIndex() + 1);
      restartAutoplay();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollToSlide(currentActiveIndex() - 1);
      restartAutoplay();
    }
  });

  // Autoplay: advance one slide at a time, looping back to the start after
  // the last one. Paused (not just reset) while the pointer/keyboard focus
  // is on the carousel so it never fights a user mid-swipe, and disabled
  // entirely for prefers-reduced-motion.
  let autoplayTimer = null;

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    if (prefersReducedMotion || slides.length < 2) return;
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      const next = (currentActiveIndex() + 1) % slides.length;
      scrollToSlide(next);
    }, AUTOPLAY_DELAY_MS);
  }

  function restartAutoplay() {
    startAutoplay();
  }

  ['pointerenter', 'focusin'].forEach((evt) => track.addEventListener(evt, stopAutoplay));
  ['pointerleave', 'focusout'].forEach((evt) => track.addEventListener(evt, startAutoplay));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  setActiveDot(0);
  startAutoplay();
})();
