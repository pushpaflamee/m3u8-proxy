export default async function handler(req, res) {
  try {
    let target = decodeURIComponent(req.query.url);
    if (!target) return res.status(400).send("Missing url");

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://megacloud.blog/",
        "Origin": "https://megacloud.blog",
        ...(req.headers.range ? { Range: req.headers.range } : {})
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    // pass headers
    if (response.headers.get("content-type")) {
      res.setHeader("Content-Type", response.headers.get("content-type"));
    }

    if (response.headers.get("content-length")) {
      res.setHeader("Content-Length", response.headers.get("content-length"));
    }

    if (response.headers.get("content-range")) {
      res.setHeader("Content-Range", response.headers.get("content-range"));
      res.status(206);
    } else {
      res.status(200);
    }

    // 🔥 STREAM (MOST IMPORTANT)
    response.body.pipe(res);

  } catch (e) {
    res.status(500).send("TS proxy error");
  }
}
