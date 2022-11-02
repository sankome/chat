const CONNECT = 0;
const ROOMS = 1;
const CHAT = 2;

let view;
let socket;

const viewDivs = [
	document.querySelector("#connect"),
	document.querySelector("#rooms"),
	document.querySelector("#chat"),
];

//connect view

const connectButton = document.querySelector("#connect__button");
connectButton.addEventListener("click", onConnectButtonClick);

function onConnectButtonClick(event) {
	socket = new WebSocket(location.origin.replace(/^http/, 'ws') +  "/chat");
	socket.addEventListener("open", onOpen);
	socket.addEventListener("message", onMessage);
}

//room view

const roomsForm = document.querySelector("#rooms__form");
const roomsUsername = document.querySelector("#rooms__username");
const roomsColours = document.querySelectorAll(".rooms__colour");
roomsForm.addEventListener("submit", onRoomsFormSubmit);
function onRoomsFormSubmit(event) {
	event.preventDefault();
	let username = roomsUsername.value.trim();
	if (!username) return;
	let colour = 1;
	for (const roomColour of roomsColours) {
		if (!roomColour.checked) continue;
		colour = roomColour.value;
		break;
	}
	
	let room = event.submitter.value;
	let password = "";
	if (event.submitter.hasPassword) password = prompt("password?");
	socket.send(JSON.stringify({
		type: "enter",
		username,
		room,
		password,
		colour,
	}));
}

const roomsList = document.querySelector("#rooms__list");

const roomsCreate = document.querySelector("#rooms__create");
const roomsName = document.querySelector("#rooms__name");
const roomsPassword = document.querySelector("#rooms__password");
roomsCreate.addEventListener("submit", onRoomsCreateSubmit);
function onRoomsCreateSubmit(event) {
	event.preventDefault();
	let room = roomsName.value.trim();
	if (!room) return;
	let username = roomsUsername.value.trim();
	if (!username) return;
	let password = roomsPassword.value;
	let colour = 1;
	for (const roomColour of roomsColours) {
		if (!roomColour.checked) continue;
		colour = roomColour.value;
		break;
	}
	
	socket.send(JSON.stringify({
		type: "enter",
		username,
		room,
		password,
		colour,
	}));
}

//chat view

const users = [];
const chatDisplay = document.querySelector("#chat__display");
const chatLog = document.querySelector("#chat__log");
const chatForm = document.querySelector("#chat__form");
const chatInput = document.querySelector("#chat__input");
chatForm.addEventListener("submit", onChatFormSubmit);

chatDisplay.addEventListener("click", onMove);
chatDisplay.addEventListener("drop", onMove);
function onMove(event) {
	event.preventDefault();
	let rect = event.currentTarget.getBoundingClientRect();
	let offsetX = 0;
	let offsetY = 0;
	if (event.type == "drop") {
		offsetX = 24 - +event.dataTransfer.getData("x");
		offsetY = 48 - +event.dataTransfer.getData("y");
	}
	let x = Math.round(100 * (event.clientX - rect.left + offsetX) / rect.width);
	let y = Math.round(100 * (event.clientY - rect.top + offsetY) / rect.height);
	
	socket.send(JSON.stringify({
		type: "move",
		x,
		y,
	}));
}
chatDisplay.addEventListener("dragover", (event) => {
	event.preventDefault();
});

function onChatFormSubmit(event) {
	event.preventDefault();
	if (!chatInput.value) return;
	sendMessage(chatInput.value);
	chatInput.value = null;
}

const chatLeave = document.querySelector("#chat__leave");
chatLeave.addEventListener("click", onChatLeaveClick);
function onChatLeaveClick(event) {
	chatLog.textContent = null;
	chatDisplay.innerHTML = null;
	users.length = 0;
	socket.send(JSON.stringify({
		type: "leave",
	}));
}

//common

async function changeView(nextView) {
	view = nextView;
	switch(view) {
		case ROOMS:
			Notification.requestPermission();
			break;
		case CHAT:
			break;
		case CONNECT:
		default:
			view = CONNECT;
			if (socket) {
				socket.close();
				socket = null;
			}
	}
	for (let i = 0; i < viewDivs.length; i++) {
		if (i == view) viewDivs[i].style = null;
		else viewDivs[i].style = "display: none;";
	}
}

function onOpen(event) {
	console.log("connected to server!");
}

