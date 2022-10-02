const ws = require("ws");
const server = new ws.Server({port: 80});

const waiting = new Map();

const sockets = [];
const passwords = [];
// sockets["test"] = new Map();

const rooms = new Map();

let index = 0;
server.on("connection", onConnection);

function onConnection(socket) {
	console.log("socket(" + index + ") connected");
	
	waiting.set(socket, {id: index++});
	// sockets["test"].set(socket, {id: index++});
	// rooms.set(socket, "test");
	
	socket.addEventListener("close", onSocketClose);
	socket.addEventListener("message", onSocketMessage);
	
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
		
		sockets[room].forEach((info, socket) => {
			socket.send(JSON.stringify({
				type: "leave",
				id,
				username,
			}));
		});
		console.log("socket(" + sockets[room].get(socket).id + ")" + (username? "(" + username + ")": "") + " closed");
		
		sockets[room].delete(socket);
		
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
	let data = JSON.parse(event.data);
	
	switch(data.type) {
		case "enter": {
			if (sockets[data.room]) {
				if (passwords[data.room] != data.password) {
					socket.send(JSON.stringify({
						type: "password",
						success: false,
					}));
					return;
				}
			} else {
				sockets[data.room] = new Map();
				passwords[data.room] = data.password;
			}
			
			console.log("socket(" + waiting.get(socket).id + ") set username(" + data.username +")");
			
			console.log("socket(" + waiting.get(socket).id + ")(" + data.username + ") entered chat room(" + data.room + ")");
			
			let info = {
				id: waiting.get(socket).id,
				username: data.username,
				x: 100 * Math.random(),
				y: 100 * Math.random(),
				colour: Math.floor(0xFFFFFF * Math.random()),	
			};
			
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
			
			// let r = [];
			// for (let room in sockets) r.push(room);
			// console.log("current rooms: " + r.join(", "));
			
			socket.send(JSON.stringify({
				type: "password",
				success: true,
			}));
			socket.send(JSON.stringify({
				type: "self",
				id: info.id,
				username: info.username,
				x: info.x,
				y: info.y,
				colour: info.colour,
			}));
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
			
			sockets[data.room].set(socket, info);
			waiting.delete(socket);
			rooms.set(socket, data.room);
			
			break;
		}
		case "message": {
			let room = rooms.get(socket);
			let username = sockets[room].get(socket).username;
			let id = sockets[room].get(socket).id;
			console.log("socket(" + sockets[room].get(socket).id + ")" + (username? "(" + username + ")": "") + " sent message(" + data.message +")");
			
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
			
			sockets[room].delete(socket);
			rooms.delete(socket);
			waiting.set(socket, {id});
			
			sockets[room].forEach((info, socket) => {
				socket.send(JSON.stringify({
					type: "leave",
					id,
					username,
				}));
			});
			
			if (sockets[room].size == 0) {
				delete sockets[room];
				console.log("chat room(" + room + ") deleted");
			}
			
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
			
			sockets[room].get(socket).x = data.x;
			sockets[room].get(socket).y = data.y;
			
			console.log("socket(" + id + ")(" + data.username + ") moved(" + data.x + "," + data.y + ")");
			
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