var displayHUD = false;
var Sprite = function() {};

Sprite.prototype.setup = function(sprite, props){
	this.sprite = sprite;
	this.merge(props);
	this.frame = this.frame || 0;
	this.w = SpriteSheet.map[sprite].w;
	this.h = SpriteSheet.map[sprite].h;
};

//Cycles through frame rate and maxvel
Sprite.prototype.merge = function(props){
	if(props){
		for (var prop in props){
			this[prop] = props[prop];
		}
	}
};

Sprite.prototype.draw = function(ctx) {
	SpriteSheet.draw(ctx, this.sprite, this.x, this.y, this.frame);
};

Sprite.prototype.hit = function(){
	this.board.remove(this);
};

//New function for one instance only class
var Game = new function(){
	var boards = [];
	
	this.itemsInCart = 0;
	this.itemsRemaining = 0;
	this.itemsList = [];

	//Game initialisation
	this.initialise = function(canvasElementId, sprite_data, callback){
		this.canvas = document.getElementById(canvasElementId);
		this.width = this.canvas.width;
		this.height = this.canvas.height;
		
		//Set up the rendering context
		this.ctx = this.canvas.getContext && this.canvas.getContext('2d');
		
		if(!this.ctx) { return alert("Please upgrade to a HTML5 compatible browser to play!"); }
		
		//setup input
		this.setupInput();
		
		//Start the game loop
		this.loop();
		
		//Load the sprite sheet and pass forward the callback
		SpriteSheet.load(sprite_data, callback);
	};
	
	//Make a hash of keycodes to give them friendlier names
	var KEY_CODES = { 37:'left', 39:'right', 38:'up', 40:'down', 32:'space' };
	//An empty hash to represent the current user input
	this.keys = {};
	
	this.setupInput = function(){
		//If a key in our has is pressed down,
		//then update the hash with true for that keycode
		//prevent the default action, i.e. scrolling the page
		window.addEventListener('keydown', function(e) {
			if(KEY_CODES[event.keyCode]){
				Game.keys[KEY_CODES[event.keyCode]] = true;
				e.preventDefault();
			}
		}, false);
		//If the key we're interested in is no longer down
		//Then set that key to false
		//And prevent the browser's default action
		window.addEventListener('keyup', function(e) {
			Game.keys[KEY_CODES[event.keyCode]] = false;
			e.preventDefault();
		}, false);
	};
	
	//Loop through the boards and check where there is a board
	//At the current index, if there is then
	//call that board's step method with an approximate number of seconds
	//That have passed, and then call the boards draw method, passing in the context
	this.loop = function() {
		var dt = 30/1000;
		for(var i = 0; i < boards.length; i++){
			if(boards[i]){
				boards[i].step(dt);
				//The step call may have removed the board,
				//so check the board exists and then draw
				boards[i].draw(Game.ctx);
			}
		}
		//Loop every 30 milli seconds. Timeout used instead of
		//Interval to avoid backing up timers if the game lags
		setTimeout(Game.loop, 30);
	};
	
	//Change an active game board
	this.setBoard = function(num, board) { boards[num] = board; };
};

//New function ensures that only instance
//Of this class can ever be created
//Sprite data = the co-ordinates which map the sprite to it's name
var SpriteSheet = new function(){
	this.map = {};
	this.load = function(spriteData, callback){
		this.map = spriteData;
		this.image = new Image();
		this.image.onload = callback;
		this.image.src = 'images/spriteSheet.png';
	};
	//Draws the sprites
	//Takes the context, the name of the sprite
	//The x and y co ordinates and frames the sprite runs for
	this.draw = function(ctx, sprite, x, y, frame){
		//Lookup the sprite by name from the map, getting the src and width/height
		var s = this.map[sprite];
		if(!frame) { frame = 0; }
		ctx.drawImage(this.image, s.sx + frame * s.w,
								  s.sy,
								  s.w, s.h,
								  Math.floor(x), Math.floor(y),
								  s.w, s.h);
	};
};

var TitleScreen = function TitleScreen(gameType,title,subtitle,callback) {
  var up = false;
  this.step = function(dt) {
    if(!Game.keys['space']){ up = true; }
    if(up && Game.keys['space'] && callback){ callback(); }
  };

  this.draw = function(ctx) {
    ctx.fillStyle = "#000000";
	var player;
	
	if(gameType == "slave"){
		player = "Player 2";
	} else {
		player = "Player 1";
	} 
	
	ctx.font = "bold 40px arial";
    var measure = ctx.measureText(player);  
    ctx.fillText(player,Game.width/2 - measure.width/2,Game.height/2);
	
    ctx.font = "bold 40px arial";
    var measure = ctx.measureText(title);  
    ctx.fillText(title,Game.width/2 - measure.width/2,Game.height/2 + 40);

    ctx.font = "bold 20px arial";
    var measure = ctx.measureText(subtitle);
    ctx.fillText(subtitle,Game.width/2 - measure.width/2,Game.height/2 + 80);
  };
};

