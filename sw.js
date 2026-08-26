// Ce service worker se désinstalle lui-même et vide tous les caches.
// Le cache agressif de la v1/v2 rendait le développement actif imprévisible
// (une correction de code pouvait rester invisible malgré un rafraîchissement
// classique, car l'ancien SW continuait à servir ses vieilles copies). On
// repart sans cache pour l'instant — un vrai mode hors-ligne pourra être
// réintroduit une fois l'app stabilisée.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
