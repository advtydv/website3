// Julia set that replaces the flow field in the ADVTYDV box
class JuliaBoxAnimation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('Canvas not found:', canvasId);
      return;
    }
    
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }
    
    // Four Julia sets parameters
    this.juliaParams = [
      {
        c: [0.355, 0.355], // Julia constant
        scale: 2.5,
        offset: [-0.3, 0.2]
      },
      {
        c: [-0.4, 0.6],
        scale: 2.2,
        offset: [0.3, -0.2]
      },
      {
        c: [-0.7, 0.27],
        scale: 2.8,
        offset: [-0.1, -0.3]
      },
      {
        c: [0.28, 0.008],
        scale: 2.3,
        offset: [0.2, 0.1]
      }
    ];
    
    this.startTime = Date.now();
    this.animationId = null;
    this.initGL();
    this.resizeCanvas();
    this.animate();
  }
  
  initGL() {
    const gl = this.gl;
    
    // Vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0, 1);
      }
    `);
    gl.compileShader(vertexShader);
    
    // Fragment shader - blue Julia set matching the flow field color
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform vec2 u_c1;
      uniform vec2 u_c2;
      uniform vec2 u_c3;
      uniform vec2 u_c4;
      uniform float u_scale1;
      uniform float u_scale2;
      uniform float u_scale3;
      uniform float u_scale4;
      uniform vec2 u_offset1;
      uniform vec2 u_offset2;
      uniform vec2 u_offset3;
      uniform vec2 u_offset4;
      uniform float u_time;
      
      vec2 complexMul(vec2 a, vec2 b) {
        return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
      }
      
      float juliaSet(vec2 pos, vec2 c) {
        vec2 z = pos;
        int iterations = 0;
        
        for (int i = 0; i < 100; i++) {
          z = complexMul(z, z) + c;
          if (dot(z, z) > 4.0) break;
          iterations = i;
        }
        
        if (iterations < 99) {
          float smoothColor = float(iterations) + 1.0 - log(log(sqrt(dot(z,z)))) / log(2.0);
          return smoothColor / 100.0;
        }
        return 0.0;
      }
      
      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
        
        // Calculate all four Julia sets
        float value1 = juliaSet(uv * u_scale1 - u_offset1, u_c1);
        float value2 = juliaSet(uv * u_scale2 - u_offset2, u_c2);
        float value3 = juliaSet(uv * u_scale3 - u_offset3, u_c3);
        float value4 = juliaSet(uv * u_scale4 - u_offset4, u_c4);
        
        // Combine all four Julia sets
        float value = max(max(value1, value2), max(value3, value4));
        
        // Black color for the Julia sets
        vec3 color = vec3(0.0, 0.0, 0.0);
        
        // Stronger alpha for immediate visibility
        float alpha = value > 0.01 ? value : 0.0;
        
        gl_FragColor = vec4(color, alpha);
      }
    `);
    gl.compileShader(fragmentShader);
    
    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    gl.useProgram(this.program);
    
    // Create buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);
    
    // Set attributes
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Get uniform locations for all four Julia sets
    this.resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    this.c1Location = gl.getUniformLocation(this.program, 'u_c1');
    this.c2Location = gl.getUniformLocation(this.program, 'u_c2');
    this.c3Location = gl.getUniformLocation(this.program, 'u_c3');
    this.c4Location = gl.getUniformLocation(this.program, 'u_c4');
    this.scale1Location = gl.getUniformLocation(this.program, 'u_scale1');
    this.scale2Location = gl.getUniformLocation(this.program, 'u_scale2');
    this.scale3Location = gl.getUniformLocation(this.program, 'u_scale3');
    this.scale4Location = gl.getUniformLocation(this.program, 'u_scale4');
    this.offset1Location = gl.getUniformLocation(this.program, 'u_offset1');
    this.offset2Location = gl.getUniformLocation(this.program, 'u_offset2');
    this.offset3Location = gl.getUniformLocation(this.program, 'u_offset3');
    this.offset4Location = gl.getUniformLocation(this.program, 'u_offset4');
    this.timeLocation = gl.getUniformLocation(this.program, 'u_time');
  }
  
  resizeCanvas() {
    // Match the parent element size (brand-animation-box)
    const parent = this.canvas.parentElement;
    if (!parent) return;
    
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  
  animate() {
    const gl = this.gl;
    const time = (Date.now() - this.startTime) / 1000;
    
    // Animate all four Julia sets
    const angle1 = time * 0.15;
    const angle2 = time * 0.1;
    const angle3 = time * 0.12;
    const angle4 = time * 0.08;
    
    this.juliaParams[0].c[0] = 0.7885 * Math.cos(angle1);
    this.juliaParams[0].c[1] = 0.7885 * Math.sin(angle1);
    this.juliaParams[0].scale = 2.5 + Math.sin(time * 0.5) * 0.2;
    
    this.juliaParams[1].c[0] = 0.6 * Math.cos(angle2);
    this.juliaParams[1].c[1] = 0.6 * Math.sin(angle2);
    this.juliaParams[1].scale = 2.2 + Math.cos(time * 0.4) * 0.2;
    
    this.juliaParams[2].c[0] = 0.5 * Math.cos(angle3);
    this.juliaParams[2].c[1] = 0.5 * Math.sin(angle3);
    this.juliaParams[2].scale = 2.8 + Math.sin(time * 0.3) * 0.3;
    
    this.juliaParams[3].c[0] = 0.65 * Math.cos(angle4);
    this.juliaParams[3].c[1] = 0.65 * Math.sin(angle4);
    this.juliaParams[3].scale = 2.3 + Math.cos(time * 0.6) * 0.25;
    
    // Set uniforms for all four Julia sets
    gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.c1Location, this.juliaParams[0].c[0], this.juliaParams[0].c[1]);
    gl.uniform2f(this.c2Location, this.juliaParams[1].c[0], this.juliaParams[1].c[1]);
    gl.uniform2f(this.c3Location, this.juliaParams[2].c[0], this.juliaParams[2].c[1]);
    gl.uniform2f(this.c4Location, this.juliaParams[3].c[0], this.juliaParams[3].c[1]);
    gl.uniform1f(this.scale1Location, this.juliaParams[0].scale);
    gl.uniform1f(this.scale2Location, this.juliaParams[1].scale);
    gl.uniform1f(this.scale3Location, this.juliaParams[2].scale);
    gl.uniform1f(this.scale4Location, this.juliaParams[3].scale);
    gl.uniform2f(this.offset1Location, this.juliaParams[0].offset[0], this.juliaParams[0].offset[1]);
    gl.uniform2f(this.offset2Location, this.juliaParams[1].offset[0], this.juliaParams[1].offset[1]);
    gl.uniform2f(this.offset3Location, this.juliaParams[2].offset[0], this.juliaParams[2].offset[1]);
    gl.uniform2f(this.offset4Location, this.juliaParams[3].offset[0], this.juliaParams[3].offset[1]);
    gl.uniform1f(this.timeLocation, time);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Clear and draw
    gl.clearColor(1, 1, 1, 1); // White background matching the page
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    this.animationId = requestAnimationFrame(this.animate.bind(this));
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Initialize black box trigger
document.addEventListener('DOMContentLoaded', () => {
  let hasBeenTriggered = false;
  let flowFieldAnimation = null;
  let juliaAnimation = null;
  
  // Create the black box button
  const blackBox = document.createElement('div');
  blackBox.id = 'julia-trigger';
  blackBox.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 40px;
    width: 20px;
    height: 20px;
    background: black;
    cursor: pointer;
    z-index: 1000;
    transition: opacity 0.3s;
  `;
  
  blackBox.addEventListener('click', () => {
    if (!hasBeenTriggered) {
      hasBeenTriggered = true;
      console.log('Switching to Julia set in ADVTYDV box');
      
      // Stop the flow field animation
      if (typeof window.flowFieldAnimation !== 'undefined' && window.flowFieldAnimation) {
        if (window.flowFieldAnimation.valid) {
          window.flowFieldAnimation.valid = false; // Stop the animation loop
        }
      }
      
      // Change ADVTYDV to black
      const advtydvLink = document.querySelector('.brand-animation-box a');
      if (advtydvLink) {
        advtydvLink.style.color = 'black';
      }
      
      // Start Julia animation immediately
      juliaAnimation = new JuliaBoxAnimation('flowFieldCanvas');
      
      // Fade out the button
      blackBox.style.opacity = '0.3';
      blackBox.style.cursor = 'default';
      
      // Add text beside the black box
      const text = document.createElement('span');
      text.textContent = '';
      text.style.cssText = `
        position: fixed;
        bottom: 25px;
        left: 50px;
        font-size: 12px;
        font-style: italic;
        color: #666;
        opacity: 0;
        transition: opacity 1s ease-in;
        z-index: 1000;
        font-family: Georgia, serif;
      `;
      document.body.appendChild(text);
      
      // Fade in the text
      setTimeout(() => {
        text.style.opacity = '1';
      }, 100);
    }
  });
  
  document.body.appendChild(blackBox);
});