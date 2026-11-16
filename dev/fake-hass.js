// In-browser stand-in for Home Assistant: cover states, service calls and covers that move
// 10 %/s toward a target, so pending targets and the moving pulse can be watched.

const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;
export const FULL = OPEN | CLOSE | SET_POSITION | STOP;
export const NO_POSITION = OPEN | CLOSE | STOP;

const TICK_MS = 100;
const STEP = 1; // 1 % per 100 ms = 10 %/s

export class FakeHass {
  /**
   * @param {Record<string, {name: string, position?: number, features?: number,
   *   deviceClass?: string, state?: string, frozen?: boolean}>} covers
   */
  constructor(covers) {
    this.covers = new Map();
    for (const [id, c] of Object.entries(covers)) {
      this.covers.set(id, {
        name: c.name,
        position: c.position ?? 0,
        features: c.features ?? FULL,
        deviceClass: c.deviceClass ?? 'curtain',
        state: c.state,
        frozen: c.frozen ?? false,
        available: true,
        target: undefined,
      });
    }
    this.listeners = new Set();
    this.log = [];
    // Stable like HA's, so the card's change check only sees entity updates.
    this.callService = this.callService.bind(this);
    this.formatEntityState = (s) =>
      ({ open: 'Open', closed: 'Closed', opening: 'Opening', closing: 'Closing' })[s.state] ??
      s.state;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.publish();
  }

  /** Called with every new hass object, the way HA pushes `hass` to cards. */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.hass);
  }

  setAvailable(id, available) {
    this.covers.get(id).available = available;
    this.publish();
  }

  tick() {
    let changed = false;
    for (const c of this.covers.values()) {
      if (c.frozen || c.target === undefined || !c.available) continue;
      const gap = c.target - c.position;
      c.position += Math.sign(gap) * Math.min(STEP, Math.abs(gap));
      if (c.position === c.target) c.target = undefined;
      changed = true;
    }
    if (changed) this.publish();
  }

  stateOf(c) {
    if (!c.available) return 'unavailable';
    if (c.frozen && c.state) return c.state;
    if (c.target !== undefined && c.target !== c.position) {
      return c.target > c.position ? 'opening' : 'closing';
    }
    return c.position > 0 ? 'open' : 'closed';
  }

  /** A fresh hass: changed entities get new state objects, unchanged ones keep theirs. */
  publish() {
    const prev = this.hass?.states ?? {};
    const states = {};
    for (const [id, c] of this.covers) {
      const attributes = {
        friendly_name: c.name,
        supported_features: c.features,
        device_class: c.deviceClass,
      };
      // Template covers report a position even without set_cover_position.
      if (c.available) attributes.current_position = c.position;
      const next = { entity_id: id, state: this.stateOf(c), attributes };
      const old = prev[id];
      states[id] = old && JSON.stringify(old) === JSON.stringify(next) ? old : next;
    }
    this.hass = {
      states,
      locale: { language: 'en' },
      callService: this.callService,
      formatEntityState: this.formatEntityState,
    };
    for (const fn of this.listeners) fn(this.hass);
  }

  callService(domain, service, data) {
    this.log.push(`${domain}.${service} ${JSON.stringify(data)}`);
    document.dispatchEvent(new CustomEvent('fake-hass-call', { detail: this.log.at(-1) }));
    const c = this.covers.get(data.entity_id);
    if (!c || !c.available) return Promise.reject(new Error(`${data.entity_id} unavailable`));
    if (c.frozen) return Promise.resolve(); // edge demos keep their state
    if (service === 'open_cover') c.target = 100;
    else if (service === 'close_cover') c.target = 0;
    else if (service === 'stop_cover') c.target = undefined;
    else if (service === 'set_cover_position') c.target = data.position;
    if (!(c.features & SET_POSITION) && service !== 'stop_cover') {
      // no position support: jump straight to the end state
      c.position = c.target ?? c.position;
      c.target = undefined;
    }
    this.publish();
    return Promise.resolve();
  }
}
