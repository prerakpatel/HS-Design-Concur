/* Design & Concur service worker: shows Web Push notifications and opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Design & Concur";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    tag: data.tag || undefined,
    data: { href: data.href || "/inbox" },
  }));
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
