import * as jsbos from '@open1s/jsbos';

export const Content = jsbos.Content;
export const ContentPart = jsbos.ContentPart;
export const Binary = jsbos.Binary;

/**
 * Compose message content for ask()/run()/stream().
 *
 * ```ts
 * await agent.ask(parts(text('What do you see?'), image(dataUrl)));
 * ```
 */

/** Text content, ready to pass to ask()/run()/stream(). */
export function text(content: string): any {
  return Content.text(content);
}

/** Image content from a `data:` or `http(s)` URL (or raw base64). */
export function image(source: string): any {
  return Content.image(source);
}

/** Combine text/image parts into a single multimodal message. */
export function parts(...items: any[]): any {
  return Content.parts(items.flat());
}

/**
 * Download an image and return it as a `data:` URL that every backend
 * accepts (local servers such as Ollama reject remote `http(s)` image URLs).
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${url}: HTTP ${res.status}`);
  }
  const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString('base64')}`;
}