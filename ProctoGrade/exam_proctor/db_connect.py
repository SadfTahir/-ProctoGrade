# db_connect.py
from pymongo import MongoClient

def get_db():
    # MongoDB connection URI 
    client = MongoClient("mongodb://localhost:27017/")  
    db = client["Login_DB"]  
    return db
