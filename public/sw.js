/* Design & Concur service worker: shows Web Push notifications and opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Design & Concur";
  // Home-screen icon badge (iOS 16.4+ installed web apps, Android, desktop): the person's unread count.
  const setBadge = async () => {
    const n = Number(data.badge);
    const nav = self.navigator;
    if (!nav || !Number.isFinite(n) || !nav.setAppBadge) return;
    try { if (n > 0) await nav.setAppBadge(n); else if (nav.clearAppBadge) await nav.clearAppBadge(); } catch {}
  };
  event.waitUntil(Promise.all([setBadge(), self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag, // a newer message on the same thread replaces the old one but still alerts
    data: { href: data.href || "/inbox" },
  })]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/inbox";
  const url = new URL(href, self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) { if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch {} } return; } }
    await self.clients.openWindow(url);
  })());
});
