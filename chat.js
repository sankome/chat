const ws = require("ws");
const http = require("http");

let httpServer;
let server;

const waiting = new Map();
const sockets = [];
const passwords = [];
const rooms = new Map();

let index = 0;

function chat(server) {
	server = new ws.Server({server, path: "/chat"});
	server.on("connection", onConnection);
}

function onConnection(socket) {
	console.log("socket(" + index + ") connected");
	
	// put connected socket in waiting with (practically) unique id
	waiting.set(socket, {id: index++});
	
	socket.addEventListener("close", onSocketClose);
	socket.addEventListener("message", onSocketMessage);
	
	// send list of rooms to socket
	socket.send(JSON.stringify({
		type: "rooms",
		rooms: (() => {
			let r = [];
			for (let room in sockets) {
				r.push({
					room,
					hasPassword: passwords[room]? true: false,
				});
			}
			return r;
		})(),
	}));
	
}

function onSocketClose(event) {
	let socket = event.target;
	let room = rooms.get(socket);
	
	if (room) {
		let username = sockets[room]?.get(socket).username;
		let id = sockets[room]?.get(socket).id;
		
		// send leave message to other users in room
		sockets[room].forEach((info, socket) => {
			socket.send(JSON.stringify({
				type: "leave",
				id,
				username,
			}));
		});
		console.log("socket(" + sockets[room].get(socket).id + ")" + (username? "(" + username + ")": "") + " closed");
		
		sockets[room].delete(socket);
		
		// delete room if there are no users
		if (sockets[room].size == 0) {
			delete sockets[room];
			console.log("chat room(" + room + ") deleted");
		}
	} else {
		console.log("socket(" + waiting.get(socket).id + ") closed");
		waiting.delete(socket);
	}
	
	rooms.delete(socket);
}

function onSocketMessage(event) {
	let socket = event.target;
	let data;
	
	try {
		data = JSON.parse(event.data);
	} catch (error) {
		console.log(error);
		socket.send(JSON.stringify({
			type: "error",
			message: error.toString(),
		}));
		return;
	}
	
	switch(data.type) {
		case "enter": {
			if (sockets[data.room]) {
				// check if password is incorrect
				if (passwords[data.room] != data.password) {
					socket.send(JSON.stringify({
						type: "password",
						success: false,
					}));
					return;
				}
			} else {
				// create room if it doesn't exist
				sockets[data.room] = new Map();
				passwords[data.room] = data.password;
				
				console.log("chat room(" + data.room + ") created");
			}
			
			// limit username to 10 characters
			data.username = data.username.substr(0, 10);
			
			console.log("socket(" + waiting.get(socket).id + ") set username(" + data.username +")");
			console.log("socket(" + waiting.get(socket).id + ")(" + data.username + ") entered chat room(" + data.room + ")");
			
			// set initial data for user
			let info = {
				id: waiting.get(socket).id,
				username: data.username,
				x: 100 * Math.random(),
				y: 100 * Math.random(),
				colour: data.colour, //todo: validate colour
			};
			
			// send join message and info to all users in room
			sockets[data.room].forEach((value, socket) => {
				socket.send(JSON.stringify({
					type: "join",
					id: info.id,
					username: info.username,
					x: info.x,
					y: info.y,
					colour: info.colour,
				}));
			});
			
			// send success message
			socket.send(JSON.stringify({
				type: "password",
				success: true,
			}));
			
			// send self info
			socket.send(JSON.stringify({
				type: "self",
				id: info.id,
				username: info.username,
				x: info.x,
				y: info.y,
				colour: info.colour,
			}));
			// and other users info
			sockets[data.room].forEach((value, key) => {
				socket.send(JSON.stringify({
					type: "other",
					id: value.id,
					username: value.username,
					x: value.x,
					y: value.y,
					colour: value.colour,
				}));
			});
			
			// move socket from waiting to sockets
			sockets[data.room].set(socket, info);
			waiting.delete(socket);
			
			// map socket to current room
			rooms.set(socket, data.room);
			
			break;
		}
		case "message": {
			let room = rooms.get(socket);
			let username = sockets[room].get(socket).username;
			let id = sockets[room].get(socket).id;
			
			// limit message to 50 characters
			data.message = data.message.substr(0, 50);
			
			console.log("socket(" + sockets[room].get(socket).id + ")" + (username? "(" + username + ")": "") + " sent message(" + data.message +")");
			
			// send message to all users in room
			sockets[room].forEach((info, socket) => {
				socket.send(JSON.stringify({
					type: "message",
					id,
					username: username? username: "unknown",
					message: data.message,
				}));
			});
			break;
		}
		case "leave": {
			let room = rooms.get(socket);
			let username = sockets[room].get(socket).username;
			let id = sockets[room].get(socket).id;
			
			console.log("socket(" + sockets[room].get(socket).id + ")" + (username? "(" + username + ")": "")+ " left chat room(" + room + ")");
			
			// move socket from sockets to waiting
			sockets[room].delete(socket);
			waiting.set(socket, {id});
			
			// unmap socket and room
			rooms.delete(socket);
			
			// send leave messages to other users in room
			sockets[room].forEach((info, socket) => {
				socket.send(JSON.stringify({
					type: "leave",
					id,
					username,
				}));
			});
			
			// delete room if there are no users
			if (sockets[room].size == 0) {
				delete sockets[room];
				console.log("chat room(" + room + ") deleted");
			}
			
			// send list of rooms to socket
			socket.send(JSON.stringify({
				type: "rooms",
				rooms: (() => {
					let r = [];
					for (let room in sockets) {
						r.push({
							room,
							hasPassword: passwords[room]? true: false,
						});
					}
					return r;
				})(),
			}));
			break;
		}
		case "move": {
			let room = rooms.get(socket);
			let username = sockets[room].get(socket).username;
			let id = sockets[room].get(socket).id;
			
			// set destination coordinates
			sockets[room].get(socket).x = data.x;
			sockets[room].get(socket).y = data.y;
			
			console.log("socket(" + id + ")(" + username + ") moved(" + data.x + "," + data.y + ")");
			
			// send move data to all users in room
			sockets[room].forEach((value, socket) => {
				socket.send(JSON.stringify({
					type: "move",
					id,
					x: data.x,
					y: data.y,
				}));
			});
			break;
		}
		default: {
			console.log("unknown data type!");
		}
	}
}

module.exports = chat;