/* =========================================================
   Termpolis — image lightbox
   Any element with [data-lightbox="<src>"] opens that image
   full-size in a modal. Optional [data-lightbox-alt] sets the
   alt text. Shared by the landing page and the docs page.
   No build step. Pure vanilla JS.
   ========================================================= */
(function () {
  var overlay = null, frame = null, imgEl = null, closeBtn = null, lastFocus = null;

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "lightbox";
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Full-size screenshot");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close full-size view">×</button>' +
      '<div class="lightbox-frame"><img alt=""></div>' +
      '<span class="lightbox-hint" aria-hidden="true">Esc or tap outside to close</span>';
    document.body.appendChild(overlay);
    frame = overlay.querySelector(".lightbox-frame");
    imgEl = overlay.querySelector(".lightbox-frame img");
    closeBtn = overlay.querySelector(".lightbox-close");

    overlay.addEventListener("click", function (e) {
      if (!frame.contains(e.target)) close();
    });
    closeBtn.addEventListener("click", close);
  }

  function open(src, alt) {
    if (!src) return;
    build();
    lastFocus = document.activeElement;
    imgEl.setAttribute("src", src);
    imgEl.setAttribute("alt", alt || "");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    if (frame) frame.scrollTop = 0;
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    if (imgEl) imgEl.setAttribute("src", "");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function isOpen() {
    return overlay && overlay.classList.contains("is-open");
  }

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { close(); return; }
    // Only the close button is focusable inside — keep focus trapped on it.
    if (e.key === "Tab") { e.preventDefault(); if (closeBtn) closeBtn.focus(); }
  });

  // Delegated trigger so it works for any current or future [data-lightbox].
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest ? e.target.closest("[data-lightbox]") : null;
    if (!trigger) return;
    e.preventDefault();
    open(trigger.getAttribute("data-lightbox"), trigger.getAttribute("data-lightbox-alt"));
  });
})();
