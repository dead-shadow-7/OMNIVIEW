from flask import Flask, jsonify
import requests
import json
import time
import threading
import os

FLIGHT_API_URL = "https://opensky-network.org/api/states/all"
TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
OUTPUT_FILE = "flights.json"

access_token = None
token_expiry = 0

def get_access_token():
    """Fetch an OAuth2 access token using client credentials."""
    global access_token, token_expiry

    if access_token and time.time() < token_expiry:
        return access_token

    client_id = os.getenv("OPENSKY_CLIENT_ID")
    client_secret = os.getenv("OPENSKY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    try:
        res = requests.post(TOKEN_URL, data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }, timeout=10)

        if res.status_code == 200:
            token_data = res.json()
            access_token = token_data["access_token"]
            # Refresh 60s before actual expiry
            token_expiry = time.time() + token_data.get("expires_in", 300) - 60
            print("OpenSky OAuth2 token acquired")
            return access_token
        else:
            print(f"Token request failed: {res.status_code}")
            return None
    except Exception as e:
        print(f"Token request error: {e}")
        return None

def start_flight_tracker():
    """Start the flight tracking in a background thread"""
    thread = threading.Thread(target=fetch_flights, daemon=True)
    thread.start()
    return thread

def fetch_flights():
    while True:
        try:
            token = get_access_token()
            headers = {"Authorization": f"Bearer {token}"} if token else {}

            res = requests.get(FLIGHT_API_URL, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                with open(OUTPUT_FILE, "w") as f:
                    json.dump(data, f)
                print("Updated flight data" + (" (authenticated)" if token else " (anonymous)"))
            else:
                print("API error:", res.status_code)
        except Exception as e:
            print("Fetch failed:", e)
        time.sleep(300)  # update every 5 minutes

def get_flights_data():
    """Get the current flight data"""
    try:
        with open(OUTPUT_FILE) as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "no data yet"}), 500
