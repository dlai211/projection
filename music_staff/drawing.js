const svg = document.getElementById("sheet");
const addRightBtn = document.getElementById("addRightBtn");
const addLeftBtn = document.getElementById("addLeftBtn");
const removeBtn = document.getElementById("removeBtn");
const keySelect = document.getElementById("keySelect");
const statusText = document.getElementById("statusText");
const addBreakBtn = document.getElementById("addBreakBtn");
const addSlotBtn = document.getElementById("addSlotBtn");

const STAFF_LEFT = 0;
const STAFF_RIGHT = 1400;
const STAFF_WIDTH = STAFF_RIGHT - STAFF_LEFT;
const STAFF_SPACING = 18; // vertical spacing between the 5 lines
const STEP_PX = STAFF_SPACING / 2;

const RIGHT_STAFF_TOP = 110;
const LEFT_STAFF_TOP = 280;

const SLOT_START_X = 120;
const SLOT_GAP = 49;
const NUM_SLOTS = 25;

const MIN_STEP = -6;
const MAX_STEP = 14;

let nextId = 1;
let selectedNoteId = null;
let draggingId = null;
let nextBreakId = 1;
let draggingBreakId = null;

let breaks = [];
let notes = [
    { id: nextId++, hand: "right", slot: 0, step: 6 }, // D5
    { id: nextId++, hand: "right", slot: 2, step: 4 }, // B4
    { id: nextId++, hand: "left",  slot: 0, step: 2 }, // G-ish relative step
    { id: nextId++, hand: "left",  slot: 2, step: 0 }  // E
];

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

const MAJOR_SCALES = {
    "C":  ["C", "D", "E", "F", "G", "A", "B"],
    "G":  ["G", "A", "B", "C", "D", "E", "F#"],
    "D":  ["D", "E", "F#", "G", "A", "B", "C#"],
    "A":  ["A", "B", "C#", "D", "E", "F#", "G#"],
    "E":  ["E", "F#", "G#", "A", "B", "C#", "D#"],
    "B":  ["B", "C#", "D#", "E", "F#", "G#", "A#"],
    "F":  ["F", "G", "A", "Bb", "C", "D", "E"],
    "Bb": ["Bb", "C", "D", "Eb", "F", "G", "A"],
    "Eb": ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
    "Ab": ["Ab", "Bb", "C", "Db", "Eb", "F", "G"]
};


function getStaffTop(hand) {
    return hand === "right" ? RIGHT_STAFF_TOP : LEFT_STAFF_TOP;
}

function stepToY(hand, step) {
    const staffTop = getStaffTop(hand);
    const bottomLineY = staffTop + STAFF_SPACING * 4;
    return bottomLineY - step * STEP_PX;
}

function getPitchFromStep(step) {
    // step 0 = E
    const baseIndex = 2; // E in C D E F G A B
    const total = baseIndex + step;
    const letterIndex = ((total % 7) + 7) % 7;
    return LETTERS[letterIndex];
}

function letterToScaleDegree(letter, key) {
    const scale = MAJOR_SCALES[key];
    const idx = scale.findIndex(n => n.replace("#", "").replace("b", "") === letter);
    if (idx !== -1) return String(idx + 1);
    return "?";
}

function getDisplayLetter(step, key) {
    const naturalLetter = getPitchFromStep(step);
    const scale = MAJOR_SCALES[key];
    const match = scale.find(n => n.replace("#", "").replace("b", "") === naturalLetter);
    return match || naturalLetter;
}



function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
    }
    return el;
}

function getSvgCoords(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}


function drawGrandStaffBrace() {
    const brace = createSvgEl("text", {
    x: 70,
    y: 290,
    class: "brace-text"
    });
    // brace.textContent = "{";
    brace.textContent = "";
    brace.setAttribute("transform", "scale(1.2,4.8) translate(-8,-53)");
    svg.appendChild(brace);
}

function slotToX(slot) {
    return SLOT_START_X + slot * SLOT_GAP;
}

function xToNearestSlot(x) {
    const slot = Math.round((x - SLOT_START_X) / SLOT_GAP);
    return Math.max(0, Math.min(NUM_SLOTS - 1, slot));
}

function yToNearestStep(hand, y) {
    const staffTop = getStaffTop(hand);
    const bottomLineY = staffTop + STAFF_SPACING * 4;
    let raw = Math.round((bottomLineY - y) / STEP_PX);
    raw = Math.max(MIN_STEP, Math.min(MAX_STEP, raw));
    return raw;
}



