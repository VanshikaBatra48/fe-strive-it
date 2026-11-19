import { useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';

const formatSize = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function AttachmentView({ att }) {
  const [src, setSrc] = useState(null);
  const isImage = att.mimeType.startsWith('image/');

  // Images are fetched with the auth header, then shown through a temporary blob URL
  useEffect(() => {
    if (!isImage) return undefined;
    let objectUrl = null;
    let cancelled = false;

    chatApi
      .fetchAttachment(att.url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [att.url, isImage]);

  const download = async () => {
    const blob = await chatApi.fetchAttachment(att.url);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.originalName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isImage) {
    return src ? (
      <img className="chat-img" src={src} alt={att.originalName} onClick={download} title="Click to download" />
    ) : (
      <div className="chat-img chat-img--loading">Loading image…</div>
    );
  }

  return (
    <button type="button" className="chat-file" onClick={download}>
      📎 {att.originalName} <small>({formatSize(att.size)})</small>
    </button>
  );
}