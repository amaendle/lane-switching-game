document.addEventListener(
  "touchmove",
  (event) => {
    // If more than one finger, block
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);

document.addEventListener("DOMContentLoaded", () => {
  // Add a variable to decide which control mode we use: "touch" or "swipe".
  // Default: "touch"
  let controlMode = "swipe";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // Set up the canvas to fill the window
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // NUMBER OF LANES
  const laneCount = 4;

  // LANE BORDERS AND CENTERS
  let laneWidth = (canvas.width * 0.8) / laneCount;
  let bottomLaneBorders = Array.from({ length: laneCount + 1 }, (_, i) =>
    canvas.width * (0.1 + i * (0.8 / laneCount))
  );
  let topLaneBorders = Array.from({ length: laneCount + 1 }, (_, i) =>
    canvas.width * (0.4 + i * (0.2 / laneCount))
  );
  let bottomLaneCenters = Array.from({ length: laneCount }, (_, i) =>
    (bottomLaneBorders[i] + bottomLaneBorders[i + 1]) / 2
  );
  let topLaneCenters = Array.from({ length: laneCount }, (_, i) =>
    (topLaneBorders[i] + topLaneBorders[i + 1]) / 2
  );

  // CAR ASPECT RATIO (300 x 274 originally)
  const CAR_WIDTH_RATIO = 300;
  const CAR_HEIGHT_RATIO = 274;
  const CAR_ASPECT = CAR_HEIGHT_RATIO / CAR_WIDTH_RATIO; // ~0.9133
  const CAR_SCALE = 0.6; // Car occupies 60% of the lane width

  // GAME STATE
  let currentLane = Math.floor(laneCount / 2);
  let targetLane = currentLane; // for smooth lane switching
  let score = 0;
  let fuel = 0; // starts empty
  let gameRunning = false;

  // IMAGES
  let carImageLoaded = false;
  let itemImageLoaded = false;
  let cloudImageLoaded = false;

  // Car image
  const carImage = new Image();
  carImage.src = "car.png";
  carImage.onload = () => { carImageLoaded = true; };

  // Item image
  const itemImage = new Image();
  itemImage.src = "fuelboost.png";
  itemImage.onload = () => { itemImageLoaded = true; };

  // Refill button image
  const refillImage = new Image();
  refillImage.src = "gas station.png";

  // Cloud image
  const cloudImage = new Image();
  cloudImage.src = "cloud.png";
  cloudImage.onload = () => {
    cloudImageLoaded = true;
  };

  // BACKGROUND MUSIC (OneDrive link)
  const gameMusic = new Audio("autolied.mp3");
  gameMusic.loop = true;

  // CAR
  let carWidth = laneWidth * CAR_SCALE;
  let carHeight = carWidth * CAR_ASPECT;
  const car = {
    width: carWidth,
    height: carHeight,
    x: bottomLaneCenters[currentLane] - carWidth / 2,
    y: canvas.height - carHeight - 20,
  };

  // ITEMS
  const items = [];

  // CLOUDS
  let clouds = [];

  //-----------------------------------------
  // ROAD MARKINGS (moving trapezoids)
  //-----------------------------------------
  const roadMarkings = [];

  // Helper: linear interpolation
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Spawn a white trapezoid marking along a given border index.
   * borderIndex: which border (1..laneCount-1) for internal lines.
   * length: how tall (in px) the trapezoid is.
   */
  function spawnMarking(borderIndex, length = 80) {
    // We'll store a small marking half-width so the trapezoid is narrow
    // Now spawn it so that its BOTTOM edge is just at y=0 => y = -length
    const markingHalf = laneWidth * 0.02; // 2% of lane width or any small fraction

    roadMarkings.push({
      borderIndex,
      // so the marking's bottom is at y=0 initially (just entering screen)
      y: -length,
      length,
      speed: 5,  // same as item speed
      markingHalf
    });
}

  // move markings downward
  function updateMarkings() {
  for (let i = roadMarkings.length - 1; i >= 0; i--) {
    const m = roadMarkings[i];

    // If there's fuel > 0, move the markings downward
    // If fuel = 0, they remain in place (car is "stopped")
    if (fuel > 0) {
      m.y += m.speed;
    }

    // Remove if offscreen
    if (m.y > canvas.height) {
      roadMarkings.splice(i, 1);
    }
  }
}


  // draw markings as trapezoids
  function drawMarkings() {
    ctx.fillStyle = "white";
    roadMarkings.forEach((m) => {
      const yTop = m.y;
      const yBot = m.y + m.length;
      if (yTop > canvas.height) return;
      if (yBot < 0) return;

      const i = m.borderIndex;
      const iNext = i + 1;
      if (iNext > laneCount) return;

      // We'll treat the border i as a single center line
      // so we find xLineTop, xLineBot, then offset by m.markingHalf

      const xLineTop = lerp(
        topLaneBorders[i],
        bottomLaneBorders[i],
        yTop / canvas.height
      );
      const xLineBot = lerp(
        topLaneBorders[i],
        bottomLaneBorders[i],
        yBot / canvas.height
      );

      const leftTop = xLineTop - m.markingHalf;
      const rightTop = xLineTop + m.markingHalf;
      const leftBot = xLineBot - m.markingHalf;
      const rightBot = xLineBot + m.markingHalf;

      ctx.beginPath();
      ctx.moveTo(leftTop, yTop);
      ctx.lineTo(rightTop, yTop);
      ctx.lineTo(rightBot, yBot);
      ctx.lineTo(leftBot, yBot);
      ctx.closePath();
      ctx.fill();
    });
  }

  // ---------------------------
  //  PLACE CLOUDS
  // ---------------------------
  function placeClouds() {
    clouds = [];

    function addCloudsInRegion(xStart, xEnd, count) {
      let currentX = xStart;
      for (let i = 0; i < count; i++) {
        const scale = 0.1 + Math.random() * 0.05; // 0.1..0.15 of canvas.width
        const w = canvas.width * scale;
        // Keep the cloud aspect ratio at 200x137 => ~0.685
        const aspect = 0.685;
        const h = w * aspect;
        const yOffset = Math.random() * (0.1 * canvas.height);

        clouds.push({ x: currentX, y: yOffset, width: w, height: h });
        currentX += w + 0.02 * canvas.width;

        if (currentX + w > xEnd) break;
      }
    }

    // top-left region: 3 clouds
    addCloudsInRegion(0, canvas.width * 0.33, 3);

    // top-right region: 4 clouds
    addCloudsInRegion(canvas.width * 0.66, canvas.width, 4);
  }

  // Initialize the scene
  placeClouds();

  // ---------------------------
  //  SPAWN ITEM
  // ---------------------------
  function spawnItem() {
    if (!gameRunning) return;
    const lane = Math.floor(Math.random() * laneCount);
    // half original size => 0.15 * laneWidth & 0.2 * laneWidth
    const itemW = laneWidth * 0.15;
    const itemH = laneWidth * 0.2;
    items.push({
      laneIndex: lane,
      x: getLaneX(lane, 0) - itemW / 2,
      y: 0,
      width: itemW,
      height: itemH,
    });
  }

  // ---------------------------
  //  GET LANE X
  // ---------------------------
  function getLaneX(laneIndex, yPosition) {
    const t = yPosition / canvas.height;
    return (
      topLaneCenters[laneIndex] * (1 - t) + bottomLaneCenters[laneIndex] * t
    );
  }

  // Save references to old update/draw so we can extend them
  // We'll redefine them later
  let oldUpdate;
  let oldDraw;

  // Original update (from your code)
  function originalUpdate() {
    if (!gameRunning) return;

    // Fuel depletion
    fuel -= 0.1;
    if (fuel <= 0) {
      fuel = 0;
      gameRunning = false;
      showRefillButton();
      return;
    }

    // Car transitions to targetLane
    const targetX = bottomLaneCenters[targetLane] - car.width / 2;
    const ease = 0.2;
    const delta = targetX - car.x;
    if (Math.abs(delta) > 0.5) {
      car.x += delta * ease;
    } else {
      car.x = targetX;
    }

    // Move items
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.y += 5;
      item.x = getLaneX(item.laneIndex, item.y) - item.width / 2;

      if (item.y > canvas.height) {
        items.splice(i, 1);
        continue;
      }

      // Collision
      if (
        item.x < car.x + car.width &&
        item.x + item.width > car.x &&
        item.y < car.y + car.height &&
        item.y + item.height > car.y
      ) {
        items.splice(i, 1);
        score++;
        fuel += 5;
        if (fuel > 100) fuel = 100;
      }
    }
  }

  // Original draw
  function originalDraw() {
    // 1) Road
    drawRoad();

    // 2) Clouds
    if (cloudImageLoaded) {
      clouds.forEach((cloud) => {
        ctx.drawImage(cloudImage, cloud.x, cloud.y, cloud.width, cloud.height);
      });
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      clouds.forEach((cloud) => {
        ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
      });
    }

    // 3) Car
    if (carImageLoaded) {
      ctx.drawImage(carImage, car.x, car.y, car.width, car.height);
    } else {
      ctx.fillStyle = "red";
      ctx.fillRect(car.x, car.y, car.width, car.height);
    }

    // 4) Items
    items.forEach((item) => {
      if (itemImageLoaded) {
        ctx.drawImage(itemImage, item.x, item.y, item.width, item.height);
      } else {
        ctx.fillStyle = "gold";
        ctx.fillRect(item.x, item.y, item.width, item.height);
      }
    });

    // 5) Fuel bar
    ctx.fillStyle = "gray";
    ctx.fillRect(20, 20, 120, 20);
    ctx.fillStyle = "green";
    ctx.fillRect(20, 20, (fuel / 100) * 120, 20);
    ctx.strokeStyle = "black";
    ctx.strokeRect(20, 20, 120, 20);

    // 6) Score
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.fillText("Score: " + score, 20, 60);
  }

  // drawRoad from your original code
  function drawRoad() {
    ctx.fillStyle = "#FAF3D1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#A7C7E7";
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.1, canvas.height);
    ctx.lineTo(canvas.width * 0.9, canvas.height);
    ctx.lineTo(canvas.width * 0.6, 0);
    ctx.lineTo(canvas.width * 0.4, 0);
    ctx.closePath();
    ctx.fill();

    
  }

  // Overwrite update/draw to incorporate marking logic
  window.update = function() {
    originalUpdate();
    // Move markings as well
    updateMarkings();
  }

  window.draw = function() {
    // Draw the road first
    drawRoad();

    // Draw the dynamic markings on top of the road but behind the clouds?
    // Or you can do it after clouds, or before the car - your choice
    drawMarkings();

    // Then do the rest
    // We replicate the originalDraw code minus the road
    // So let's call originalDraw minus the road portion

    // We'll skip the road portion from original
    // or we can do:
    ctx.save();
    // skip the road from original
    originalDrawPart();
    ctx.restore();
  }

  function originalDrawPart() {
    // skip road part in original

    // 2) Clouds
    if (cloudImageLoaded) {
      clouds.forEach((cloud) => {
        ctx.drawImage(cloudImage, cloud.x, cloud.y, cloud.width, cloud.height);
      });
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      clouds.forEach((cloud) => {
        ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
      });
    }

    // Car
    if (carImageLoaded) {
      ctx.drawImage(carImage, car.x, car.y, car.width, car.height);
    } else {
      ctx.fillStyle = "red";
      ctx.fillRect(car.x, car.y, car.width, car.height);
    }

    // Items
    items.forEach((item) => {
      if (itemImageLoaded) {
        ctx.drawImage(itemImage, item.x, item.y, item.width, item.height);
      } else {
        ctx.fillStyle = "gold";
        ctx.fillRect(item.x, item.y, item.width, item.height);
      }
    });

    // Fuel bar
    ctx.fillStyle = "gray";
    ctx.fillRect(20, 20, 120, 20);
    ctx.fillStyle = "green";
    ctx.fillRect(20, 20, (fuel / 100) * 120, 20);
    ctx.strokeStyle = "black";
    ctx.strokeRect(20, 20, 120, 20);

    // Score
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.fillText("Score: " + score, 20, 60);
  }

  // ---------------------------
  //  REFILL BUTTON
  // ---------------------------
  function showRefillButton() {
    const button = document.createElement("button");
    button.style.position = "absolute";
    button.style.top = "50%";
    button.style.left = "50%";
    button.style.transform = "translate(-50%, -50%)";
    button.style.width = "150px";
    button.style.height = "150px";
    button.style.border = "5px solid black";
    button.style.borderRadius = "20px";
    button.style.background = "none";
    button.style.padding = "0";
    button.style.cursor = "pointer";

    const img = document.createElement("img");
    img.src = refillImage.src;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.borderRadius = "20px";

    button.appendChild(img);
    document.body.appendChild(button);

    button.addEventListener("click", () => {
      fuel = 100;
      gameRunning = true;

      // Attempt to play music
      gameMusic.play().catch((err) => {
        console.error("Music playback failed:", err);
      });

      button.remove();
    });
  }

  // ---------------------------
  //  HANDLE RESIZE
  // ---------------------------
  // 1) Listen for `resize` events (covers rotation on mobile and resizing on desktop)
  window.addEventListener("resize", handleResize);
  
  // 2) A function that re-initializes layout whenever the screen size changes
  function handleResize() {
    // Update canvas to new window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Recompute laneWidth, lane borders, centers
    laneWidth = (canvas.width * 0.8) / laneCount;
    bottomLaneBorders = Array.from({ length: laneCount + 1 }, (_, i) =>
      canvas.width * (0.1 + i * (0.8 / laneCount))
    );
    topLaneBorders = Array.from({ length: laneCount + 1 }, (_, i) =>
      canvas.width * (0.4 + i * (0.2 / laneCount))
    );
    bottomLaneCenters = Array.from({ length: laneCount }, (_, i) =>
      (bottomLaneBorders[i] + bottomLaneBorders[i + 1]) / 2
    );
    topLaneCenters = Array.from({ length: laneCount }, (_, i) =>
      (topLaneBorders[i] + topLaneBorders[i + 1]) / 2
    );
    
    // Recalculate the car's width/height
    carWidth = laneWidth * CAR_SCALE;
    carHeight = carWidth * CAR_ASPECT;
    // And re-place the car near the bottom
    car.width = carWidth;
    car.height = carHeight;
    car.x = bottomLaneCenters[currentLane] - carWidth / 2;
    car.y = canvas.height - carHeight - 20;
  
    // Optionally re-place items or remove them
    // Optionally re-place clouds
    placeClouds();
  }
  
  // ---------------------------
  //  GAME LOOP
  // ---------------------------
  function gameLoop() {
    window.update();
    window.draw();
    requestAnimationFrame(gameLoop);
  }

  // Initially, show refill button (tank = 0, gameRunning=false)
  showRefillButton();

  // Start game loop
  gameLoop();

  // Spawn items every second
  setInterval(spawnItem, 1000);

  // Also spawn marking trapezoids for each internal lane border
  // e.g., every 800 ms
  setInterval(() => {
    if (!gameRunning) return;
    for (let i = 1; i < laneCount; i++) {
      spawnMarking(i, 80);
    }
  }, 800);

  // Variables for swipe logic
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeThreshold = 50; // minimal distance (px) to count as a swipe

  // Decide between old "touch" or "swipe" logic:
  if (controlMode === "touch") {
    // Old Touch logic: move to nearest lane center on tap
    canvas.addEventListener("touchstart", (event) => {
      if (!gameRunning) return;
      const touchX = event.touches[0].clientX;
      // find which lane center is closest
      let closestLane = 0;
      let minDist = Infinity;
      for (let i = 0; i < laneCount; i++) {
        const dist = Math.abs(touchX - bottomLaneCenters[i]);
        if (dist < minDist) {
          minDist = dist;
          closestLane = i;
        }
      }
      // set target lane
      targetLane = closestLane;
    });
  } else {
    // Swipe logic
    // We'll track touchstart and touchend, measure horizontal difference

    canvas.addEventListener("touchstart", (event) => {
      if (!gameRunning) return;
      swipeStartX = event.touches[0].clientX;
      swipeStartY = event.touches[0].clientY;
    });

    canvas.addEventListener("touchend", (event) => {
      if (!gameRunning) return;
      // measure final X
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const distX = endX - swipeStartX;
      const distY = endY - swipeStartY;

      // only consider horizontal swipes if |distX| > |distY|
      if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > swipeThreshold) {
        // negative => swipe left, positive => swipe right
        if (distX < 0 && currentLane > 0) {
          // left lane
          targetLane = currentLane = Math.max(0, currentLane - 1);
        } else if (distX > 0 && currentLane < laneCount - 1) {
          // right lane
          targetLane = currentLane = Math.min(laneCount - 1, currentLane + 1);
        }
      }
    });
  }
});
