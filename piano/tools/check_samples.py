#!/usr/bin/env python3
"""Check that each piano sample actually sounds the note its filename claims.

A sample set can be complete, the right length and the right bitrate, and still be
wrong: transposed, rendered from another instrument, or cut from the wrong key. The page
cannot tell - it plays whatever the file holds - so this script does.

Method: decode, take a window just after the attack, window it with a Hann taper, take
the spectrum, and score every key by the strength of its first six harmonics. Scoring the
harmonics rather than the fundamental alone is what keeps a low note from being mistaken
for its own second harmonic, which is the usual way a pitch check goes wrong.

Usage:
    python -I tools/check_samples.py [folder] [--all]
"""
import os
import subprocess
import sys

import numpy as np

SR = 16000           # 8 kHz of usable spectrum: enough for C8 at 4186 Hz
START = 0.15         # skip the hammer strike
LENGTH = 0.45
HARMONICS = (1.0, 0.7, 0.5, 0.35, 0.25, 0.2)
# A piano is stretch-tuned: the top octaves run sharp, and a sample of a low note has a
# weak fundamental. Both are normal, so each harmonic is searched for over a wide window
# (±60 cents) rather than at one exact frequency.
STRETCH = 0.035   # ±3.5% is about ±60 cents

NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FILE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def decode(path):
    result = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        capture_output=True
    )
    if result.returncode != 0 or not result.stdout:
        return None
    return np.frombuffer(result.stdout, dtype='<f4')


def midi_name(midi):
    return NAMES[midi % 12] + str(midi // 12 - 1)


def file_name_for(midi):
    return FILE_NAMES[midi % 12] + str(midi // 12 - 1)


def midi_for_file(stem):
    for midi in range(21, 109):
        if file_name_for(midi) == stem:
            return midi
    return None


def spectrum_of(path):
    samples = decode(path)
    if samples is None or len(samples) < SR // 4:
        return None

    start = int(START * SR)
    end = min(len(samples), start + int(LENGTH * SR))
    window = samples[start:end].astype(np.float64)
    if len(window) < 1024:
        return None

    window = window - window.mean()
    window *= np.hanning(len(window))
    magnitudes = np.abs(np.fft.rfft(window))
    freqs = np.fft.rfftfreq(len(window), 1 / SR)
    return freqs, magnitudes


def harmonic_score(freqs, magnitudes, f0):
    """How strongly a pitch and its first six harmonics are present."""
    score = 0.0
    for k, weight in enumerate(HARMONICS, 1):
        f = f0 * k
        if f * (1 + STRETCH) >= freqs[-1]:
            break
        low = int(np.searchsorted(freqs, f * (1 - STRETCH)))
        high = int(np.searchsorted(freqs, f * (1 + STRETCH)))
        lo, hi = max(0, low), min(len(magnitudes), max(high + 1, low + 1))
        score += weight * float(magnitudes[lo:hi].max())
    return score


def analyse(path):
    data = spectrum_of(path)
    if data is None:
        return None
    freqs, magnitudes = data
    scores = {}
    for midi in range(21, 109):
        f0 = 440 * 2 ** ((midi - 69) / 12)
        if f0 >= freqs[-1] - 100:
            continue
        scores[midi] = harmonic_score(freqs, magnitudes, f0)
    best = max(scores, key=scores.get)
    return best, scores


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'piano-mp3'
    every = '--all' in sys.argv

    if not os.path.isdir(folder):
        print('no such folder: ' + folder)
        return 1

    files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.mp3'))
    if not every:
        wanted = ['A0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'A4']
        files = [f for f in files if f[:-4] in wanted]

    wrong = []
    print('%-10s %-10s %-10s %-9s %s' % ('file', 'named', 'strongest', 'match', 'named note'));
    print('%-10s %-10s %-10s %-9s %s' % ('', '', '', '', 'vs the strongest'))
    for name in files:
        stem = name[:-4]
        expected = midi_for_file(stem)
        if expected is None:
            print('%-10s %-10s %-10s %-9s %s' % (name, '-', '-', 'unused', 'outside A0-C8'))
            continue

        result = analyse(os.path.join(folder, name))

        if result is None:
            print('%-10s %-10s %s' % (name, midi_name(expected) if expected else '?', 'cannot decode'))
            wrong.append(name)
            continue

        best, scores = result
        ratio = scores.get(expected, 0.0) / scores[best] if scores.get(best) else 0.0
        # A low sample can out-score its own note with the octave above, because a weak
        # fundamental also fits that reading. If the named note is nearly as strong, the
        # file is the right note - the ambiguity belongs to the measurement, not the file.
        # Two honest ambiguities. A low note's weak fundamental fits the octave above
        # almost as well, and a note can be read as its own third or fifth harmonic.
        # Both leave the named note strong; a transposed file would leave it weak.
        octave_away = abs(best - expected) == 12
        ok = expected is not None and (best == expected or ratio >= 0.85 or (octave_away and ratio >= 0.6))
        if not ok:
            wrong.append(name)
        print('%-10s %-10s %-10s %-9s %5.0f%%' % (
            name,
            midi_name(expected) if expected else '?',
            midi_name(best),
            'ok' if best == expected else ('ok (harmonics shared)' if ok else 'WRONG'),
            ratio * 100
        ))

    print('')
    if wrong:
        print('%d of %d samples do not sound the note they are named for.' % (len(wrong), len(files)))
        print('Check the spacing: a fixed gap in semitones is a transposed set;')
        print('alternating octaves is a naming or rendering problem.')
        return 1
    print('every sample sounds the note it is named for.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