function drawBarAlignmentLines() {
    for (let s = 0; s < NUM_SLOTS; s++) {
    const x = slotToX(s);
    svg.appendChild(createSvgEl("line", {
        x1: x,
        y1: RIGHT_STAFF_TOP - 10,
        x2: x,
        y2: LEFT_STAFF_TOP + STAFF_SPACING * 4 + 10,
        class: "bar-line"
    }));
    }
}

function drawLedgerLines(hand, x, step) {
    const lines = [];
    const bottomLineStep = 0;
    const topLineStep = 8;

    if (step < bottomLineStep) {
    for (let s = step; s <= -2; s++) {
        if (s % 2 === 0) lines.push(s);
    }
    }

    if (step > topLineStep) {
    for (let s = 10; s <= step; s++) {
        if (s % 2 === 0) lines.push(s);
    }
    }

    lines.forEach(s => {
    const y = stepToY(hand, s);
    svg.appendChild(createSvgEl("line", {
        x1: x - 18,
        y1: y,
        x2: x + 18,
        y2: y,
        class: "ledger-line"
    }));
    });
}


function drawNote(note) {
    const x = slotToX(note.slot);
    const y = stepToY(note.hand, note.step);
    const key = keySelect.value;
    const displayLetter = getDisplayLetter(note.step, key);
    const degree = letterToScaleDegree(getPitchFromStep(note.step), key);

    drawLedgerLines(note.hand, x, note.step);

    const group = createSvgEl("g", {
    class: "note" + (note.id === selectedNoteId ? " selected" : ""),
    "data-id": note.id
    });

    // note facing the other direction when too close
    const neighbor = notes.find(n =>
        n.id !== note.id &&
        n.hand === note.hand &&
        n.slot === note.slot &&
        Math.abs(n.step - note.step) <= 1
    );

    const headRight = neighbor && note.step < neighbor.step;
    const head = createSvgEl("ellipse", {
        cx: headRight ? x - 9.5 : x + 9.5,
        cy: headRight ? y - 3 : y + 3,
        rx: 9.5,
        ry: 6,
        transform: `rotate(-20 ${x} ${y})`,
        class: "note-head"
    });

    // stem up if note is below the middle line (step < 4), otherwise stem down
    const stemUp = note.step < 4;
    const stem = createSvgEl("line", stemUp ? {
    x1: x,
    y1: y,
    x2: x,
    y2: y - 42,
    class: "stem"
    } : {
    x1: x,
    y1: y,
    x2: x,
    y2: y + 42,
    class: "stem"
    });

    const labelY1 = note.hand === "right" ? RIGHT_STAFF_TOP + 150 : LEFT_STAFF_TOP + 150;
    const labelY2 = labelY1 + 22;

    const label1 = createSvgEl("text", {
    x: x,
    y: labelY1,
    class: "note-label"
    });
    label1.textContent = displayLetter;

    const label2 = createSvgEl("text", {
    x: x,
    y: labelY2,
    class: "note-sub-label"
    });
    label2.textContent = degree;

    group.appendChild(head);
    group.appendChild(stem);
    group.appendChild(label1);
    group.appendChild(label2);

    group.addEventListener("pointerdown", (e) => {
    draggingId = note.id;
    selectedNoteId = note.id;
    group.setPointerCapture(e.pointerId);
    render();
    });

    group.addEventListener("click", () => {
    selectedNoteId = note.id;
    render();
    });

    svg.appendChild(group);
}

function removeSelectedNote() {
    if (selectedNoteId == null) return;
    notes = notes.filter(n => n.id !== selectedNoteId);
    selectedNoteId = notes.length ? notes[notes.length - 1].id : null;
    render();
}

function findFirstOpenSlot(hand) {
    const used = new Set(notes.filter(n => n.hand === hand).map(n => n.slot));
    for (let s = 0; s < NUM_SLOTS; s++) {
    if (!used.has(s)) return s;
    }
    return null;
}

function addNote(hand) {
    let slot = findFirstOpenSlot(hand);

    // if all slots are used, place at last slot
    if (slot === null) slot = NUM_SLOTS - 1;

    const defaultStep = hand === "right" ? 4 : 2;

    const note = {
    id: nextId++,
    hand,
    slot,
    step: defaultStep
    };

    notes.push(note);
    selectedNoteId = note.id;
    render();
}

