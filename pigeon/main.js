const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight/3;
const gap = 200;
// const cutoff = 120;


const audio = document.getElementById("audio"); // from <audio>
const playBtn = document.getElementById("playBtn");
const bgVideo = document.getElementById("bgVideo");
const coverVideo = document.getElementById("coverVideo");


 // Default song when loading
audio.src = "uwu_funk.mp3";

// document.getElementById("cover").src = "music_pic/music_2.webp";
document.getElementById("song-name").textContent = "Pigeon Dance";
document.getElementById("artist-name").textContent = "pigeon";
animateLetters(document.getElementById("song-name"), "Pigeon Dance");
animateLetters(document.getElementById("artist-name"), "pigeon");


const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
const source = audioCtx.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(audioCtx.destination);
// analyser.fftSize = 4096;
analyser.fftSize = 512;


const buffLen = analyser.frequencyBinCount;
const dataArray = new Uint8Array(buffLen);
const barWidth = (canvas.width - gap * (buffLen - 1)) / buffLen;

// const barWidth = (canvas.width / buffLen) * 0.8;
ctx.lineWidth = barWidth;
ctx.lineCap = "round";
ctx.strokeStyle = "black";
ctx.fillStyle = "rgb(220, 238, 224)";

let animationStarted = false;


function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    analyser.getByteFrequencyData(dataArray);
    const cutoff = 0.5* Math.max(...dataArray);
    // const cutoff = 0;

    for (let i = 0; i < buffLen; i++) {
    const x = i * (barWidth + gap);
    const y = canvas.height;
    let barHeight = dataArray[i];


    if (barHeight > cutoff) {
        barHeight = (barHeight - cutoff) * 0.2;
        ctx.beginPath();
        ctx.moveTo(x + barWidth / 2, y);
        ctx.lineTo(x + barWidth / 2, y - barHeight);
        ctx.stroke();
    }
    }
}

// Play/pause logic
playBtn.addEventListener("click", async () => {
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  if (audio.paused) {
    audio.play();
    bgVideo.play();
    coverVideo.play();
    document.querySelector('#playBtn .btn-text').textContent = '⏸ Pause';
    // playBtn.textContent = "⏸ Pause";
    if (!animationStarted) {
      draw();
      animationStarted = true;
    }
  } else {
    audio.pause();
    bgVideo.pause();
    coverVideo.pause();
    document.querySelector('#playBtn .btn-text').textContent = '▶ Play';
    // playBtn.textContent = "▶ Play";
  }
});
