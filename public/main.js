const socket = io();
const canvas = document.getElementsByClassName('whiteboard')[0];
const colors = document.getElementsByClassName('color');
const [undo, redo, clear] = document.getElementsByClassName('tool');
const context = canvas.getContext('2d');

const current = { color: 'black' };
const canvasState = [];
let step = -1;
let drawing = false;

canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

//Touch support for mobile devices
canvas.addEventListener('touchstart', onMouseDown, false);
canvas.addEventListener('touchend', onMouseUp, false);
canvas.addEventListener('touchcancel', onMouseUp, false);
canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false);

for (let i = 0; i < colors.length; i++) {
  const event = colors[i].type === 'color' ? 'change' : 'click';
  colors[i].addEventListener(event, onColorUpdate, false);
}

undo.addEventListener('click', onUndoCanvas, false);
redo.addEventListener('click', onRedoCanvas, false);
clear.addEventListener('click', onClearCanvas, false);

socket.on('save', saveCanvas);
socket.on('undo', undoCanvas);
socket.on('redo', redoCanvas);
socket.on('clear', clearCanvas);
socket.on('drawing', onDrawingEvent);

window.addEventListener('resize', onResize, false);
onResize();

function drawLine(x0, y0, x1, y1, color, emit) {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
  context.closePath();

  if (!emit) return;

  const w = canvas.width;
  const h = canvas.height;

  socket.emit('drawing', {
    x0: x0 / w,
    y0: y0 / h,
    x1: x1 / w,
    y1: y1 / h,
    color: color,
  });
}

function onMouseDown(e) {
  drawing = true;
  current.x = e.clientX || e.touches[0].clientX;
  current.y = e.clientY || e.touches[0].clientY;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;

  drawLine(
    current.x,
    current.y,
    e.clientX || e.touches[0].clientX,
    e.clientY || e.touches[0].clientY,
    current.color,
    true
  );

  saveCanvas(true);
}

function onMouseMove(e) {
  if (!drawing) return;
  drawLine(
    current.x,
    current.y,
    e.clientX || e.touches[0].clientX,
    e.clientY || e.touches[0].clientY,
    current.color,
    true
  );
  current.x = e.clientX || e.touches[0].clientX;
  current.y = e.clientY || e.touches[0].clientY;
}

function onColorUpdate(e) {
  const color =
    e.target.type === 'color'
      ? e.target.value
      : getComputedStyle(e.target).backgroundColor;
  current.color = color;
}

function onDrawingEvent(data) {
  const w = canvas.width;
  const h = canvas.height;
  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
}

// make the canvas fill its parent
function onResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function onClearCanvas(e) {
  clearCanvas(true);
}

// limit the number of events per second
function throttle(callback, delay) {
  let previousCall = new Date().getTime();
  return function () {
    const time = new Date().getTime();

    if (time - previousCall >= delay) {
      previousCall = time;
      callback.apply(null, arguments);
    }
  };
}

function clearCanvas(emit) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvasState.length = 0;
  step = -1;
  setDisabled([undo, redo, clear], true);
  if (emit) socket.emit('clear');
}

function onUndoCanvas(e) {
  undoCanvas(true);
}

function onRedoCanvas(e) {
  redoCanvas(true);
}

function drawImage(url) {
  const image = new Image();
  image.src = url;
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  };
}

function saveCanvas(emit) {
  step++;
  if (step < canvasState.length) canvasState.length = step;
  canvasState.push(canvas.toDataURL());

  setDisabled(undo, step < 1);
  setDisabled(redo, true);
  setDisabled(clear, false);

  if (emit) socket.emit('save');
}

function undoCanvas(emit) {
  if (step <= 0) {
    setDisabled(undo, true);
    return;
  }

  drawImage(canvasState[--step]);
  setDisabled(redo, false);

  if (emit) socket.emit('undo');
}

function redoCanvas(emit) {
  if (step >= canvasState.length - 1) {
    setDisabled(redo, true);
    return;
  }

  drawImage(canvasState[++step]);
  setDisabled(undo, false);

  if (emit) socket.emit('redo');
}

function setDisabled(
  elem,
  disabled,
  elements = Array.isArray(elem) ? elem : [elem]
) {
  elements.forEach((el) => {
    el.classList[disabled ? 'add' : 'remove']('disabled');
  });
}
