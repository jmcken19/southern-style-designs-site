// Southern Style Designs – small behaviours for this site only (the shared parts live in site.js):
// concept banner dismiss, portfolio filter, front-end-only contact form.
(function () {
  var html = document.documentElement;
  try { if (localStorage.getItem('conceptHidden') === '1') html.classList.add('concept-hidden'); } catch (e) { /* storage off */ }

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // Concept banner
    var hide = document.querySelector('[data-concept-hide]');
    if (hide) hide.addEventListener('click', function () {
      html.classList.add('concept-hidden');
      try { localStorage.setItem('conceptHidden', '1'); } catch (e) { /* storage off */ }
    });

    // Portfolio filter
    var buttons = document.querySelectorAll('[data-filter]');
    var works = document.querySelectorAll('[data-works] > li');
    var none = document.querySelector('[data-works-none]');
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter'), shown = 0;
        Array.prototype.forEach.call(buttons, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        Array.prototype.forEach.call(works, function (li) {
          var on = f === 'all' || li.getAttribute('data-cat') === f;
          li.hidden = !on; if (on) shown++;
        });
        if (none) none.hidden = shown > 0;
      });
    });

    // Contact form: not connected yet (concept preview) – check the fields, then say so.
    var form = document.querySelector('[data-demo-form]');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var msg = form.querySelector('[data-demo-msg]');
      if (msg) { msg.hidden = false; msg.classList.add('is-ok'); }
      form.reset();
    });
  });
})();
