export default {
  async fetch(req, env) {
    const res = await env.ASSETS.fetch(req);
    let headers = {
      "cross-origin-resource-policy": "same-origin",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      ...Object.fromEntries(res.headers.entries()),
      "access-control-allow-origin": "*",
      "access-control-max-age": "86400",
    };
    if(res.headers.get("content-type") === "text/html; charset=utf-8") {
      headers = {
        ...headers,
        "cross-origin-embedder-policy": "require-corp",
        "content-security-policy": `default-src 'none'; script-src 'self'; style-src 'self'; font-src: 'self'; connect-src 'self' https://github.com/ https://developers.cloudflare.com/ https://developer.mozilla.org; upgrade-insecure-requests; block-all-mixed-content; sandbox allow-same-origin allow-popups;`,
        "permissions-policy": "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
        "cross-origin-opener-policy": "same-origin",
      };
    }
    return new Response(res.body, {
      ...res,
      headers
    });
  }
}