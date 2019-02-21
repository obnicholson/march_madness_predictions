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


// Function to predict winner of current round and populate next round's teams
// ####################################################################################################
function populateBracketRound(round, bracket) {
    round.each(function(d, i) {
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
        
        if (gameMatchupData.team1WinProb > gameMatchupData.team2WinProb) {
            game.select("div[data-team='1']")
                .select('p')
                .html(`<strong>${team1}</strong>`);

            bracket.select(`.game[data-game='${nextGameID}']`)
                .select(`div[data-team='${nextGamePos}']`)
                .select('p')
                .text(team1);
        }
        else {
            game.select("div[data-team='2']")
                .select('p')
                .html(`<strong>${team2}</strong>`);

                bracket.select(`.game[data-game='${nextGameID}']`)
                .select(`div[data-team='${nextGamePos}']`)
                .select('p')
                .text(team2);
        }
    });  
}

// Function to filter game data by round
// ####################################################################################################
function selectRound(round) {
    return function(game) {
        return game.round === round;
    }
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
// ####################################################################################################
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

            console.log(gameArray);
            console.log(matchupArray);
            console.log(schoolArray);


// Create bracket
// ####################################################################################################
        var round1Games = gameArray.filter(selectRound('1'));
        var round2Games = gameArray.filter(selectRound('2'));
        var round3Games = gameArray.filter(selectRound('3'));
        var round4Games = gameArray.filter(selectRound('4'));
        var round5Games = gameArray.filter(selectRound('5'));
        var round6Games = gameArray.filter(selectRound('6'));

        var bracket = d3.select('#bracket');

        var round1Div = bracket.append('div')
            .attr('id', 'round1');

        var round1GameDivs = round1Div.selectAll('div')
            .data(round1Games)
            .enter()
            .append('div')
            .classed('game', true)
            .attr('data-game', d=>d.game_id);
        
        round1GameDivs.append('div')
            .attr('data-team', '1')
            .append('p')
            .text(d=>d.team1)
        
        round1GameDivs.append('div')
            .attr('data-team', '2')
            .append('p')
            .text(d=>d.team2)


// Populate bracket predictions
// ####################################################################################################
            var round1 = bracket.select('#round1').selectAll('.game')
            var round2 = bracket.select('#round2').selectAll('.game')
            var round3 = bracket.select('#round3').selectAll('.game')
            var round4 = bracket.select('#round4').selectAll('.game')
            var round5 = bracket.select('#round5').selectAll('.game')
            var round6 = bracket.select('#round6').selectAll('.game')

            populateBracketRound(round1, bracket);
            populateBracketRound(round2, bracket);
            populateBracketRound(round3, bracket);
            populateBracketRound(round4, bracket);
        });
    });
});

