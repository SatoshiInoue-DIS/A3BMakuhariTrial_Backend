import os

from dotenv import load_dotenv

from azure.identity import DefaultAzureCredential
from azure.identity import DefaultAzureCredential
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient
from azure.search.documents import SearchClient
from azure.search.documents.indexes.models import *

from .savedfile import decode_metadata_value

AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_STORAGE_ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")

# .envファイルの内容を読み込見込む
load_dotenv()

azure_credential = DefaultAzureCredential()

# BlobServiceClientの作成
blob_service = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
    credential=f"{AZURE_STORAGE_ACCOUNT_KEY}"
)

# Container内のすべてのBLOBを取得するし、名前だけを返す
def getAllFiles(bot):
    container_client = blob_service.get_container_client(bot)
    # コンテナー内のすべてのBLOB（メタデータを含む）を取得
    blob_list = container_client.list_blobs(include=['metadata'])
    # Blobの名前のみを含むリストの作成
    blob_names = []
    # Blobの名前をリストに追加
    for blob in blob_list:
        blob_name = blob.name
        # メタデータ内のoriginalFileNameの値を取得
        encode_filename = blob.metadata["originalFileName"]
        original_filename = decode_metadata_value(encode_filename)
        blob_names.append((blob_name, original_filename))
    return blob_names

# 指定したBlobデータをContainer内から論理的な削除をする
def deleteBlob(files, container_name):
    is_delete_files = []
    for blob in files:
        blob_client = blob_service.get_blob_client(container=container_name, blob=blob)
        blob_client.delete_blob()
        is_delete_files.append(blob)
    return True

# 検索インデックスから削除したBlobデータに紐づいたインデックスを削除する
# sourcefileフィールドに検索をかけ、出てきたインデックスのidを取得しそのidを元に削除(指定するきKeyは一意である必要がある為)
def removeSearchIndex(files, search_index):
    search_client = SearchClient(
        endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
        index_name=search_index,
        credential=AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)
    )
    success = True
    delete_ids = []
    for file in files:
        try:
            # 検索クエリを定義
            search_query = f'"{file}"'
            # 検索実行
            search_results = search_client.search(search_text=search_query, search_fields=["sourcefile"], search_mode="all", select=["id"])
            # 検索結果からidを取得
            for result in search_results:
                document_id = result["id"]
                delete_ids.append(document_id)
                search_client.delete_documents(documents=[{"id":document_id}])
        except Exception as e:
            # エラー処理
            print(f"エラー：{e}", flush=True)
            success = False
    return success