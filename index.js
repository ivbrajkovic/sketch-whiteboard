const reload = require('reload');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

function onConnection(socket) {
  socket.on('drawing', (data) => socket.broadcast.emit('drawing', data));
  socket.on('save', () => socket.broadcast.emit('save'));
  socket.on('undo', () => socket.broadcast.emit('undo'));
  socket.on('redo', () => socket.broadcast.emit('redo'));
  socket.on('clear', () => socket.broadcast.emit('clear'));
}

io.on('connection', onConnection);

http.listen(port, () => console.log('listening http://localhost:' + port));

reload(app);
