// =============================================
// sw.js — HM Creative Root Service Worker
// Provides Native Browser Push Notifications & Background Sync
// Scope: /
// =============================================

const SW_VERSION = "hm-creative-sw-v1";

self.addEventListener("install", (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Become available to all pages immediately
  event.waitUntil(self.clients.claim());
});

/* ── Notification Click Handler ── */
// Fires when user taps/clicks on the notification banner (mobile or desktop)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || "/admin/chats.html";

  // If path is relative to admin/, ensure proper absolute or relative path
  if (!targetUrl.startsWith("http") && !targetUrl.startsWith("/")) {
    targetUrl = "/admin/" + targetUrl;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing admin window
      for (const client of windowClients) {
        if (client.url.includes("/admin/")) {
          // Bring window to focus
          if ("focus" in client) {
            client.focus();
          }
          // Navigate to target URL
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }

      // 2. If no admin window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── Web Push Event Handler (for future or remote push triggers) ── */
self.addEventListener("push", (event) => {
  let payload = {
    title: "💬 New Message — HM Creative",
    body: "You received a new message from a client.",
    icon: "/HM Creatve logo.png",
    badge: "/HM Creatve logo.png",
    tag: "hm-creative-chat",
    data: { url: "/admin/chats.html" }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/HM Creatve logo.png",
      badge: payload.badge || "/HM Creatve logo.png",
      tag: payload.tag || ("chat-" + Date.now()),
      renotify: true,
      silent: false,
      vibrate: [150, 75, 150],
      data: payload.data || { url: "/admin/chats.html" },
      actions: [
        { action: "open", title: "Open Chat 💬" }
      ]
    })
  );
});
