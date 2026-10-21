// Camera photos for the stock opname evidence (06.9 §5): resized and compressed in the browser before upload.

const MAX_SIDE = 1600;

export function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("not an image"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });
}

export const photoUrl = (id: string) => `/api/so/count-photos/${id}`;

// Evidence documents of a count (2026-10-21): the same types and size as the server accepts (kopicalf attachments.py)
export const fileUrl = (id: string) => `/api/so/count-photos/files/${id}`;
export const MAX_FILES = 15;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt", "txt", "jpg", "jpeg", "png", "webp"];
export const FILE_ACCEPT = FILE_EXTENSIONS.map((e) => `.${e}`).join(",");
export const fileExt = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
export const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
