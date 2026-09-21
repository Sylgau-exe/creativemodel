// Minimal local stand-in for Vercel: static files from public/, api/*.js handlers, and the edge middleware on "/" and "/index.html".
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import middleware from "../middleware.js";

const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

export async function start(port = 0) {
  const handlers = {};
  for (const name of ["enter", "ping", "feedback", "prep", "admin", "opportunity"]) handlers[name] = (await import(`../api/${name}.js`)).default;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const h = handlers[url.pathname.slice(5)];
      if (!h) { res.statusCode = 404; return res.end(); }
      return h(req, res);
    }
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/opportunity.html") {
      const r = await middleware(new Request("http://localhost" + req.url, { headers: { cookie: req.headers.cookie || "" } }));
      if (r) { res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); return res.end(); }
    }
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      const body = await readFile(join(root, "public", file));
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      res.end(body);
    } catch { res.statusCode = 404; res.end("not found"); }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const { url } = await start(3456);
  console.log("local preview at " + url);
}
