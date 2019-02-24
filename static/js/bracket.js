// Data URLs
// ####################################################################################################
gamesURL = "/game-data"
matchupsURL = "/matchup-data"
schoolsURL = "/school-data"


// Create empty arrays for data
// ####################################################################################################
var gameArray = [];
var matchupArray = [];
var schoolArray = [];


// Function to filter game data by round
// ####################################################################################################
function selectRound(round, division) {
    return function(game) {
        return game.round === round && game.bracket === division;
    }
}


// Function to build bracket
// ####################################################################################################
function buildBracket(round, divisionInitial, bracket, roundGames) {
    var roundDiv = bracket.select(`#round${round}_${divisionInitial}`)

    var gameDivs = roundDiv.selectAll('btn-group-vertical')
        .data(roundGames)
        .enter()
        .append('div')
        .classed('game', true)
        .classed('btn-group-vertical', true)
        .attr('data-game', d=>d.game_id);
    
    gameDivs.append('button')
        .attr('type', 'button')
        .classed('team1', true)
        .classed('btn btn-outline-secondary btn-sm btn-block', true)
        .attr('data-team', '1')
        .text(d=>d.team1)
    
    gameDivs.append('button')
        .attr('type', 'button')
        .classed('team2', true)
        .classed('btn btn-outline-secondary btn-sm btn-block', true)
        .attr('data-team', '2')
        .text(d=>d.team2)
}


// Function to get game info for given game
// ####################################################################################################
function getGameInfo(game, bracket) {
    var game_id = game.attr('data-game');
    var team1 = game.select("button[data-team='1']").text();
    var team2 = game.select("button[data-team='2']").text(); 

    var thisMatchup = matchupArray.find(function(matchup){
        return matchup.game_id === game_id && matchup.team1 === team1 && matchup.team2 === team2;
    }); 

    var thisGame = gameArray.find(function(game){
        return game.game_id === game_id;
    });

    // var gameMatchupData = Object.assign(thisMatchup, thisGame);

    var gameInfo = {};
    gameInfo.game = game;
    gameInfo.nextGame = thisGame.nextGame;
    gameInfo.nextGamePos = thisGame.nextGamePos;
    gameInfo.bracket = bracket;
    gameInfo.team1 = team1;
    gameInfo.team2 = team2;
    gameInfo.team1WinProb = thisMatchup.team1WinProb;
    gameInfo.team2WinProb = thisMatchup.team2WinProb;

    return gameInfo;
}


// Function to predict winner of given game
// ####################################################################################################
function predictWinner(gameInfo) {
    var game = gameInfo.game;
    var bracket = gameInfo.bracket;

    var nextGameID = gameInfo.nextGame;
    var nextGamePos = gameInfo.nextGamePos;

    var team1 = gameInfo.team1;
    var team2 = gameInfo.team2;

    var team1WinProb = gameInfo.team1WinProb;
    var team2WinProb = gameInfo.team2WinProb;

    if (team1WinProb > team2WinProb) {
        game.select("button[data-team='1']")
            .classed('active', true);

        game.select("button[data-team='2']")
            .classed('active', false);

        nextGame(nextGameID, nextGamePos, team1, bracket);
    }
    else {
        game.select("button[data-team='2']")
            .classed('active', true);

        game.select("button[data-team='1']")
            .classed('active', false)

        nextGame(nextGameID, nextGamePos, team2, bracket);
    }
}


// Function to populate next game based on projected winner
// ####################################################################################################
function nextGame(nextGameID, nextGamePos, winningTeam, bracket) {
    var nextGame = bracket.select(`.game[data-game='${nextGameID}']`)
        .select(`button[data-team='${nextGamePos}']`)
    
    nextGame.text(winningTeam);
}


// Function to predict winner of current round and populate next round's teams
// ####################################################################################################
function populateBracketRound(round, bracket) {
    round.each(function(d, i) {
        var game = d3.select(this);

        predictWinner(getGameInfo(game, bracket));
    });  
}


// Function run predictions for multiple rounds
// ####################################################################################################
function runPredictions(startingRound, bracket) {
    for (var i=startingRound; i<7; i++){
        var round = bracket.selectAll(`.round${i}`).selectAll('.game')

        populateBracketRound(round, bracket);
    }

    var round6 = bracket.selectAll('.round6').selectAll('.game');

    var champion = round6.select('.active').text()
    var championSchoolInfo = schoolArray.find(function(school){
        return school.name === champion;
    });
    
    var championSchoolLogo = championSchoolInfo.logo

    round6.select('img')
        .attr('src', championSchoolLogo);

}


// Get game data
// ####################################################################################################
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

    Object.entries(gameData.team2).forEach(function([key, value]){
        gameArray[key].team2 = value;
    });

    Object.entries(gameData.next_game).forEach(function([key, value]){
        gameArray[key].nextGame = value;
    });

    Object.entries(gameData.next_game_pos).forEach(function([key, value]){
        gameArray[key].nextGamePos = value;
    });

 // Get matchup data
