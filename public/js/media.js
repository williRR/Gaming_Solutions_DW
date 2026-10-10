function formatGoogleDriveImageUrl(value) {
  const url = String(value || '').trim();
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)(?:\/|$)/i)
    || url.match(/drive\.google\.com\/open\?id=([^&#]+)/i)
    || url.match(/[?&]id=([^&#]+)/i);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}
function imagePlaceholderSvg(label = 'Imagen no disponible') {
  const text = String(label).replace(/[<>&"']/g, '');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#eef0ed"/><path d="M220 245l70-75 48 48 35-35 80 82H220z" fill="#c8f05a"/><circle cx="355" cy="125" r="28" fill="#f17e61"/><text x="320" y="310" text-anchor="middle" fill="#78808a" font-family="Arial,sans-serif" font-size="18">${text}</text></svg>`)}`;
}
window.formatGoogleDriveImageUrl = formatGoogleDriveImageUrl;
window.imagePlaceholderSvg = imagePlaceholderSvg;
