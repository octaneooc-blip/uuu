import { writable } from 'svelte/store';

export const clock = writable('--:--');

export function startClock(){
  const tick = () => {
    const d = new Date();
    clock.set(d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
