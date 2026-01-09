"""
Live2D Desktop Mate - Python Control Server
Full API for controlling Live2D models with advanced features
"""

import asyncio
import websockets
import json
import logging
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Callable
from enum import Enum
import time
import threading
import queue
import numpy as np


class MotionPriority(Enum):
    NONE = 0
    IDLE = 1
    NORMAL = 2
    FORCE = 3


@dataclass
class Live2DState:
    """Class to hold the state of the Live2D model including parameters and expressions"""
    parameters: Dict[str, float]
    expressions: Dict[str, bool]
    current_motion: str = ""
    lip_sync_level: float = 0.0
    eye_blink_enabled: bool = True
    breathing_enabled: bool = True


class Live2DAPI:
    """Main Live2D control API class"""
    
    def __init__(self):
        self.state = Live2DState(
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
                'ParamBrowRY': 0.0,
                'ParamBreath': 0.5
            },
            expressions={
                'smile': False,
                'angry': False,
                'sad': False,
                'surprised': False
            }
        )
        
        # Event callbacks
        self._event_handlers = {}
        
        # Motion management
        self.current_priority = MotionPriority.NONE
        self.motion_queue = queue.Queue()
        
        # Animation loops
        self.animation_tasks = []
        self.running = True
        
        # Initialize default animations
        self._start_default_animations()
    
    def _start_default_animations(self):
        """Start default animations like breathing and blinking"""
        # Start breathing animation
        breathing_task = threading.Thread(target=self._breathing_loop, daemon=True)
        breathing_task.start()
        
        # Start blinking animation
        blink_task = threading.Thread(target=self._blink_loop, daemon=True)
        blink_task.start()
    
    def _breathing_loop(self):
        """Background breathing animation"""
        while self.running:
            if self.state.breathing_enabled:
                # Breathing animation: slow sine wave
                breath_value = 0.5 + 0.1 * np.sin(time.time() * 0.5)
                self.set_parameter('ParamBreath', breath_value)
            time.sleep(0.1)  # Update every 100ms
    
    def _blink_loop(self):
        """Background blinking animation"""
        last_blink_time = time.time()
        while self.running:
            if self.state.eye_blink_enabled and (time.time() - last_blink_time) > 3.0:
                # Random blink interval between 3-8 seconds
                if np.random.random() > 0.7:  # 30% chance to blink
                    self._perform_blink()
                    last_blink_time = time.time()
            time.sleep(0.5)  # Check every 500ms
    
    def _perform_blink(self):
        """Perform a blink animation"""
        # Close eyes
        self.set_parameter('ParamEyeLOpen', 0.0)
        self.set_parameter('ParamEyeROpen', 0.0)
        time.sleep(0.1)
        # Open eyes
        self.set_parameter('ParamEyeLOpen', 1.0)
        self.set_parameter('ParamEyeROpen', 1.0)
    
    def set_parameter(self, param_id: str, value: float) -> bool:
        """Set a parameter value"""
        if param_id in self.state.parameters:
            # Clamp value between -1 and 1
            clamped_value = max(-1.0, min(1.0, float(value)))
            self.state.parameters[param_id] = clamped_value
            
            # Trigger parameter changed event
            self._trigger_event('parameter_changed', {
                'id': param_id,
                'value': clamped_value
            })
            
            return True
        return False
    
    def get_parameter(self, param_id: str) -> Optional[float]:
        """Get a parameter value"""
        return self.state.parameters.get(param_id)
    
    def set_expression(self, expression: str, active: bool = True) -> bool:
        """Set an expression"""
        if expression in self.state.expressions:
            self.state.expressions[expression] = active
            
            # Trigger expression changed event
            self._trigger_event('expression_changed', {
                'expression': expression,
                'active': active
            })
            
            return True
        return False
    
    def play_motion(self, group: str, index: int = 0, priority: int = MotionPriority.NORMAL.value) -> bool:
        """Play a motion with priority"""
        if priority < self.current_priority.value:
            return False  # Lower priority, don't interrupt
        
        old_priority = self.current_priority
        self.current_priority = MotionPriority(priority)
        
        # Trigger motion start event
        self._trigger_event('motion_started', {
            'group': group,
            'index': index,
            'priority': priority
        })
        
        # Simulate motion duration (in a real implementation, this would play actual motion data)
        def finish_motion():
            time.sleep(2.0)  # Simulate 2 second motion
            self.current_priority = old_priority
            self._trigger_event('motion_finished', {
                'group': group,
                'index': index
            })
        
        motion_thread = threading.Thread(target=finish_motion, daemon=True)
        motion_thread.start()
        
        return True
    
    def set_lip_sync(self, level: float):
        """Set lip sync level for mouth animation"""
        level = max(0.0, min(1.0, float(level)))
        self.state.lip_sync_level = level
        
        # Map audio level to mouth openness
        mouth_open = level * 1.5  # Amplify slightly for better effect
        mouth_open = min(1.0, mouth_open)  # Cap at 1.0
        
        self.set_parameter('ParamMouthOpenY', mouth_open)
        
        self._trigger_event('lip_sync_updated', {
            'level': level,
            'mouth_open': mouth_open
        })
    
    def set_eye_tracking(self, x: float, y: float):
        """Set eye tracking values"""
        x = max(-1.0, min(1.0, float(x)))
        y = max(-1.0, min(1.0, float(y)))
        
        self.set_parameter('ParamEyeBallX', x)
        self.set_parameter('ParamEyeBallY', y)
        
        self._trigger_event('eye_tracking_updated', {
            'x': x,
            'y': y
        })
    
    def set_head_rotation(self, x: float, y: float, z: float = 0.0):
        """Set head rotation"""
        x = max(-30.0, min(30.0, float(x)))
        y = max(-30.0, min(30.0, float(y)))
        z = max(-30.0, min(30.0, float(z)))
        
        self.set_parameter('ParamAngleX', x / 30.0)  # Normalize to -1 to 1
        self.set_parameter('ParamAngleY', y / 30.0)
        self.set_parameter('ParamAngleZ', z / 30.0)
        
        self._trigger_event('head_rotation_updated', {
            'x': x, 'y': y, 'z': z
        })
    
    def add_event_handler(self, event_type: str, handler: Callable):
        """Add an event handler for specific events"""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)
    
    def remove_event_handler(self, event_type: str, handler: Callable):
        """Remove an event handler"""
        if event_type in self._event_handlers:
            if handler in self._event_handlers[event_type]:
                self._event_handlers[event_type].remove(handler)
    
    def _trigger_event(self, event_type: str, data: dict):
        """Trigger an event with data"""
        if event_type in self._event_handlers:
            for handler in self._event_handlers[event_type]:
                try:
                    handler(data)
                except Exception as e:
                    logging.error(f"Error in event handler for {event_type}: {e}")
    
    def get_state(self) -> dict:
        """Get current model state"""
        return asdict(self.state)
    
    def reset_state(self):
        """Reset model state to defaults"""
        self.state = Live2DState(
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
                'ParamBrowRY': 0.0,
                'ParamBreath': 0.5
            },
            expressions={
                'smile': False,
                'angry': False,
                'sad': False,
                'surprised': False
            }
        )
        self._trigger_event('state_reset', {})
    
    def destroy(self):
        """Clean up resources"""
        self.running = False


