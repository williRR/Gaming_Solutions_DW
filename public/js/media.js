function formatGoogleDriveImageUrl(value) {
  const url = String(value || '').trim();
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)(?:\/|$)/i);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}
window.formatGoogleDriveImageUrl = formatGoogleDriveImageUrl;
