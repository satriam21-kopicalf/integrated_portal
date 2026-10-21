// URLs of the stock opname evidence (06.9 §5): photos (taken with the camera) and documents.

export const photoUrl = (id: string) => `/api/so/count-photos/${id}`;

// Evidence documents of a count (2026-10-21): the same types and size as the server accepts (kopicalf attachments.py)
export const fileUrl = (id: string) => `/api/so/count-photos/files/${id}`;
export const MAX_FILES = 15;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt", "txt", "jpg", "jpeg", "png", "webp"];
export const FILE_ACCEPT = FILE_EXTENSIONS.map((e) => `.${e}`).join(",");
export const fileExt = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
export const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