function drawStaff(topY, label='') {
    // 2 solid verical lines at both sides
    svg.appendChild(createSvgEl("line", {
        x1: STAFF_LEFT,
        y1: topY,
        x2: STAFF_LEFT, 
        y2: LEFT_STAFF_TOP + STAFF_SPACING * 4 ,
        class: "staff-line"
    }));
    svg.appendChild(createSvgEl("line", {
        x1: STAFF_RIGHT,
        y1: topY,
        x2: STAFF_RIGHT, 
        y2: LEFT_STAFF_TOP + STAFF_SPACING * 4 ,
        class: "staff-line"
    }));

    // 5 solid vertical lines in between
    for (let i = 1; i < 5; i++) {
        svg.appendChild(createSvgEl("line", {
            x1: STAFF_LEFT + i * STAFF_WIDTH / 5,
            y1: topY,
            x2: STAFF_LEFT + i * STAFF_WIDTH / 5,
            y2: LEFT_STAFF_TOP + STAFF_SPACING * 4 ,
            class: "staff-line"
        }));
    }

    // 5 horizontal lines
    for (let i = 0; i < 5; i++) {
        const y = topY + i * STAFF_SPACING;
        svg.appendChild(createSvgEl("line", {
            x1: STAFF_LEFT,
            y1: y,
            x2: STAFF_RIGHT,
            y2: y,
            class: "staff-line"
        }));
    }

    // slots
    for (let s = 0; s < NUM_SLOTS; s++) {
    const x = slotToX(s);
    svg.appendChild(createSvgEl("line", {
        x1: x,
        y1: topY - 40,
        x2: x,
        y2: topY + STAFF_SPACING * 4 + 70,
        class: "slot-guide"
    }));
    }

    // Right Hand / Left Hand label
    svg.appendChild(createSvgEl("text", {
    x: 10,
    y: topY - 22,
    class: "staff-label"
    })).textContent = label;
}

function render() {
    svg.innerHTML = "";

    drawGrandStaffBrace();
    drawBarAlignmentLines();
    drawStaff(RIGHT_STAFF_TOP);
    drawStaff(LEFT_STAFF_TOP);

    notes
    .slice()
    .sort((a, b) => {
        if (a.hand !== b.hand) return a.hand.localeCompare(b.hand);
        return a.slot - b.slot;
    })
    .forEach(drawNote);

    updateStatus();
}


function handlePointerMove(evt) {
    if (draggingBreakId != null) {
        moveDraggedBreak(evt);
        return;
    }

    if (draggingId != null) {
        const note = notes.find(n => n.id === draggingId);
        if (!note) return;

        const pt = getSvgCoords(evt);

        note.slot = xToNearestSlot(pt.x);
        note.step = yToNearestStep(note.hand, pt.y);

        render();
    }
}

function updateStatus() {
    const key = keySelect.value;
    const selected = notes.find(n => n.id === selectedNoteId);

    if (!selected) {
    statusText.textContent = `Key: ${key} major`;
    return;
    }

    const letter = getDisplayLetter(selected.step, key);
    const degree = letterToScaleDegree(getPitchFromStep(selected.step), key);
    statusText.textContent = `Selected: ${selected.hand} hand, slot ${selected.slot + 1}, ${letter}, degree ${degree} in ${key} major`;
}


addRightBtn.addEventListener("click", () => addNote("right"));
addLeftBtn.addEventListener("click", () => addNote("left"));
removeBtn.addEventListener("click", removeSelectedNote);
keySelect.addEventListener("change", render);


addBreakBtn.addEventListener("click", () => addBreak(false));
addSlotBtn.addEventListener("click", () => addBreak(true));

svg.addEventListener("pointermove", handlePointerMove);
svg.addEventListener("pointerup", () => { draggingId = null; });
svg.addEventListener("pointerleave", () => { draggingId = null; });


window.addEventListener("keydown", (e) => {
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note) return;

    if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelectedNote();
        return;
    }

    if (e.key === "ArrowUp") {
        e.preventDefault();
        note.step = Math.min(MAX_STEP, note.step + 1);
        render();
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        note.step = Math.max(MIN_STEP, note.step - 1);
        render();
    } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        note.slot = Math.max(0, note.slot - 1);
        render();
    } else if (e.key === "ArrowRight") {
        e.preventDefault();
        note.slot = Math.min(NUM_SLOTS - 1, note.slot + 1);
        render();
    }
});

render();