var BackgroundImg = function BackgroundImg() {
	this.step = function (dt){};
	
	this.draw = function(ctx){
		var bgImage = new Image();
		bgImage.src = "images/TiledBackground.gif";
		ctx.drawImage(bgImage, 0, 0);		
	};
};

var GameBoard = function(){
	var board = this;
	
	//The current list of objects
	this.objects = [];
	
	//Add a new object to our list of objects
	this.add = function(obj){
		//Tell the object what board it belongs to
		//so that it can interact with the board to remove itself
		obj.board = this;
		this.objects.push(obj);
		return obj;
	};
	
	var removed = [];
	//mark an object from removal.
	//We can't just remove it from the array as the game
	//Will be looping over that array and it would break the loop.
	//Instead mark the objects for removal in a separate array and then
	//Compare them against each other
	this.remove = function(obj){
		this.removed.push(obj);
	};
	
	//Reset the list of removed objects
	this.resetRemoved = function() { this.removed = []; };
	
	//Remove objects marked for removal from the list
	this.finaliseRemoved = function() {
		for(var i=0; i < this.removed.length; i++){
			//Find the removed objects in the objects list
			var idx = this.objects.indexOf(this.removed[i]);
			if(idx != -1){
				//Splice them out of the array
				this.objects.splice(idx, 1);
			}
		}
	};
	
	//Call the same method on all current objects
	this.iterate = function(funcName){
		//Args JS hack to get all of the arguments passed into the method
		//start at the second element because 0 is the function name
		var args = Array.prototype.slice.call(arguments, 1);
		for(var i = 0; i < this.objects.length; i++){
			var obj = this.objects[i];
			//Run the function with the arguments
			obj[funcName].apply(obj, args);
		}
	};
	
	//Collision detection
	//Find the first object for which func is true
	this.detect = function(func){
		for(var i = 0; i < this.objects.length; i++){
			//If the object returns true to after running the function
			//Then return it
			if(func.call(this.objects[i])){ return this.objects[i]; }
		}
		//Return false after there are no more objects to compare
		return false;
	};
	
	//Call step on all objects and then delete
	//any objects that have been marked for removal
	this.step = function(dt){
		this.resetRemoved();
		this.iterate('step', dt);
		this.finaliseRemoved();
	};
	
	//Draw all the objects
	this.draw = function(ctx){
		this.iterate('draw', ctx);
	};
	
	this.overlap = function(object1, object2){
		//Rather than check if one box is ontop of another
		//Check if one object couldn't be in the other and negate the result
		//Check the bottom edge of object1 against the bottom edge of object2
		//To see if object 1 is to the right of object 2
		//Then check the top edge of object1 against the bottom edge of object2
		//Then check if the right edge of object1 is touching the left of object2 ??
		//Then check if left edge of object1 is touching the right edge of object 2 ??
		return !((object1.y + object1.h -1 < object2.y) ||
				 (object1.y > object2.y + object2.h -1) ||
				 (object1.x + object1.w -1 < object2.x) ||
				 (object1.x > object2.x + object2.w -1));		
	};
	
	// Find the first object that collides with obj
	// match against an optional type
	this.collide = function(obj,type) {
	  return this.detect(function() {
		if(obj != this) {
		 var col = (!type || this.type & type) && board.overlap(obj,this);
		 return col ? this : false;
		}
	  });
	};
};

var GameScores = function() {
  
  this.draw = function(ctx) {
	if(displayHUD){
		ctx.save();
		ctx.font = "bold 18px arial";
		ctx.fillStyle= "#000000";

		var items = "Items in cart: " + Game.itemsInCart;
		ctx.fillText(items,10,20);
		
		var remaining = "Items remaining: " + Game.itemsRemaining;
		ctx.fillText(remaining, 10, 40);
		
		var itemsText = "Shopping List:";
		ctx.fillText(itemsText, Game.width - ctx.measureText(itemsText).width, 20);
		for(var i = 0; i < Game.itemsList.length; i++){
			var txt = Game.itemsList[i].name;
			ctx.fillText(txt, Game.width - ctx.measureText(txt).width, 40 + (20 * i));
		}
		
		ctx.restore();
	}
  };

  this.step = function(dt) { };
};