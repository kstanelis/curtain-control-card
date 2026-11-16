/** Minimal slice of Home Assistant's frontend types this card relies on. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}
