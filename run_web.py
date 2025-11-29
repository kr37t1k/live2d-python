from logging import basicConfig, DEBUG
import http.server
import socketserver
import os

basicConfig(level=DEBUG)

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*') # Add CORS header
        super().end_headers()

handler_object = MyHttpRequestHandler

def serverInit(host, port):
    with socketserver.TCPServer((host, port), handler_object) as httpd:
        print(f"Serving at port {port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
        print("Server stopped.")
import eel
eel.init("/")
# eel.start("index.html")
# eel.init("C://Users/user/Desktop/WE/projects/myprojects/MyTermProj")
# eel.init("C://Users/user/Documents/GitHub/live2d-python/pixi/example")
eel.start("index.html")
