# Third-party notice — Bravura music font

The musical shapes in `js/glyphs-bravura.js` (the grand-staff brace, the treble and
bass clefs, the key-signature sharps, the time-signature figures and the noteheads)
are vector outlines extracted from the **Bravura** music font.

- **Font:** Bravura
- **Copyright:** © Steinberg Media Technologies GmbH
- **Licence:** SIL Open Font License, Version 1.1
- **Source:** https://github.com/steinbergmedia/bravura

The Open Font License permits the outlines to be used, modified and redistributed
inside this project. The full licence text ships with the font and is available at
https://scripts.sil.org/OFL.

## Why the outlines are embedded rather than the font file

The score is drawn with real engraved shapes. Using Unicode musical characters
(`𝄞`, `𝄢`, `♯`) would render differently on every machine — and often not at all,
because those code points are missing from most system fonts. Shipping the outlines
as SVG paths makes the notation identical everywhere and lets the renderer position
each glyph exactly, using the font's own bounding boxes.

## Regenerating

`js/glyphs-bravura.js` is generated. To rebuild it from the font:

```bash
python tools/extract_bravura_glyphs.py Bravura.otf Bravura.json js/glyphs-bravura.js
```

`Bravura.otf` and `Bravura.json` come from the `redist/otf/` and `redist/` folders
of the Bravura repository.