function onMessage(event) {
	let data;
	try {
		data = JSON.parse(event.data);
	} catch (error) {
		console.log(error.toString());
		return;
	}
	
	switch(data.type) {
		case "rooms": {
			roomsList.textContent = null;
			if (data.rooms.length) {
				for (let room of data.rooms) {
					let li = document.createElement("li");
					let input = document.createElement("input");
					input.type = "submit";
					input.value = room.room;
					input.hasPassword = room.hasPassword;
					li.appendChild(input);
					roomsList.appendChild(li);
				}
			} else {
				let li = document.createElement("li");
				li.appendChild(document.createTextNode("no chat rooms yet"));
				roomsList.appendChild(li);
			}
			changeView(ROOMS);
			break;
		}
		case "message": {
			let atBottom = false;
			if (chatLog.scrollTop == chatLog.scrollTopMax) atBottom = true;
			
			let user = users.find(user => user.id == data.id);
			
			let p = document.createElement("p");
			p.appendChild(document.createTextNode(data.username + ": " + data.message));
			if (user.self) p.style.color = "plum";
			chatLog.appendChild(p);
			
			if (atBottom) chatLog.scrollTop = chatLog.scrollTopMax;
			
			user.showMessage(data.message);
			
			if (!user.self && Notification.permission === "granted") {
				let notification = new Notification("Sanko Chat", {
					body: data.username + ": " + data.message,
					tag: data.username,
				});
				setTimeout(() => {
					notification.close();
				}, 3000);
			}
			break;
		}
		case "join": {
			let atBottom = false;
			if (chatLog.scrollTop == chatLog.scrollTopMax) atBottom = true;
			
			let p = document.createElement("p");
			p.appendChild(document.createTextNode(data.username + " joined the chat"));
			p.style.color = "#ccc";
			chatLog.appendChild(p);
			
			if (atBottom) chatLog.scrollTop = chatLog.scrollTopMax;
			
			let user = new User(data.id, data.username, data.x, data.y, data.colour);
			chatDisplay.appendChild(user.element);
			
			if (Notification.permission === "granted") {
				let notification = new Notification("Sanko Chat", {
					body: data.username + " joined the chat",
					tag: data.username,
				});
				setTimeout(() => {
					notification.close();
				}, 3000);
			}
			
			break;
		}
		case "leave": {
			let atBottom = false;
			if (chatLog.scrollTop == chatLog.scrollTopMax) atBottom = true;
			
			let p = document.createElement("p");
			p.appendChild(document.createTextNode(data.username + " left the chat"));
			p.style.color = "#ccc";
			chatLog.appendChild(p);
			
			if (atBottom) chatLog.scrollTop = chatLog.scrollTopMax
			
			let user = users.find(user => user.id == data.id);
			user.element.parentNode?.removeChild(user.element);
			users.splice(users.findIndex(user => user.id == data.id), 1);
			
			if (Notification.permission === "granted") {
				let notification = new Notification("Sanko Chat", {
					body: data.username + " left the chat",
					tag: data.username,
				});
				setTimeout(() => {
					notification.close();
				}, 3000);
			}
			
			break;
		}
		case "move": {
			let user = users.find(user => user.id == data.id);
			user.move(data.x, data.y);
			break;
		}
		case "password": {
			if (data.success) changeView(CHAT);
			else alert("password is incorrect");
			break;
		}
		case "self": {
			let user = new User(data.id, data.username, data.x, data.y, data.colour, true);
			chatDisplay.appendChild(user.element);
			break;
		}
		case "other": {
			let user = new User(data.id, data.username, data.x, data.y, data.colour);
			chatDisplay.appendChild(user.element);
			break;
		}
		default: {
			console.log("unknown data type!");
		}
	}
}

