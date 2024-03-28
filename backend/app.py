from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # CORS設定を追加

@app.route('/')
def hello():
    return "Hello from Flask!"

if __name__ == '__main__':
    app.run(debug=True)