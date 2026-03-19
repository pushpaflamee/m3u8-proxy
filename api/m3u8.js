export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");
    target = decodeURIComponent(target);

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        "Referer": "https://megacloud.club/",
        "Origin": "https://megacloud.club",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    let text = await response.text();

    // Block HTML (Cloudflare or invalid)
    if (
      contentType.includes("text/html") ||
      text.includes("<!DOCTYPE html") ||
      text.includes("Attention Required")
    ) {
      return res.status(403).send("Blocked or invalid response");
    }

    if (!text.includes("#EXTM3U")) {
      return res.status(500).send("Invalid m3u8");
    }

    const base = target.substring(0, target.lastIndexOf("/") + 1);

    text = text
      .split("\n")
      .map((line) => {
        line = line.trim();
        if (!line || line.startsWith("#")) return line;

        let absolute;
        try {
          absolute = line.startsWith("http")
            ? line
            : new URL(line, base).href;
        } catch {
          return line;
        }

        // Skip if already proxied
        if (absolute.includes("/proxy/")) return absolute;

        // Segments: .ts, .jpg, .jpeg, .m4s, .mp4, seg-*, or token-style (no ext, long path)
        const isSegment = /\.(ts|jpg|jpeg|m4s|mp4)(\?|$)/i.test(absolute) ||
                          absolute.includes("seg-") ||
                          (!absolute.includes(".m3u8") && (absolute.includes("~") || absolute.match(/\/[A-Za-z0-9~%+_\-]{40,}/)));

        if (isSegment) {
          return `/proxy/ts?url=${encodeURIComponent(absolute)}`;
        }

        // Nested m3u8
        if (absolute.includes(".m3u8")) {
          return `/proxy/m3u8?url=${encodeURIComponent(absolute)}`;
        }

        return absolute;
      })
      .join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    return res.status(200).send(text);
  } catch (e) {
    console.error(e);
    res.status(500).send("M3U8 proxy error");
  }
}
