export type UploadProgressCallback = (progress: number) => void;

export type UploadFileOptions = {
  signal?: AbortSignal;
  onProgress?: UploadProgressCallback;
};

export type UploadFileResponse = {
  url: string;
  publicUrl?: string;
};

const readErrorMessage = (responseText: string): string => {
  try {
    const parsed = JSON.parse(responseText);
    if (parsed?.error) {
      return String(parsed.error);
    }
  } catch {
    // noop
  }

  return responseText || "Upload failed.";
};

export function uploadFile(file: File, options: UploadFileOptions = {}): Promise<UploadFileResponse> {
  return new Promise<UploadFileResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress) return;
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress(percent);
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading file."));
    };

    xhr.onload = () => {
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          reject(new Error("Invalid server response."));
        }
        return;
      }

      const message = readErrorMessage(xhr.responseText);
      reject(new Error(message));
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
