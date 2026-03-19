import https from "node:https";
import http from "node:http";

// Reuse agents for keep-alive performance
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 10000,
  rejectUnauthorized: false, // Sometimes helps with self-signed certs on edge nodes
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
});

function getHeaders(extra = {}) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://megacloud.club",
    "Referer": "https://megacloud.club/",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    ...extra,
  };
}

export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");
    target = decodeURIComponent(target);
    
    const uri = new URL(target);
    const isHttps = uri.protocol === "https:";

    const options = {
      hostname: uri.hostname,
      port: uri.port || (isHttps ? 443 : 80),
      path: uri.pathname + uri.search,
      method: req.method,
      headers: getHeaders({
        ...(req.headers.range ? { Range: req.headers.range } : {}),
        // Pass through host to avoid some SNI issues
        Host: uri.host 
      }),
      agent: isHttps ? httpsAgent : httpAgent,
      timeout: 15000,
    };

    const lib = isHttps ? https : http;

    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Origin, Referer, User-Agent");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");

    const proxyReq = lib.request(options, (proxyRes) => {
      // If upstream returns 403/429, pass it clearly
      if (proxyRes.statusCode === 403 || proxyRes.statusCode === 429) {
        res.writeHead(proxyRes.statusCode, { "Content-Type": "text/plain" });
        return res.end("Upstream Forbidden. IP blocked by source server.");
      }

      // Forward valid headers
      const resHeaders = {};
      if (proxyRes.headers["content-type"]) resHeaders["Content-Type"] = proxyRes.headers["content-type"];
      if (proxyRes.headers["content-length"]) resHeaders["Content-Length"] = proxyRes.headers["content-length"];
      if (proxyRes.headers["accept-ranges"]) resHeaders["Accept-Ranges"] = proxyRes.headers["accept-ranges"];
      if (proxyRes.headers["content-range"]) {
        resHeaders["Content-Range"] = proxyRes.headers["content-range"];
        res.writeHead(206, resHeaders);
      } else {
        res.writeHead(proxyRes.statusCode || 200, resHeaders);
      }

      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      console.error("Proxy Request Error:", err.message);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Upstream connection failed: ${err.message}`);
      } else {
        res.end();
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { "Content-Type": "text/plain" });
        res.end("Upstream timeout");
      }
    });

    req.pipe(proxyReq);

  } catch (e) {
    console.error("TS Handler Error:", e);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(e.message);
    }
  }
}
