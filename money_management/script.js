const piano = document.getElementById('piano');
const cutTitle = document.getElementById("cut-title");
const letterBtn = document.getElementById("letter-btn");
const numberBtn = document.getElementById("number-btn");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
let currentMode = 'letters'; // 'letters' or 'numbers'

const whiteWidthPercent = 2.041;  // percent width of each white key
const blackWidthPercent = 1.101;  // percent width of each black key
const whiteNotes = ['C','D','E','F','G','A','B'];
const blackNotes = ['Db','Eb',null,'Gb','Ab','Bb',null];
const numberMap = { C: '1', D: '2', E: '3', F: '4', G: '5', A: '6', B: '7' };

// Check the version of ml5
console.log('ml5 version:', ml5.version);
console.log('ml5 methods:', Object.keys(ml5));
console.log('typeof ml5.pitchDetection:', typeof ml5.pitchDetection);


// Generate white keys
let whiteCount = 0;
for (let octave = 1; octave <= 7; octave++) {
    whiteNotes.forEach((wn) => {
    const note = wn + octave;
    const key = document.createElement('div');
    key.className = 'white-key';
    key.dataset.note = note;
    piano.appendChild(key);
    whiteCount++;
    });
}

// Generate black keys
whiteCount = 0;
for (let octave = 1; octave <= 7; octave++) {
    whiteNotes.forEach((wn, i) => {
    if (blackNotes[i]) {
        const note = blackNotes[i] + octave;
        const key = document.createElement('div');
        key.className = 'black-key';
        key.dataset.note = note;
        const leftPos = (whiteCount * whiteWidthPercent) + whiteWidthPercent - (blackWidthPercent/2);
        key.style.left = leftPos + '%';
        piano.appendChild(key);
    }
    whiteCount++;
    });
}

// Update key labels based on mode
function updateLabels(mode) {
    currentMode = mode;
    
    document.querySelectorAll("#cut-nav a.cut-btn").forEach(a => a.classList.remove("active"));
    letterBtn.classList.toggle("active", currentMode === "letters");
    numberBtn.classList.toggle("active", mode === "numbers");

    document.querySelectorAll('.white-key, .black-key').forEach(key => {
    const note = key.dataset.note;
    const letter = note.match(/^[A-G]#?/)[0];
    let label;
    if (currentMode === 'letters') {
        label = letter;
    } else {
        const base = letter.replace('b', '');
        label = numberMap[base] + (letter.includes('b') ? 'b' : '');
    }
    key.textContent = label;
    });
}


numberBtn.onclick = () => updateLabels("numbers");
letterBtn.onclick = () => updateLabels("letters");

updateLabels(currentMode);

// Helper: play and animate click
function playKey(note) {
    // const filename = note.replace('#', 'b');
    const filename = note;
    console.log(filename);
    const audio = new Audio(`./piano-mp3/${filename}.mp3`);
    audio.play();

    const keyEl = document.querySelector(`[data-note='${note}']`);
    cutTitle.textContent = `Current Node Played is ${note}`;
    if (keyEl) {
    keyEl.classList.add('active');
    setTimeout(() => keyEl.classList.remove('active'), 150);
    }
}

// Click-to-play
piano.addEventListener('click', (e) => {
    const note = e.target.dataset.note;
    if (note) playKey(note);
});

// Pitch detection
async function setupMic() {

    const Tolerance_pct = 2;

    function freqToNote(freq) {
    const A4 = 440;
    const noteNum = 12 * (Math.log2(freq / A4)) + 69;
    const rounded = Math.round(noteNum);
    const exactFreq = A4 * Math.pow(2, (rounded - 69) / 12);
    const diffPct = Math.abs(freq - exactFreq) / exactFreq * 100;

      console.log(
    `→ midiNum: ${noteNum.toFixed(2)}, rounded: ${rounded}, ` +
    `exactFreq: ${exactFreq.toFixed(2)}, diffPct: ${diffPct.toFixed(2)}%`
        );           

    if (diffPct > Tolerance_pct) return null;

    // const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const names = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const name = names[(rounded % 12 + 12) % 12]; // ensure positive mod

    const oct = Math.floor(rounded / 12) - 1;

    return name + oct;
    }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micNode = audioCtx.createMediaStreamSource(stream);

    // PASS THE RAW stream, NOT micNode.stream
    const pitch = ml5.pitchDetection('./pitch-detection/crepe', audioCtx, stream, detect);

    function detect() {
    pitch.getPitch((err, freq) => {
        console.log(`freq: ${freq}`);
        document.querySelectorAll('.white-key, .black-key').forEach(k => k.classList.remove('highlight'));
        if (freq) {
        const note = freqToNote(freq);
        cutTitle.textContent = `Current Node Detected is ${note}`;
        const keyEl = document.querySelector(`[data-note='${note}']`);
        if (keyEl) keyEl.classList.add('highlight');
        } else {
            // no pitch right now
            cutTitle.textContent = `Current Node Detected is --`;
        }
        requestAnimationFrame(detect);
    });
    }
}

startBtn.addEventListener('click', () => {
    startBtn.classList.toggle("active");
    setupMic(); 
});
