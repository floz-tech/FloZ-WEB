#!/usr/bin/env python3
"""
High-performance local static server for FloZ web.
Features:
- Handles assets saved with query strings (e.g. ?dpl=...) and URL-encoded (%3F) filenames
- Correct JavaScript ES module & CSS MIME types
- HTTP 206 Partial Content (Range requests) for video playback (.mp4)
- Multi-threaded for concurrent asset downloads
- CORS headers for local testing
"""

import sys
import os
import re
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".webmanifest": "application/manifest+json",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
}

class FlozRequestHandler(BaseHTTPRequestHandler):
    server_version = "FlozServer/1.0"

    def guess_mimetype(self, filepath):
        basename = os.path.basename(filepath)
        clean_name = basename.split("?")[0]
        ext = os.path.splitext(clean_name)[1].lower()
        return MIME_TYPES.get(ext, "application/octet-stream")

    def resolve_path(self, raw_url_path):
        base_dir = self.server.base_dir
        rel_path = raw_url_path.lstrip("/")
        
        url_path, sep, query = rel_path.partition("?")
        
        candidates = []
        if rel_path:
            candidates.append(urllib.parse.unquote(rel_path))
            candidates.append(rel_path)
            
        if query:
            candidates.append(urllib.parse.unquote(url_path) + "?" + query)
            candidates.append(url_path + "?" + query)
            
        candidates.append(urllib.parse.unquote(url_path))
        candidates.append(url_path)
        
        for cand in candidates:
            if not cand:
                continue
            full = os.path.normpath(os.path.join(base_dir, cand))
            if not full.startswith(base_dir):
                continue
            if os.path.isfile(full):
                return full
            if os.path.isdir(full):
                idx = os.path.join(full, "index.html")
                if os.path.isfile(idx):
                    return idx
                    
        clean_cand = urllib.parse.unquote(url_path)
        if clean_cand:
            html_try = os.path.normpath(os.path.join(base_dir, clean_cand + ".html"))
            if html_try.startswith(base_dir) and os.path.isfile(html_try):
                return html_try
                
        dirname, basename = os.path.split(urllib.parse.unquote(url_path))
        target_dir = os.path.normpath(os.path.join(base_dir, dirname))
        if target_dir.startswith(base_dir) and os.path.isdir(target_dir):
            clean_base = basename.split("?")[0]
            if clean_base:
                try:
                    for f in os.listdir(target_dir):
                        if f.startswith(clean_base):
                            return os.path.join(target_dir, f)
                except OSError:
                    pass

        if not rel_path or url_path in ("", "/"):
            idx = os.path.join(base_dir, "index.html")
            if os.path.isfile(idx):
                return idx
                
        return None

    def do_HEAD(self):
        self.handle_request(send_body=False)

    def do_GET(self):
        self.handle_request(send_body=True)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def handle_request(self, send_body=True):
        filepath = self.resolve_path(self.path)
        if not filepath or not os.path.isfile(filepath):
            self.send_error(404, f"File not found: {self.path}")
            return

        try:
            file_size = os.path.getsize(filepath)
            content_type = self.guess_mimetype(filepath)
            
            range_header = self.headers.get("Range")
            start = 0
            end = file_size - 1
            is_range = False

            if range_header and range_header.startswith("bytes="):
                range_match = re.match(r"bytes=(\d*)-(\d*)", range_header)
                if range_match:
                    r_start, r_end = range_match.groups()
                    if r_start:
                        start = int(r_start)
                    if r_end:
                        end = int(r_end)
                    if start <= end and start < file_size:
                        end = min(end, file_size - 1)
                        is_range = True

            if is_range:
                self.send_response(206)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                content_len = end - start + 1
            else:
                self.send_response(200)
                content_len = file_size

            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(content_len))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            if send_body:
                with open(filepath, "rb") as f:
                    if start > 0:
                        f.seek(start)
                    bytes_remaining = content_len
                    chunk_size = 64 * 1024
                    while bytes_remaining > 0:
                        chunk = f.read(min(chunk_size, bytes_remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        bytes_remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.send_error(500, f"Internal server error: {e}")

    def log_message(self, format, *args):
        msg = format % args
        if " 404 " in msg:
            print(f"\033[31m[404]\033[0m {msg}", flush=True)
        elif " 200 " in msg or " 206 " in msg:
            print(f"\033[32m[OK]\033[0m {msg}", flush=True)
        else:
            print(f"[Floz] {msg}", flush=True)

def run(port=8000, base_dir=None):
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(base_dir)

    server = ThreadingHTTPServer(("0.0.0.0", port), FlozRequestHandler)
    server.base_dir = base_dir

    print("=" * 60)
    print(f"🚀 FloZ Web Local Server Running!")
    print(f"📁 Serving Directory: {base_dir}")
    print(f"🌐 Local URL:         http://localhost:{port}")
    print(f"🌐 Network URL:       http://127.0.0.1:{port}")
    print("=" * 60)
    print("Press Ctrl+C to stop the server.\n", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    base_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
    run(port=port, base_dir=base_dir)
