import os
import time
import pypdf

import openai

from flask import Flask, jsonify, request
from flask_cors import CORS

from azure.search.documents.indexes.models import *
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from core.uploadfile import *
from core.savedfile import *
from core.deletefile import *


# configure_azure_monitor()
app = Flask(__name__)
# 文字コードの設定をUTF-8(asciiじゃなくする)にする(Flaskは元々がascii)
app.config["JSON_AS_ASCII"] = False
CORS(app)  # CORS設定を追加
FlaskInstrumentor().instrument_app(app)

# Azure Blob StorageとAzure AI Searchのインデックスに登録したドキュメントを削除する
@app.route("/delete", methods=["POST"])
def delete():
    botname = request.json["bot"]
    if botname == "幕張トライアル":
        containername = "test"
    else:
        containername = ""
    files = request.json["options"]
    answers = []
    try:
        for f in files:
            filename = f["filename"]
            print(botname + "から" + filename + "を削除する")
            deleteFileName = filename
            baseName = os.path.splitext(deleteFileName)[0]
            extension = os.path.splitext(deleteFileName)[1]
            blobList = getAllFiles(containername)
            # 正規表現パターン：baseNameで始まり、-（ハイフン）の後に数字が続き、拡張子で終わる(例:test-1.pdf)
            pattern = re.compile(rf"^{re.escape(baseName)}-\d+{re.escape(extension)}$", re.IGNORECASE)
            # パターンにマッチするファイルを抽出
            selectedFiles = [file for file in blobList if pattern.match(file)]
            # selectedFiles = [file for file in blobList if baseName in file and file.lower().endswith(extension)]
            deleteResultOfBlob = deleteBlob(selectedFiles, containername)
            deleteResultOfIndex = removeSearchIndex(selectedFiles)
            if deleteResultOfBlob and deleteResultOfIndex:
                answer = { "answer": True }
                answers.append(answer)
            else:
                answer = { "answer": False }
                answers.append(answer)
            # bbb = run_indexer()
        return jsonify(answers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Azure Blob Storageに登録してあるドキュメント情報を取得する
@app.route("/savedfile", methods=["POST"])
def savedfile():
    print(request.json["options"]["bot"])
    try:
        botname = request.json["options"]["bot"]
        if botname == "幕張トライアル":
            containername = "test"
            saved_files_info = get_seved_file_info(containername)
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
    #選択したボット名を持ってきてた
    botname = request.form["bot"]
    bot = ""
    if botname == "幕張トライアル" :
        index = "test"
    else :
        index = ""
        answer = { "answer": False }
        return jsonify(answer)
    if 'file' not in request.files:
        answer = { "answer": False }
        return jsonify(answer)
    try:
        # インデックスの存在を確認。なければ作成
        create_search_index()
        # ファイルのバイナリーデータ
        upload_files = request.files.getlist("file")
        for upload_file in upload_files:
            original_extension = os.path.splitext(upload_file.filename)[1].lower() 
            organized_allpages = upload_blobs(upload_file, original_extension)
            for page in organized_allpages:
                page_map = get_document_text(page, index, original_extension)
                sections = create_sections(os.path.basename(page), page_map)
                index_sections(os.path.basename(page), sections)
            answer = { "answer": True }
        return jsonify(answer)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    # data = request.form  # フォームデータを取得する場合
    # data = request.files  # ファイルを含むフォームデータを取得する場合

    # 受け取ったデータを出力して確認
    print(data)

# OpenAI APIへのアクセスに必要なトークンを確認し、必要に応じて更新する
def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token
        # openai.api_key = os.environ.get("AZURE_OPENAI_KEY")

if __name__ == '__main__':
    app.run(debug=True)

