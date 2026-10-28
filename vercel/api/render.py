"""POST /api/render: draws the sticky-note picture of a plain thought and answers with the JPEG.

Called by the API Worker (worker/api.js, renderNote) right after a plain whisper is posted; the Worker stores the picture in R2 itself.
Body (JSON): {"slug": "sundemon", "text": "the words", "n": 123}. Header X-Token must equal the environment variable RENDER_TOKEN
(the same secret the Worker holds as NOTE_RENDER_TOKEN). The function never talks to Cloudflare or the database: it only draws.
"""
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from note_render import find_font, jpeg, render_note  # noqa: E402

SLUGS = ("pocomon", "ngesomon", "sundemon", "kuntimon")


class handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type="application/json", cache=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache or "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, message):
        self._send(status, json.dumps({"error": message}).encode())

    def do_POST(self):
        secret = os.environ.get("RENDER_TOKEN", "")
        sent = self.headers.get("X-Token", "")
        if not secret or not hmac.compare_digest(sent.encode(), secret.encode()):
            return self._error(403, "forbidden")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 4096:
                return self._error(400, "bad request")
            body = json.loads(self.rfile.read(length))
            slug, text, n = body.get("slug"), str(body.get("text") or "").strip()[:260], int(body.get("n"))
        except (ValueError, TypeError):
            return self._error(400, "bad request")
        if slug not in SLUGS or not text or n < 0:
            return self._error(400, "bad request")
        try:
            data = jpeg(render_note(slug, text, n, find_font()))
        except Exception as e:  # a missing font or a drawing failure: tell the Worker, which just keeps the ghost's scene picture
            return self._error(500, f"render failed: {type(e).__name__}")
        self._send(200, data, "image/jpeg")

    def do_GET(self):
        self._send(200, b'{"ok": true}')   # a plain "is it alive" answer, nothing secret
