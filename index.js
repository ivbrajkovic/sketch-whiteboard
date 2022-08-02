/* eslint-disable no-undef */
const reload = require('reload');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
  socket.onAny((...args) => socket.broadcast.emit(...args));
});

http.listen(port, () => console.log('listening http://localhost:' + port));

reload(app);
