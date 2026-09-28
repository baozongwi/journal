(function () {
  var cache = new Map();
  var appliedKey = location.pathname + location.search;
  var progressEl = null;
  var progressTimer = 0;
  var HUGE = 200000;

  function sameOrigin(href) {
    try {
      return new URL(href, location.href).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  function canonPath(path) {
    if (!path) return "/";
    if (path.length > 1 && path.charAt(path.length - 1) !== "/") return path + "/";
    return path;
  }

  function urlKey(href) {
    var u = new URL(href, location.href);
    return canonPath(u.pathname) + u.search;
  }

  function showProgress() {
    if (!progressEl) {
      progressEl = document.createElement("div");
      progressEl.className = "nav-progress";
      progressEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(progressEl);
    }
    progressEl.classList.add("nav-progress--on");
  }

  function hideProgress() {
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = 0;
    }
    if (progressEl) progressEl.classList.remove("nav-progress--on");
  }

  function hashId(hash) {
    if (!hash || hash === "#") return "";
    try {
      return decodeURIComponent(hash.replace(/^#/, ""));
    } catch (e) {
      return hash.replace(/^#/, "");
    }
  }

  function scrollToHash(hash) {
    var id = hashId(hash);
    if (!id) {
      window.scrollTo(0, 0);
      return;
    }
    var el = document.getElementById(id);
    if (!el) {
      window.scrollTo(0, 0);
      return;
    }
    el.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function prefetch(url) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    var p = fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).then(function (html) {
      cache.set(url, html);
      return html;
    }).catch(function (err) {
      cache.delete(url);
      throw err;
    });
    cache.set(url, p);
    return p;
  }

  function runScripts(root) {
    var scripts = root.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      var s = document.createElement("script");
      if (old.src) s.src = old.src;
      else s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    }
  }

  function adoptAssets(doc) {
    var links = doc.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (href && !document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) {
        document.head.appendChild(links[i].cloneNode(true));
      }
    }
    var scripts = doc.querySelectorAll("script[src]");
    for (var j = 0; j < scripts.length; j++) {
      var src = scripts[j].getAttribute("src");
      if (!src || src.indexOf("nav-transition") !== -1) continue;
      if (document.querySelector('script[src="' + src + '"]')) continue;
      var s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = function () {
        if (typeof window.SUEnhanceArticle === "function") window.SUEnhanceArticle();
      };
      document.body.appendChild(s);
    }
  }

  function renderMath() {
    if (typeof renderMathInElement !== "function") return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\begin{equation}", right: "\\end{equation}", display: true },
        { left: "\\begin{align}", right: "\\end{align}", display: true },
        { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
        { left: "\\begin{gather}", right: "\\end{gather}", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
      ]
    });
  }

  function apply(html, url) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var newMain = doc.querySelector("main");
    var curMain = document.querySelector("main");
    var newShell = doc.querySelector(".page-shell");
    var curShell = document.querySelector(".page-shell");
    var newNav = doc.querySelector(".site-nav__list");
    var curNav = document.querySelector(".site-nav__list");
    if (!newMain || !curMain) throw new Error("missing main");

    document.title = doc.title;
    adoptAssets(doc);
    if (curShell && newShell) curShell.className = newShell.className;
    if (curNav && newNav) curNav.innerHTML = newNav.innerHTML;
    curMain.replaceWith(newMain);
    runScripts(newMain);
    if (typeof window.SUEnhanceArticle === "function") window.SUEnhanceArticle();
    appliedKey = urlKey(url);
    var hash = "";
    try { hash = new URL(url, location.href).hash; } catch (e) {}
    requestAnimationFrame(function () {
      scrollToHash(hash);
    });
    renderMath();
  }

  function swap(html, url, push) {
    var run = function () { apply(html, url); };
    var huge = typeof html === "string" && html.length > HUGE;
    if (!huge && document.startViewTransition) {
      var vt = document.startViewTransition(run);
      if (vt && vt.finished) {
        vt.finished.catch(function () {}).then(function () {
          var hash = "";
          try { hash = new URL(url, location.href).hash; } catch (e) {}
          if (hash) scrollToHash(hash);
        });
      }
    } else {
      run();
    }
    if (push) history.pushState({ suNav: 1 }, "", url);
  }

  function go(url, push) {
    var hit = cache.get(url);
    if (typeof hit === "string") {
      swap(hit, url, push);
      return;
    }
    if (hit && typeof hit.then === "function") {
      progressTimer = setTimeout(showProgress, 140);
      hit.then(function (html) {
        hideProgress();
        swap(html, url, push);
      }).catch(function () {
        hideProgress();
        location.href = url;
      });
      return;
    }
    location.href = url;
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    var raw = a.getAttribute("href");
    if (!raw || raw === "#" || raw.indexOf("mailto:") === 0 || raw.indexOf("javascript:") === 0) return;
    var url = a.href;
    if (!sameOrigin(url)) return;
    var next;
    try { next = new URL(url); } catch (err) { return; }
    if (urlKey(next.href) === urlKey(location.href)) {
      if (next.hash) {
        e.preventDefault();
        if (next.hash !== location.hash) history.pushState({ suNav: 1 }, "", next.href);
        scrollToHash(next.hash);
      } else {
        e.preventDefault();
      }
      return;
    }
    var hit = cache.get(url);
    if (typeof hit !== "string" && !(hit && typeof hit.then === "function")) {
      return;
    }
    e.preventDefault();
    go(url, true);
  });

  document.addEventListener("mouseover", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    if (!sameOrigin(a.href)) return;
    var next;
    try { next = new URL(a.href); } catch (err) { return; }
    if (urlKey(next.href) === urlKey(location.href)) return;
    prefetch(a.href);
  }, { passive: true });

  window.addEventListener("popstate", function () {
    if (urlKey(location.href) === appliedKey) {
      scrollToHash(location.hash);
      return;
    }
    go(location.href, false);
  });
})();
