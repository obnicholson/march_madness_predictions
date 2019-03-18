import pandas as pd

import sqlalchemy
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, func

from flask import Flask, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
# app.config['DEBUG'] = True


# Database setup
####################################################################################################
engine = create_engine("sqlite:///db/ncaa_history.sqlite")

Base = automap_base()
Base.prepare(engine, reflect=True)

games = Base.classes.bracket_schedule_2019
probabilities = Base.classes.matchup_probabilities_2019
schools = Base.classes.schools

session = Session(engine)

@app.route("/game-data")
def game_data():
    stmt = session.query(games).statement
    df = pd.read_sql_query(stmt, session.bind)

    return df.to_json()  

@app.route("/matchup-data")
def matchup_probabilities():
    stmt = session.query(probabilities).statement
    df = pd.read_sql_query(stmt, session.bind)

    return df.to_json()  

@app.route("/school-data")
def school_data():
    stmt = session.query(schools).statement
    df = pd.read_sql_query(stmt, session.bind)

    return df.to_json()     

@app.route("/")
def index():
    return render_template("bracket.html")

if __name__ == "__main__":
    app.run()

