# 0033. A light and a dark look from one palette of roles

- Status: accepted
- Date: 2026-10-22

## Context

The app has one look, paper and ink after the roadbooks, drawn by 242 uses of a static `colors` object inside 18 style sheets
built once at import. A rider at night, or in a tunnel of trees, wants a dark screen, and one that follows the phone without
asking. Dark is not the light palette inverted: the same colour plays two parts (the moss is the text of a title on paper and the
background of the gauge panel; the rust is the text of a figure and the background of a hairpin banner), and a warning must look
the same whatever the look.

## Decision

- A palette per look, `PALETTES` in `src/ui/theme.ts`, whose keys name **roles**. The old names stay; roles are added where one
  colour had two parts: `accent` (moss for text and icons on paper, a light green on dark paper), `rustText`, `route` and `hazard`
  (the route and the corners on the map), and `onSignal` and `onRust` (the text on a yellow or rust button, which does not change
  with the look: a warning is read the same in both).
- `colors` stays the way every screen already reads it but is a proxy over the palette of the look in use, and style sheets
  become `themed(() => StyleSheet.create({...}))`: built the first time for each look, then kept. No screen changes shape. As with
  the language (ADR 0032) the look is a variable, `setScheme`, and `App` calls `useScheme()` so the tree is drawn again on a
  change. A colour must never be kept in a constant at module level.
- The choice (System, Light, Dark) follows the language's pattern: pure rules in `src/core/theme.ts`, a hook and AsyncStorage in
  `src/ui/themeSetting.ts`, an item in the home menu. System reads `Appearance` and follows it while the app runs.
- The basemap follows the look: the plain basemap is OpenFreeMap's positron in the light look and its dark `fiord` style in the
  dark one; the colour one stays `liberty`. No new native module: `Appearance` and `StatusBar` are in React Native and Expo already.
- The contrast tests run over both palettes, so a new colour pair cannot pass in one look and fail in the other.

## Consequences

- Both looks are tested for contrast in one place; a screen that reads `colors` is themed without changes.
- The offline basemap saved in one look has the style (sprites and glyphs) of that look; the other look may need the network.
- The "Light" basemap's name is now the plain one, dark in the dark look; the name was kept so the screens and their tests stay.

## Alternatives considered

- **Hooks and style functions in each component** (`useStyles`). Explicit, but 18 files and every component change, for the
  same result.
- **Inverting the palette.** A hairpin banner or a Start button would change colour with the look, and the two-part colours
  would fail.
- **A theme library.** The roles are ours and the mechanism is thirty lines; a library would not choose the roles.
