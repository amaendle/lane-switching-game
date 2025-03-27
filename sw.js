const CACHE_NAME = "car-lane-game-v1";
const urlsToCache = [
  "./",           // your index.html
  "./index.html",
  "./car_lane_game_with_moving_markings.js", // your JS
  "./manifest.json",
  // plus any images or assets you want offline
  "./autolied.mp3",
  "./car.png",
  "./cloud.png",
  "./fuelboost.png",
  "./gas station.png",
];

// Install event: cache all your game’s assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event: serve from cache if available
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
