addRightaddRightBtn.addEventListener("click", () => addNote("right"));
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