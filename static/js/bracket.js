gamesURL = "/game-data"
matchupsURL = "/matchup-data"
schoolsURL = "/school-data"

// Get game data
// ##################################################
var gameArray = [];

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
});


// Get matchup data
// ##################################################
var matchupArray = []

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
});

console.log(matchupArray);