#!/usr/bin/env python3
import http.server
import socket
import socketserver
import webbrowser
from pathlib import Path

PORT = 8080
Path(__file__).resolve().parent.chdir() if hasattr(Path, "chdir") else None

# Compatibile con tutte le versioni Python: spostati nella cartella dello script.
import os
os.chdir(Path(__file__).resolve().parent)

try:
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
except OSError:
    local_ip = "IP-DEL-COMPUTER"

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as server:
    print("\nTaxi Ledger Web è avviato.")
    print(f"Su questo computer: http://localhost:{PORT}")
    print(f"Da iPhone sulla stessa rete Wi-Fi: http://{local_ip}:{PORT}")
    print("Premi Ctrl+C per arrestare il server.\n")
    webbrowser.open(f"http://localhost:{PORT}")
    server.serve_forever()
