import os
import time
import sys
import openai
import re

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
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
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
# 処理の進行状況
PROGRESS_STORE = {}
# タスクステータス
TASKS = {}
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
    # 各リクエストごとにIDを設定
    request_id = request.json["delete_id"]
    PROGRESS_STORE[request_id] = {
        "progress": 0.0,
        "isComp": False
    }
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    files = request.json["options"]
    answers = []
    # 5%経過
    PROGRESS_STORE[request_id]["progress"] += 5.0
    total_files = len(files)
    # エラーが発生したファイルを集める
    failed_delete_files = []
    try:
        for f in files:
            try:
                deleteFileName = f["filename"]
                print(botname + "から" + deleteFileName + "を削除する", flush=True)
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
                if not deleteResultOfBlob and not deleteResultOfIndex:
                    failed_delete_files.append(f)
                # 全部完了で100%
                PROGRESS_STORE[request_id]["progress"] += (1 / total_files) * 93
            except Exception as e:
                failed_delete_files.append(f)
                continue
        PROGRESS_STORE[request_id]["progress"] += 2.0
        # 最終的な進捗を# 100を超えないように整数に変換
        PROGRESS_STORE[request_id]["progress"] = min(100, round(PROGRESS_STORE[request_id]["progress"]))
        PROGRESS_STORE[request_id]["isComp"] = True
        # 全ての処理が成功したら
        if PROGRESS_STORE[request_id]["progress"] >= 100:
            answer = { "answer": True }
        # 1つでも失敗したら
        elif PROGRESS_STORE[request_id]["progress"] < 100 and failed_delete_files :
            answer = { "answer": True, "failed_files": failed_delete_files }
        return jsonify(answer)
    except Exception as e:
        PROGRESS_STORE[request_id]["progress"] = 100.0
        PROGRESS_STORE[request_id]["isComp"] = True
        return jsonify({"error": str(e)}), 500