function User(id, name, x, y, colour, self = false) {
	this.id = id;
	this.name = name; 
	this.destX = this.x = x;
	this.destY = this.y = y;
	this.vx = 0;
	this.vy = 0;
	this.colour = colour;
	this.self = self;
	this.moving = false;
	
	this.messageTimeoutId;
	this.showMessage = function(message) {
		clearTimeout(this.messageTimeoutId);
		this.message.textContent = this.name + ": " + message;
		this.message.style.display = "block";
		this.messageTimeoutId = setTimeout(() => {
			this.message.style.display = "none";
		}, 2500);
	}
	this.message = document.createElement("div");
	this.message.style.display = "none";
	this.message.style.position = "absolute";
	this.message.style.left = "50%";
	this.message.style.bottom = "100%";
	this.message.style.width = "max-content";
	this.message.style.maxWidth = "200px";
	this.message.style.padding = "10px";
	this.message.style.transform = "translate(-50%, -10px)";
	this.message.style.backgroundColor = "white";
	this.message.style.border = "1px solid #ccc";
	this.message.style.overflowWrap = "break-word";
	this.message.style.pointerEvents = "none";
	
	this.element = document.createElement("div");
	this.element.style.position = "absolute";
	this.element.style.left = x + "%";
	this.element.style.top = y + "%";
	this.element.style.width = "48px";
	this.element.style.height = "48px";
	this.element.style.transform = "translate(-24px, -48px)";
	
	this.shadowElement = document.createElement("div");
	this.shadowElement.style.position = "absolute";
	this.shadowElement.style.left = "0";
	this.shadowElement.style.bottom = "0";
	this.shadowElement.style.width = "48px";
	this.shadowElement.style.height = "48px";
	this.shadowElement.style.backgroundSize = "auto 48px";
	this.shadowElement.style.imageRendering = "pixelated";
	this.shadowElement.style.pointerEvents = "none";
	this.shadowElement.style.opacity = "0.25";
	this.shadowElement.style.backgroundImage = "url(\"sprites/shadow.png\")";
	
	this.imageElement = document.createElement("div");
	this.imageElement.style.position = "absolute";
	this.imageElement.style.left = "0";
	this.imageElement.style.bottom = "0";
	this.imageElement.style.width = "48px";
	this.imageElement.style.height = "48px";
	this.imageElement.style.backgroundSize = "auto 48px";
	this.imageElement.style.imageRendering = "pixelated";
	this.imageElement.style.pointerEvents = "none";
	
	if (this.colour == 1) {
		this.imageElement.style.backgroundImage = "url(\"sprites/doux.png\")";
	} else if (this.colour == 2) {
		this.imageElement.style.backgroundImage = "url(\"sprites/mort.png\")";
	} else if (this.colour == 3) {
		this.imageElement.style.backgroundImage = "url(\"sprites/tard.png\")";
	} else if (this.colour == 4) {
		this.imageElement.style.backgroundImage = "url(\"sprites/vita.png\")";
	} else {
		this.imageElement.style.backgroundImage = "url(\"sprites/doux.png\")";
	}
	
	this.element.appendChild(this.shadowElement);
	this.element.appendChild(this.imageElement);
	this.element.appendChild(this.message);
	
	this.time = 0;
	this.animate = function(time) {
		if (this.vx > 0) this.imageElement.style.transform = "scaleX(1)";
		else if (this.vx < 0) this.imageElement.style.transform = "scaleX(-1)";
		
		this.time += time;
		let frame;
		if (this.moving) {
			if (this.time > 0.75) this.time -= 0.75;
			frame = 4 + Math.floor(this.time * 8);
		} else {
			if (this.time > 0.375) this.time -= 0.375;
			frame = Math.floor(this.time * 8);
		}
		this.imageElement.style.backgroundPosition = String(frame * -48) + "px";
	}
	
	if (self) {
		this.element.draggable = true;
		this.element.addEventListener("dragstart", (event) => {			
			let rect = event.currentTarget.getBoundingClientRect();
			let x = event.clientX - rect.left;
			let y = event.clientY - rect.top;
			event.dataTransfer.setData("x", x);
			event.dataTransfer.setData("y", y);
		});
	}
	
	this.move = function(x, y) {
		this.moving = true;
		
		this.destX = x;
		this.destY = y;
		
		// let distance = Math.sqrt((this.x - x) * (this.x - x) + (this.y - y) * (this.y - y));
		let angle = Math.atan2(y - this.y, x - this.x);
		this.vx = 25 * Math.cos(angle);
		this.vy = 25 * Math.sin(angle);
		
		this.element.style.left = this.x + "%";
		this.element.style.top = this.y + "%";
	};
	
	users.push(this);
}

let prev;
requestAnimationFrame(onFrame);
function onFrame(timestamp) {
	if (prev == undefined) prev = timestamp;
	const time = (timestamp - prev) * 0.001;
	
	users.sort((user1, user2) => user1.y - user2.y);
	for (let i = 0; i < users.length; i++) {
		users[i].element.style.zIndex = String(i);
		users[i].x += users[i].vx * time;
		users[i].y += users[i].vy * time;
		
		if (users[i].vx > 0 && users[i].destX <= users[i].x) {
			users[i].vx = 0;
			users[i].x = users[i].destX;
		} else if (users[i].vx < 0 && users[i].destX >= users[i].x) {
			users[i].vx = 0;
			users[i].x = users[i].destX;
		}
		if (users[i].vy > 0 && users[i].destY <= users[i].y) {
			users[i].vy = 0;
			users[i].y = users[i].destY;
		} else if (users[i].vy < 0 && users[i].destY >= users[i].y) {
			users[i].vy = 0;
			users[i].y = users[i].destY;
		}
		
		if (!users[i].vx && !users[i].vy) users[i].moving = false;
		
		users[i].element.style.left = users[i].x + "%";
		users[i].element.style.top = users[i].y + "%";
		
		users[i].animate(time);
	}
	
	prev = timestamp;
	requestAnimationFrame(onFrame);
}

function sendMessage(message) {
	socket.send(JSON.stringify({
		type: "message",
		message: message,
	}));
}

changeView(CONNECT);