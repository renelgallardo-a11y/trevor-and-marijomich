/* ==========================================================================
   aos.js — scroll-triggered entrance animations
   --------------------------------------------------------------------------
   A small self-contained engine for the effects declared in css/aos.css.
   It reads the data-aos-* attributes, watches each element with an
   IntersectionObserver, and adds the .aos-animate class when the element
   reaches the viewport.

   Supported attributes
     data-aos              the effect name, required to take part
     data-aos-delay        ms to wait before animating   (default 0)
     data-aos-duration     ms the animation takes        (default 1200)
     data-aos-offset       how far into the viewport the
                           element must travel, in px    (default 120)
     data-aos-once         "true" to stay animated for good,
                           "false" (the default) to replay
                           every time the element scrolls back in
     data-aos-easing       a transition timing curve; see
                           css/aos.css for the names

   Replaying: by default an element animates in, and the class is removed
   again as it leaves the viewport. Scrolling back up therefore replays the
   entrance instead of leaving the element sitting in its final state.
   Put data-aos-once="true" on a heading you would rather not see repeat.

   Exposed on window so the page can re-measure after fonts or images land:
     AOS.refresh()
   ========================================================================== */

(function () {
  'use strict';

  const DEFAULTS = {
    duration: 1200,
    delay: 0,
    offset: 120,
    once: false,
    easing: null
  };

  const EASINGS = {
    linear: 'cubic-bezier(.25,.25,.75,.75)',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    'linear-out': 'cubic-bezier(0,0,.2,1)',
    'ease-out-back': 'cubic-bezier(.175,.885,.32,1.275)',
    'ease-in-out-back': 'cubic-bezier(.68,-.55,.265,1.55)',
    'ease-out-sine': 'cubic-bezier(.39,.575,.565,1)',
    'ease-in-out-sine': 'cubic-bezier(.445,.05,.55,.95)',
    'ease-out-quad': 'cubic-bezier(.25,.46,.45,.94)',
    'ease-out-cubic': 'cubic-bezier(.215,.61,.355,1)',
    'ease-in-out-cubic': 'cubic-bezier(.455,.03,.515,.955)'
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* element -> its settings, so the observer callback stays cheap */
  const records = new Map();
  let observer = null;

  function readNumber(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readBool(value, fallback) {
    if (value == null) return fallback;
    return String(value).toLowerCase() !== 'false';
  }

  function prepare(element) {
    const name = element.getAttribute('data-aos');
    if (!name) return null;

    const record = {
      element,
      delay: readNumber(element.getAttribute('data-aos-delay'), DEFAULTS.delay),
      duration: readNumber(element.getAttribute('data-aos-duration'), DEFAULTS.duration),
      offset: readNumber(element.getAttribute('data-aos-offset'), DEFAULTS.offset),
      once: readBool(element.getAttribute('data-aos-once'), DEFAULTS.once)
    };

    element.style.setProperty('--aos-delay', record.delay + 'ms');
    element.style.setProperty('--aos-duration', record.duration + 'ms');

    const easing = element.getAttribute('data-aos-easing');
    if (easing && EASINGS[easing]) {
      element.style.setProperty('--aos-easing', EASINGS[easing]);
    }

    return record;
  }

  function onIntersect(entries) {
    entries.forEach(function (entry) {
      const record = records.get(entry.target);
      if (!record) return;

      if (entry.isIntersecting) {
        record.element.classList.add('aos-animate');
        /* keep watching when it should replay, otherwise stand down */
        if (record.once && observer) observer.unobserve(record.element);
      } else if (!record.once) {
        /* leaving the viewport resets it, ready to play again */
        record.element.classList.remove('aos-animate');
      }
    });
  }

  function build() {
    if (observer) observer.disconnect();
    records.clear();

    const elements = Array.prototype.slice.call(document.querySelectorAll('[data-aos]'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach(function (element) {
        prepare(element);
        element.classList.add('aos-animate');
      });
      return;
    }

    elements.forEach(function (element) {
      const record = prepare(element);
      if (record) records.set(element, record);
    });

    observer = new IntersectionObserver(onIntersect, {
      /* a negative bottom margin pulls the trigger line up by the default
         offset, so an element animates just after it appears */
      rootMargin: '0px 0px -' + DEFAULTS.offset + 'px 0px',
      threshold: 0.01
    });

    records.forEach(function (record) { observer.observe(record.element); });
  }

  const AOS = {
    /* Re-reads the document. Call after late-loading images change heights. */
    refresh: build,

    init: function () {
      if (reduceMotion) document.body.classList.add('aos-disabled');
      build();

      /* Fonts and images can shift layout after first paint, so re-measure
         once everything has settled. */
      window.addEventListener('load', function () { build(); });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { build(); });
      }
    }
  };

  window.AOS = AOS;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AOS.init);
  } else {
    AOS.init();
  }
}());