#Azure Blob Storageに登録してあるドキュメント情報を取得する
@app.route("/savedfile", methods=["POST"])
def savedfile():
    print(request.json["options"]["bot"], flush=True)
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
async def upload():
    # ensure_openai_token()
    print(request.files, flush=True)
    print(request.form["bot"], flush=True)
    print(request.form["upload_id"], flush=True)
    # 各リクエストごとにIDを設定
    request_id = request.form["upload_id"]
    PROGRESS_STORE[request_id] = {
        "progress": 0.0,
        "isComp": False
    }
    answer = []
    botname = request.form["bot"]
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    if 'file' not in request.files:
        answer = { "answer": False }
        return jsonify(answer)
    # 5%経過
    PROGRESS_STORE[request_id]["progress"] += 5.0
    try:
        # インデックスの存在を確認。なければ作成
        create_search_index(search_index)
        # 10%経過
        PROGRESS_STORE[request_id]["progress"] += 5.0
        # ファイルのバイナリーデータ
        upload_files = request.files.getlist("file")
        total_files = len(upload_files)
        all_uploaded_pages = []
        # エラーが発生したファイルを集める
        failed_upload_files = []
        # タスクを逐次処理する
        for upload_file in upload_files:
            try:
                # 拡張子の取得
                original_extension = os.path.splitext(upload_file.filename)[1].lower()
                # 非同期にAzure Blob Storageにファイルをアップロードし、その結果を取得
                result = await upload_blobs(upload_file, original_extension, container_name)
                all_uploaded_pages.append(result)
                # 全部完了で40%まで経過とする
                PROGRESS_STORE[request_id]["progress"] += (1 / total_files) * 30
            except Exception as e:
                print(f"{upload_file}ファイルのタスクが失敗しました: {e}", flush=True)
                failed_upload_files.append(upload_file)
                continue
        if failed_upload_files:
            print(f"処理に失敗したファイル: {failed_upload_files}", flush=True)
        successd_files = []
        total_tasks2 = sum(len(organized_allpages) for organized_allpages in all_uploaded_pages)
        # エラーが発生したページを記録するリスト
        failed_pages = []
        # タスクを逐次処理する
        for organized_allpages in all_uploaded_pages:
            for page in organized_allpages:
                try:
                    successd_file = await process_page(page, container_name, original_extension, search_index, request_id)
                    successd_files.append(successd_file)
                    PROGRESS_STORE[request_id]["progress"] += (1 / total_tasks2) * 58
                except Exception as e:
                    print(f"{page}ページのタスクが失敗しました: {e}", flush=True)
                    failed_pages.append(page)
                    continue  
        if failed_pages:
            print(f"処理に失敗したページ: {failed_pages}", flush=True)
            # 正規表現パターン：ファイル名の末尾の "-0.pdf" や "-neos-0.pdf" を取り除く
            for file_data in upload_files:
                # FileStorage オブジェクトからファイル名を取得
                file_name = file_data.filename
                # file_data の拡張子を保持してファイル名を取得
                file_base_name, file_extension = re.match(r'(.+)(\.[^.]+)$', file_name).groups()
                # failed_pages の各ファイル名から不要な部分を取り除く
                for failed_upload_file in failed_pages:
                    # ファイルの拡張子
                    failed_extension = os.path.splitext(failed_upload_file)[1].lower()
                    cleaned_failed_base_name = ""
                    if failed_extension in (".txt", ".jpeg", ".jpg", ".png"):
                        # ファイルが(*.txt, *.jpeg, *.jpg, *.png)の場合
                        pattern = re.compile(r'(-[^-]*\d+)(\.[a-z0-9]+)$')
                        # 不要な部分を取り除く
                        cleaned_failed_base_name = pattern.sub(r'\2', failed_upload_file)
                    elif failed_extension in (".pdf"):
                        pattern_numeric = re.compile(r'(\.[a-zA-Z0-9]+)-\d+\.pdf$')
                        pattern_string_numeric = re.compile(r'(\.[a-zA-Z0-9]+)-[^-]+-\d+\.pdf$')
                        # ファイルが(*.doc, *.docx, *.ppt, *.pptx, *.pdf).拡張子-数字.pdf の場合
                        if pattern_numeric.search(failed_upload_file):
                            # 不要な部分を取り除く
                            cleaned_failed_base_name = pattern_numeric.sub(r'\1', failed_upload_file)
                        # ファイルが(*.xls, *.xlsx).excel拡張子-文字列-数字.pdf の場合
                        elif pattern_string_numeric.search(failed_upload_file):
                            # 不要な部分を取り除く
                            cleaned_failed_base_name = pattern_string_numeric.sub(r'\1', failed_upload_file)
                        else:
                            cleaned_failed_base_name = failed_upload_file
                    # ファイル名と拡張子に分ける
                    failed_base_name, failed_extension = re.match(r'(.+)(\.[^.]+)$', cleaned_failed_base_name).groups()
                    # 取り除いたファイル名が file_data のファイル名と一致するかを確認
                    if failed_base_name == file_base_name and file_extension == failed_extension:
                        failed_upload_files.append(cleaned_failed_base_name)
                        break
        PROGRESS_STORE[request_id]["progress"] += 2.0
        # 最終的な進捗を# 100を超えないように整数に変換
        PROGRESS_STORE[request_id]["progress"] = min(100, round(PROGRESS_STORE[request_id]["progress"]))
        PROGRESS_STORE[request_id]["isComp"] = True
        # 全ての処理が成功したら
        if PROGRESS_STORE[request_id]["progress"] >= 100:
            answer = { "answer": True }
        # 1つでも失敗したら
        elif PROGRESS_STORE[request_id]["progress"] < 100 and failed_upload_files :
            answer = { "answer": True, "failed_files": failed_upload_files }
        return jsonify(answer)
    except Exception as e:
        PROGRESS_STORE[request_id]["progress"] = 100.0
        PROGRESS_STORE[request_id]["isComp"] = True
        return jsonify({"error": str(e)}), 500

async def process_page(page, container_name, original_extension, search_index, request_id):
    # テキストを抽出 Document intelligence
    page_map = await get_document_text(page, container_name, original_extension, request_id)
    # ページマップからセクションオブジェクトのジェネレータを作成します。
    sections = create_sections(os.path.basename(page), page_map)
    # セクションを検索インデックスにインデックスします。
    await index_sections(os.path.basename(page), sections, search_index)
    return ({
         "answer": True,
         "file_name": os.path.basename(page),

        }
    )

# フロントエンドからのリクエストに対して、対応するIDの進行状況を返します。
@app.route('/status/<request_id>', methods=['GET'])
def check_status(request_id):
    progress_data = PROGRESS_STORE.get(request_id, None)
    if progress_data is None:
        return jsonify({"error": "Invalid request ID"}), 404
    elif progress_data is not None:
        progress = progress_data.get("progress", 0.0) 
        isComp = progress_data.get("isComp", False)
    else:
        return jsonify({"error": "Invalid request ID"}), 404
    return jsonify({"progress": progress, "isComp": isComp})

# 処理の最中にキャンセルした際、バックエンドの処理を止めます。
@app.route("/cancel/<task_id>", methods=["POST"])
async def cancel_task(task_id):
    if task_id in TASKS:
        TASKS[task_id]['cancelled'] = True
        return jsonify({"status": "cancelling"})
    return jsonify({"status": "not_found"}), 404


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

