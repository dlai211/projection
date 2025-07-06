const container = document.getElementById("wheel-container");

let isDragging = false;
let startY;

const radius = 100;
const itemHeight = 30;
let angleOffset = -0 * itemHeight;
const centerY = container.offsetHeight / 2;

// Create wheel items
songs.forEach((song, i) => {
  const el = document.createElement("div");
  el.className = "wheel-item";
  el.innerText = song.name;

  el.onmousedown = (e) => e.preventDefault(); // prevent text selection

  container.appendChild(el);
});

function updateWheel() {
  const items = container.querySelectorAll(".wheel-item");

  items.forEach((el, i) => {
    const angle = (i * itemHeight + angleOffset) / radius;
    const x = Math.sin(angle) * radius;
    const y = centerY - Math.cos(angle) * radius;
    const deg = angle * (180 / Math.PI) - 90;

    el.style.transform = `translate(${x}px, ${y}px) rotate(${deg}deg)`;
    el.style.opacity = Math.abs(deg) < 60 ? 1 : 0.2;

    if (Math.abs(deg) < 10) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

function highlightedSong() {
  const items = container.querySelectorAll(".wheel-item");

  items.forEach((el, i) => {
    if (el.classList.contains("active")) {
      const song = songs[i];
      const newSrc = `music_mp3/${song.src}`;

      // Prevent reloading the same song
      if (audio.src.includes(song.src)) return;

      audio.pause();
      audio.src = newSrc;
      audio.load();

      // Update song info
      document.getElementById("cover").src = `music_pic/${song.pic}`;
      document.getElementById("song-name").textContent = song.name;
      document.getElementById("artist-name").textContent = song.artist;
      document.getElementById("lyric").textContent = song.lyrics || "";

      const imageUrl = `url("music_pic/${song.pic}")`;

      if (song.theme) {
        const gradient = `linear-gradient(to bottom, ${song.theme}, rgba(255, 255, 255, 0.2))`;
        document.body.style.backgroundImage = `${gradient}, ${imageUrl}`;
        document.body.style.backgroundColor = song.theme;
        document.body.style.backgroundBlendMode = "normal";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundSize = "100% auto";
        document.body.style.backgroundRepeat = "no-repeat";
      } else {
        document.body.style.backgroundImage = imageUrl;
        document.body.style.backgroundColor = "#ffffff";
        document.body.style.backgroundBlendMode = "normal";
        document.body.style.backgroundPosition = "right 20% center";
        document.body.style.backgroundSize = "35% auto";
        document.body.style.backgroundRepeat = "no-repeat";
      }

      // Animation
      animateLetters(document.getElementById("song-name"), song.name);
      animateLetters(document.getElementById("artist-name"), song.artist);

      const playBtn = document.getElementById("playBtn");
      if (playBtn) {
        playBtn.innerHTML = `<span class="btn-text">▶ Play</span>`;
      }
    }
  });
}

updateWheel();

// Mouse drag to scroll
container.addEventListener("mousedown", (e) => {
  isDragging = true;
  startY = e.clientY;
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const deltaY = e.clientY - startY;
  angleOffset += deltaY;
  startY = e.clientY;
  updateWheel();
});

document.addEventListener("mouseup", () => {
  isDragging = false;
  highlightedSong();
});

// Scroll wheel to rotate
container.addEventListener("wheel", (e) => {
  e.preventDefault();
  angleOffset -= e.deltaY / 10;
  updateWheel();
  highlightedSong();
});



// For phone users
container.addEventListener("touchstart", (e) => {
  isDragging = true;
  startY = e.touches[0].clientY;
  e.preventDefault();
}, false);

container.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  const currentY = e.touches[0].clientY;
  const deltaY = currentY - startY;
  angleOffset += deltaY;
  startY = currentY;
  updateWheel();
}, false);

container.addEventListener("touchend", () => {
  isDragging = false;
  highlightedSong();
});
