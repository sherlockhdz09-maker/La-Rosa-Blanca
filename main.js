(function () {
  "use strict";

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var escHTML = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "] failed:", e); }
  }

  // ---------------------------------------------------------------
  // Config: PIN de administración. Cámbialo aquí si lo deseas.
  // ---------------------------------------------------------------
  var ADMIN_PIN = "0201";
  var STORAGE_KEY = "lodgeConfig_v1";

  var defaults = (window.__LODGE__ && window.__LODGE__.history && window.__LODGE__.donations) ? {
    historyIntro: window.__LODGE__.history.intro,
    historyBody: window.__LODGE__.history.body,
    phone: window.__LODGE__.donations.phone,
    account: window.__LODGE__.donations.account,
    extraGallery: []
  } : {
    historyIntro: "Una hermandad joven, construida sobre columnas milenarias.",
    historyBody: "La Rosa Blanca Lodge #968 reúne a hermanos comprometidos con el aprendizaje, la fraternidad y el servicio a la comunidad.",
    phone: "Pendiente de configurar",
    account: "Pendiente de configurar",
    extraGallery: []
  };

  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }
  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      return true;
    } catch (e) {
      console.warn("No se pudo guardar la configuración:", e);
      return false;
    }
  }

  var state = { config: loadConfig() || Object.assign({}, defaults) };
  if (!state.config.extraGallery) state.config.extraGallery = [];

  // ---------------------------------------------------------------
  // Splash — doble red de seguridad
  // ---------------------------------------------------------------
  function initSplash() {
    var splash = $("#splash");
    if (!splash) return;
    var hide = function () { splash.style.display = "none"; };
    setTimeout(hide, 2200);
    window.addEventListener("load", function () { setTimeout(hide, 400); });
  }

  // ---------------------------------------------------------------
  // Nav scroll state + menú móvil
  // ---------------------------------------------------------------
  function initNav() {
    var nav = $("#nav");
    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 40) nav.classList.add("is-scrolled");
        else nav.classList.remove("is-scrolled");
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    var toggle = $("#navToggle"), menu = $("#mobileMenu"), close = $("#mobileClose");
    if (toggle && menu) {
      var open = function () { menu.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); };
      var closeMenu = function () { menu.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); };
      toggle.addEventListener("click", open);
      if (close) close.addEventListener("click", closeMenu);
      $$("#mobileMenu a").forEach(function (a) { a.addEventListener("click", closeMenu); });
    }
  }

  // ---------------------------------------------------------------
  // Reveal on scroll — threshold bajo + timeout de seguridad
  // ---------------------------------------------------------------
  function initReveals() {
    var items = $$(".reveal");
    if (!items.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });

    // red de seguridad: si algo queda oculto, revélalo igual
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    }, 6000);
  }

  // ---------------------------------------------------------------
  // Año en footer
  // ---------------------------------------------------------------
  function initYear() {
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  // ---------------------------------------------------------------
  // Aplicar configuración guardada al contenido visible
  // ---------------------------------------------------------------
  function applyConfig() {
    var c = state.config;
    var intro = $("#historyIntro"), body = $("#historyBody");
    if (intro && c.historyIntro) intro.textContent = c.historyIntro;
    if (body && c.historyBody) body.textContent = c.historyBody;

    var phone = $("#donatePhone"), account = $("#donateAccount");
    if (phone) phone.textContent = c.phone || defaults.phone;
    if (account) account.textContent = c.account || defaults.account;

    renderExtraGallery();
  }

  function renderExtraGallery() {
    var target = $("#galleryExtra");
    if (!target) return;
    target.innerHTML = "";
    (state.config.extraGallery || []).forEach(function (item, i) {
      var fig = document.createElement("figure");
      fig.className = "gallery-item reveal is-visible";
      fig.innerHTML =
        '<img src="' + item.src + '" alt="' + escHTML(item.alt || "Foto de La Rosa Blanca Lodge #968") + '" loading="lazy">' +
        '<span class="zoom-icon">＋</span>';
      target.appendChild(fig);
    });
    bindGalleryClicks();
    var counter = $("#galleryCount");
    if (counter) {
      var n = (state.config.extraGallery || []).length;
      counter.textContent = n > 0 ? (n + " foto" + (n === 1 ? "" : "s") + " añadida" + (n === 1 ? "" : "s") + " desde el panel.") : "Aún no has añadido fotos personalizadas.";
    }
  }

  // ---------------------------------------------------------------
  // Galería + lightbox
  // ---------------------------------------------------------------
  var lightboxItems = [];
  var lightboxIndex = 0;

  function collectGalleryItems() {
    return $$(".gallery-item img", $("#galleryGrid"));
  }

  function openLightbox(index) {
    lightboxItems = collectGalleryItems();
    lightboxIndex = index;
    var lb = $("#lightbox"), img = $("#lightboxImg"), cap = $("#lightboxCaption");
    if (!lb || !img) return;
    var el = lightboxItems[lightboxIndex];
    if (!el) return;
    img.src = el.getAttribute("src");
    img.alt = el.getAttribute("alt") || "";
    if (cap) cap.textContent = el.getAttribute("alt") || "";
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    var lb = $("#lightbox");
    if (!lb) return;
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function stepLightbox(dir) {
    if (!lightboxItems.length) return;
    lightboxIndex = (lightboxIndex + dir + lightboxItems.length) % lightboxItems.length;
    openLightbox(lightboxIndex);
  }

  function bindGalleryClicks() {
    collectGalleryItems().forEach(function (img, i) {
      var fig = img.closest(".gallery-item");
      if (!fig || fig.dataset.bound) return;
      fig.dataset.bound = "1";
      fig.addEventListener("click", function () {
        openLightbox(collectGalleryItems().indexOf(img));
      });
    });
  }

  function initLightbox() {
    bindGalleryClicks();
    var closeBtn = $("#lightboxClose"), prev = $("#lightboxPrev"), next = $("#lightboxNext"), lb = $("#lightbox");
    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (prev) prev.addEventListener("click", function () { stepLightbox(-1); });
    if (next) next.addEventListener("click", function () { stepLightbox(1); });
    if (lb) lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (!lb || !lb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  // ---------------------------------------------------------------
  // Copiar al portapapeles (teléfono / cuenta)
  // ---------------------------------------------------------------
  function initCopyButtons() {
    $$(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-copy-target");
        var el = document.getElementById(targetId);
        if (!el) return;
        var text = el.textContent.trim();
        var done = function () {
          btn.classList.add("copied");
          showToast("Copiado al portapapeles");
          setTimeout(function () { btn.classList.remove("copied"); }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(done);
        } else {
          done();
        }
      });
    });
  }

  // ---------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------
  var toastTimer = null;
  function showToast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 2600);
  }

  // ---------------------------------------------------------------
  // Panel de configuración (admin)
  // ---------------------------------------------------------------
  var pendingUploads = [];

  function initAdmin() {
    var trigger = $("#settingsTrigger");
    var overlay = $("#adminOverlay");
    var pinScreen = $("#pinScreen");
    var editScreen = $("#editScreen");
    var pinInput = $("#pinInput");
    var pinDots = $$("#pinDots span");
    var pinError = $("#pinError");
    if (!trigger || !overlay) return;

    function resetPinUI() {
      pinInput.value = "";
      pinDots.forEach(function (d) { d.classList.remove("filled"); });
      pinError.textContent = "";
    }

    function openAdmin() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      pinScreen.style.display = "block";
      editScreen.style.display = "none";
      resetPinUI();
      document.body.style.overflow = "hidden";
      setTimeout(function () { pinInput.focus(); }, 250);
    }
    function closeAdmin() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    function unlock() {
      pinScreen.style.display = "none";
      editScreen.style.display = "block";
      fillForm();
    }

    trigger.addEventListener("click", openAdmin);
    $$("[data-close-admin]").forEach(function (b) { b.addEventListener("click", closeAdmin); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeAdmin(); });

    pinInput.addEventListener("input", function () {
      var val = pinInput.value.replace(/\D/g, "").slice(0, 4);
      pinInput.value = val;
      pinDots.forEach(function (d, i) { d.classList.toggle("filled", i < val.length); });
      if (val.length === 4) {
        if (val === ADMIN_PIN) {
          pinError.textContent = "";
          unlock();
        } else {
          pinError.textContent = "PIN incorrecto. Intenta de nuevo.";
          setTimeout(resetPinUI, 500);
        }
      }
    });
    // permitir tocar los puntos para enfocar el input en móvil
    pinDots.forEach(function (d) { d.addEventListener("click", function () { pinInput.focus(); }); });
    $("#pinDots") && $("#pinDots").addEventListener("click", function () { pinInput.focus(); });

    function fillForm() {
      var c = state.config;
      $("#fHistoryIntro").value = c.historyIntro || "";
      $("#fHistoryBody").value = c.historyBody || "";
      $("#fPhone").value = (c.phone && c.phone !== defaults.phone) ? c.phone : "";
      $("#fAccount").value = (c.account && c.account !== defaults.account) ? c.account : "";
      renderUploadPreview();
    }

    function renderUploadPreview() {
      var wrap = $("#uploadPreview");
      wrap.innerHTML = "";
      (state.config.extraGallery || []).forEach(function (item, i) {
        var div = document.createElement("div");
        div.className = "thumb";
        div.innerHTML = '<img src="' + item.src + '" alt=""><button type="button" aria-label="Quitar foto">✕</button>';
        div.querySelector("button").addEventListener("click", function () {
          state.config.extraGallery.splice(i, 1);
          renderUploadPreview();
        });
        wrap.appendChild(div);
      });
    }

    // Subida de fotos
    var uploadZone = $("#uploadZone"), fileInput = $("#fileInput");
    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", function () { fileInput.click(); });
      ["dragover", "dragenter"].forEach(function (evt) {
        uploadZone.addEventListener(evt, function (e) { e.preventDefault(); uploadZone.classList.add("is-drag"); });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        uploadZone.addEventListener(evt, function (e) { e.preventDefault(); uploadZone.classList.remove("is-drag"); });
      });
      uploadZone.addEventListener("drop", function (e) {
        handleFiles(e.dataTransfer && e.dataTransfer.files);
      });
      fileInput.addEventListener("change", function () {
        handleFiles(fileInput.files);
        fileInput.value = "";
      });
    }

    function handleFiles(fileList) {
      if (!fileList || !fileList.length) return;
      Array.prototype.slice.call(fileList).forEach(function (file) {
        if (!/^image\//.test(file.type)) return;
        var reader = new FileReader();
        reader.onload = function () {
          state.config.extraGallery.unshift({ src: reader.result, alt: "Foto de La Rosa Blanca Lodge #968" });
          renderUploadPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    // Guardar
    var saveBtn = $("#saveBtn");
    if (saveBtn) saveBtn.addEventListener("click", function () {
      state.config.historyIntro = $("#fHistoryIntro").value.trim() || defaults.historyIntro;
      state.config.historyBody = $("#fHistoryBody").value.trim() || defaults.historyBody;
      state.config.phone = $("#fPhone").value.trim() || defaults.phone;
      state.config.account = $("#fAccount").value.trim() || defaults.account;
      var ok = saveConfig(state.config);
      applyConfig();
      showToast(ok ? "Cambios guardados en este navegador" : "No se pudo guardar (almacenamiento lleno o bloqueado)");
      closeAdmin();
    });

    // Restablecer
    var resetBtn = $("#resetBtn");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (!confirm("¿Restablecer historia, donaciones y fotos añadidas a los valores originales?")) return;
      state.config = Object.assign({}, defaults, { extraGallery: [] });
      saveConfig(state.config);
      applyConfig();
      fillForm();
      showToast("Valores originales restablecidos");
    });
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function boot() {
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initYear, "initYear");
    safe(applyConfig, "applyConfig");
    safe(initReveals, "initReveals");
    safe(initLightbox, "initLightbox");
    safe(initCopyButtons, "initCopyButtons");
    safe(initAdmin, "initAdmin");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
