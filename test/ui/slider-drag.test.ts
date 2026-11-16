import { describe, expect, it, vi } from 'vitest';
import { SliderDrag } from '../../src/ui/slider-drag';

/** Track stand-in: rect top 0, height 200; records pointer capture. */
function track() {
  const el = document.createElement('div');
  const capture = vi.fn();
  const release = vi.fn();
  el.getBoundingClientRect = () => ({ top: 0, height: 200 }) as DOMRect;
  el.setPointerCapture = capture;
  el.releasePointerCapture = release;
  el.hasPointerCapture = () => true;
  return Object.assign(el, { capture, release });
}

const ev = (clientY: number, pointerId = 1, extra: Partial<PointerEvent> = {}) =>
  ({ clientY, pointerId, button: 0, ...extra }) as PointerEvent;

function setup() {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  return { drag: new SliderDrag(onChange, onCommit), onChange, onCommit };
}

describe('SliderDrag', () => {
  it('down captures the pointer and sets the value at once', () => {
    const { drag, onChange, onCommit } = setup();
    const t = track();
    drag.down('0:cover.a', ev(100), t);
    expect(t.capture).toHaveBeenCalledWith(1);
    expect(drag.value('0:cover.a')).toBe(50);
    expect(onChange).toHaveBeenCalledWith('0:cover.a', 50);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('move updates live; up commits exactly once', () => {
    const { drag, onChange, onCommit } = setup();
    drag.down('k', ev(100), track());
    drag.move(ev(40));
    expect(drag.value('k')).toBe(80);
    expect(onChange).toHaveBeenLastCalledWith('k', 80);
    expect(onCommit).not.toHaveBeenCalled();
    drag.up(ev(40));
    drag.up(ev(40));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('k', 80);
    expect(drag.value('k')).toBeNull();
  });

  it('ignores moves and ups from another pointer', () => {
    const { drag, onCommit } = setup();
    drag.down('k', ev(100, 1), track());
    drag.move(ev(0, 2));
    drag.up(ev(0, 2));
    expect(drag.value('k')).toBe(50);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ignores a second down while one drag is active', () => {
    const { drag } = setup();
    drag.down('a', ev(100, 1), track());
    drag.down('b', ev(0, 2), track());
    expect(drag.value('a')).toBe(50);
    expect(drag.value('b')).toBeNull();
  });

  it('ignores non-primary mouse buttons', () => {
    const { drag, onChange } = setup();
    drag.down('k', ev(100, 1, { button: 2 }), track());
    expect(drag.value('k')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancel reverts without a commit and reports the change', () => {
    const { drag, onChange, onCommit } = setup();
    const t = track();
    drag.down('k', ev(100), t);
    drag.cancel();
    expect(drag.value('k')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('k', null);
    expect(t.release).toHaveBeenCalledWith(1);
    drag.up(ev(100));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('cancel with no drag is a no-op', () => {
    const { drag, onChange } = setup();
    drag.cancel();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('value is only reported for the active key', () => {
    const { drag } = setup();
    drag.down('0:cover.a', ev(100), track());
    expect(drag.value('1:cover.a')).toBeNull();
  });

  it('drags on without capture when setPointerCapture throws', () => {
    const { drag, onCommit } = setup();
    const t = track();
    t.setPointerCapture = () => {
      throw new Error('NotFoundError');
    };
    drag.down('k', ev(100), t);
    drag.up(ev(100));
    expect(onCommit).toHaveBeenCalledWith('k', 50);
  });

  it('a move to the same value reports nothing new', () => {
    const { drag, onChange } = setup();
    drag.down('k', ev(100), track());
    drag.move(ev(100.4));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('cancel after capture was already lost does not release again', () => {
    const { drag } = setup();
    const t = track();
    t.hasPointerCapture = () => false;
    drag.down('k', ev(100), t);
    drag.cancel();
    expect(t.release).not.toHaveBeenCalled();
  });
});
