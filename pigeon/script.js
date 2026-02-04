// Animation for the text
function animateLetters(textElement, text) {
  textElement.innerHTML = [...text].map((char, i) => {
    const content = char === " " ? "&nbsp;" : char;
    return `<span style="--i:${i}">${content}</span>`;
  }).join('');
}

const songNameEl = document.getElementById("song-name");



// Progress bar 
const progressFill = document.querySelector(".progress-fill");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");

audio.addEventListener("loadedmetadata", () => {
  totalTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  const percent = (audio.currentTime / audio.duration) * 100;
  progressFill.style.width = `${percent}%`;
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}


const progressBar = document.querySelector(".progress-bar");

progressBar.addEventListener("click", (e) => {
  const rect = progressBar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percent = clickX / rect.width;
  audio.currentTime = percent * audio.duration;
});


let draggingProgress = false;

progressBar.addEventListener("mousedown", (e) => {
  draggingProgress = true;
  seekToPosition(e);
});

progressBar.addEventListener("mousemove", (e) => {
  if (draggingProgress) {
    seekToPosition(e);
  }
});

progressBar.addEventListener("mouseup", () => {
  draggingProgress = false;
});

document.addEventListener("mouseup", () => {
  draggingProgress = false;
});


function seekToPosition(e) {
  const rect = progressBar.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width); // clamp
  const percent = x / rect.width;
  audio.currentTime = percent * audio.duration;
}




// Rain