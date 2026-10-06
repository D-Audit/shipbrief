/*!
 * ShipBrief "What's new" widget loader.
 *
 *   <script>
 *     (function (w) { w.ShipBrief = w.ShipBrief || function () { (w.ShipBrief.q = w.ShipBrief.q || []).push(arguments); }; })(window);
 *     ShipBrief("init", { key: "sb_…", user: { id, email, name, plan, tags }, userHash: "…" });
 *   </script>
 *   <script async src="https://<shipbrief>/widget.js"></script>
 *
 * init options: key (required), user + userHash (signed-in user), theme ("light" | "dark"),
 * launcher: false (hide the floating button and open the feed from your own control).
 * Commands: init, identify(user, userHash), logout, open, close, toggle, on(event, callback).
 * Events: ready, open, close, unread (count).
 * Any element with data-shipbrief-toggle opens the feed; elements with data-shipbrief-badge show the unread count.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || (window.ShipBrief && window.ShipBrief.loaded)) return;

  var script =
    document.currentScript ||
    Array.prototype.slice.call(document.getElementsByTagName("script")).filter(function (s) { return /\/widget\.js(\?|$)/.test(s.src); })[0];
  var ORIGIN = script ? new URL(script.src, location.href).origin : location.origin;
  var Z = 2147483000;

  var state = {
    key: null,
    theme: null,
    hideLauncher: false,
    identity: null, // { user, userHash } waiting to be sent, or the last one sent
    frame: null,
    frameReady: false,
    root: null,
    launcher: null,
    badge: null,
    panel: null,
    config: null,
    open: false,
    unread: 0,
    listeners: {},
  };

  function warn(message) {
    if (window.console && console.warn) console.warn("[ShipBrief] " + message);
  }

  function emit(event, payload) {
    (state.listeners[event] || []).forEach(function (callback) {
      try { callback(payload); } catch (error) { warn("A '" + event + "' listener threw: " + (error && error.message)); }
    });
  }

  function post(message) {
    if (state.frame && state.frameReady && state.frame.contentWindow) state.frame.contentWindow.postMessage(message, ORIGIN);
  }

  /** Ink or white, whichever reads better on the workspace's accent colour. */
  function textOn(hex) {
    var clean = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(clean)) return "#ffffff";
    var lum = [0, 2, 4].map(function (i) {
      var c = parseInt(clean.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] > 0.18 ? "#171717" : "#ffffff";
  }

  var STYLE =
    ":host{all:initial}" +
    ".launcher{position:fixed;bottom:20px;z-index:" + Z + ";display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:0;border-radius:999px;" +
    "font:500 14px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);transition:transform .15s ease}" +
    ".launcher:hover{transform:translateY(-1px)}.launcher:focus-visible{outline:2px solid currentColor;outline-offset:3px}" +
    ".launcher svg{width:16px;height:16px}" +
    ".badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}" +
    ".badge[hidden]{display:none}" +
    ".panel{position:fixed;bottom:72px;z-index:" + Z + ";width:380px;height:min(620px,calc(100vh - 96px));border-radius:14px;overflow:hidden;" +
    "box-shadow:0 18px 60px rgba(0,0,0,.28);opacity:0;transform:translateY(8px);pointer-events:none;visibility:hidden;transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s}" +
    ".panel.manual{bottom:20px;height:min(620px,calc(100vh - 40px))}" +
    ".panel.open{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity .16s ease,transform .16s ease}" +
    ".panel iframe{width:100%;height:100%;border:0;display:block;background:transparent;color-scheme:normal}" +
    ".right{right:20px}.left{left:20px}" +
    "@media (max-width:480px){.panel{inset:0;width:auto;height:100%;border-radius:0;bottom:0}.panel.manual{height:100%}.launcher.is-open{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.launcher,.panel{transition:none}}";

  var BELL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/></svg>';

  function mount() {
    if (state.root) return;
    var host = document.createElement("div");
    host.setAttribute("data-shipbrief", "");
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);

    var panel = document.createElement("div");
    panel.className = "panel right";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "What's new");
    var frame = document.createElement("iframe");
    var src = ORIGIN + "/embed/whats-new?mode=panel&key=" + encodeURIComponent(state.key);
    if (state.theme) src += "&theme=" + encodeURIComponent(state.theme);
    frame.src = src;
    frame.title = "What's new";
    frame.setAttribute("allow", "clipboard-write");
    panel.appendChild(frame);
    root.appendChild(panel);

    (document.body || document.documentElement).appendChild(host);
    state.root = root;
    state.panel = panel;
    state.frame = frame;
  }

  function renderLauncher() {
    var config = state.config;
    if (!config || !state.root) return;
    var side = config.placement === "bottom-left" ? "left" : "right";
    var manual = config.launcherMode === "manual" || state.hideLauncher;
    state.panel.className = "panel " + side + (manual ? " manual" : "") + (state.open ? " open" : "");
    if (manual) return;
    if (!state.launcher) {
      var button = document.createElement("button");
      button.type = "button";
      button.innerHTML = BELL + "<span>What's new</span>";
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.hidden = true;
      button.appendChild(badge);
      button.addEventListener("click", toggle);
      state.root.appendChild(button);
      state.launcher = button;
      state.badge = badge;
    }
    state.launcher.className = "launcher " + side + (state.open ? " is-open" : "");
    state.launcher.style.background = config.accentColor;
    state.launcher.style.color = textOn(config.accentColor);
    state.launcher.setAttribute("aria-expanded", String(state.open));
    updateBadges();
  }

  function updateBadges() {
    var count = state.unread;
    var show = count > 0 && (!state.config || state.config.showUnreadBadge !== false);
    var label = count > 9 ? "9+" : String(count);
    if (state.badge) {
      state.badge.hidden = !show;
      state.badge.textContent = label;
    }
    if (state.launcher) state.launcher.setAttribute("aria-label", "What's new" + (count ? ", " + count + " unread" : ""));
    Array.prototype.forEach.call(document.querySelectorAll("[data-shipbrief-badge]"), function (el) {
      el.textContent = show ? label : "";
      el.hidden = !show;
    });
  }

  function setOpen(open) {
    if (!state.panel) return warn("Call ShipBrief('init', { key }) before opening the widget.");
    if (state.open === open) return;
    state.open = open;
    state.panel.classList.toggle("open", open);
    if (state.launcher) {
      state.launcher.setAttribute("aria-expanded", String(open));
      state.launcher.classList.toggle("is-open", open);
    }
    post({ sb: open ? "opened" : "closed" });
    if (open && state.frame) state.frame.focus();
    if (!open && state.launcher) state.launcher.focus();
    emit(open ? "open" : "close");
  }

  function toggle() { setOpen(!state.open); }

  function sendIdentity() {
    if (!state.identity) return;
    post({ sb: "identify", user: state.identity.user, userHash: state.identity.userHash });
  }

  function identify(user, userHash) {
    if (!user || user.id === undefined || user.id === null || user.id === "") return warn("identify() needs a user with an id.");
    if (!userHash) {
      return warn(
        "identify() needs userHash = HMAC-SHA256(identity secret, user.id), computed on your server. " +
          "Without it the widget stays anonymous and the user is not added to your email contacts.",
      );
    }
    state.identity = { user: user, userHash: String(userHash) };
    sendIdentity();
  }

  function logout() {
    state.identity = null;
    post({ sb: "logout" });
  }

  function init(options) {
    options = options || {};
    if (state.key) return warn("init() was already called; use identify() to change the user.");
    if (!options.key) return warn("init() needs your widget key (Widget install → Project ID).");
    state.key = String(options.key);
    if (options.theme === "light" || options.theme === "dark") state.theme = options.theme;
    if (options.launcher === false) state.hideLauncher = true;
    if (options.user) identify(options.user, options.userHash);
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }

  function on(event, callback) {
    if (typeof callback !== "function") return;
    (state.listeners[event] = state.listeners[event] || []).push(callback);
    if (event === "ready" && state.frameReady) callback();
    if (event === "unread" && state.frameReady) callback(state.unread);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN || !state.frame || event.source !== state.frame.contentWindow) return;
    var data = event.data || {};
    switch (data.sb) {
      case "ready":
        state.frameReady = true;
        state.config = data.config || null;
        renderLauncher();
        sendIdentity();
        emit("ready");
        break;
      case "unread":
        state.unread = Math.max(0, Number(data.count) || 0);
        updateBadges();
        emit("unread", state.unread);
        break;
      case "close":
        setOpen(false);
        break;
      case "identify-failed":
        warn(data.message || "The signed-in user couldn't be identified.");
        break;
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.open) setOpen(false);
  });
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-shipbrief-toggle]") : null;
    if (target) {
      event.preventDefault();
      toggle();
    }
  });

  var commands = {
    init: init,
    identify: identify,
    logout: logout,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: toggle,
    on: on,
  };

  function run(args) {
    var name = args[0];
    var command = commands[name];
    if (!command) return warn("Unknown command '" + name + "'.");
    return command.apply(null, Array.prototype.slice.call(args, 1));
  }

  var queued = (window.ShipBrief && window.ShipBrief.q) || [];
  var api = function () { return run(arguments); };
  Object.keys(commands).forEach(function (name) { api[name] = commands[name]; });
  api.loaded = true;
  window.ShipBrief = api;
  queued.forEach(function (args) { run(args); });
})();
