"use strict";

const fs = require("fs");
const os = require("os");
const nodeStatic = require("node-static");
const https = require("https");
const socketIO = require("socket.io");

const httpsOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/forms.omega.no/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/forms.omega.no/fullchain.pem"),
  // ca: [
  //   fs.readFileSync("path/to/CA_root.crt"),
  //   fs.readFileSync("path/to/ca_bundle_certificate.crt"),
  // ],
};

const fileServer = new(nodeStatic.Server)();
fileServer.defaultHeaders = {
  "Access-Control-Allow-Origin": "*",
};

const app = https.createServer(httpsOptions, function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

const io = new socketIO.Server(app);
io.sockets.on("connection", function(socket) {
  /**
   * convenience function to log server messages on the client.
   */
  function log(...args) {
    const array = ["Message from server:"];
    array.push(...args);
    socket.emit("log", array);
  }

  socket.on("message", function(message) {
    log("Client said: ", message);
    socket.broadcast.emit("message", message);
  });

  socket.on("create or join", function(room) {
    log("Received request to create or join room " + room);

    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ?
      Object.keys(clientsInRoom.sockets).length :
      0;

    log("Room " + room + " now has " + numClients + " client(s)");

    if (numClients === 0) {
      socket.join(room);
      log("Client ID " + socket.id + " created room " + room);
      socket.emit("created", room, socket.id);
    } else if (numClients < 6) {
      log("Client ID " + socket.id + " joined room " + room);
      io.sockets.in(room).emit("join", room);
      socket.join(room);
      socket.emit("joined", room, socket.id);
      io.sockets.in(room).emit("ready");
    } else { // max two clients
      socket.emit("full", room);
    }
  });

  socket.on("ipaddr", function() {
    const ifaces = os.networkInterfaces();
    for (let i = 0; i < ifaces.length; i++) {
      const dev = ifaces[i];
      ifaces[dev].forEach(function(details) {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("bye", function() {
    console.log("received bye");
  });
});
