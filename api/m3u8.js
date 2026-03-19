export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");

    target = decodeURIComponent(target);

    // =============================
    // 🔥 FETCH WITH STRONG HEADERS
    // =============================
    const response = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        "Referer": "https://megacloud.club/",
        "Origin": "https://megacloud.club",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    let text = await response.text();

    // =============================
    // 🚫 BLOCK HTML (Cloudflare)
    // =============================
    if (
      contentType.includes("text/html") ||
      text.includes("<!DOCTYPE html") ||
      text.includes("cf-browser-verification") ||
      text.includes("Attention Required")
    ) {
      return res.status(403).send("Blocked by Cloudflare");
    }

    // =============================
    // 🎬 VALIDATE M3U8
    // =============================
    if (!text.includes("#EXTM3U")) {
      return res.status(500).send("Invalid m3u8 response");
    }

    const base = target.substring(0, target.lastIndexOf("/") + 1);

    // =============================
    // 🔁 REWRITE PLAYLIST
    // =============================
    text = text
      .split("\n")
      .map((line) => {
        if (!line || line.startsWith("#")) return line;

        let absolute = line.startsWith("http")
          ? line
          : new URL(line, base).href;

        // 🔴 SEGMENTS (.ts / .jpg / seg-)
        if (
          absolute.includes(".ts") ||
          absolute.includes(".jpg") ||
          absolute.includes("seg-")
        ) {
          return `/proxy/ts?url=${encodeURIComponent(absolute)}`;
        }

        // 🔵 NESTED M3U8
        if (absolute.includes(".m3u8")) {
          return `/proxy/m3u8?url=${encodeURIComponent(absolute)}`;
        }

        // fallback
        return absolute;
      })
      .join("\n");

    // =============================
    // 📤 RESPONSE
    // =============================
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    return res.status(200).send(text);

  } catch (e) {
    console.error("M3U8 ERROR:", e);
    res.status(500).send("M3U8 proxy error");
  }
}
