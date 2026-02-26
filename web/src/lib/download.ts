const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5131";

/**
 * Download a file from an authenticated API endpoint.
 * Uses fetch + Blob so the JWT Authorization header is sent.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
