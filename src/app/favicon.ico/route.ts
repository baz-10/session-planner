const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#17365d"/>
  <rect x="20" y="16" width="24" height="32" rx="4" fill="none" stroke="#34d3c5" stroke-width="5"/>
  <path d="M25 15h14v8H25z" fill="#17365d" stroke="#34d3c5" stroke-width="4" stroke-linejoin="round"/>
</svg>`;

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
