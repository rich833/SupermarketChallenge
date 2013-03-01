var express = require('express'),
	//Create an express server
	app = express.createServer(),
	//attach socket.io to the server
	supermarket = require('socket.io').listen(app);

//Configure a static directory for public files
app.configure(function() {
	app.use(express.static(__dirname + '/public'));
});

//set the port to listen to
app.listen(3000);

var games = [];

//Once a socket has connected
supermarket.sockets.on('connection', function(socket) {
	var game = null;
	console.log('someone connected');
	//Find the first game with less than two players
	for(var i=0; i < games.length; i++){
		if(games[i].length < 2){
			game = i;
		}
	}
	
	//If all games have two players, then create a new game
	if(game == null){
		games.push([]);
		game = games.length-1;
	}
	
	//Keep track of which socket belongs to which game
	games[game].push(socket);
	socket.set('game', game);
	
	//If there are two players for the game,
	//Set one as a master and one as a slave
	//Also put a socket linking to each other
	//Inside of their socket labelled as partner
	if(games[game].length == 2){
		games[game][0].set('partner', socket);
		games[game][1].set('partner', games[game][0]);
		games[game][0].emit('master');
		games[game][1].emit('slave');
	}
	console.log('no of players: ' + games[game].length);

	//Works out the timing delay between the two players
	//Every time the delay event is received, it is passed
	//To the partner and the number of steps in incremented.
	//Once the number of steps is 3 (client to server, 
	//to partner to server), the request is complete and
	//we can calculate the delay
	socket.on('delay', function(data){
		socket.get('partner', function(err,partner){
			if(partner){
				data.steps += 1;
				partner.emit('delay', data);
			}
		});
	});
	
	//Pass data from one socket to the other
	//Emitted as volatile to drop packets if they lag
	//So that player doesn't fast forward across the screen
	socket.on('move', function(data) {
		socket.get('partner', function(err, partner) {
			if(partner){
				partner.volatile.emit('move', data);
			}
		});
	});
	
	//Sent by the winner to update their partner as the loser
	socket.on('winner', function() {
		socket.get('partner', function(err, partner) {
			if(partner){
				partner.volatile.emit('loser');
			}
		});
	});
	
	//Helps to create partner items in random positions
	//Which appear in the same places on each player's screen
	socket.on('createPartnerItems', function(data) {
		socket.get('partner', function(err, partner) {
			if(partner){
				partner.emit('setPositions', {
					x: data.x,
					y: data.y,
					id: data.id
				});
			}
		});	
	});
	
	//Tells the partner when the player has started playing
	//The game, so that their game starts too
	socket.on('playGame', function(data) {
		socket.get('partner', function(err, partner) {
			if(partner){
				partner.emit('playGame');
			}
		});	
	});
	
	//Once the player collects an item, it is removed from
	//their partner's screen too
	socket.on('removeItem', function(data) {
		socket.get('partner', function(err, partner) {
			if(partner){
				partner.emit('removeItem', data);
			}
		});
	});
	
	//When a socket disconnects, tell the partner
	//and remove itself from the game, so that the 
	//partner can be rematched
	socket.on('disconnect', function() {
		socket.get('partner', function(err, partner) {
			if(partner) {
				partner.emit('end');
				partner.set('partner', null);
			}
		});
		
		socket.get('game', function(err, game){
			var idx = games[game].indexOf(socket);
			if(idx !=1) games[game].splice(idx, 1);
		});
	});
});