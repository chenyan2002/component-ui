import { Platform } from './platform';

export const browserPlatform: Platform = {
  async importModule(code) {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
      return await import(/* @vite-ignore */ url);
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};

// Reads a component the user picked, or an example served with the app.
export async function readWasm(file: string | File): Promise<Uint8Array> {
  if (file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const url = new URL(import.meta.env.BASE_URL + file, window.location.origin);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
