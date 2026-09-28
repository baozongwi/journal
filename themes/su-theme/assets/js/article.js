(function () {
  function bindCopyButtons() {
    var nodes = document.querySelectorAll(".article__content .highlight, .article__content > pre");
    for (var i = 0; i < nodes.length; i++) {
      var block = nodes[i];
      var host = block;
      if (block.tagName === "PRE") {
        if (block.parentNode && block.parentNode.classList.contains("highlight")) continue;
        var wrap = document.createElement("div");
        wrap.className = "highlight";
        block.parentNode.insertBefore(wrap, block);
        wrap.appendChild(block);
        host = wrap;
      }
      if (host.querySelector(".code-copy-btn")) continue;

      var btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code");
      btn.textContent = "Copy";
      btn.addEventListener("click", (function (b, copyBtn) {
        return function (e) {
          e.preventDefault();
          e.stopPropagation();
          var code = b.querySelector("code");
          var text = code ? code.textContent : b.textContent;
          navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = "Copied";
            copyBtn.classList.add("code-copy-btn--copied");
            setTimeout(function () {
              copyBtn.textContent = "Copy";
              copyBtn.classList.remove("code-copy-btn--copied");
            }, 1600);
          });
        };
      })(host, btn));
      host.appendChild(btn);
    }
  }

  function closeLightbox() {
    var box = document.querySelector(".image-lightbox");
    if (!box) return;
    document.removeEventListener("keydown", onLightboxKey);
    box.remove();
    document.body.classList.remove("image-lightbox-open");
  }

  function onLightboxKey(e) {
    if (e.key === "Escape") closeLightbox();
  }

  function bindLightbox() {
    if (document.documentElement.dataset.suLightbox === "1") return;
    document.documentElement.dataset.suLightbox = "1";
    document.addEventListener("click", function (e) {
      var img = e.target.closest && e.target.closest("img.blog-post__image[data-fullsrc]");
      if (!img) return;
      var src = img.getAttribute("data-fullsrc");
      if (!src || src.charAt(0) !== "/" || src.charAt(1) === "/") return;
      e.preventDefault();
      closeLightbox();
      var box = document.createElement("div");
      box.className = "image-lightbox";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "Image preview");
      var full = document.createElement("img");
      full.src = src;
      full.alt = img.alt || "";
      box.appendChild(full);
      box.addEventListener("click", closeLightbox);
      document.body.appendChild(box);
      document.body.classList.add("image-lightbox-open");
      document.addEventListener("keydown", onLightboxKey);
    });
  }

  function init() {
    bindCopyButtons();
    bindLightbox();
  }

  window.SUEnhanceArticle = init;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
