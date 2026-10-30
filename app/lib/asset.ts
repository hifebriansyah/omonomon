// Addresses of files from the Python build (build/img, build/data) and the content JSON, under BASE_PATH.
// Content paths are relative ("build/img/1.webp"); full URLs are left alone.
export const asset = (path: string) => (/^(https?:|data:|blob:)/.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`);
