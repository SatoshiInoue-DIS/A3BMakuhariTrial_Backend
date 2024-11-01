import os
import base64
import pytz
from dotenv import load_dotenv

from azure.storage.blob import BlobServiceClient

# .envファイルの内容を読み込見込む
load_dotenv()

# Azure Storageアカウントの接続情報の設定
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")
PROTOCOL = os.environ.get("PROTOCOL")
AZURE_STORAGE_CONNECTION_STRING = f"DefaultEndpointsProtocol={PROTOCOL};AccountName={AZURE_STORAGE_ACCOUNT};AccountKey={AZURE_STORAGE_ACCOUNT_KEY}"

# BlobServiceClientの作成
blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)

# Azure Blob Storage内のデータを取得
def get_seved_file_info(container_name):
    container_client  = blob_service_client.get_container_client(container=container_name)
    # BLOBコンテナー内の全データを取得
    blob_list = container_client.list_blobs(include=['metadata'])
    # ファイル名、登録日時、更新日時、サイズ、削除したかどうか、削除した日時、メタデータ
    files_info_list = []
    for blob in blob_list:
        file_info_taple = get_blob_info(blob)
        # BLOB情報一つ一つをリストにする
        files_info_list.append(file_info_taple)
    return files_info_list

# Azure Blob Storage内のデータを検索
def get_search_file_info(container_name, file_name):
    container_client  = blob_service_client.get_container_client(container=container_name)
    # BLOBコンテナー内の全データを取得
    blob_list = container_client.list_blobs(include=['metadata'])
    search_text = file_name
    # ファイル名、登録日時、更新日時、サイズ、削除したかどうか、削除した日時、メタデータ
    files_info_list = []
    for blob in blob_list:
        if search_text in blob.name:
            file_info_taple = get_blob_info(blob)
            # BLOB情報一つ一つをリストにする
            files_info_list.append(file_info_taple)
    return files_info_list

# ファイル名、登録日時、更新日時、サイズ、削除したかどうか、削除した日時、メタデータ
def get_blob_info(blob):
    # UTC時間をJSTに変換
    jst_timezone = pytz.timezone('Asia/Tokyo')
    utc_creation_time = blob.creation_time
    utc_last_modified = blob.last_modified

    jst_creation_time = utc_creation_time.astimezone(jst_timezone)
    jst_last_modified = utc_last_modified.astimezone(jst_timezone)
    # 削除した日時
    if blob.deleted_time == None:
        jst_deleted_time = ''
    else:
        utc_deleted_time = blob.deleted_time
        jst_deleted_time = utc_deleted_time.astimezone(jst_timezone)
    # 削除したかどうか
    if blob.deleted == None:
        blob_deleted = False
    else:
        blob_deleted = blob.deleted
    # メタデータが存在するかチェック
    if blob.metadata and "originalFileName" in blob.metadata:
        # メタデータ内のoriginalFileNameの値を取得
        encode_filename = blob.metadata["originalFileName"]
        original_filename = decode_metadata_value(encode_filename)
        # メタデータ内のoriginalfileformatの値を取得
        fileformat = blob.metadata["originalFileFormat"]
    else:
        original_filename = blob.name
        ext = os.path.splitext(original_filename)[1]
        fileformat = "PDF"
    # encode_filename = blob.metadata["originalFileName"]
    # 一つのBLOB情報を入れる
    file_info_taple = (blob.name, jst_creation_time, jst_last_modified, blob.size, blob_deleted, jst_deleted_time, original_filename, fileformat)
    
    return file_info_taple

# Base64エンコードされた日本語を元に戻す
def decode_metadata_value(value):
    return base64.b64decode(value.encode('ascii')).decode('utf-8')