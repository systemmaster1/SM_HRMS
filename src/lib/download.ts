/**
 * Saves a generated file (PDF, CSV).
 *  - Browser: normal download.
 *  - SM HRMS Android app: WebView cannot download generated files, so the
 *    file is handed to the app, which opens the Android share sheet
 *    (open / save to Files or Drive / send on WhatsApp or email).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const native = typeof window !== "undefined" ? (window as any).SMHRMSNative : null;
  if (native && typeof native.saveFile === "function") {
    const b64 = await blobToBase64(blob);
    const res = String(native.saveFile(filename, blob.type || "application/octet-stream", b64) || "");
    if (res.startsWith("error:")) throw new Error(res.slice(6) || "Could not save the file.");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
