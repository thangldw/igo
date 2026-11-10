// Import from OGS: the public SGF endpoint sends `access-control-allow-origin: *`, so the browser can fetch it directly.
export function parseOgsGameId(input) {
  const text = String(input || '').trim();
  if (/^\d{1,12}$/.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (!['online-go.com', 'www.online-go.com'].includes(url.hostname)) return null;
  const m = url.pathname.match(/^\/(?:game(?:\/view)?|api\/v1\/games)\/(\d{1,12})(?:\/sgf)?\/?$/);
  return m ? m[1] : null;
}
export const ogsSgfUrl = id => `https://online-go.com/api/v1/games/${id}/sgf`;
export async function fetchOgsSgf(id, fetchImpl = fetch, limit = 1000000) {
  const response = await fetchImpl(ogsSgfUrl(id), { headers: { accept: 'application/x-go-sgf,text/plain' } });
  if (response.status === 404) throw new Error('Không tìm thấy ván này trên OGS.');
  if (!response.ok) throw new Error(`OGS trả về lỗi ${response.status}.`);
  const text = await response.text();
  if (text.length > limit) throw new Error('File SGF từ OGS vượt 1 MB.');
  return text;
}
