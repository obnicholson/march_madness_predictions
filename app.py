import pandas as pd

import sqlalchemy
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, func

from flask import Flask, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy

from geopy.geocoders import MapBox
from geopy.distance import geodesic

import pickle

app = Flask(__name__)
app.config['DEBUG'] = True


# Model setup
####################################################################################################
geolocator = MapBox(api_key="pk.eyJ1Ijoib2JuaWNob2xzb24iLCJhIjoiY2pwcHBrbmIxMGdhMTN4cWZ2czR6NDVwcCJ9.T5lnDc1uaxKgp4S18rFyBw", timeout=None)

model_filename = 'ncaa_model.pkl'
model_input_features = ['team_seed', 'team_travel_miles', 'opponent_seed', 'opponent_travel_miles', 'team_rank_SOS', 'team_rank_SRS', 
'team_rank_ast', 'team_rank_blk', 'team_rank_fg', 'team_rank_fg2', 'team_rank_fg2_pct', 'team_rank_fg2a', 'team_rank_fg3', 
'team_rank_fg3_pct', 'team_rank_fg3a', 'team_rank_fg_pct', 'team_rank_fga', 'team_rank_ft', 'team_rank_ft_pct', 'team_rank_fta', 
'team_rank_pts', 'team_rank_pts_per_g', 'team_rank_stl', 'team_rank_trb', 'opponent_team_rank_SOS', 'opponent_team_rank_SRS', 
'opponent_team_rank_ast', 'opponent_team_rank_blk', 'opponent_team_rank_fg', 'opponent_team_rank_fg2', 'opponent_team_rank_fg2_pct', 
'opponent_team_rank_fg2a', 'opponent_team_rank_fg3', 'opponent_team_rank_fg3_pct', 'opponent_team_rank_fg3a', 'opponent_team_rank_fg_pct', 
'opponent_team_rank_fga', 'opponent_team_rank_ft', 'opponent_team_rank_ft_pct', 'opponent_team_rank_fta', 'opponent_team_rank_pts', 
'opponent_team_rank_pts_per_g', 'opponent_team_rank_stl', 'opponent_team_rank_trb']


# Database setup
####################################################################################################
engine = create_engine("sqlite:///db/ncaa_history.sqlite")

Base = automap_base()
Base.prepare(engine, reflect=True)

games = Base.classes.bracket_schedule
teams = Base.classes.teams_predictions
schools = Base.classes.schools

session = Session(engine)


# Retrieving school/game info required for model
####################################################################################################
def get_team_info(team):
    team_info_query = session.query(teams.name, teams.team_rank_SOS, teams.team_rank_SRS, teams.team_rank_ast, teams.team_rank_blk, 
    teams.team_rank_fg, teams.team_rank_fg2, teams.team_rank_fg2_pct, teams.team_rank_fg2a, teams.team_rank_fg3, teams.team_rank_fg3_pct, 
    teams.team_rank_fg3a, teams.team_rank_fg_pct, teams.team_rank_fga, teams.team_rank_ft, teams.team_rank_ft_pct, teams.team_rank_fta, 
    teams.team_rank_pts, teams.team_rank_pts_per_g, teams.team_rank_stl, teams.team_rank_trb).filter(teams.name == team).statement
    
    df = pd.read_sql_query(team_info_query, session.bind)

    school_location = session.query(schools.location).filter(schools.name == team).first()[0]
    df['location'] = school_location

    return df

def get_game_info(game_id):
    game_info_query = session.query(games).filter(games.game_id == game_id).statement
    df = pd.read_sql_query(game_info_query, session.bind)

    return df


# Run model for specified team/game
####################################################################################################
def get_win_probability(team1, team2, game_id):
    team_df = get_team_info(team1)

    opponent_df = get_team_info(team2)

    game_df = get_game_info(game_id)

    #team seeds
    if team_df['name'][0] == game_df['team1'][0]:
        team_df['team_seed'] = game_df['seed1']
    elif team_df['name'][0] == game_df['team2'][0]:
        team_df['team_seed'] = game_df['seed2']

    if opponent_df['name'][0] == game_df['team1'][0]:
        opponent_df['seed'] = game_df['seed1']
    elif opponent_df['name'][0] == game_df['team2'][0]:
        opponent_df['seed'] = game_df['seed2']

    # travel distances
    game_location = game_df['location']
    team_location = team_df['location']
    opponent_location = opponent_df['location']

    game_geolocation = geolocator.geocode(game_location)
    team_geolocation = geolocator.geocode(team_location)
    opponent_geolocation = geolocator.geocode(opponent_location)

    game_latlon = (game_geolocation.latitude, game_geolocation.longitude)
    team_latlon = (team_geolocation.latitude, team_geolocation.longitude)
    opponent_latlon = (opponent_geolocation.latitude, opponent_geolocation.longitude)

    team_df['team_travel_miles'] = geodesic(team_latlon, game_latlon).miles
    opponent_df['travel_miles'] = geodesic(opponent_latlon, game_latlon).miles

    # team df to include opponent data for model
    opponent_df = opponent_df.add_prefix('opponent_')
    team_df = team_df.merge(opponent_df, left_index=True, right_index=True)

    # run model
    model_features_df = team_df[model_input_features]

    with open(model_filename, 'rb') as file:  
        prediction_model = pickle.load(file)
    
    probabilities = prediction_model.predict_proba(model_features_df)

    win_probability = probabilities[0][1]
    seed = team_df['team_seed'][0]
    next_game = game_df['next_game'][0]
    next_game_pos = game_df['next_game_pos'][0]

    return [win_probability, seed, next_game, next_game_pos]


# Route for retrieving game prediction information
####################################################################################################
@app.route("/<team_1>/<team_2>/<gameid>")
def prediction(team_1, team_2, gameid):
    team_1_prob = get_win_probability(team_1,team_2,gameid)
    team_2_prob = get_win_probability(team_2,team_1,gameid)

    if team_1_prob[0] > team_2_prob[0]:
        predicted_winner = team_1
        predicted_winner_seed = str(team_1_prob[1])
        confidence_spread = team_1_prob[0] - team_2_prob[0]
    else:
        predicted_winner = team_2
        predicted_winner_seed = str(team_2_prob[1])
        confidence_spread = team_2_prob[0] - team_1_prob[0]

    next_game = team_1_prob[2]
    next_game_pos = team_1_prob[3]

    probs = {'team1': team_1,
        'team1_win_prob': team_1_prob[0],
        'team2': team_2,
        'team2_win_prob': team_2_prob[0],
        'predicted_winner': predicted_winner,
        'predicted_winner_seed': predicted_winner_seed,
        'confidence_spread': confidence_spread,
        'next_game': next_game,
        'next_gam_pos': next_game_pos}

    return jsonify(probs)



if __name__ == "__main__":
    app.run()

