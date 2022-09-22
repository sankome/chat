const ws = require("ws");
const server = new ws.Server({port: 80});

const sockets = [];
sockets["test"] = new Map();

const rooms = new Map();

let index = 0;
server.on("connection", onConnection);

function onConnection(socket) {
	sockets["test"].set(socket, {id: index++});
	rooms.set(socket, "test");
	
	socket.addEventListener("close", onSocketClose);
	
	socket.send(JSON.stringify({
		type: "connect",
		message: "successfully connected to the server!",
	}));
	
	socket.addEventListener("message", onSocketMessage);
}

function onSocketClose(event) {
	let socket = event.target;
	sockets["test"].delete(socket);
	rooms.delete(socket);
}

function onSocketMessage(event) {
	let socket = event.target;
	let data = JSON.parse(event.data);
	let room = rooms.get(socket);
	
	switch(data.type) {
		case "username":
			sockets[room].get(socket).username = data.username;
			break;
		case "message":
			let username = sockets[room].get(socket).username;
			sockets[room].forEach((info, socket) => {
				socket.send(JSON.stringify({
					type: "message",
					username: username,
					message: data.message,
				}));
			});
			break;
		default:
			console.log("unknown data type!");
	}
}