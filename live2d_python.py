from flask import Flask, send_file
from flask_socketio import SocketIO, emit

app = Flask(__name__)
sio = SocketIO(app)

@app.route('/')
def index():
    return send_file('index.html')

@sio.on('connect')
def handle_connect():
    emit('animate', {'mounthOpen': 0.8})

if __name__ == '__main__':
    sio.run(app, host='0.0.0.0', port=2033, debug=True)
