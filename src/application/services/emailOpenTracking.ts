const TRACKING_PATH = "/api/v1/public/email-open";

export function resolveTrackingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function appendEmailTrackingPixel(
  html: string,
  trackingToken: string,
): string {
  const pixelUrl = `${resolveTrackingBaseUrl()}${TRACKING_PATH}/${encodeURIComponent(trackingToken)}.gif`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  const bodyClose = /<\/body\s*>/i;

  return bodyClose.test(html)
    ? html.replace(bodyClose, `${pixel}</body>`)
    : `${html}${pixel}`;
}
