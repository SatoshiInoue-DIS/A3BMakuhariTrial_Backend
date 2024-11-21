import os
import time
import sys
import openai
import re
import multiprocessing
from dotenv import load_dotenv

import jwt
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

from azure.search.documents.indexes.models import *
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from core.uploadfile import *
from core.savedfile import *
from core.deletefile import *

# .envファイルの内容を読み込見込む
load_dotenv()
#ブランチコメント

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

AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")

# 処理の進行状況 グローバル変数 PROGRESS_STORE を Manager で管理
if __name__ == '__main__':
    multiprocessing.set_start_method('spawn', True)
    multiprocessing.freeze_support()
    manager = multiprocessing.Manager()
    PROGRESS_STORE = manager.dict()
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

def validate_token(token):
    try:
        # 1.公開鍵の一覧を取得
        key_url = requests.get("https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration").json()["jwks_uri"]
        keys = requests.get(key_url).json()["keys"]
        # 2.IDトークンの署名を検証する公開鍵を抽出
        header = jwt.get_unverified_header(token)
        for key in keys:
            # kidが一致している公開鍵を抽出
            if key["kid"] == header["kid"]:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break
        # 3.IDトークンを検証
        decoded_token = jwt.decode(
            token,
            public_key,
            audience=AZURE_CLIENT_ID,
            algorithms=["RS256"]
        )
        return decoded_token
    # 検証に失敗した場合
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

@app.route("/userinfo", methods=["GET"])  
def userinfo():
    auth_header = request.headers.get("Authorization")  
    if auth_header:  
        token = auth_header.split(" ")[1]  
        user_info = validate_token(token)  
        if user_info:  
            return jsonify(user_info)  
    return jsonify({"error": "Invalid token"}), 401

# Azure Blob StorageとAzure AI Searchのインデックスに登録したドキュメントを削除する
@app.route("/delete", methods=["POST"])
def delete():
    # 各リクエストごとにIDを設定
    request_id = request.json["delete_id"]
    botname = request.json["bot"]
    files = request.json["options"]
    # 進行状況初期値設定
    PROGRESS_STORE[request_id] = {
        "progress": 0.0,
        "isComp": False,
        "failed_files": []
    }
    # progressを更新(PROGRESS_STOREから値を取り出して操作)
    progress_data = PROGRESS_STORE[request_id]
    # 5%経過
    progress_data["progress"] += 5.0
    # 再度PROGRESS_STOREに保存
    PROGRESS_STORE[request_id] = progress_data
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    # プロセスでバックグラウンドタスクを実行
    process = multiprocessing.Process(target=process_delete, args=(request_id, files, container_name, search_index, PROGRESS_STORE))
    process.start()
    answer = { "answer": True }
    if 'file' not in request.files:
        answer = { "answer": False }
        return jsonify(answer)
    return jsonify(answer)
    
def process_delete(request_id, files, container_name, search_index, PROGRESS_STORE):
    total_files = len(files)
    # エラーが発生したファイルを集める
    failed_delete_files = []
    try:
        for f in files:
            try:
                deleteFileName = f["filename"]
                print(container_name + "から" + deleteFileName + "を削除する", flush=True)
                # コンテナーからすべてのBLOBを取り出す。
                blobList = getAllFiles(container_name)
                # 正規表現パターン
                pattern = re.compile(rf'{re.escape(deleteFileName)}')
                # パターンにマッチするファイルを抽出
                selectedFiles = [file[0] for file in blobList if pattern.match(file[1])]
                # 指定したBlobデータをContainer内から論理的な削除をする
                deleteResultOfBlob = deleteBlob(selectedFiles, container_name)
                # progressを更新(PROGRESS_STOREから値を取り出して操作)
                progress_data = PROGRESS_STORE[request_id]
                # 全部完了で50%まで経過とする
                progress_data["progress"] += ((1 / total_files) * 93) / 2
                # 再度PROGRESS_STOREに保存
                PROGRESS_STORE[request_id] = progress_data
                # 削除したBlobデータに紐づいたインデックスを削除する
                deleteResultOfIndex = removeSearchIndex(selectedFiles, search_index)
                if not deleteResultOfBlob and not deleteResultOfIndex:
                    failed_delete_files.append(f)
                # progressを更新(PROGRESS_STOREから値を取り出して操作)
                progress_data = PROGRESS_STORE[request_id]
                # 全部完了で98%まで経過とする
                progress_data["progress"] += ((1 / total_files) * 93) / 2
                # 再度PROGRESS_STOREに保存
                PROGRESS_STORE[request_id] = progress_data
            except Exception as e:
                print(f"{deleteFileName}ファイルの削除が失敗しました: {e}", flush=True)
                failed_delete_files.append(f)
                continue
        if failed_delete_files:
            print(f"削除に失敗したファイル: {failed_delete_files}", flush=True)
        # progressを更新(PROGRESS_STOREから値を取り出して操作)
        progress_data = PROGRESS_STORE[request_id]
        # 全部完了で100%
        progress_data["progress"] += 2.0
        # 最終的な進捗を# 100を超えないように整数に変換
        progress_data["progress"] = min(100, round(progress_data["progress"]))
        progress_data["isComp"] = True
        progress_data["failed_files"] = failed_delete_files
        # 再度PROGRESS_STOREに保存
        PROGRESS_STORE[request_id] = progress_data
    except Exception as e:
        print(f"削除処理が失敗しました: {e}", flush=True)
        # progressを更新(PROGRESS_STOREから値を取り出して操作)
        progress_data = PROGRESS_STORE[request_id]
        progress_data["isComp"] = True
        # 再度PROGRESS_STOREに保存
        PROGRESS_STORE[request_id] = progress_data

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
    
