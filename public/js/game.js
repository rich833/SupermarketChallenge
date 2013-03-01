var socket = io.connect('http://localhost:3000'); 
var gameType = null, 
	delay = 0, 
	emit = false, 
	direction = "",
	OBJECT_PLAYER = 5,
	OBJECT_ITEM = 2,
	OBJECT_ENEMY = 3,
	board = new GameBoard();
	
var sprites = {
	player:		 { sx:50, sy:80,  w:19, h:29, frames:1 },
	enemy:		 { sx:14, sy:80,  w:23, h:32, frames:1 },
	cheetos: 	 { sx:90,  sy:0,  w:26, h:32, frames:1 },
	mountainDew: { sx:100,  sy:80,  w:16, h:32, frames:1 },
	popTarts:	 { sx:0, sy:80,  w:25, h:34, frames:1 },
	whoppers:	 { sx:90,  sy:43,  w:32, h:25, frames:1 }
};

socket.on("master",function() {
	gameType = 'master';
	$("#output").text("Player 1");
});

socket.on("slave",function() {
	gameType = 'slave';
	$("#output").text("Player 2");
});
  
socket.on("end",function() {
	clearBoard();
	startGame();
});

//Work out the latency between the two games
//Every two seconds we ping our partner who pings
//The server and then the server pings this socket
//If all three steps are recorded, the cycle is complete
//And the time it took can be calculated & passed to the client.step function
socket.on('delay',function(data) {
  if(data.steps == 3) {
    // delay 1/2 of the round trip time
    dt = (new Date().getTime() - data.timer)/2;
    if(dt > 50) {
      dt = 50;
    }
  } else {
    data.steps += 1;
    socket.emit('delay',data);
  }
});

setInterval(function() {
	socket.emit('delay',{ steps: 0, timer: new Date().getTime() });
},2000);

var startGame = function() {
	Game.setBoard(0, new BackgroundImg());
	Game.setBoard(1, new TitleScreen(gameType,
									"Supermarket Challenge",
									 "Press Space to Play", 
									 playGames));
	Game.setBoard(2, new GameScores());
};

var clearBoard = function() {
	//Remove all the objects from the canvas, it doesn't matter about marking
	//them for removal individually since we're displaying a title screen.
	ShoppingList.list = [];
	Game.itemsList = [];
	
	//Reset the counters
	Game.itemsInCart = 0;
	Game.itemsRemaining = 0;
};

var playGames = function(){
	socket.emit('playGame');
	playGame();
};

socket.on('playGame', function() {
	playGame();
});

var playGame = function() {
	//Display the Heads up display
	displayHUD = true;
	
	//Set the board's objects to 0 just incase
	//We're replaying
	board.objects = [];
	
	//Add the player and enemy objects
	board.add(new Player());
	board.add(new Enemy());
	
	if(gameType == "master"){
		var playerList = new ShoppingList(4);
		board.add(playerList);
	} else {
		var enemyList = new ShoppingList(4);
		board.add(enemyList);
	}
	Game.setBoard(1, board);
};

window.addEventListener("load", function() {
	//When a player is found, load the game
	socket.on('connect', function (data) {
		Game.initialise("game", sprites, startGame);
	});
});


var Client = function() { };
Client.prototype = new Sprite();
Client.prototype.type = OBJECT_PLAYER;

Client.prototype.move = function(direction, dt){
	switch(direction){
		case "left":
			this.x -= 5 + 5*dt;
			break;
		case "right":
			this.x += 5 + 5*dt;
			break;
		case "up":
			this.y -= 5 + 5*dt;
			break;
		case "down":
			this.y += 5 + 5*dt;
			break;
		default:
			break;
	}
};


var Player = function() {
	this.setup('player', {frame:1, maxVel: 200});
	this.x = 100;
	this.y = 100;
	Client.apply(this,Array.prototype.slice.call(arguments));
};
Player.prototype = new Sprite();
Player.prototype.type = OBJECT_PLAYER;
Player.prototype.step = function(dt){
	Client.prototype.step.call(this, dt);
};
Player.prototype.move = function(direction, dt){
	Client.prototype.move.call(this, direction, dt);
};


var Enemy = function() {
	this.setup('enemy', {frame:1, maxVel: 200});
	this.x = 400;
	this.y = 400;
	Client.apply(this,Array.prototype.slice.call(arguments))
};
Enemy.prototype = new Sprite();
Enemy.prototype.type = OBJECT_ENEMY;
Enemy.prototype.step = function(dt){
	Client.prototype.step.call(this, dt);
};
Enemy.prototype.move = function(direction, dt){
	Client.prototype.move.call(this, direction, dt);
};

//Move our partner
socket.on("move", function(data) {
	direction = data.direction;
	emit = true;
});

//Tracks whether the player was moved
//So that we can reset it's direction if it has
var completed = false;