class Live2DWebSocketServer:
    """WebSocket server for Live2D control"""
    
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.api = Live2DAPI()
        self.clients = set()
        self.websocket = None
    
    async def register_client(self, websocket):
        """Register a new client"""
        self.clients.add(websocket)
        # Send current state to new client
        await websocket.send(json.dumps({
            'type': 'state_update',
            'data': self.api.get_state()
        }))
    
    async def unregister_client(self, websocket):
        """Unregister a client"""
        self.clients.discard(websocket)
    
    async def broadcast_message(self, message):
        """Broadcast message to all connected clients"""
        if self.clients:
            await asyncio.gather(*[client.send(message) for client in self.clients], 
                               return_exceptions=True)
    
    async def handle_message(self, websocket, message_data):
        """Handle incoming message from client"""
        try:
            data = json.loads(message_data)
            msg_type = data.get('type')
            
            response = None
            
            if msg_type == 'set_parameter':
                param_id = data.get('id')
                value = data.get('value')
                success = self.api.set_parameter(param_id, value)
                response = {
                    'type': 'parameter_set',
                    'success': success,
                    'id': param_id,
                    'value': value
                }
            
            elif msg_type == 'set_expression':
                expression = data.get('expression')
                active = data.get('active', True)
                success = self.api.set_expression(expression, active)
                response = {
                    'type': 'expression_set',
                    'success': success,
                    'expression': expression,
                    'active': active
                }
            
            elif msg_type == 'play_motion':
                group = data.get('group')
                index = data.get('index', 0)
                priority = data.get('priority', 2)
                success = self.api.play_motion(group, index, priority)
                response = {
                    'type': 'motion_played',
                    'success': success,
                    'group': group,
                    'index': index,
                    'priority': priority
                }
            
            elif msg_type == 'lip_sync':
                level = data.get('level', 0.0)
                self.api.set_lip_sync(level)
                response = {
                    'type': 'lip_sync_processed',
                    'level': level
                }
            
            elif msg_type == 'eye_tracking':
                x = data.get('x', 0.0)
                y = data.get('y', 0.0)
                self.api.set_eye_tracking(x, y)
                response = {
                    'type': 'eye_tracking_processed',
                    'x': x,
                    'y': y
                }
            
            elif msg_type == 'head_rotation':
                x = data.get('x', 0.0)
                y = data.get('y', 0.0)
                z = data.get('z', 0.0)
                self.api.set_head_rotation(x, y, z)
                response = {
                    'type': 'head_rotation_processed',
                    'x': x,
                    'y': y,
                    'z': z
                }
            
            elif msg_type == 'get_state':
                response = {
                    'type': 'current_state',
                    'data': self.api.get_state()
                }
            
            elif msg_type == 'reset_state':
                self.api.reset_state()
                response = {
                    'type': 'state_reset',
                    'success': True
                }
            
            if response:
                await websocket.send(json.dumps(response))
        
        except json.JSONDecodeError:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            logging.error(f"Error handling message: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def handle_connection(self, websocket, path):
        """Handle a new WebSocket connection"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister_client(websocket)
    
    def start_event_listeners(self):
        """Start listening for API events to broadcast to clients"""
        
        def on_parameter_changed(data):
            asyncio.run_coroutine_threadsafe(
                self.broadcast_message(json.dumps({
                    'type': 'parameter_changed',
                    'data': data
                })),
                self.websocket.loop
            )
        
        def on_expression_changed(data):
            asyncio.run_coroutine_threadsafe(
                self.broadcast_message(json.dumps({
                    'type': 'expression_changed',
                    'data': data
                })),
                self.websocket.loop
            )
        
        def on_motion_started(data):
            asyncio.run_coroutine_threadsafe(
                self.broadcast_message(json.dumps({
                    'type': 'motion_started',
                    'data': data
                })),
                self.websocket.loop
            )
        
        def on_motion_finished(data):
            asyncio.run_coroutine_threadsafe(
                self.broadcast_message(json.dumps({
                    'type': 'motion_finished',
                    'data': data
                })),
                self.websocket.loop
            )
        
        # Register event handlers
        self.api.add_event_handler('parameter_changed', on_parameter_changed)
        self.api.add_event_handler('expression_changed', on_expression_changed)
        self.api.add_event_handler('motion_started', on_motion_started)
        self.api.add_event_handler('motion_finished', on_motion_finished)
    
    async def start_server(self):
        """Start the WebSocket server"""
        print(f"Starting Live2D WebSocket server on {self.host}:{self.port}")
        
        # Store reference to the event loop
        self.websocket = await websockets.serve(
            self.handle_connection,
            self.host,
            self.port
        )
        
        # Start event listeners
        self.start_event_listeners()
        
        print("Live2D WebSocket server started!")
        await self.websocket.wait_closed()


class Live2DRestAPI:
    """REST API for Live2D control"""
    
    def __init__(self, api_instance):
        self.api = api_instance
    
    def set_parameter(self, param_id: str, value: float) -> dict:
        """Set a parameter via REST"""
        success = self.api.set_parameter(param_id, value)
        return {
            'success': success,
            'parameter': param_id,
            'value': value
        }
    
    def get_parameter(self, param_id: str) -> dict:
        """Get a parameter value via REST"""
        value = self.api.get_parameter(param_id)
        return {
            'parameter': param_id,
            'value': value
        }
    
    def set_expression(self, expression: str, active: bool = True) -> dict:
        """Set an expression via REST"""
        success = self.api.set_expression(expression, active)
        return {
            'success': success,
            'expression': expression,
            'active': active
        }
    
    def play_motion(self, group: str, index: int = 0, priority: int = 2) -> dict:
        """Play a motion via REST"""
        success = self.api.play_motion(group, index, priority)
        return {
            'success': success,
            'group': group,
            'index': index,
            'priority': priority
        }
    
    def get_state(self) -> dict:
        """Get current state via REST"""
        return self.api.get_state()
    
    def set_lip_sync(self, level: float) -> dict:
        """Set lip sync via REST"""
        self.api.set_lip_sync(level)
        return {
            'success': True,
            'level': level
        }
    
    def set_eye_tracking(self, x: float, y: float) -> dict:
        """Set eye tracking via REST"""
        self.api.set_eye_tracking(x, y)
        return {
            'success': True,
            'x': x,
            'y': y
        }


def main():
    """Main function to start the server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Live2D Desktop Mate Control Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to bind to')
    
    args = parser.parse_args()
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Create and start server
    server = Live2DWebSocketServer(args.host, args.port)
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.api.destroy()


if __name__ == "__main__":
    main()