
export const postRaw = (name, data = {}) =>
  fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });

export const postJSON = async (name, data = {}) => {
  const res = await postRaw(name, data);

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`NUI ${name} failed: ${res.status} ${txt}`);
  }

  const text = await res.text().catch(() => '');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export const post = postRaw;

export function onMessage(fn) {
  window.addEventListener('message', (e) => fn(e.data || {}));
}

export async function requestStash() {
  return postJSON('getStash', {});
}
