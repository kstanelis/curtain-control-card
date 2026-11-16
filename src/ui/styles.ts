import { css } from 'lit';

/** Card look per the canvas Card.dc.html; only var(--cc-*) colours. Sizes come in as --cc-sz-*. */
export const cardStyles = css`
  :host {
    display: block;
    /* Sections: fill the grid cell HA sizes from getGridOptions. */
    height: 100%;
  }
  ha-card {
    box-sizing: border-box;
    padding: 16px;
    overflow: hidden;
    color: var(--cc-text);
  }
  ha-card.forced {
    --ha-card-background: var(--cc-card);
    --ha-card-border-color: var(--cc-border);
    background: var(--cc-card);
  }
  .grid {
    display: grid;
    height: 100%;
    gap: 12px 8px;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
  }
  .header {
    display: flex;
    flex: 0 0 var(--cc-sz-header);
    justify-content: space-between;
    align-items: baseline;
    gap: 2px;
    min-width: 0;
  }
  .compact .header,
  .fabric .header {
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }
  button {
    font: inherit;
    color: inherit;
  }
  .name {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    min-width: 0;
    max-width: 100%;
    font-size: var(--cc-sz-name);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Pill readout. Scoped to the header so it never outranks the fabric .chip. */
  .header .readout {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: var(--cc-sz-pct);
    font-weight: 500;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: var(--cc-accent-text);
  }
  .unavailable .header .readout,
  .unavailable .buttons button {
    color: var(--cc-muted);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
    min-height: 0;
  }
  .side .body {
    flex-direction: row;
  }
  .track {
    position: relative;
    flex-grow: 1;
    min-height: 48px;
    min-width: 0;
    overflow: hidden;
    border-radius: 16px;
    box-sizing: border-box;
    background: var(--cc-track);
  }
  /* Only draggable tracks block page scroll; read-only and unavailable ones let swipes through. */
  .normal .track {
    touch-action: none;
    cursor: ns-resize;
  }
  .normal .track:focus-visible {
    outline: 2px solid var(--cc-accent);
    outline-offset: 2px;
  }
  .dragging .track {
    box-shadow: 0 0 0 3px var(--cc-accent-tint);
  }
  .compact .track {
    border-radius: 12px;
  }
  .fabric .track {
    background: var(--cc-window);
    border: 2px solid var(--cc-border);
  }
  .readonly .track {
    cursor: default;
  }
  .unavailable .track {
    background: transparent;
    border: 2px dashed var(--cc-border);
    cursor: default;
  }
  .fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--cc-accent);
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    transition: height 150ms ease-out;
  }
  /* Room for the handle bar; read-only columns have none, so 0 % stays empty. */
  .fill.handle {
    padding-top: 8px;
  }
  .bar {
    display: block;
    width: 36%;
    max-width: 48px;
    height: 4px;
    border-radius: 2px;
    background: var(--cc-on-accent);
  }
  .fabric-cloth {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    background: repeating-linear-gradient(
      90deg,
      var(--cc-fabric-a) 0 12px,
      var(--cc-fabric-b) 12px 24px
    );
    transition: height 150ms ease-out;
  }
  .fabric-edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    display: flex;
    justify-content: center;
    transition: top 150ms ease-out;
  }
  /* Under a finger or held keys the fill follows instantly; reduced motion never animates. */
  .live .fill,
  .live .fabric-cloth,
  .live .fabric-edge,
  .reduced .fill,
  .reduced .fabric-cloth,
  .reduced .fabric-edge {
    transition: none;
  }
  .fabric-handle {
    display: block;
    width: 40%;
    max-width: 56px;
    height: 8px;
    margin-top: -4px;
    border-radius: 4px;
    background: var(--cc-handle);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  }
  .chip-row {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
  }
  .chip-row.bottom {
    bottom: 8px;
  }
  .chip-row.top {
    top: 8px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--cc-chip-bg);
    color: var(--cc-chip-text);
    font-size: var(--cc-sz-chip);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .unavailable-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--cc-muted);
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .buttons button {
    border: none;
    border-radius: 12px;
    background: var(--cc-button);
    color: var(--cc-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    height: var(--cc-sz-btn);
  }
  .buttons button:disabled {
    cursor: default;
  }
  .row .buttons {
    flex-direction: row;
  }
  .row .buttons button {
    flex: 1 1 0;
    min-width: 0;
  }
  .side .buttons {
    width: 64px;
  }
  .side .buttons button {
    flex: 1 1 0;
    min-height: 44px;
    height: auto;
  }
  svg {
    fill: currentColor;
    flex: none;
  }
  .hint {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 0 16px;
  }
  .hint svg {
    fill: var(--cc-accent-text);
  }
  .hint .title {
    font-size: 16px;
    font-weight: 500;
  }
  .hint .help {
    font-size: 14px;
    color: var(--cc-muted);
  }
`;