// ####################################################################################################
    d3.json(matchupsURL).then(function(matchupData){
        Object.values(matchupData.game_id).forEach(function(value){
            var matchupInfo = {'game_id':value};
            matchupArray.push(matchupInfo);
        });

        Object.entries(matchupData.seed_team1).forEach(function([key, value]){
            matchupArray[key].seed1 = value;
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

        Object.entries(matchupData.seed_team2).forEach(function([key, value]){
            matchupArray[key].seed2 = value;
        });

        Object.entries(matchupData.team2_win_probability).forEach(function([key, value]){
            matchupArray[key].team2WinProb = value;
        });


// Get school data
// ####################################################################################################
        d3.json(schoolsURL).then(function(schoolData){
            Object.values(schoolData.name).forEach(function(value){
                var schoolInfo = {'name':value};
                schoolArray.push(schoolInfo);
            });

            Object.entries(schoolData.logo).forEach(function([key, value]){
                schoolArray[key].logo = value;
            });


// Create bracket
// ####################################################################################################
            var round1Games_S = gameArray.filter(selectRound('1', 'South'));
            var round1Games_W = gameArray.filter(selectRound('1', 'West'));
            var round1Games_MW = gameArray.filter(selectRound('1', 'Midwest'));
            var round1Games_E = gameArray.filter(selectRound('1', 'East'));

            var round2Games_S = gameArray.filter(selectRound('2', 'South'));
            var round2Games_W = gameArray.filter(selectRound('2', 'West'));
            var round2Games_MW = gameArray.filter(selectRound('2', 'Midwest'));
            var round2Games_E = gameArray.filter(selectRound('2', 'East'));

            var round3Games_S = gameArray.filter(selectRound('3', 'South'));
            var round3Games_W = gameArray.filter(selectRound('3', 'West'));
            var round3Games_MW = gameArray.filter(selectRound('3', 'Midwest'));
            var round3Games_E = gameArray.filter(selectRound('3', 'East'));

            var round4Games_S = gameArray.filter(selectRound('4', 'South'));
            var round4Games_W = gameArray.filter(selectRound('4', 'West'));
            var round4Games_MW = gameArray.filter(selectRound('4', 'Midwest'));
            var round4Games_E = gameArray.filter(selectRound('4', 'East'));

            var round5Games_S_W = gameArray.filter(selectRound('5', 'FF_W_S'));
            var round5Games_E_MW = gameArray.filter(selectRound('5', 'FF_E_MW'));

            var bracket = d3.select('#bracket');

            buildBracket('1', 's',  bracket, round1Games_S);
            buildBracket('1', 'w',  bracket, round1Games_W);
            buildBracket('1', 'mw',  bracket, round1Games_MW);
            buildBracket('1', 'e',  bracket, round1Games_E);

            buildBracket('2', 's',  bracket, round2Games_S);
            buildBracket('2', 'w',  bracket, round2Games_W);
            buildBracket('2', 'mw',  bracket, round2Games_MW);
            buildBracket('2', 'e',  bracket, round2Games_E);

            buildBracket('3', 's',  bracket, round3Games_S);
            buildBracket('3', 'w',  bracket, round3Games_W);
            buildBracket('3', 'mw',  bracket, round3Games_MW);
            buildBracket('3', 'e',  bracket, round3Games_E);

            buildBracket('4', 's',  bracket, round4Games_S);
            buildBracket('4', 'w',  bracket, round4Games_W);
            buildBracket('4', 'mw',  bracket, round4Games_MW);
            buildBracket('4', 'e',  bracket, round4Games_E);

            buildBracket('5', 's_w',  bracket, round5Games_S_W);
            buildBracket('5', 'e_mw',  bracket, round5Games_E_MW);


// Populate initial bracket predictions; make responsive to recalculate predictions on user button selection
// ####################################################################################################
            runPredictions(1, bracket);

            var changeWinnerButtons = d3.selectAll('.btn-group-vertical').selectAll('.btn');

            changeWinnerButtons.on('click', function() {
                var selectedButton = d3.select(this);
                var selectedRound = selectedButton.data()[0].round;

                var gameID = selectedButton.data()[0].game_id;
                var game = bracket.select(`.game[data-game='${gameID}']`)

                var gameInfo = getGameInfo(game, bracket);

                var nextGameID = gameInfo.nextGame
                var nextGamePos = gameInfo.nextGamePos;
                var selectedWinnerName = selectedButton.text();

                nextGame(nextGameID, nextGamePos, selectedWinnerName, bracket);

                var nextRound = parseInt(selectedRound) + 1

                runPredictions(nextRound, bracket);
            });
        });
    });
});


// UPDATE BUTTON CLICK RESPONSE FOR FINALS SELECTION TO CHANGE HIGHLIGHT AND LOGO
// RESET BUTTON
// INDIVIDUAL DIVISIONS ZOOM IN???






