#!/usr/bin/env python3
"""Serveur local pour PopNote : sert le site statique. Aucune dépendance
externe, uniquement la bibliothèque standard.
"""
import functools
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        # Site perso a faible trafic : on desactive le cache pour eviter
        # qu'un navigateur (Safari en particulier) affiche des donnees
        # perimees apres une mise a jour.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8534
    handler = functools.partial(Handler, directory=str(BASE_DIR))
    with ThreadingHTTPServer(("", port), handler) as httpd:
        print(f"Carnet en ligne sur http://localhost:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