#Azure Blob Storageに登録してあるドキュメントを検索する
@app.route("/searchfile", methods=["POST"])
def searchfile():
    print(request.json["filename"], flush=True)
    print(request.json["bot"], flush=True)
    filename = request.json["filename"]
    botname = request.json["bot"]
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    try:
        # コンテナーから名前に紐づいたファイルを取得
        saved_files_info = get_search_file_info(container_name, filename)
        return jsonify(saved_files_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#upload
@app.route("/upload", methods=["POST"])
def upload():
    # ensure_openai_token()
    print(request.files, flush=True)
    print(request.form["bot"], flush=True)
    print(request.form["upload_id"], flush=True)
    # 各リクエストごとにIDを設定
    request_id = request.form["upload_id"]
    botname = request.form["bot"]
    upload_files = request.files.getlist("file")
    # 一時保存したファイルのパスとファイル名のタプルを保存するリスト
    temp_file_info = []
    for upload_file in upload_files:
        # 元のファイルの拡張子を取り出す
        file_ext = os.path.splitext(upload_file.filename)[1]
        # ファイルを一時的に保存（元の拡張子も追加）
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            # ファイルのデータを一時ファイルに書き込む
            tmp_file.write(upload_file.read())
            # 一時ファイルのパスを取得
            tmp_file_path = tmp_file.name
            # パスとファイル名をタプルで保存
            temp_file_info.append((tmp_file_path, upload_file.filename))
    # 進行状況初期値設定
    PROGRESS_STORE[request_id] = {
        "progress": 0.0,
        "isComp": False,
        "failed_files": []
    }
    # progressを更新(PROGRESS_STOREから値を取り出して操作)
    progress_data = PROGRESS_STORE[request_id]
    # 5%経過
    progress_data["progress"] += 5.0
    # 再度PROGRESS_STOREに保存
    PROGRESS_STORE[request_id] = progress_data
    # 選択したボットからコンテナー名を取得する
    container_name, search_index = get_container_name(botname)
    # インデックスの存在を確認。なければ作成
    create_search_index(search_index)
    # プロセスでバックグラウンドタスクを実行
    process = multiprocessing.Process(target=process_upload, args=(request_id, temp_file_info, container_name, search_index, PROGRESS_STORE))
    process.start()
    answer = { "answer": True }
    if 'file' not in request.files:
        answer = { "answer": False }
        return jsonify(answer)
    return jsonify(answer)

def process_upload(request_id, temp_file_info, container_name, search_index, PROGRESS_STORE):
    try:
        total_files = len(temp_file_info)
        upload_files = []
        temp_file_paths = []
        # 一時保存したファイルを再度読み込む
        for temp_file_path, original_filename in temp_file_info:
            # ファイルを読み込む
            if os.path.exists(temp_file_path):
                temp_file_paths.append(temp_file_path)
                # ファイルを開いて処理
                with open(temp_file_path, "rb") as temp_file:
                    binary_file_data = temp_file.read()  # ファイルのバイナリデータを読み込み
                    # バイナリデータを BytesIO オブジェクトに変換
                    file_data = io.BytesIO(binary_file_data)
                    # バイナリデータと元のファイル名を保存
                    upload_files.append((file_data, original_filename))
        # progressを更新(PROGRESS_STOREから値を取り出して操作)
        progress_data = PROGRESS_STORE[request_id]
        # 10%経過
        progress_data["progress"] += 5.0
        # 再度PROGRESS_STOREに保存
        PROGRESS_STORE[request_id] = progress_data
        all_uploaded_pages = []
        # エラーが発生したファイルを集める
        failed_upload_files = []
        # タスクを逐次処理する
        for upload_file, original_filename in upload_files:
            try:
                # 拡張子の取得
                original_extension = os.path.splitext(original_filename)[1].lower()
                # 非同期にAzure Blob Storageにファイルをアップロードし、その結果を取得
                result = upload_blobs(upload_file, original_filename, original_extension, container_name)
                all_uploaded_pages.append(result)
                # progressを更新(PROGRESS_STOREから値を取り出して操作)
                progress_data = PROGRESS_STORE[request_id]
                # 全部完了で40%まで経過とする
                progress_data["progress"] += (1 / total_files) * 30
                # 再度PROGRESS_STOREに保存
                PROGRESS_STORE[request_id] = progress_data
            except Exception as e:
                print(f"{original_filename}ファイルの保存が失敗しました: {e}", flush=True)
                failed_upload_files.append(original_filename)
                continue
        if failed_upload_files:
            print(f"ストレージへの保存に失敗したファイル: {failed_upload_files}", flush=True)
        successd_files = []
        total_tasks2 = sum(len(organized_allpages) for organized_allpages in all_uploaded_pages)
        # エラーが発生したページを記録するリスト
        failed_pages = []
        # タスクを逐次処理する
        for organized_allpages in all_uploaded_pages:
            for page in organized_allpages:
                try:
                    successd_file = process_page(page, container_name, original_extension, search_index, request_id)
                    successd_files.append(successd_file)
                    # progressを更新(PROGRESS_STOREから値を取り出して操作)
                    progress_data = PROGRESS_STORE[request_id]
                    # 全部完了で98%まで経過とする
                    progress_data["progress"] += (1 / total_tasks2) * 58
                    # 再度PROGRESS_STOREに保存
                    PROGRESS_STORE[request_id] = progress_data
                except Exception as e:
                    print(f"{page}ページのインデックス登録が失敗しました: {e}", flush=True)
                    failed_pages.append(page)
                    continue  
        if failed_pages:
            print(f"インデックス登録に失敗したページ: {failed_pages}", flush=True)
            # 正規表現パターン：ファイル名の末尾の "-0.pdf" や "-neos-0.pdf" を取り除く
            for file_data, original_filename in upload_files:
                # ファイル名を取得
                file_name = original_filename
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
        # progressを更新(PROGRESS_STOREから値を取り出して操作)
        progress_data = PROGRESS_STORE[request_id]
        # 全部完了で100%
        progress_data["progress"] += 2.0
        # 最終的な進捗を# 100を超えないように整数に変換
        progress_data["progress"] = min(100, round(progress_data["progress"]))
        progress_data["isComp"] = True
        progress_data["failed_files"] = failed_upload_files
        # 再度PROGRESS_STOREに保存
        PROGRESS_STORE[request_id] = progress_data
        # 1つでも失敗したら
    except Exception as e:
        print(f"登録処理が失敗しました: {e}", flush=True)
        # progressを更新(PROGRESS_STOREから値を取り出して操作)
        progress_data = PROGRESS_STORE[request_id]
        progress_data["isComp"] = True
        # 再度PROGRESS_STOREに保存
        PROGRESS_STORE[request_id] = progress_data
    finally:
        # 一時ファイルを削除する
        for tmp_file_path in temp_file_paths:
            os.remove(tmp_file_path)

def process_page(page, container_name, original_extension, search_index, request_id):
    # テキストを抽出 Document intelligence
    page_map = get_document_text(page, container_name, original_extension, request_id)
    # ページマップからセクションオブジェクトのジェネレータを作成します。
    sections = create_sections(os.path.basename(page), page_map)
    # セクションを検索インデックスにインデックスします。
    index_sections(os.path.basename(page), sections, search_index)
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
        failed_files = progress_data.get("failed_files", [])
    else:
        return jsonify({"error": "Invalid request ID"}), 404
    return jsonify({
        "progress": progress,
        "isComp": isComp,
        "failed_files": failed_files
    })

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

