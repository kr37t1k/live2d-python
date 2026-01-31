"""
Live2D Desktop Window - Creates a transparent window with Live2D model rendering
Uses PyGame for window management and transparency, with WebKit for rendering the Live2D model
"""

import pygame
import sys
import os
import subprocess
import threading
import time
from flask import Flask, render_template_string, send_from_directory, request
from flask_socketio import SocketIO, emit
import json
import webbrowser
import socket
from dataclasses import dataclass, asdict
from typing import Dict
import numpy as np


class Live2DDesktopWindow:
    def __init__(self, model_path="web/models/Hiyori/Hiyori.model3.json", port=5000):
        """
        Initialize the Live2D Desktop Window
        
        Args:
            model_path: Path to the Live2D model file
            port: Port for the Flask server
        """
        self.model_path = model_path
        self.port = port
        self.server_process = None
        self.is_running = False
        
        # Initialize pygame for the transparent window
        pygame.init()
        
        # Set up the screen with per-pixel alpha
        self.screen = pygame.display.set_mode((400, 600), pygame.NOFRAME)
        pygame.display.set_caption("Live2D Desktop Mate")
        
        # Set window to be always on top (platform-specific)
        self._setup_window_properties()
        
        # Make the window transparent
        self._make_transparent()
        
        # Start the Flask server in a separate thread
        self.start_server()
    
    def _setup_window_properties(self):
        """Setup window properties to make it stay on top and transparent"""
        # Try to set window properties based on platform
        try:
            import pygame.display
            # This helps with making the window always on top
            os.environ['SDL_VIDEO_WINDOW_POS'] = 'center'
        except:
            pass
    
    def _make_transparent(self):
        """Make the window transparent"""
        # Fill with transparent color (alpha 0)
        self.screen.fill((0, 0, 0, 0))
        pygame.display.flip()
    
    def start_server(self):
        """Start the Flask server in a separate thread"""
        def run_server():
            # Get the directory of the current module
            module_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Initialize Flask app with template folder
            app = Flask(__name__, template_folder=os.path.join(module_dir, 'web'))
            
            # Initialize SocketIO with CORS allowed
            socketio = SocketIO(app, cors_allowed_origins="*")
            
            @dataclass
            class Live2DState:
                """Class to hold the state of the Live2D model including parameters and expressions"""
                parameters: Dict[str, float]
                expressions: Dict[str, bool]
                current_motion: str = ""
                lip_sync: float = 0.0
            
            # Initialize model state with default parameters and expressions
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
            
            # Keep track of connected clients
            connected_clients = set()
            
            @app.route('/')
            def index():
                """Route to serve the main index page"""
                with open(os.path.join(app.template_folder, 'index.html'), 'r', encoding='utf-8') as f:
                    return render_template_string(f.read())
            
            @app.route('/web/<path:filename>')
            def web(filename):
                """Route to serve static files from the web directory"""
                return send_from_directory('web', filename)
            
            # Endpoint to get client count
            @socketio.on('get_clients_count')
            def handle_get_clients_count(data):
                """Return the number of connected clients"""
                emit('clients_count_response', {'count': len(connected_clients)})
            
            # Socket event handlers
            @socketio.on('connect')
            def handle_connect():
                """Handle client connection"""
                connected_clients.add(request.sid)
                print(f'[+] Client connected: {request.sid}. Connected clients: {len(connected_clients)}')

                # Send initial model state to newly connected client
                emit('model_state', asdict(model_state))

            
            @socketio.on('disconnect')
            def handle_disconnect():
                """Handle client disconnection"""
                if request.sid in connected_clients:
                    connected_clients.remove(request.sid)
                print(f'[-] Client disconnected: {request.sid}. Connected clients: {len(connected_clients)}')

            
            @socketio.on('set_parameter')
            def handle_set_parameter(data):
                """Handle parameter update from client"""
                param_id = data.get('id')
                value = data.get('value')

                if param_id in model_state.parameters:
                    model_state.parameters[param_id] = max(-1.0, min(1.0, float(value)))

                    # Broadcast parameter update to all other clients
                    emit('parameter_update', {
                        'id': param_id,
                        'value': model_state.parameters[param_id]
                    }, broadcast=True, include_self=False)

                    print(f'Parameter {param_id} = {value}')

            
            @socketio.on('set_expression')
            def handle_set_expression(data):
                """Handle expression activation/deactivation from client"""
                expr = data.get('expression')
                active = data.get('active', False)

                if expr in model_state.expressions:
                    model_state.expressions[expr] = bool(active)
                    
                    # Broadcast expression update to all clients
                    emit('expression_update', {
                        'expression': expr,
                        'active': active
                    }, broadcast=True)
                    print(f'Expression {expr} = {active}')

            
            @socketio.on('play_motion')
            def handle_play_motion(data):
                """Handle motion playback request from client"""
                group = data.get('group', 'idle')
                index = data.get('index', 0)
                priority = data.get('priority', 3)

                model_state.current_motion = f'{group}_{index}'
                
                # Broadcast motion start to all clients
                emit('motion_start', {
                    'group': group,
                    'index': index,
                    'priority': priority
                }, broadcast=True)
                print(f'Motion: {group}[{index}] (priority: {priority})')

            
            @socketio.on('lip_sync')
            def handle_lip_sync(data):
                """Handle lip synchronization from client"""
                level = float(data.get('level', 0.0))
                model_state.lip_sync = max(0.0, min(1.0, level))

                # Calculate mouth opening based on audio level
                mouth_open = np.clip(level * 1.5, 0.0, 1.0)
                model_state.parameters['ParamMouthOpenY'] = mouth_open

                # Broadcast mouth parameter update to all clients
                emit('parameter_update', {
                    'id': 'ParamMouthOpenY',
                    'value': mouth_open
                }, broadcast=True)

            
            # Public API functions
            def set_parameter(param_id: str, value: float):
                """Set parameter value programmatically (public method for import)"""
                with app.app_context():
                    socketio.emit('parameter_update', {
                        'id': param_id,
                        'value': max(-1.0, min(1.0, value))
                    })

            
            def play_expression(expr_name: str, duration: float = 3.0):
                """Play expression animation programmatically (public method for import)"""
                with app.app_context():
                    socketio.emit('expression_update', {
                        'expression': expr_name,
                        'active': True
                    })
                    # Schedule deactivation after specified duration
                    socketio.start_background_task(
                        lambda: (time.sleep(duration),
                                 socketio.emit('expression_update', {
                                     'expression': expr_name,
                                     'active': False
                                 }))
                    )

            
            # Demo animation loop
            def demo_loop():
                """Run demo animation in background"""
                import math
                counter = 0

                while True:
                    time.sleep(0.033)  # ~30 FPS

                    if not connected_clients:
                        continue

                    # Animate head angle with sine wave
                    angle = math.sin(counter * 0.05) * 0.3
                    set_parameter('ParamAngleX', angle)

                    # Simulate blinking periodically
                    if int(counter) % 90 == 0:  # 3 sec * 30 FPS
                        set_parameter('ParamEyeLOpen', 0.0)
                        set_parameter('ParamEyeROpen', 0.0)
                        time.sleep(0.1)
                        set_parameter('ParamEyeLOpen', 1.0)
                        set_parameter('ParamEyeROpen', 1.0)
                    # Play random expressions periodically
                    if int(counter) % 200 == 0:
                        import random
                        expr = random.choice(list(model_state.expressions.keys()))
                        play_expression(expr, 2.0)

                    counter += 1

            
            # Run demo animation in background thread
            demo_thread = threading.Thread(target=demo_loop, daemon=True)
            demo_thread.start()
            
            # Start the Flask server
            socketio.run(app, host='127.0.0.1', port=self.port, debug=False, use_reloader=False)
        
        # Start the server in a separate thread
        self.server_thread = threading.Thread(target=run_server, daemon=True)
        self.server_thread.start()
        
        # Give the server a moment to start
        time.sleep(2)
        
        print(f'Server started on http://localhost:{self.port}')
    
    def run(self):
        """Main run loop for the desktop window"""
        self.is_running = True
        
        # Open the browser to the local server
        webbrowser.open_new_tab(f'http://localhost:{self.port}')
        
        clock = pygame.time.Clock()
        
        while self.is_running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.is_running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.is_running = False
            
            # Fill with transparent color
            self.screen.fill((0, 0, 0, 0))
            
            # Update display
            pygame.display.flip()
            clock.tick(60)  # 60 FPS
        
        pygame.quit()
        sys.exit()


def main():
    """Main function to run the Live2D Desktop Window"""
    # Create and run the desktop window
    desktop_window = Live2DDesktopWindow()
    desktop_window.run()


if __name__ == "__main__":
    main()