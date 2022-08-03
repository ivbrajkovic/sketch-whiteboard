import { io } from 'https://cdn.socket.io/4.3.2/socket.io.esm.min.js';
import { throttle, debounce } from './utility.js';

class Whiteboard {
  isDrawing = false;
  color = 'black';
  step = -1;
  canvasState = [];
  mouse = { x: 0, y: 0 };

  constructor() {
    this.canvas = document.getElementById('canvas');
    this.colors = document.getElementsByClassName('color');

    const [undo, redo, clear] = document.getElementsByClassName('tool');
    this.undo = undo;
    this.redo = redo;
    this.clear = clear;

    this.context = this.canvas.getContext('2d');
    this.socket = io();

    // Throttle the drawing event
    this.onMouseMoveThrottled = throttle(this.onMouseMove, 10);

    // Debounce window resize event
    this.onResizeDebounced = debounce(this.onResize, 300);

    this.initPage();
    this.initSocket();
    this.onResize();
  }

  initPage() {
    this.canvas.addEventListener('mousedown', this.onMouseDown, false);
    this.canvas.addEventListener('mouseup', this.onMouseUp, false);
    this.canvas.addEventListener('mouseout', this.onMouseUp, false);
    this.canvas.addEventListener('mousemove', this.onMouseMoveThrottled, false);

    //Touch support for mobile devices
    this.canvas.addEventListener('touchstart', this.onMouseDown, false);
    this.canvas.addEventListener('touchend', this.onMouseUp, false);
    this.canvas.addEventListener('touchcancel', this.onMouseUp, false);
    this.canvas.addEventListener('touchmove', this.onMouseMoveThrottled, false);

    for (let i = 0; i < this.colors.length; i++) {
      const event = this.colors[i].type === 'color' ? 'change' : 'click';
      this.colors[i].addEventListener(event, this.onColorUpdate, false);
    }

    this.undo.addEventListener('click', this.onUndoCanvas, false);
    this.redo.addEventListener('click', this.onRedoCanvas, false);
    this.clear.addEventListener('click', this.onClearCanvas, false);

    window.addEventListener('resize', this.onResizeDebounced, false);
  }

  initSocket() {
    this.socket.on('save', this.saveCanvas);
    this.socket.on('undo', this.undoCanvas);
    this.socket.on('redo', this.redoCanvas);
    this.socket.on('clear', this.clearCanvas);
    this.socket.on('drawing', this.onDrawingEvent);
  }

  onResize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.step < 0) return;
    this.drawImage(this.canvasState[this.step]);
  };

  onMouseDown = (e) => {
    this.isDrawing = true;
    this.mouse.x = e.clientX || e.touches[0].clientX;
    this.mouse.y = e.clientY || e.touches[0].clientY;
  };

  onMouseUp = (e) => {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    this.drawLine(
      this.mouse.x,
      this.mouse.y,
      e.clientX || e.touches[0]?.clientX || e.changedTouches[0]?.clientX,
      e.clientY || e.touches[0]?.clientY || e.changedTouches[0]?.clientY,
      this.color,
      true
    );

    this.saveCanvas(true);
  };

  onMouseMove = (e) => {
    if (!this.isDrawing) return;

    this.drawLine(
      this.mouse.x,
      this.mouse.y,
      e.clientX || e.touches[0].clientX,
      e.clientY || e.touches[0].clientY,
      this.color,
      true
    );

    this.mouse.x = e.clientX || e.touches[0].clientX;
    this.mouse.y = e.clientY || e.touches[0].clientY;
  };

  onUndoCanvas = () => this.undoCanvas(true);
  onRedoCanvas = () => this.redoCanvas(true);
  onClearCanvas = () => this.clearCanvas(true);

  onColorUpdate = (e) => {
    this.color =
      e.target.type === 'color'
        ? e.target.value
        : getComputedStyle(e.target).backgroundColor;
  };

  onDrawingEvent = (data) => {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.drawLine(
      data.x0 * w,
      data.y0 * h,
      data.x1 * w,
      data.y1 * h,
      data.color
    );
  };

  drawLine = (x0, y0, x1, y1, color, emit) => {
    this.context.beginPath();
    this.context.moveTo(x0, y0);
    this.context.lineTo(x1, y1);
    this.context.strokeStyle = color;
    this.context.lineWidth = 2;
    this.context.stroke();
    this.context.closePath();

    if (!emit) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    this.socket.emit('drawing', {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color,
    });
  };

  clearCanvas = (emit) => {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasState.length = 0;
    this.step = -1;

    this.setDisabled([this.undo, this.redo, this.clear], true);
    if (emit) this.socket.emit('clear');
  };

  drawImage(url) {
    const image = new Image();
    image.src = url;
    image.onload = () => {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.drawImage(image, 0, 0);
    };
  }

  saveCanvas = (emit) => {
    this.step++;
    if (this.step < this.canvasState.length)
      this.canvasState.length = this.step;
    this.canvasState.push(this.canvas.toDataURL());

    this.setDisabled(this.undo, this.step < 1);
    this.setDisabled(this.redo, true);
    this.setDisabled(this.clear, false);

    if (emit) this.socket.emit('save');
  };

  undoCanvas = (emit) => {
    if (this.step < 1) return;

    this.drawImage(this.canvasState[--this.step]);
    this.setDisabled(this.redo, false);

    if (this.step < 1) this.setDisabled(this.undo, true);
    if (emit) this.socket.emit('undo');
  };

  redoCanvas = (emit) => {
    if (!this.canvasState.length || this.step === this.canvasState.length - 1)
      return;

    this.drawImage(this.canvasState[++this.step]);
    this.setDisabled(this.undo, false);

    if (this.step === this.canvasState.length - 1)
      this.setDisabled(this.redo, true);
    if (emit) this.socket.emit('redo');
  };

  setDisabled(elem, disabled, elements = Array.isArray(elem) ? elem : [elem]) {
    elements.forEach((el) =>
      el.classList[disabled ? 'add' : 'remove']('disabled')
    );
  }
}

new Whiteboard();
