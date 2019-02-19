import pandas as pd

import sqlalchemy
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, func

from geopy.geocoders import MapBox
from geopy.distance import geodesic

import pickle

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

games = Base.classes.bracket_paths
game_schedule = Base.classes.bracket_schedule
teams = Base.classes.teams_predictions
schools = Base.classes.schools

session = Session(engine)


# Retrieving school/game info required for model
####################################################################################################
def get_team_info(team):
    team_info_query = session.query(teams.team_rank_SOS, teams.team_rank_SRS, teams.team_rank_ast, teams.team_rank_blk, teams.team_rank_fg, 
    teams.team_rank_fg2, teams.team_rank_fg2_pct, teams.team_rank_fg2a, teams.team_rank_fg3, teams.team_rank_fg3_pct, teams.team_rank_fg3a, 
    teams.team_rank_fg_pct, teams.team_rank_fga, teams.team_rank_ft, teams.team_rank_ft_pct, teams.team_rank_fta, teams.team_rank_pts, 
    teams.team_rank_pts_per_g, teams.team_rank_stl, teams.team_rank_trb).filter(teams.name == team).statement
    
    team_stats_df = pd.read_sql_query(team_info_query, session.bind)

    school_location = session.query(schools.location).filter(schools.name == team).first()[0]
    team_stats_df['location'] = school_location

    return team_stats_df

def get_game_info(game_id):
    game_info_query = session.query(game_schedule).filter(game_schedule.game_id == game_id).statement
    game_schedule_df = pd.read_sql_query(game_info_query, session.bind)

    return game_schedule_df


# Run model for specified team/game
####################################################################################################
def get_win_probability(matchup, position):
    game_id = matchup['game_id']
    
    if position == 1:
        team = matchup['team1']
        team_seed = matchup['seed_team1']
        opponent = matchup['team2']
        opponent_seed = matchup['seed_team2']
    elif position == 2:
        team = matchup['team2']
        team_seed = matchup['seed_team2']
        opponent = matchup['team1']
        opponent_seed = matchup['seed_team1']       

    team_df = get_team_info(team)

    opponent_df = get_team_info(opponent)

    game_df = get_game_info(game_id)

    #team seeds
    team_df['team_seed'] = team_seed
    opponent_df['seed'] = opponent_seed

    # travel distances
    game_location = matchup['game_location']
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

    loss_probability = probabilities[0][0]
    win_probability = probabilities[0][1]

    next_game = game_df['next_game'][0]
    next_game_pos = game_df['next_game_pos'][0]

    matchup_outcome = {'win_probability': win_probability,
                        'loss_probability': loss_probability,
                        'next_game': next_game,
                        'next_game_pos': next_game_pos}

    return matchup_outcome


# Create team/location matchups
####################################################################################################
game_info_query = session.query(games).statement
games_df = pd.read_sql_query(game_info_query, session.bind)


#round 1 matchups
rd_1_df = games_df[['bracket', 'team', 'seed', 'rd_1', 'rd_1_location', 'rd_1_pos']]
rd_1_df_pos1 = rd_1_df.loc[(rd_1_df['rd_1_pos'] == '1'),:]
rd_1_df_pos2 = rd_1_df.loc[(rd_1_df['rd_1_pos'] == '2'),:]

