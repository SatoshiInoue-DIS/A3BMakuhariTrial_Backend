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
    file_info_taple = ()
    files_info_list = []
    for blob in blob_list:
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
        # メタデータ内のoriginalFileNameの値を取得
        encode_filename = blob.metadata["originalFileName"]
        original_filename = decode_metadata_value(encode_filename)
        # 一つのBLOB情報を入れる
        file_info_taple = (blob.name, jst_creation_time, jst_last_modified, blob.size, blob_deleted, jst_deleted_time, original_filename)
        # BLOB情報一つ一つをリストにする
        files_info_list.append(file_info_taple)
    return files_info_list

# Base64エンコードされた日本語を元に戻す
def decode_metadata_value(value):
    return base64.b64decode(value.encode('ascii')).decode('utf-8')