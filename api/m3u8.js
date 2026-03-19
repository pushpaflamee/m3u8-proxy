export default async function handler(req, res) {
  try {
    let target = req.query.url;
    if (!target) return res.status(400).send("Missing url");
    target = decodeURIComponent(target);

    // Advanced Browser Headers to bypass Cloudflare/Bot protection
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://megacloud.club/",
      "Origin": "https://megacloud.club",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      // Some WAFs block if no cookie is present, adding a dummy one helps
      "Cookie": "cf_clearance=; _ga=; _gid=" 
    };

    const response = await fetch(target, {
      method: "GET",
      headers: headers,
      redirect: "follow", // Handle redirects explicitly
      // Force HTTP/1.1 behavior if possible via agent (handled internally by fetch mostly)
    });

    const contentType = response.headers.get("content-type") || "";
    let text = await response.text();

    // Double check for Cloudflare blocks even if status was 200 (soft blocks)
    if (
      response.status === 403 || 
      response.status === 429 ||
      contentType.includes("text/html") ||
      text.includes("<!DOCTYPE html") ||
      text.includes("Attention Required") ||
      text.includes("cf-browser-verification") ||
      text.includes("rayID")
    ) {
      console.error(`[M3U8] Blocked by upstream. Status: ${response.status}`);
      return res.status(403).send("Upstream blocked request (Cloudflare/WAF). Try again or check IP reputation.");
    }

    if (!text.includes("#EXTM3U")) {
      // If it's not HTML but also not M3U8, it might be binary or empty
      return res.status(500).send("Invalid m3u8 content received");
    }

    const base = target.substring(0, target.lastIndexOf("/") + 1);

    text = text.split("\n").map((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return line;

      let absolute;
      try {
        absolute = line.startsWith("http") ? line : new URL(line, base).href;
      } catch {
        return line;
      }

      if (absolute.includes("/proxy/")) return absolute;

      // Robust segment detection: seg- pattern OR common extensions OR token URLs
      const isSegment = 
        absolute.includes("seg-") || 
        /\.(ts|jpg|jpeg|png|m4s|mp4|webp|ico|css|js|html|txt)(\?|$)/i.test(absolute) ||
        (!absolute.includes(".m3u8") && absolute.length > 100); // Fallback for long token URLs

      if (isSegment) {
        return `/proxy/ts?url=${encodeURIComponent(absolute)}`;
      }

      if (absolute.includes(".m3u8")) {
        return `/proxy/m3u8?url=${encodeURIComponent(absolute)}`;
      }

      return absolute;
    }).join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Vary", "Accept-Encoding");
    
    return res.status(200).send(text);
  } catch (e) {
    console.error("[M3U8 Error]", e);
    res.status(500).send(`Proxy Error: ${e.message}`);
  }
}
