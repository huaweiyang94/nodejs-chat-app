const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '../public');

app.use(express.static(publicDir));

const adminUsername = 'Admin';

// when a socket connects
io.on('connection', (socket) => {
    console.log('new websocket connection');

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit('message', generateMessage(adminUsername, 'Welcome!')); // emit message to SINGLE client
        // socket.broadcast.emit('message', generateMessage('A new user has joined!')); // emit message to EVERY client but the current one
        socket.broadcast.to(user.room).emit('message', generateMessage(adminUsername, `${user.username} has joined!`)); // emit message to EVERY client but the current one in the ROOM
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    });

    socket.on('sendMessage', (message, callback) => {
        const filter = new Filter();
        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!');
        }

        const user = getUser(socket.id);

        if (user) {
            // io.emit('message', generateMessage(message)); // emit message to EVERY client
            io.to(user.room).emit('message', generateMessage(user.username, message)); // emit message to EVERY client in the ROOM
            callback();
        }
    });

    socket.on('sendLocation', ({ latitude, longitude }, callback) => {
        const user = getUser(socket.id);

        if (user) {
            io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${latitude},${longitude}`));
            callback();
        }
    });

    //when a socket disconnects
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            // // no need to use broadcast since the current client has disconnected
            // io.emit('message', generateMessage('A user has left!'));
            io.to(user.room).emit('message', generateMessage(adminUsername, `${user.username} has left!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

server.listen(port, () => {
    console.log(`server is running on port ${port}`);
});