import { writable, derived } from 'svelte/store';

export const playerName = writable('Citizen');
export const playerState = writable({ job:'', gang:'', onDuty:false });

export const apps = writable([]);       // من السيرفر (Config.Apps)
export const attached = writable([]);   // getStash.attached
export const inventory = writable([]);  // getStash.inventory
export const slots = writable(6);

export const attachedSet = derived(attached, ($a) => new Set($a.map(x => x.name)));
