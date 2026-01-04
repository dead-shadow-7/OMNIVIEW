from flask import Flask, jsonify
import requests
import json
import time
import threading

FLIGHT_API_URL = "https://opensky-network.org/api/states/all"
OUTPUT_FILE = "flights.json"

def start_flight_tracker():
    """Start the flight tracking in a background thread"""
    thread = threading.Thread(target=fetch_flights, daemon=True)
    thread.start()
    return thread

def fetch_flights():
    while True:
        try:
            res = requests.get(FLIGHT_API_URL, timeout=10)
            if res.status_code == 200:
                data = res.json()
                with open(OUTPUT_FILE, "w") as f:
                    json.dump(data, f)
                print("Updated flight data")
            else:
                print("API error:", res.status_code)
        except Exception as e:
            print("Fetch failed:", e)
        time.sleep(240)  # update every 4 minutes

def get_flights_data():
    """Get the current flight data"""
    try:
        with open(OUTPUT_FILE) as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "no data yet"}), 500