import os
import time
import pypdf

import openai

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from azure.identity import DefaultAzureCredential
from azure.identity import ManagedIdentityCredential
from azure.identity import AzureDeveloperCliCredential
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from core.uploadfile import *

# configure_azure_monitor()
app = Flask(__name__)
CORS(app)  # CORS設定を追加
FlaskInstrumentor().instrument_app(app)

#ボットに登録しているファイルデータの取得
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
    #選択したボット名を持ってきてた
    botname = request.form["bot"]
    answer = []
    try:
        if 'file' not in request.files:
            return "no"
        # インデックスの存在を確認。なければ作成
        create_search_index()
        # ファイルのバイナリーデータ
        upload_files = request.files.getlist("file")
        for upload_file in upload_files:
            # ファイルをBlobストレージに保存
            upload_blobs(upload_file)
            # ファイル名の抽出
            filename = upload_file.filename
            # ファイルを保存するディレクトリパスを指定
            save_path = f"data/" + filename
            # if not os.path.exists(save_path):
            #     os.makedirs(save_path)
            # ファイルを指定したパスに保存
            # upload_file.save(save_path + "\\" + filename)
            # PDFの場合
             # PDFを開く
            pdf_reader = pypdf.PdfReader(upload_file)
            pdf_writer = pypdf.PdfWriter()
        
            # ページをコピー
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)
            
            # 新しいPDFファイルに書き込む
            output_file_path = save_path
            with open(output_file_path, 'wb') as output_file:
                pdf_writer.write(output_file)

            print(f"\t ('{filename}')をtempフォルダに保存しました。")


            # 保存されたディレクトリパスを指定
            saved_path = f"data"
            # 保存されたファイルのURL
            file_url = saved_path + "/" + filename
            
            page_map = get_document_text(file_url)
            sections = create_sections(os.path.basename(filename), page_map)
            index_sections(os.path.basename(filename), sections)

            answer.append({"ansesr": True})
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

