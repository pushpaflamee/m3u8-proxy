export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");

    target = decodeURIComponent(target);

    const isM3U8 = target.includes(".m3u8");

    // =============================
    // 🎯 FETCH
    // =============================
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://megacloud.blog/",
        "Origin": "https://megacloud.blog",
        ...(req.headers.range && { Range: req.headers.range })
      }
    });

    const contentType = response.headers.get("content-type") || "";

    // =============================
    // 🎬 HANDLE M3U8
    // =============================
    if (isM3U8 || contentType.includes("mpegurl")) {
      let text = await response.text();
      const base = target.substring(0, target.lastIndexOf("/") + 1);

      text = text.split("\n").map(line => {
        if (!line || line.startsWith("#")) return line;

        let absolute = line.startsWith("http")
          ? line
          : new URL(line, base).href;

        // =============================
        // 🔴 HD-1 (animeparadise)
        // =============================
        if (absolute.includes("rainveil") || absolute.includes("haildrop") || absolute.includes("frostshine")) {
          if (absolute.includes(".m3u8")) {
            return `/proxy?url=${encodeURIComponent(absolute)}`;
          } else {
            return `/proxy?url=${encodeURIComponent(absolute)}`; // handles .jpg too
          }
        }

        // =============================
        // 🔵 HD-2 (netmagcdn)
        // =============================
        if (absolute.includes("netmagcdn")) {
          return `/proxy?url=${encodeURIComponent(absolute)}`;
        }

        // =============================
        // 🟢 HD-3 (douvid)
        // =============================
        if (absolute.includes("douvid")) {
          return `/proxy?url=${encodeURIComponent(absolute)}`;
        }

        // default
        return `/proxy?url=${encodeURIComponent(absolute)}`;

      }).join("\n");

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");

      return res.send(text);
    }

    // =============================
    // 📦 SEGMENTS (ALL TYPES)
    // =============================

    res.setHeader("Access-Control-Allow-Origin", "*");

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

    // 🔥 STREAM FIX
    response.body.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
}
