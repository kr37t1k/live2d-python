from flask import Flask, render_template_string, send_from_directory, request
from flask_socketio import SocketIO, emit
import json
import time
import threading
from dataclasses import dataclass, asdict
from typing import Dict
import numpy as np
import os

module_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web'))
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@dataclass
class Live2DState:
    parameters: Dict[str, float]
    expressions: Dict[str, bool]
    current_motion: str = ""
    lip_sync: float = 0.0

model_state = Live2DState(
    parameters={
        'ParamAngleX': 0.0,
        'ParamAngleY': 0.0,
        'ParamAngleZ': 0.0,
        'ParamBodyAngleX': 0.0,
        'ParamEyeLOpen': 1.0,
        'ParamEyeROpen': 1.0,
        'ParamEyeBallX': 0.0,
        'ParamEyeBallY': 0.0,
        'ParamMouthOpenY': 0.0,
        'ParamBrowLY': 0.0,
        'ParamBrowRY': 0.0
    },
    expressions={
        'smile': False,
        'angry': False,
        'sad': False,
        'surprised': False
    }
)

connected_clients = set()

@app.route('/')
def index():
    with open(os.path.join(app.template_folder, 'index.html'), 'r', encoding='utf-8') as f:
        return render_template_string(f.read())

@app.route('/web/<path:filename>')
def web(filename):
    return send_from_directory('web', filename)

# Private methods
@socketio.on('connect')
def handle_connect():
    """Client connected"""
    connected_clients.add(request.sid)
    print(f'[+] client connected: {request.sid}. connected clients: {len(connected_clients)}')

    emit('model_state', asdict(model_state))


@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected"""
    if request.sid in connected_clients:
        connected_clients.remove(request.sid)
    print(f'[-] client disconnected: {request.sid}. connected clients: {len(connected_clients)}')


@socketio.on('set_parameter')
def handle_set_parameter(data):
    """Set model parameter"""
    param_id = data.get('id')
    value = data.get('value')

    if param_id in model_state.parameters:
        model_state.parameters[param_id] = max(-1.0, min(1.0, float(value)))

        emit('parameter_update', {
            'id': param_id,
            'value': model_state.parameters[param_id]
        }, broadcast=True, include_self=False)

        print(f'Parameter {param_id} = {value}')


@socketio.on('set_expression')
def handle_set_expression(data):
    """Activate/deactivate expression"""
    expr = data.get('expression')
    active = data.get('active', False)

    if expr in model_state.expressions:
        model_state.expressions[expr] = bool(active)
        emit('expression_update', {
            'expression': expr,
            'active': active
        }, broadcast=True)
        print(f'Expression {expr} = {active}')


@socketio.on('play_motion')
def handle_play_motion(data):
    """Play motion"""
    group = data.get('group', 'idle')
    index = data.get('index', 0)
    priority = data.get('priority', 3)

    model_state.current_motion = f'{group}_{index}'
    emit('motion_start', {
        'group': group,
        'index': index,
        'priority': priority
    }, broadcast=True)
    print(f'Motion: {group}[{index}] (priority: {priority})')


@socketio.on('lip_sync')
def handle_lip_sync(data):
    """Synchronize lip movement"""
    level = float(data.get('level', 0.0))
    model_state.lip_sync = max(0.0, min(1.0, level))

    mouth_open = np.clip(level * 1.5, 0.0, 1.0)
    model_state.parameters['ParamMouthOpenY'] = mouth_open

    emit('parameter_update', {
        'id': 'ParamMouthOpenY',
        'value': mouth_open
    }, broadcast=True)


# Public
def set_parameter(param_id: str, value: float):
    """Set parameter value (public method for import)"""
    with app.app_context():
        socketio.emit('parameter_update', {
            'id': param_id,
            'value': max(-1.0, min(1.0, value))
        })


def play_expression(expr_name: str, duration: float = 3.0):
    """Play animation (public method for import)"""
    with app.app_context():
        socketio.emit('expression_update', {
            'expression': expr_name,
            'active': True
        })
        socketio.start_background_task(
            lambda: (time.sleep(duration),
                     socketio.emit('expression_update', {
                         'expression': expr_name,
                         'active': False
                     }))
        )


# Demo-Animation
def demo_loop():
    import math
    counter = 0

    while True:
        time.sleep(0.033)  # ~30 FPS

        if not connected_clients:
            continue

        # head angle
        angle = math.sin(counter * 0.05) * 0.3
        set_parameter('ParamAngleX', angle)

        # blink
        if int(counter) % 90 == 0:  # 3 sec * 30 FPS
            set_parameter('ParamEyeLOpen', 0.0)
            set_parameter('ParamEyeROpen', 0.0)
            time.sleep(0.1)
            set_parameter('ParamEyeLOpen', 1.0)
            set_parameter('ParamEyeROpen', 1.0)
        if int(counter) % 200 == 0:
            import random
            expr = random.choice(list(model_state.expressions.keys()))
            play_expression(expr, 2.0)

        counter += 1


# Run demo animation in background thread
demo_thread = threading.Thread(target=demo_loop, daemon=True)
demo_thread.start()

if __name__ == '__main__':
    print('open http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)