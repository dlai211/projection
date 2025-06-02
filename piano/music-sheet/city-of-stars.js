const songNotes = ['G4', 'A4', 'G4', 'E4', 'G4', 'A4', 'G4', 'E4'];
let currentNoteIndex = 0;

function renderSongTrack() {
  const track = document.getElementById('song-track');
  track.innerHTML = songNotes.map((note, i) => {
    const offset = i - currentNoteIndex;
    return `<span class="song-note" data-index="${i}" data-note="${note}" data-offset="${offset}">${note}</span>`;
  }).join('');
}

renderSongTrack();


const simulatedNotes = ['G4', 'A4', 'G4', 'E4', 'G4', 'A4', 'G4', 'E4'];
let simIndex = 0;

// Fake note trigger every 1.5 seconds
const simInterval = setInterval(() => {
    if (simIndex >= simulatedNotes.length) {
        clearInterval(simInterval);
        return;
    }

    const fakeNote = simulatedNotes[simIndex];
    console.log(`Simulated: ${fakeNote}`);

    // Simulate match logic
    const expectedNote = songNotes[currentNoteIndex];
    if (fakeNote === expectedNote) {
    currentNoteIndex++;
    renderSongTrack(); // ← update the shifted notes
    }

    simIndex++;
}, 1500);
