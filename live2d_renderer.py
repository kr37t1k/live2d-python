#!/usr/bin/env python3
"""
Full Live2D Model Loader and Renderer with Python GUI
This application loads and renders Live2D models with interactive controls
"""

import sys
import os
import json
import math
import numpy as np
from PIL import Image
import pygame
from pygame.locals import *
from OpenGL.GL import *

# Initialize pygame
pygame.init()

class Live2DModel:
    """Class to handle Live2D model data and rendering"""
    
    def __init__(self, model_path):
        self.model_path = model_path
        self.model_data = None
        self.textures = []
        self.parts = []
        self.parameters = {}
        self.parts_visibility = {}
        self.load_model()
    
    def load_model(self):
        """Load Live2D model from JSON file"""
        try:
            # Load model JSON
            model_json_path = os.path.join(self.model_path, "model.json")
            with open(model_json_path, 'r', encoding='utf-8') as f:
                self.model_data = json.load(f)
            
            # Load textures
            self.load_textures()
            
            # Initialize parameters
            self.initialize_parameters()
            
            print(f"Model loaded successfully from {self.model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    def load_textures(self):
        """Load all textures for the model"""
        if 'textures' in self.model_data:
            for tex_path in self.model_data['textures']:
                full_path = os.path.join(self.model_path, tex_path)
                try:
                    texture = pygame.image.load(full_path).convert_alpha()
                    self.textures.append(texture)
                except pygame.error:
                    print(f"Could not load texture: {full_path}")
                    # Create a placeholder texture
                    placeholder = pygame.Surface((100, 100), pygame.SRCALPHA)
                    placeholder.fill((255, 0, 255, 128))  # Magenta as placeholder
                    self.textures.append(placeholder)
    
    def initialize_parameters(self):
        """Initialize model parameters"""
        if 'parameters' in self.model_data:
            for param in self.model_data['parameters']:
                self.parameters[param['id']] = {
                    'value': param.get('default', 0),
                    'min': param.get('minimum', -30),
                    'max': param.get('maximum', 30),
                    'type': param.get('type', 'angle')
                }
        
        # Initialize parts visibility
        if 'groups' in self.model_data:
            for group in self.model_data['groups']:
                for part in group['parts']:
                    self.parts_visibility[part['id']] = True

class Live2DRenderer:
    """Main renderer class for Live2D models"""
    
    def __init__(self, width=800, height=600):
        self.width = width
        self.height = height
        self.screen = pygame.display.set_mode((width, height), DOUBLEBUF | OPENGL)
        pygame.display.set_caption("Live2D Model Renderer")
        
        # OpenGL setup
        glViewport(0, 0, width, height)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        # gluOrtho2D(0, width, height, 0)
        glMatrixMode(GL_MODELVIEW)
        glLoadIdentity()
        
        # Model and camera
        self.model = None
        self.camera_x = width // 2
        self.camera_y = height // 2
        self.scale = 1.0
        self.rotation_x = 0
        self.rotation_y = 0
        
        # Mouse interaction
        self.dragging = False
        self.last_mouse_x = 0
        self.last_mouse_y = 0
        
        # Animation
        self.time = 0
        self.blink_timer = 0
        self.blink_state = False
        
        # GUI elements
        self.gui_elements = []
        self.selected_parameter = None
    
    def load_model(self, model_path):
        """Load a Live2D model"""
        try:
            self.model = Live2DModel(model_path)
            self.create_gui_elements()
            return True
        except Exception as e:
            print(f"Failed to load model: {e}")
            return False
    
    def create_gui_elements(self):
        """Create GUI elements for parameter control"""
        self.gui_elements = []
        y_pos = 20
        if self.model:
            for param_id, param_data in self.model.parameters.items():
                element = {
                    'type': 'slider',
                    'id': param_id,
                    'x': self.width - 200,
                    'y': y_pos,
                    'width': 180,
                    'height': 20,
                    'value': param_data['value'],
                    'min': param_data['min'],
                    'max': param_data['max'],
                    'label': param_id
                }
                self.gui_elements.append(element)
                y_pos += 30
    
    def handle_event(self, event):
        """Handle pygame events"""
        if event.type == QUIT:
            return False
        
        elif event.type == MOUSEBUTTONDOWN:
            if event.button == 1:  # Left mouse button
                # Check if clicking on GUI element
                for element in self.gui_elements:
                    if (element['x'] <= event.pos[0] <= element['x'] + element['width'] and
                        element['y'] <= event.pos[1] <= element['y'] + element['height']):
                        self.selected_parameter = element
                        break
                else:
                    # Start dragging
                    self.dragging = True
                    self.last_mouse_x, self.last_mouse_y = event.pos
            
            elif event.button == 4:  # Mouse wheel up
                self.scale *= 1.1
            elif event.button == 5:  # Mouse wheel down
                self.scale *= 0.9
        
        elif event.type == MOUSEBUTTONUP:
            if event.button == 1:  # Left mouse button
                self.dragging = False
                self.selected_parameter = None
        
        elif event.type == MOUSEMOTION:
            if self.dragging:
                dx = event.pos[0] - self.last_mouse_x
                dy = event.pos[1] - self.last_mouse_y
                self.camera_x += dx
                self.camera_y += dy
                self.last_mouse_x, self.last_mouse_y = event.pos
            
            if self.selected_parameter:
                # Update slider value
                rel_x = max(0, min(event.pos[0] - self.selected_parameter['x'], 
                                  self.selected_parameter['width']))
                ratio = rel_x / self.selected_parameter['width']
                value_range = self.selected_parameter['max'] - self.selected_parameter['min']
                self.selected_parameter['value'] = self.selected_parameter['min'] + ratio * value_range
                
                # Update model parameter
                if self.model:
                    self.model.parameters[self.selected_parameter['id']]['value'] = self.selected_parameter['value']
        
        elif event.type == KEYDOWN:
            if event.key == K_ESCAPE:
                return False
            elif event.key == K_r:  # Reset view
                self.reset_view()
        
        return True
    
    def reset_view(self):
        """Reset camera and model view"""
        self.camera_x = self.width // 2
        self.camera_y = self.height // 2
        self.scale = 1.0
        self.rotation_x = 0
        self.rotation_y = 0
    
    def update(self, dt):
        """Update animation and model state"""
        self.time += dt
        
        # Simple blinking animation
        self.blink_timer += dt
        if self.blink_timer > 2.0:  # Blink every 2 seconds
            self.blink_state = not self.blink_state
            self.blink_timer = 0
        
        # Update model parameters based on mouse position (looking at mouse)
        mouse_x, mouse_y = pygame.mouse.get_pos()
        rel_x = (mouse_x - self.camera_x) / self.width
        rel_y = (mouse_y - self.camera_y) / self.height
        
        if self.model:
            # Eye tracking
            if 'ParamEyeBallX' in self.model.parameters:
                self.model.parameters['ParamEyeBallX']['value'] = rel_x * 30
            if 'ParamEyeBallY' in self.model.parameters:
                self.model.parameters['ParamEyeBallY']['value'] = rel_y * 30
            
            # Head tracking
            if 'ParamAngleX' in self.model.parameters:
                self.model.parameters['ParamAngleX']['value'] = rel_x * 30
            if 'ParamAngleY' in self.model.parameters:
                self.model.parameters['ParamAngleY']['value'] = rel_y * 30
    
    def render(self):
        """Render the model and GUI"""
        # Clear screen
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        glLoadIdentity()
        
        # Apply camera transformation
        glTranslatef(self.camera_x, self.camera_y, 0)
        glScalef(self.scale, self.scale, 1)
        glRotatef(self.rotation_x, 1, 0, 0)
        glRotatef(self.rotation_y, 0, 1, 0)
        
        # Render model if loaded
        if self.model:
            self.render_model()
        
        # Render GUI
        self.render_gui()
        
        pygame.display.flip()
    
    def render_model(self):
        """Render the Live2D model"""
        # For demonstration, we'll render a simple representation
        # In a real implementation, this would use proper Live2D rendering
        
        # Draw textures as simple sprites
        if self.model and self.model.textures:
            center_x = 0
            center_y = 0
            
            for i, texture in enumerate(self.model.textures):
                # Simple positioning for demonstration
                x = center_x - texture.get_width() // 2
                y = center_y - texture.get_height() // 2 - i * 50
                
                # Convert pygame surface to OpenGL texture and render
                texture_data = pygame.image.tostring(texture, "RGBA", 1)
                width = texture.get_width()
                height = texture.get_height()
                
                glEnable(GL_TEXTURE_2D)
                texture_id = glGenTextures(1)
                glBindTexture(GL_TEXTURE_2D, texture_id)
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
                glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, 
                           GL_RGBA, GL_UNSIGNED_BYTE, texture_data)
                
                glBegin(GL_QUADS)
                glTexCoord2f(0, 0)
                glVertex2f(x, y)
                glTexCoord2f(1, 0)
                glVertex2f(x + width, y)
                glTexCoord2f(1, 1)
                glVertex2f(x + width, y + height)
                glTexCoord2f(0, 1)
                glVertex2f(x, y + height)
                glEnd()
                
                glDeleteTextures([texture_id])
                glDisable(GL_TEXTURE_2D)
        else:
            # Draw a placeholder if no model is loaded
            glColor3f(0.5, 0.5, 0.5)
            glBegin(GL_QUADS)
            glVertex2f(-100, -100)
            glVertex2f(100, -100)
            glVertex2f(100, 100)
            glVertex2f(-100, 100)
            glEnd()
    
    def render_gui(self):
        """Render GUI elements"""
        glMatrixMode(GL_PROJECTION)
        glPushMatrix()
        glLoadIdentity()
        # gluOrtho2D(0, self.width, 0, self.height)
        glMatrixMode(GL_MODELVIEW)
        glLoadIdentity()
        
        # Render sliders
        for element in self.gui_elements:
            # Slider background
            glColor3f(0.3, 0.3, 0.3)
            glBegin(GL_QUADS)
            glVertex2f(element['x'], element['y'])
            glVertex2f(element['x'] + element['width'], element['y'])
            glVertex2f(element['x'] + element['width'], element['y'] + element['height'])
            glVertex2f(element['x'], element['y'] + element['height'])
            glEnd()
            
            # Slider fill
            value_range = element['max'] - element['min']
            fill_ratio = (element['value'] - element['min']) / value_range
            fill_width = element['width'] * fill_ratio
            
            glColor3f(0.2, 0.6, 1.0)
            glBegin(GL_QUADS)
            glVertex2f(element['x'], element['y'])
            glVertex2f(element['x'] + fill_width, element['y'])
            glVertex2f(element['x'] + fill_width, element['y'] + element['height'])
            glVertex2f(element['x'], element['y'] + element['height'])
            glEnd()
            
            # Label
            glColor3f(1, 1, 1)
            # In a real implementation, we'd render text here
            # For now, we'll just print to console
            # print(f"Parameter: {element['label']}: {element['value']:.2f}")
        
        glMatrixMode(GL_PROJECTION)
        glPopMatrix()
        glMatrixMode(GL_MODELVIEW)

def main():
    """Main application function"""
    # Initialize renderer
    renderer = Live2DRenderer(1024, 768)
    
    # Try to load a default model if provided
    default_model_path = "models/huohuo"
    if os.path.exists(default_model_path):
        renderer.load_model(default_model_path)
    else:
        print("No default model found. Please provide a model path.")
    
    # Main loop
    clock = pygame.time.Clock()
    running = True
    
    while running:
        dt = clock.tick(60) / 1000.0  # Delta time in seconds
        
        # Handle events
        for event in pygame.event.get():
            if not renderer.handle_event(event):
                running = False
        
        # Update
        renderer.update(dt)
        
        # Render
        renderer.render()
    
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()