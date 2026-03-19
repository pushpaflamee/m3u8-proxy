import https from "node:https";
import http from "node:http";

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 10000,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
});

function getHeaders(extra = {}) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://megacloud.club",
    "Referer": "https://megacloud.club/",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    ...extra,
  };
}

export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");

    target = decodeURIComponent(target);
    const uri = new URL(target);

    const options = {
      hostname: uri.hostname,
      port: uri.port || (uri.protocol === "https:" ? 443 : 80),
      path: uri.pathname + uri.search,
      method: req.method,
      headers: getHeaders({
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      }),
      agent: uri.protocol === "https:" ? httpsAgent : httpAgent,
    };

    const lib = uri.protocol === "https:" ? https : http;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");

    const proxy = lib.request(options, (r) => {
      if (r.headers["content-type"])
        res.setHeader("Content-Type", r.headers["content-type"]);

      if (r.headers["content-length"])
        res.setHeader("Content-Length", r.headers["content-length"]);

      if (r.headers["accept-ranges"])
        res.setHeader("Accept-Ranges", "bytes");

      if (r.headers["content-range"]) {
        res.setHeader("Content-Range", r.headers["content-range"]);
        res.writeHead(206);
      } else {
        res.writeHead(r.statusCode || 200);
      }

      r.pipe(res);
    });

    proxy.setTimeout(15000, () => {
      proxy.destroy();
    });

    proxy.on("error", (err) => {
      res.writeHead(500);
      res.end(err.message);
    });

    req.pipe(proxy);

  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
}
