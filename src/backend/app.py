import os
import time
import pypdf
import sys
import openai

from dotenv import load_dotenv

from flask import Flask, jsonify, request
from flask_cors import CORS

from azure.search.documents.indexes.models import *
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from core.uploadfile import *
from core.savedfile import *
from core.deletefile import *

# .envファイルの内容を読み込見込む
load_dotenv()

# configure_azure_monitor()
app = Flask(__name__)
# 文字コードの設定をUTF-8(asciiじゃなくする)にする(Flaskは元々がascii)
app.config["JSON_AS_ASCII"] = False
# sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
# CORS設定を追加
CORS(app)
FlaskInstrumentor().instrument_app(app)

MAKUHARI = os.environ.get("MAKUHARI")
SHINSOTSU = os.environ.get("SHINSOTSU")
UNEI = os.environ.get("UNEI")

MAKUHARI_CONTAINER = os.environ.get("MAKUHARI_CONTAINER")
SHINSOTSU_CONTAINER = os.environ.get("SHINSOTSU_CONTAINER")
UNEI_CONTAINER = os.environ.get("UNEI_CONTAINER")

MAKUHARI_AZURE_SEARCH_INDEX = os.environ.get("MAKUHARI_AZURE_SEARCH_INDEX")
SHINSOTSU_AZURE_SEARCH_INDEX = os.environ.get("SHINSOTSU_AZURE_SEARCH_INDEX")
UNEI_AZURE_SEARCH_INDEX = os.environ.get("UNEI_AZURE_SEARCH_INDEX")
# 選択したボットからコンテナー名を取得する
def get_container_name(botname):
    if botname == MAKUHARI:
        container_name = MAKUHARI_CONTAINER
        search_index = MAKUHARI_AZURE_SEARCH_INDEX
    elif botname == SHINSOTSU:
        container_name = SHINSOTSU_CONTAINER
        search_index = SHINSOTSU_AZURE_SEARCH_INDEX
    elif botname == UNEI:
        container_name = UNEI_CONTAINER
        search_index = UNEI_AZURE_SEARCH_INDEX
    return container_name, search_index

# Azure Blob StorageとAzure AI Searchのインデックスに登録したドキュメントを削除する
@app.route("/delete", methods=["POST"])
def delete():
    botname = request.json["bot"]
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    files = request.json["options"]
    answers = []
    try:
        for f in files:
            deleteFileName = f["filename"]
            print(botname + "から" + deleteFileName + "を削除する")
            # コンテナーからすべてのBLOBを取り出す。
            blobList = getAllFiles(container_name)
            # 正規表現パターン
            pattern = re.compile(rf'{re.escape(deleteFileName)}')
            # パターンにマッチするファイルを抽出
            selectedFiles = [file[0] for file in blobList if pattern.match(file[1])]
            # 指定したBlobデータをContainer内から論理的な削除をする
            deleteResultOfBlob = deleteBlob(selectedFiles, container_name)
            # 削除したBlobデータに紐づいたインデックスを削除する
            deleteResultOfIndex = removeSearchIndex(selectedFiles, search_index)
            if deleteResultOfBlob and deleteResultOfIndex:
                answer = { "answer": True }
                answers.append(answer)
            else:
                answer = { "answer": False }
                answers.append(answer)
        return jsonify(answers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Azure Blob Storageに登録してあるドキュメント情報を取得する
@app.route("/savedfile", methods=["POST"])
def savedfile():
    print(request.json["options"]["bot"])
    botname = request.json["options"]["bot"]
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    try:
        # コンテナー内の全データを取得
        saved_files_info = get_seved_file_info(container_name)
        return jsonify(saved_files_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#upload
@app.route("/upload", methods=["POST"])
def upload():
    # ensure_openai_token()
    print(request.files)
    print(request.form["bot"])
    answer = []
    botname = request.form["bot"]
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    if 'file' not in request.files:
        answer = { "answer": False }
        return jsonify(answer)
    try:
        # インデックスの存在を確認。なければ作成
        create_search_index(search_index)
        # ファイルのバイナリーデータ
        upload_files = request.files.getlist("file")
        for upload_file in upload_files:
            # 拡張子の取得
            original_extension = os.path.splitext(upload_file.filename)[1].lower() 
            # Azure Blob Storageにアップロード
            organized_allpages = upload_blobs(upload_file, original_extension, container_name)
            for page in organized_allpages:
                # テキストを抽出 Document intelligence
                page_map = get_document_text(page, container_name, original_extension)
                # ページマップからセクションオブジェクトのジェネレータを作成します。
                sections = create_sections(os.path.basename(page), page_map)
                # セクションを検索インデックスにインデックスします。
                index_sections(os.path.basename(page), sections, search_index)
            answer = { "answer": True }
        return jsonify(answer)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# OpenAI APIへのアクセスに必要なトークンを確認し、必要に応じて更新する
def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token
        # openai.api_key = os.environ.get("AZURE_OPENAI_KEY")

if __name__ == '__main__':
    port = int(os.environ.get('HTTP_PLATFORM_PORT', 5000))
    app.run(debug=True, port=port)

