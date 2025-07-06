const container = document.getElementById("wheel-container");

let isDragging = false;
let startY;

const radius = 100;
const itemHeight = 30;
let angleOffset = -0 * itemHeight; // this is index 0 → centered
const centerY = container.offsetHeight / 2;



songs.forEach((song, i) => {
    const el = document.createElement("div");
    el.className = "wheel-item";
    el.innerText = song.name;
    el.onmousedown = (e) => e.preventDefault(); // prevent highlight

    el.onclick = () => {
    // Set audio source
    audio.pause();
    audio.src = `music_mp3/${song.src}`;
    audio.load();

    // Update cover, name, artist
    document.getElementById("cover").src = `music_pic/${song.pic}`;
    document.getElementById("song-name").textContent = song.name;
    document.getElementById("artist-name").textContent = song.artist;

    // Optional: sync button
    const playBtn = document.getElementById("playBtn");
    if (playBtn) playBtn.textContent = "⏸ Pause";

    audio.oncanplay = () => {
        audio.play().catch(e => console.warn("Playback failed:", e));
    };
    };

    container.appendChild(el);
});


function updateWheel() {
  const items = container.querySelectorAll(".wheel-item");

  items.forEach((el, i) => {
    const angle = (i * itemHeight + angleOffset) / radius;
    const x = Math.sin(angle) * radius;
    const y = container.offsetHeight / 2 - Math.cos(angle) * radius;

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

updateWheel();

// Mouse drag to scroll
container.addEventListener("mousedown", (e) => {
  isDragging = true;
  startY = e.clientY;
});

// Mouse scroll to scroll
container.addEventListener("wheel", (e) => {
  e.preventDefault();
  angleOffset += e.deltaY / 10;
  updateWheel();
  highlightedSong();
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
  highlightedSong
});
