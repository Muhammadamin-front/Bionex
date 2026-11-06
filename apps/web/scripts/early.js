/* Inlined into the <head> of the prerendered main page (scripts/prerender.mjs, with its hash in the CSP).
   Records what the visitor does before the page's own script has arrived: see src/lib/early.ts. */
(function () {
  var e = (window.__bxEarly = { first: 0, keys: 0, pasted: false, taps: 0, synthetic: 0, autofill: [], submit: null, done: false, ready: false });
  var d = document;
  // The drawn form's fields are read-only until the page's script has taken over. This script counts
  // the typing that script would count, so it may open them; if it never runs, they wait as before.
  // It runs in <head>, before the page is parsed (on slow 3G the form showed before the end of the page
  // had arrived, and a letter typed then was lost): a field opens the moment a finger or focus reaches
  // it, and all of them once the page is parsed.
  function open(t) {
    if (!e.ready && t && t.readOnly && (t.name === 'zn-customer' || t.name === 'zn-number') && formOf(t)) t.readOnly = false;
  }
  function openAll() {
    var f = d.querySelectorAll('#root form input[name="zn-customer"], #root form input[name="zn-number"]');
    for (var k = 0; k < f.length; k++) open(f[k]);
    return f.length;
  }
  d.addEventListener('focusin', function (ev) { open(ev.target); }, true);
  d.addEventListener('touchstart', function (ev) { open(ev.target); }, { capture: true, passive: true });
  d.addEventListener('mousedown', function (ev) { open(ev.target); }, true);
  // Each field opens as the page is parsed (DOMContentLoaded would wait for the page's own script).
  var mo = typeof MutationObserver === 'function' ? new MutationObserver(function () { if (openAll() >= 4) mo.disconnect(); }) : null;
  if (mo) mo.observe(d.documentElement, { childList: true, subtree: true });
  d.addEventListener('readystatechange', function () {
    if (d.readyState === 'loading') return;
    openAll();
    if (mo) mo.disconnect();
  });
  function formOf(t) {
    return t && t.closest ? t.closest('#root form') : null;
  }
  function digits(t) {
    return (t.value || '').replace(/\D/g, '').length;
  }
  function wantSend(f) {
    e.submit = f;
    var b = f.querySelector('button');
    if (b) b.setAttribute('data-wait', '');
  }
  d.addEventListener(
    'input',
    function (ev) {
      var t = ev.target;
      var type = ev.inputType || '';
      var typed = type === 'insertText' || type === 'deleteContentBackward' || type === 'insertFromPaste';
      if (!e.done) {
        e.first = e.first || performance.now();
        if (type === 'insertText' || type === 'deleteContentBackward') e.keys++;
        else if (type === 'insertFromPaste') e.pasted = true;
      }
      if (e.ready || !t || t.name !== 'zn-number') return;
      var i = e.autofill.indexOf(t);
      if (typed) {
        if (i >= 0) e.autofill.splice(i, 1);
      } else if (digits(t) - (t.__bxDigits || 0) >= 5 && i < 0) e.autofill.push(t);
      t.__bxDigits = digits(t);
    },
    true,
  );
  d.addEventListener(
    typeof PointerEvent === 'function' ? 'pointerdown' : 'touchstart',
    function (ev) {
      open(ev.target);
      if (e.done) return;
      if (ev.isTrusted) e.taps++;
      else e.synthetic++;
    },
    true,
  );
  d.addEventListener(
    'click',
    function (ev) {
      if (!e.done && !ev.isTrusted) e.synthetic++;
      if (e.ready) return;
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      var f = formOf(b);
      if (f) wantSend(f);
    },
    true,
  );
  d.addEventListener(
    'keydown',
    function (ev) {
      if (e.ready || ev.key !== 'Enter') return;
      var f = formOf(ev.target);
      if (!f || ev.target.tagName !== 'INPUT') return;
      ev.preventDefault();
      // «Next» on the name goes to the number; «send» on the number sends.
      var next = ev.target.name === 'zn-customer' ? f.querySelector('input[name="zn-number"]') : null;
      if (next) next.focus();
      else wantSend(f);
    },
    true,
  );
  d.addEventListener(
    'submit',
    function (ev) {
      if (e.ready) return;
      var f = formOf(ev.target);
      if (!f) return;
      ev.preventDefault();
      wantSend(f);
    },
    true,
  );
})();
