/* Urmia Works — landing interactions
   Vanilla JS, no dependencies. Progressive enhancement only. */
(function () {
  "use strict";

  // Current year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Sticky header shadow on scroll
  var header = document.getElementById("header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  var toggle = document.getElementById("menuToggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Reveal-on-scroll
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // Notify form
  var form = document.getElementById("notifyForm");
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("notifyBtn");
  var emailInput = document.getElementById("emailInput");

  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg;
    status.className = "form-status" + (kind ? " " + kind : "");
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (emailInput && emailInput.value || "").trim();
      var honeypot = (form.querySelector('input[name="website"]') || {}).value || "";

      // Basic validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("Please enter a valid email address.", "err");
        return;
      }
      // Bot caught in honeypot — pretend success, do nothing
      if (honeypot) {
        setStatus("Thanks! We'll be in touch.", "ok");
        form.reset();
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      setStatus("");

      // Opens the visitor's mail app addressed to support@urmiaworks.com so the
      // sign-up reaches the live mailbox even when no server sender is configured.
      function mailtoFallback() {
        setStatus("Almost there — opening your email app to finish.", "ok");
        var subject = encodeURIComponent("Notify me at launch");
        var body = encodeURIComponent("Please add me to the launch list: " + email);
        window.location.href =
          "mailto:support@urmiaworks.com?subject=" + subject + "&body=" + body;
        form.reset();
      }

      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, source: "landing" })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad status " + res.status);
          return res.json().catch(function () { return {}; });
        })
        .then(function (data) {
          // Only claim success when the server actually delivered the email.
          if (data && data.delivered) {
            setStatus("You're on the list. We'll be in touch. 🎉", "ok");
            form.reset();
          } else {
            mailtoFallback();
          }
        })
        .catch(function () {
          // Endpoint missing/unreachable — still reach support@ via mail client.
          mailtoFallback();
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = "Notify me"; }
        });
    });
  }
})();
