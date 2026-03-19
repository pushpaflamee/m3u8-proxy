export default async function handler(req, res) {
  try {
    let target = decodeURIComponent(req.query.url);
    if (!target) return res.status(400).send("Missing url");

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://megacloud.blog/",
        "Origin": "https://megacloud.blog"
      }
    });

    let text = await response.text();
    const base = target.substring(0, target.lastIndexOf("/") + 1);

    text = text.split("\n").map(line => {
      if (!line || line.startsWith("#")) return line;

      let absolute = line.startsWith("http")
        ? line
        : new URL(line, base).href;

      // 🔴 IMPORTANT LOGIC

      // if segment (.ts OR .jpg)
      if (
        absolute.includes(".ts") ||
        absolute.includes(".jpg") ||
        absolute.includes("seg-")
      ) {
        return `/proxy/ts?url=${encodeURIComponent(absolute)}`;
      }

      // if nested m3u8
      return `/proxy/m3u8?url=${encodeURIComponent(absolute)}`;

    }).join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.send(text);

  } catch (e) {
    res.status(500).send("M3U8 proxy error");
  }
}
