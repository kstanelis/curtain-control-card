# Dev harness and demo entities

## Harness (no Home Assistant needed)

```sh
npm run dev                    # rebuilds dist/ on every change
python3 -m http.server 8000    # in a second terminal, from the repo root
```

Open <http://localhost:8000/dev/> and reload after each rebuild (the bundle URL is cache-busted).

`fake-hass.js` stands in for Home Assistant. Covers move 10 %/s toward their target and report
`opening` / `closing` while they do; service calls show in the top bar.

| Section     | What it shows                                                                   |
| ----------- | ------------------------------------------------------------------------------- |
| Main        | Masonry column 464 px: pill × 4 at 480 px, fabric × 8 at 704 px                 |
| Widths      | Sections 12 cols (480), Sections 6 cols (236, wraps), Masonry 300, full width   |
| Themes      | dark on HA light, light + amber on HA dark, auto on HA light, auto on Nord      |
| Edge states | unavailable, no position support, opening, closing (frozen), 1 curtain, no hint |

Controls:

- **Style / Theme**: override every card, to see each state in both styles and all three themes.
- **Reduced motion**: flips `prefers-reduced-motion` for the cards.
- **Living left available**: makes the first curtain unavailable and back.
- **Move curtain 2**: sends Living right to the far end, so it moves while you watch.

## Demo entities in a real Home Assistant

Five template covers, each backed by an `input_number` (position) and an `input_boolean`
(availability):

| Entity                   | Device class | Position support |
| ------------------------ | ------------ | ---------------- |
| `cover.cc_living_left`   | curtain      | yes              |
| `cover.cc_living_right`  | curtain      | yes              |
| `cover.cc_bedroom`       | curtain      | yes              |
| `cover.cc_kitchen_blind` | shade        | yes              |
| `cover.cc_hall_readonly` | none         | no               |

Use `ha-demo.yaml` on HA 2025.10 or newer and `ha-demo-legacy.yaml` on older releases (tested on
2024.8). Copy it and `ha-demo-helpers.yaml` into `<config>/packages/`, add this to `configuration.yaml`
and restart:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Turn an `input_boolean.cc_*_available` off to make its cover unavailable. Positions change
instantly; for a cover that moves over time, use the `demo:` integration's covers.

## Checklist

Each state, in pill and fabric, under auto, light and dark (use the Style / Theme overrides):

| State               | Where                                                      | Checked |
| ------------------- | ---------------------------------------------------------- | ------- |
| open / closed       | Main: Living left 100 %, Bedroom 0 %                       | ✓       |
| opening             | Edge: Opening (arrow up, pulsing); or Move curtain 2       | ✓       |
| closing             | Edge: Closing (arrow down, pulsing)                        | ✓       |
| dragging            | Drag any track: accent ring, live value                    | ✓       |
| pending             | Release mid-track: readout holds the target while moving   | ✓       |
| no position support | Edge: Read-only — Open/Closed, no handle                   | ✓       |
| unavailable         | Edge: Unavailable; or untick Living left available         | ✓       |
| reduced motion      | Tick Reduced motion: arrow stays, no pulse, no transitions | ✓       |
| more-info           | Tap a name: top bar shows `more-info <entity>`             | ✓       |
| no curtains         | Edge: hint                                                 | ✓       |
| wrap to 2 rows      | Widths: Sections 6 cols, Masonry 300                       | ✓       |