Client.prototype.step = function(dt)  {
	completed = false;
	
	if(Game.keys['left']){
		direction = "left";
	}
	if(Game.keys['right']){
		direction = "right";
	}
	if(Game.keys['up']){
		direction = "up";
	}
	if(Game.keys['down']){
		direction = "down";
	}

	//Debugging
	//$('#output').text("gameType: " + gameType + " this.type: " + this.type + " emit: " + emit + " direction: " + direction);
	
	//If we're the master game, move and tell the slave to move
	if(gameType == "master" && this.type == OBJECT_PLAYER && emit === false && direction !== "" 
	|| gameType == "slave" && this.type == OBJECT_ENEMY && emit === false  && direction !== ""){
		this.move(direction, dt);
		socket.emit('move', {type: this.type, direction: direction});
		
		//Movement completed
		completed = true;
	
	//If we're the slave, then just move and don't emit to anyone
	} else if(gameType == "slave" && this.type == OBJECT_PLAYER && emit === true 
	|| gameType == "master" && this.type == OBJECT_ENEMY && emit === true ) {
		this.move(direction, dt);
		//Player received and moved, so set those tracking vars respectively
		emit = false;	
		completed = true;
	}
	
	if(completed){
		//Reset the direction if the player moved
		direction = "";
	}
			
	//Stop the character moving off of the canvas
	if(this.x < 0) { this.x = 0; }
	else if(this.x > Game.width - this.w){
		this.x = Game.width - this.w; 
	}
		
	if(this.y < 0) { this.y = 0; }
	else if(this.y > Game.height - this.h){
		this.y = Game.height - this.h;
	}
};

//Tracks whether it's time to end the game
var gameOver;
var ShoppingList = function(noItems){
	//Holds a list of item objects
	this.list = [];
	
	//Create the items, addding them to the list and
	//Telling the partner to create the same items in the same random place
	for(var i = 0; i < noItems; i++){
		var x = 32 + (Math.random() * (game.width - 64));
		var y = 32 + (Math.random() * (game.height - 64));
		this.list.push(new ShoppingListItem(i, x, y));
		Game.itemsList.push(new ShoppingListItem(i, x, y));
		Game.itemsRemaining++;
		socket.emit('createPartnerItems', {id: i, x: x, y: y});
	}
	
	//Create the partner's items in the specified place
	socket.on('setPositions', function(data) {
			this.list.push(new ShoppingListItem(data.id, data.x, data.y));
	}.bind(this));
	
	socket.on('removeItem', function(data) {
		this.list.splice(Game.itemsRemaining, 1);
	}.bind(this));
	
	this.step = function(dt) {
		//Loop over every item in the list to see if it has
		//Touched the player or enemy
		for(var i = 0; i < this.list.length; i++){
			//Check for a colission between this object and the player
			var collision = this.board.collide(this.list[i], OBJECT_PLAYER) || this.board.collide(this.list[i], OBJECT_ENEMY);

			if(gameType == "master" && collision.sprite == "player" || gameType == "slave" && collision.sprite == "enemy"){
				//If it's the next item in the list, remove it
				if(this.list[i] == this.list[0]){
					//Tell our partner to remove the item from their screen.
					socket.emit('removeItem', {id: i, object: this.list[i]});
					
					//Remove the actual object from the canvas
					this.list.splice(i,1);
					
					//Update the game scores and shopping list
					Game.itemsInCart++;
					Game.itemsRemaining--;
					Game.itemsList.splice(i, 1);
					
					//Decide when the game has ended
					if(Game.itemsRemaining === 0){
						gameOver = true;
					}
				} else {
					//Otherwise move away from the object, as we're not collecting items in order
					this.reposition(collision, this.list[i], dt);
				}
			} else if(gameType == "master" && collision.sprite == "enemy" || gameType == "slave" && collision.sprite == "player"){
				//Otherwise move away from the object, as it's not our item to collect
				this.reposition(collision, this.list[i], dt);						
			}
		}
		
		//If the game is over, tell the partner
		//Clear the board of objects, and show a new title screen
		if(gameOver){
			socket.emit("winner");
			displayHUD = false;
			clearBoard();					
			Game.setBoard(1, new TitleScreen(gameType,
							"Winner!",
							 "Press Space to Play Again", 
						 startGame));
					
			gameOver = false;
		}
		
		//If we're the looser, then the server will tell us
		//We just need to clear the board and display a title screen
		socket.on('loser', function() {
			displayHUD = false;
			clearBoard();
			Game.setBoard(1, new TitleScreen(gameType,
					"Loser!",
					 "Press Space to Play Again", 
				 startGame));				
		});		
	};
	
	this.draw = function(ctx){
		for(var i = 0; i < this.list.length; i++){
			//Draw the shopping list items
			SpriteSheet.draw(ctx, this.list[i].sprite, this.list[i].x, this.list[i].y, 0);
		}
	};
	
	this.reposition = function(player, item, dt){			
		//Tracks whether the player has been repositioned
		var moved = false;

		//Detect which side the object was hit from
		//Then move back in that same direction
		if(player.x < item.x){
			if(!moved){
				player.move("left", dt);
				moved = true;
			}
		}
					
		if(player.x < item.x - item.w){
			if(!moved){
				player.move("right", dt);
				moved = true;
			}
		}
						
		if(player.y < item.y){
			if(!moved){
				player.move("up", dt);
				moved = true;
			}
		}

		if(player.y > item.y){
			if(!moved){
				player.move("down", dt);
				moved = true;
			}
		}	
	}
};

var ShoppingListItem = function(id,x,y){
	var sprite;
	switch(id){
		case 0: sprite = 'cheetos';
			this.name = "Cheetos";
			break;
		case 1: sprite = 'mountainDew';
			this.name = "Mountain Dew";
			break;
		case 2: sprite = 'popTarts';
			this.name = "Pop Tarts";
			break;
		case 3: sprite = 'whoppers';
			this.name = "Whoppers";
			break;
		default:
			break;
	}
	
	this.setup(sprite, { frame:1, maxVel: 200});
	this.x = x; //32 + (Math.random() * (game.width - 64));
	this.y = y; //32 + (Math.random() * (game.width - 64));
};
ShoppingListItem.prototype = new Sprite();
ShoppingListItem.prototype.type = OBJECT_ITEM;