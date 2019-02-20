gamesURL = "/game-data"
matchupsURL = "/matchup-data"
schoolsURL = "/school-data"

// Get game data
// ##################################################
var gameArray = [];
var matchupArray = [];

function selectRound(round) {
    return function(game) {
        return game.round === round;
    }
}

d3.json(gamesURL).then(function(gameData){
    Object.values(gameData.game_id).forEach(function(value){
        var gameInfo = {'game_id':value};
        gameArray.push(gameInfo);
    });

    Object.entries(gameData.bracket).forEach(function([key, value]){
        gameArray[key].bracket = value;
    });

    Object.entries(gameData.round).forEach(function([key, value]){
        gameArray[key].round = value;
    });

    Object.entries(gameData.team1).forEach(function([key, value]){
        gameArray[key].team1 = value;
    });

    Object.entries(gameData.seed1).forEach(function([key, value]){
        gameArray[key].seed1 = value;
    });

    Object.entries(gameData.team2).forEach(function([key, value]){
        gameArray[key].team2 = value;
    });

    Object.entries(gameData.seed2).forEach(function([key, value]){
        gameArray[key].seed2 = value;
    });

    Object.entries(gameData.next_game).forEach(function([key, value]){
        gameArray[key].nextGame = value;
    });

    Object.entries(gameData.next_game_pos).forEach(function([key, value]){
        gameArray[key].nextGamePos = value;
    });

 // Get matchup data
// ##################################################
    d3.json(matchupsURL).then(function(matchupData){
        Object.values(matchupData.game_id).forEach(function(value){
            var matchupInfo = {'game_id':value};
            matchupArray.push(matchupInfo);
        });

        Object.entries(matchupData.team1).forEach(function([key, value]){
            matchupArray[key].team1 = value;
        });

        Object.entries(matchupData.team1_win_probability).forEach(function([key, value]){
            matchupArray[key].team1WinProb = value;
        });

        Object.entries(matchupData.team2).forEach(function([key, value]){
            matchupArray[key].team2 = value;
        });

        Object.entries(matchupData.team2_win_probability).forEach(function([key, value]){
            matchupArray[key].team2WinProb = value;
        });

        console.log(gameArray);
        console.log(matchupArray);






        var round1GameData = gameArray.filter(selectRound('1'));

        console.log(round1GameData);

        


        var bracket = d3.select('#bracket')
        var round1 = bracket.select('#round1').selectAll('.game')
        var round2 = bracket.select('#round2').selectAll('.game')

        round1.each(function(d, i) {
            var game = d3.select(this);
            var game_id = game.attr('data-game');
            var team1 = game.select("div[data-team='1']").select('p').text();
            var team2 = game.select("div[data-team='2']").select('p').text();
            
            var thisMatchup = matchupArray.find(function(matchup){
                return matchup.game_id === game_id && matchup.team1 === team1 && matchup.team2 === team2;
            })

            var thisGame = gameArray.find(function(game){
                return game.game_id === game_id;
            })

            var gameMatchupData = Object.assign(thisMatchup, thisGame);
            var nextGameID = gameMatchupData.nextGame;
            var nextGamePos = gameMatchupData.nextGamePos;
            
            //do i need this?
            game.data(gameMatchupData);
            
            if (gameMatchupData.team1WinProb > gameMatchupData.team2WinProb) {
                game.select("div[data-team='1']")
                    .select('p')
                    .html(`<strong>${team1}</strong>`);
            }
            else {
                game.select("div[data-team='2']")
                    .select('p')
                    .html(`<strong>${team2}</strong>`);
            }
        });
    });
});