rd_1_matchups = rd_1_df_pos1.merge(rd_1_df_pos2, on="rd_1", suffixes=('_team1', '_team2'))
rd_1_matchups['round'] = '1'
rd_1_matchups = rd_1_matchups[['rd_1', 'round', 'rd_1_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_1_matchups = rd_1_matchups.rename(columns={'rd_1': 'game_id',
                                                'rd_1_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

# round 2 matchups
rd_2_df = games_df[['bracket', 'team', 'seed', 'rd_2', 'rd_2_location', 'rd_2_pos']]
rd_2_df_pos1 = rd_2_df.loc[(rd_2_df['rd_2_pos'] == '1'),:]
rd_2_df_pos2 = rd_2_df.loc[(rd_2_df['rd_2_pos'] == '2'),:]

rd_2_matchups = rd_2_df_pos1.merge(rd_2_df_pos2, on="rd_2", suffixes=('_team1', '_team2'))
rd_2_matchups['round'] = '2'
rd_2_matchups = rd_2_matchups[['rd_2', 'round', 'rd_2_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_2_matchups = rd_2_matchups.rename(columns={'rd_2': 'game_id',
                                                'rd_2_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

# round 3 matchups
rd_3_df = games_df[['bracket', 'team', 'seed', 'rd_3', 'rd_3_location', 'rd_3_pos']]
rd_3_df_pos1 = rd_3_df.loc[(rd_3_df['rd_3_pos'] == '1'),:]
rd_3_df_pos2 = rd_3_df.loc[(rd_3_df['rd_3_pos'] == '2'),:]

rd_3_matchups = rd_3_df_pos1.merge(rd_3_df_pos2, on="rd_3", suffixes=('_team1', '_team2'))
rd_3_matchups['round'] = '3'
rd_3_matchups = rd_3_matchups[['rd_3', 'round', 'rd_3_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_3_matchups = rd_3_matchups.rename(columns={'rd_3': 'game_id',
                                                'rd_3_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

# round 4 matchups
rd_4_df = games_df[['bracket', 'team', 'seed', 'rd_4', 'rd_4_location', 'rd_4_pos']]
rd_4_df_pos1 = rd_4_df.loc[(rd_4_df['rd_4_pos'] == '1'),:]
rd_4_df_pos2 = rd_4_df.loc[(rd_4_df['rd_4_pos'] == '2'),:]

rd_4_matchups = rd_4_df_pos1.merge(rd_4_df_pos2, on="rd_4", suffixes=('_team1', '_team2'))
rd_4_matchups['round'] = '4'
rd_4_matchups = rd_4_matchups[['rd_4', 'round', 'rd_4_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_4_matchups = rd_4_matchups.rename(columns={'rd_4': 'game_id',
                                                'rd_4_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

# round 5 matchups
rd_5_df = games_df[['bracket', 'team', 'seed', 'rd_5', 'rd_5_location', 'rd_5_pos']]
rd_5_df_pos1 = rd_5_df.loc[(rd_5_df['rd_5_pos'] == '1'),:]
rd_5_df_pos2 = rd_5_df.loc[(rd_5_df['rd_5_pos'] == '2'),:]

rd_5_matchups = rd_5_df_pos1.merge(rd_5_df_pos2, on="rd_5", suffixes=('_team1', '_team2'))
rd_5_matchups['round'] = '5'
rd_5_matchups = rd_5_matchups[['rd_5', 'round', 'rd_5_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_5_matchups = rd_5_matchups.rename(columns={'rd_5': 'game_id',
                                                'rd_5_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

# round 6 matchups
rd_6_df = games_df[['bracket', 'team', 'seed', 'rd_6', 'rd_6_location', 'rd_6_pos']]
rd_6_df_pos1 = rd_6_df.loc[(rd_6_df['rd_6_pos'] == '1'),:]
rd_6_df_pos2 = rd_6_df.loc[(rd_6_df['rd_6_pos'] == '2'),:]

rd_6_matchups = rd_6_df_pos1.merge(rd_6_df_pos2, on="rd_6", suffixes=('_team1', '_team2'))
rd_6_matchups['round'] = '6'
rd_6_matchups = rd_6_matchups[['rd_6', 'round', 'rd_6_location_team1', 'team_team1', 'seed_team1', 'team_team2', 'seed_team2']]
rd_6_matchups = rd_6_matchups.rename(columns={'rd_6': 'game_id',
                                                'rd_6_location_team1': 'game_location',
                                                'team_team1': 'team1',
                                                'seed_team1': 'seed_team1',
                                                'team_team2': 'team2',
                                                'seed_team2': 'seed_team2'})

#all possible matchups
all_possible_matchups = pd.concat([rd_1_matchups, rd_2_matchups, rd_3_matchups, rd_4_matchups, rd_5_matchups, rd_6_matchups], axis=0, ignore_index=True)


# Calculate all probabilities
####################################################################################################
all_possible_matchups['team1_win_probability'] = 0.0
all_possible_matchups['team2_win_probability'] = 0.0
all_possible_matchups['next_game'] = ''

for index, matchup in all_possible_matchups.iterrows():
    team1_model_outcome = get_win_probability(matchup,1)
    team2_model_outcome = get_win_probability(matchup,2)

    team1_win_probability = team1_model_outcome['win_probability']
    team2_win_probability = team2_model_outcome['win_probability']
    next_game = team1_model_outcome['next_game']

    all_possible_matchups.at[index, 'team1_win_probability'] = team1_win_probability
    all_possible_matchups.at[index, 'team2_win_probability'] = team2_win_probability
    all_possible_matchups.at[index, 'next_game'] = next_game

    print(index)

all_possible_matchups.to_sql('matchup_probabilities', con=engine, if_exists='replace')























