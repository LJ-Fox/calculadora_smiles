import json
import uuid
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")
DATA_FILE = Path(__file__).parent / "datos.json"


def read_data():
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def write_data(data):
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# --- Static ---

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# --- Config ---

@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify(read_data()["config"])


@app.route("/api/config", methods=["PUT"])
def put_config():
    data = read_data()
    data["config"] = request.get_json()
    write_data(data)
    return jsonify(data["config"])


# --- Millas ---

@app.route("/api/millas", methods=["GET"])
def get_millas():
    return jsonify(read_data()["lotes_millas"])


@app.route("/api/millas", methods=["POST"])
def post_milla():
    data = read_data()
    lote = request.get_json()
    lote["id"] = str(uuid.uuid4())
    data["lotes_millas"].append(lote)
    write_data(data)
    return jsonify(lote), 201


@app.route("/api/millas/<lote_id>", methods=["PUT"])
def put_milla(lote_id):
    data = read_data()
    lote = request.get_json()
    lote["id"] = lote_id
    data["lotes_millas"] = [l if l["id"] != lote_id else lote for l in data["lotes_millas"]]
    write_data(data)
    return jsonify(lote)


@app.route("/api/millas/<lote_id>", methods=["DELETE"])
def delete_milla(lote_id):
    data = read_data()
    data["lotes_millas"] = [l for l in data["lotes_millas"] if l["id"] != lote_id]
    write_data(data)
    return "", 204


# --- Tickets ---

@app.route("/api/tickets", methods=["GET"])
def get_tickets():
    return jsonify(read_data()["tickets"])


@app.route("/api/tickets", methods=["POST"])
def post_ticket():
    data = read_data()
    ticket = request.get_json()
    ticket["id"] = str(uuid.uuid4())
    data["tickets"].append(ticket)
    write_data(data)
    return jsonify(ticket), 201


@app.route("/api/tickets/<ticket_id>", methods=["PUT"])
def put_ticket(ticket_id):
    data = read_data()
    ticket = request.get_json()
    ticket["id"] = ticket_id
    data["tickets"] = [t if t["id"] != ticket_id else ticket for t in data["tickets"]]
    write_data(data)
    return jsonify(ticket)


@app.route("/api/tickets/<ticket_id>", methods=["DELETE"])
def delete_ticket(ticket_id):
    data = read_data()
    data["tickets"] = [t for t in data["tickets"] if t["id"] != ticket_id]
    write_data(data)
    return "", 204


# --- Full data (for initial load) ---

@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify(read_data())


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
