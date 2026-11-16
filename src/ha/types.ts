/** Minimal slice of Home Assistant's frontend types this card relies on. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity | undefined>;
  locale?: { language: string };
  /** HA's own translations; a new function arrives when translations load. */
  localize?(key: string, ...args: unknown[]): string;
  callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown>;
  /** HA 2023.9+, always present on the 2024.8 minimum. */
  formatEntityState(stateObj: HassEntity): string;
  /** HA 2026.4+; feature-detected. */
  formatEntityName?(stateObj: HassEntity, parts: unknown[], opts?: unknown): string;
}
