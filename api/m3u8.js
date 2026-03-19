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

    // === DEBUG: Return raw response for inspection ===
    return res.status(200).send(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      contentType: contentType,
      first500Chars: text.substring(0, 500),
      fullLength: text.length,
      includesEXTM3U: text.includes("#EXTM3U"),
      includesDOCTYPE: text.includes("<!DOCTYPE"),
      includesCloudflare: text.includes("Cloudflare") || text.includes("Attention Required")
    }, null, 2));
    // === END DEBUG ===

    // (Comment out the rest until you confirm what's being returned)

  } catch (e) {
    console.error(e);
    res.status(500).send("M3U8 proxy error: " + e.message);
  }
}
