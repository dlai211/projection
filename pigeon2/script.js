const video = document.getElementById("video");
const music = document.getElementById("music");
const playBtn = document.getElementById("playBtn");
const progressFill = document.getElementById("progressFill");
const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");

let isPlaying = false;


function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/* --- Play / Pause --- */
async function togglePlay() {
  if (!isPlaying) {
    try {
      await video.play();
      await music.play();
      playBtn.innerHTML = '<span class="btn-text">⏸ Pause</span>';
      isPlaying = true;
    } catch (e) {
      console.log("Autoplay blocked:", e);
    }
  } else {
    video.pause();
    music.pause();
    playBtn.innerHTML = '<span class="btn-text">▶ Play</span>';
    isPlaying = false;
  }
}

playBtn.addEventListener("click", togglePlay);


music.addEventListener("timeupdate", () => {
  const percent = (music.currentTime / music.duration) * 100;
  progressFill.style.width = percent + "%";

  currentTimeEl.textContent = formatTime(music.currentTime);
});

music.addEventListener("loadedmetadata", () => {
  totalTimeEl.textContent = formatTime(music.duration);
});

progressBar.addEventListener("click", (e) => {
  const rect = progressBar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;

  music.currentTime = ratio * music.duration;

  // sync video to music
  video.currentTime = music.currentTime % video.duration;
});