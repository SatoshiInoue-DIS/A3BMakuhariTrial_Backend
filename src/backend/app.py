import os
import io
import glob
import html
import re
import time

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

import asyncio

from azure.identity import DefaultAzureCredential
from azure.identity import ManagedIdentityCredential
from azure.identity import AzureDeveloperCliCredential
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexerClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.ai.documentintelligence import DocumentIntelligenceClient

# .envファイルの内容を読み込見込む
load_dotenv()

app = Flask(__name__)
CORS(app)  # CORS設定を追加

MAX_SECTION_LENGTH = 1000
SENTENCE_SEARCH_LIMIT = 100
SECTION_OVERLAP = 100

AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")
PROTOCOL = os.environ.get("PROTOCOL")

# Azure Storageアカウントの接続情報の設定
AZURE_STORAGE_CONNECTION_STRING = f"DefaultEndpointsProtocol={PROTOCOL};AccountName={AZURE_STORAGE_ACCOUNT};AccountKey={AZURE_STORAGE_ACCOUNT_KEY}"
AZURE_STORAGE_CONTAINER_NAME = os.environ.get("AZURE_STORAGE_CONTAINER_NAME")

AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX")
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")
AZURE_FORMRECOGNIZER_SERVICE = os.environ.get("AZURE_FORMRECOGNIZER_SERVICE")
AZURE_FORM_RECOGNIZER_KEY=os.environ.get("AZURE_FORM_RECOGNIZER_KEY")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID")

azure_credential = DefaultAzureCredential()
# BlobServiceClientの作成
blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
# こっちでもいい
blob_service = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
    credential=azure_credential
)
azd_credential = AzureDeveloperCliCredential(tenant_id=AZURE_TENANT_ID, process_timeout=60)
# default_creds = azd_credential
search_creds = AzureKeyCredential(AZURE_FORM_RECOGNIZER_KEY)
# search_creds = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)
# formrecognizer_creds = default_creds
formrecognizer_creds = search_creds
default_creds = ManagedIdentityCredential()

local_file_path = r"C:\Users\sinou\GitManagement\A3BMakuhariTrial_Backend\data\test.pdf"
# local_file_path = r"C:"
blob_name = "test.pdf"

# コンテナーの作成
# container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER_NAME)
# container_client.create_container()

# Blobのアップロード
blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER_NAME, blob=blob_name)
with open(local_file_path, "rb") as data:
    blob_client.upload_blob(data, overwrite=True)

print("ファイルがアップロードされました。")







index_client = SearchIndexClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
    credential=azure_credential
)
if AZURE_SEARCH_INDEX not in index_client.list_index_names():
    index = SearchIndex(
        name=AZURE_SEARCH_INDEX,
        fields=[
            SimpleField(name="id", type="Edm.String", key=True),
            SearchableField(name="content", type="Edm.String", analyzer_name="ja.microsoft"),
            SimpleField(name="category", type="Edm.String", filterable=True, facetable=True),
            SimpleField(name="sourcepage", type="Edm.String", filterable=True, facetable=True),
            SimpleField(name="sourcefile", type="Edm.String", filterable=True, facetable=True)
        ],
        semantic_settings=SemanticSettings(
            configurations=[SemanticConfiguration(
                name='default',
                prioritized_fields=PrioritizedFields(
                    title_field=None, prioritized_content_fields=[SemanticField(field_name='content')]))])
    )
    if True: print(f"検索インデックス（'{AZURE_SEARCH_INDEX}'）の作成")
    index_client.create_index(index)
else:
    if True: print(f"検索インデックス（'{AZURE_SEARCH_INDEX}'）はすでに存在します。")

print("ファイルを処理しています...")


# ファイル名とページ番号からBlobの名前を生成します。
def blob_name_from_file_page(filename, page = 0):
    if os.path.splitext(filename)[1].lower() == ".pdf":
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
    else:
        return os.path.basename(filename)



#  PDFからテキストを抽出します。ローカルのPDFパーサー（PyPdf）またはAzure Form Recognizerサービスを使用します。
def get_document_text(filename):
    offset = 0
    page_map = []
    # if args.localpdfparser:
    #     reader = PdfReader(filename)
    #     pages = reader.pages
    #     for page_num, p in enumerate(pages):
    #         page_text = p.extract_text()
    #         page_map.append((page_num, offset, page_text))
    #         offset += len(page_text)
    # else:
    print(f"Azure Form Recognizer を使用して '{filename}' からテキストを抽出します")
    # DocumentAnalysisClient は、ドキュメントと画像からの情報を分析します。
    form_recognizer_client = DocumentAnalysisClient(
        endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/",
        credential=formrecognizer_creds,
        headers={"x-ms-useragent": "azure-search-chat-demo/1.0.0"}
    )
    with open(filename, "rb") as f:
        poller = form_recognizer_client.begin_analyze_document("prebuilt-layout", document = f)
    form_recognizer_results = poller.result()

    for page_num, page in enumerate(form_recognizer_results.pages):
        tables_on_page = [table for table in form_recognizer_results.tables if table.bounding_regions[0].page_number == page_num + 1]

        # ページ内のテーブル スパンのすべての位置をマークします。
        page_offset = page.spans[0].offset
        page_length = page.spans[0].length
        table_chars = [-1]*page_length
        for table_id, table in enumerate(tables_on_page):
            for span in table.spans:
                # すべてのテーブル スパンを table_chars 配列の「table_id」に置き換えます
                for i in range(span.length):
                    idx = span.offset - page_offset + i
                    if idx >=0 and idx < page_length:
                        table_chars[idx] = table_id

        # テーブルスパン内の文字をテーブルHTMLに置き換えてページテキストを構築します
        page_text = ""
        added_tables = set()
        for idx, table_id in enumerate(table_chars):
            if table_id == -1:
                page_text += form_recognizer_results.content[page_offset + idx]
            elif table_id not in added_tables:
                page_text += table_to_html(tables_on_page[table_id])
                added_tables.add(table_id)

        page_text += " "
        page_map.append((page_num, offset, page_text))
        offset += len(page_text)

    return page_map

# テーブルオブジェクトをHTML形式の文字列に変換します。
def table_to_html(table):
    table_html = "<table>"
    rows = [sorted([cell for cell in table.cells if cell.row_index == i], key=lambda cell: cell.column_index) for i in range(table.row_count)]
    for row_cells in rows:
        table_html += "<tr>"
        for cell in row_cells:
            tag = "th" if (cell.kind == "columnHeader" or cell.kind == "rowHeader") else "td"
            cell_spans = ""
            if cell.column_span > 1: cell_spans += f" colSpan={cell.column_span}"
            if cell.row_span > 1: cell_spans += f" rowSpan={cell.row_span}"
            table_html += f"<{tag}{cell_spans}>{html.escape(cell.content)}</{tag}>"
        table_html +="</tr>"
    table_html += "</table>"
    return table_html

# ページマップからセクションオブジェクトのジェネレータを作成します。
def create_sections(filename, page_map):
    for i, (section, pagenum) in enumerate(split_text(page_map)):
        yield {
            "id": re.sub("[^0-9a-zA-Z_-]","_",f"{filename}-{i}"),
            "content": section,
            # "content": page_map[i][2],
            "category": "document",
            "sourcepage": blob_name_from_file_page(filename, pagenum),
            "sourcefile": filename
        }

# ページマップからテキストをセクションに分割します。
def split_text(page_map):
    SENTENCE_ENDINGS = [".", "!", "?"]
    WORDS_BREAKS = [",", ";", ":", " ", "(", ")", "[", "]", "{", "}", "\t", "\n"]
    print(f"「'{filename}'」をセクションに分割しています")

    def find_page(offset):
        l = len(page_map)
        for i in range(l - 1):
            if offset >= page_map[i][1] and offset < page_map[i + 1][1]:
                return i
        return l - 1

    all_text = "".join(p[2] for p in page_map)
    length = len(all_text)
    start = 0
    end = length
    while start + SECTION_OVERLAP < length:
        last_word = -1
        end = start + MAX_SECTION_LENGTH

        if end > length:
            end = length
        else:
            # Try to find the end of the sentence
            while end < length and (end - start - MAX_SECTION_LENGTH) < SENTENCE_SEARCH_LIMIT and all_text[end] not in SENTENCE_ENDINGS:
                if all_text[end] in WORDS_BREAKS:
                    last_word = end
                end += 1
            if end < length and all_text[end] not in SENTENCE_ENDINGS and last_word > 0:
                end = last_word # Fall back to at least keeping a whole word
        if end < length:
            end += 1

        # Try to find the start of the sentence or at least a whole word boundary
        last_word = -1
        while start > 0 and start > end - MAX_SECTION_LENGTH - 2 * SENTENCE_SEARCH_LIMIT and all_text[start] not in SENTENCE_ENDINGS:
            if all_text[start] in WORDS_BREAKS:
                last_word = start
            start -= 1
        if all_text[start] not in SENTENCE_ENDINGS and last_word > 0:
            start = last_word
        if start > 0:
            start += 1

        section_text = all_text[start:end]
        yield (section_text, find_page(start))

        last_table_start = section_text.rfind("<table")
        if (last_table_start > 2 * SENTENCE_SEARCH_LIMIT and last_table_start > section_text.rfind("</table")):
            # If the section ends with an unclosed table, we need to start the next section with the table.
            # If table starts inside SENTENCE_SEARCH_LIMIT, we ignore it, as that will cause an infinite loop for tables longer than MAX_SECTION_LENGTH
            # If last table starts inside SECTION_OVERLAP, keep overlapping
            print(f"セクションは閉じていないテーブルで終了し{find_page(start)}オフセット{start}テーブル開始{last_table_start}ページのテーブルで次のセクションを開始する")
            start = min(end - SECTION_OVERLAP, start + last_table_start)
        else:
            start = end - SECTION_OVERLAP
        
    if start + SECTION_OVERLAP < end:
        yield (all_text[start:end], find_page(start))



# セクションを検索インデックスにインデックスします。
def index_sections(filename, sections):
    print(f"ファイル名「'{filename}'」のセクションを検索インデックス「'{AZURE_SEARCH_INDEX}'」にインデックスする")
    search_client = SearchClient(
        endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
        index_name=AZURE_SEARCH_INDEX,
        credential=AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)
        # azd_credential = AzureDeveloperCliCredential(tenant_id=AZURE_TENANT_ID, process_timeout=60)ダメ
        # search_creds = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)めっちゃダメfibbcon
        # default_creds = ManagedIdentityCredential()よくわからないダメ
        # azure_credential = DefaultAzureCredential()ダメ
    )
    i = 0
    batch = []
    for s in sections:
        batch.append(s)
        i += 1
        if i % 1000 == 0:
            results = search_client.upload_documents(documents=batch)
            succeeded = sum([1 for r in results if r.succeeded])
            print(f"\t {len(results)} セクションのインデックス、 {succeeded} 成功")
            batch = []

    if len(batch) > 0:
        results = search_client.upload_documents(documents=batch)
        succeeded = sum([1 for r in results if r.succeeded])
        print(f"\t {len(results)} セクションのインデックス、 {succeeded} 成功")  

for filename in glob.glob(local_file_path):
    page_map = get_document_text(filename)
    sections = create_sections(os.path.basename(filename), page_map)
    index_sections(os.path.basename(filename), sections)





# # 接続文字列

# # コンテナー名

# # ファイル名
# blob_name = 'test.txt'

# client = BlobClient.from_connection_string(connection_str, AZURE_STORAGE_CONTAINER_NAME, blob_name)

# # アップロード
# upload_data = 'hello world.'
# client.upload_blob(upload_data, overwrite=True)

# # ダウンロード
# download_data = client.download_blob().readall()







# # Azure Storage上にて、接続文字列を確認する。
# connect_str = "test"

# # Create a file in local data directory to upload and download
# AZURE_STORAGE_CONTAINER_NAME = "<コンテナ名称>"

# # Azure Storage内は厳密には、フォルダという構成ではない。
# # 一応 "\"区切りをすることで、疑似的にフォルダ構造を実現することは可能
# upload_path = "<アップロード先のフォルダ名称>"

# # アップロードするファイル名(実行位置によって、相対ファイルパスを記載すること)
# local_file_name = "HelloWorld.txt"

# # アップロード先
# upload_file_path = os.path.join(upload_path, local_file_name)

# # 自身のAzure Storageに接続するためのインスタンスを作成する。
# blob_service_client = BlobServiceClient.from_connection_string(connect_str)

# # Azure Storageの指定コンテナに接続するブロブ（ファイル）のクライアントインスタンスを作成する。
# blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER_NAME, blob=local_file_name)

# print("\nUploading to Azure Storage as blob:\n\t" + local_file_name)

# # Azure Storageへのアップロード
# with open(upload_file_path, "rb") as data:
#     blob_client.upload_blob(data)











# # ローカル ファイル パスからブロック BLOB をアップロードする
# def upload_blob_file(self, blob_service_client: BlobServiceClient, AZURE_STORAGE_CONTAINER_NAME: str):
#     container_client = blob_service_client.get_container_client(container=AZURE_STORAGE_CONTAINER_NAME)
#     with open(file=os.path.join('filepath', 'filename'), mode="rb") as data:
#         blob_client = container_client.upload_blob(name="sample-blob.txt", data=data, overwrite=True)

# # ストリームからブロック BLOB をアップロードする
# def upload_blob_stream(self, blob_service_client: BlobServiceClient, AZURE_STORAGE_CONTAINER_NAME: str):
#     blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER_NAME, blob="sample-blob.txt")
#     input_stream = io.BytesIO(os.urandom(15))
#     blob_client.upload_blob(input_stream, blob_type="BlockBlob")

# # ブロック BLOB にバイナリ データをアップロードする
# def upload_blob_data(self, blob_service_client: BlobServiceClient, contAZURE_STORAGE_CONTAINER_NAMEainer_name: str):
#     blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER_NAME, blob="sample-blob.txt")
#     data = b"Sample data for blob"

#     # Upload the blob data - default blob type is BlockBlob
#     blob_client.upload_blob(data, blob_type="BlockBlob")

# # インデックス タグ付きのブロック BLOB をアップロードする
# def upload_blob_tags(self, blob_service_client: BlobServiceClient, AZURE_STORAGE_CONTAINER_NAME: str):
#     container_client = blob_service_client.get_container_client(container=AZURE_STORAGE_CONTAINER_NAME)
#     sample_tags = {"Content": "image", "Date": "2022-01-01"}
#     with open(file=os.path.join('filepath', 'filename'), mode="rb") as data:
#         blob_client = container_client.upload_blob(name="sample-blob.txt", data=data, tags=sample_tags)

# # アップロード時のデータ転送オプションの指定
# def upload_blob_transfer_options(self, account_url: str, AZURE_STORAGE_CONTAINER_NAME: str, blob_name: str):
#     # Create a BlobClient object with data transfer options for upload
#     blob_client = BlobClient(
#         account_url=account_url, 
#         container_name=AZURE_STORAGE_CONTAINER_NAME, 
#         blob_name=blob_name,
#         credential=DefaultAzureCredential(),
#         max_block_size=1024*1024*4, # 4 MiB
#         max_single_put_size=1024*1024*8 # 8 MiB
#     )
    
#     with open(file=os.path.join(r'file_path', blob_name), mode="rb") as data:
#         blob_client = blob_client.upload_blob(data=data, overwrite=True, max_concurrency=2)

# # アップロード時に BLOB のアクセス層を設定する
# def upload_blob_access_tier(self, blob_service_client: BlobServiceClient, AZURE_STORAGE_CONTAINER_NAME: str, blob_name: str):
#     blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER_NAME, blob=blob_name)
    
#     #Upload blob to the cool tier
#     with open(file=os.path.join(r'file_path', blob_name), mode="rb") as data:
#         blob_client = blob_client.upload_blob(data=data, overwrite=True, standard_blob_tier=StandardBlobTier.COOL)

# # ブロックのステージングとコミットによってブロック BLOB をアップロードする
# def upload_blocks(self, blob_container_client: ContainerClient, local_file_path: str, block_size: int):
#     file_name = os.path.basename(local_file_path)
#     blob_client = blob_container_client.get_blob_client(file_name)

#     with open(file=local_file_path, mode="rb") as file_stream:
#         block_id_list = []

#         while True:
#             buffer = file_stream.read(block_size)
#             if not buffer:
#                 break

#             block_id = uuid.uuid4().hex
#             block_id_list.append(BlobBlock(block_id=block_id))

#             blob_client.stage_block(block_id=block_id, data=buffer, length=len(buffer))

#         blob_client.commit_block_list(block_id_list)

# # BLOB を非同期にアップロードする
# async def main():
#     sample = BlobSamples()

#     # TODO: Replace <storage-account-name> with your actual storage account name
#     account_url = "https://<storage-account-name>.blob.core.windows.net"
#     credential = DefaultAzureCredential()

#     async with BlobServiceClient(account_url, credential=credential) as blob_service_client:
#         await sample.upload_blob_file(blob_service_client, "sample-container")

# if __name__ == '__main__':
#     asyncio.run(main())

# async def upload_blob_file(self, blob_service_client: BlobServiceClient, container_name: str):
#     container_client = blob_service_client.get_container_client(container=AZURE_STORAGE_CONTAINER_NAME)
#     with open(file=os.path.join('filepath', 'filename'), mode="rb") as data:
#         blob_client = await container_client.upload_blob(name="sample-blob.txt", data=data, overwrite=True)










# # Blob Storage へのアクセスを承認して接続する
# def get_blob_service_client(self, AZURE_STORAGE_ACCOUNT):
#     account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
#     credential = DefaultAzureCredential()

#     # BlobServiceClient オブジェクトを作成する
#     blob_service_client = BlobServiceClient(account_url, credential=credential)

#     return blob_service_client

# # 非同期 Blob Storage へのアクセスを承認して接続する
# async def get_blob_service_client_sas(self, sas_token: str):
#     account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
#     # SAS トークン文字列は、ここで認証情報に割り当てることも、アカウント URL に追加することもできます
#     credential = sas_token

#     # BlobServiceClient オブジェクトを作成する
#     # blob_service_client = BlobServiceClient(account_url, credential=credential)

#     async with BlobServiceClient(account_url, credential=credential) as blob_service_client:
#         container_client = blob_service_client.get_container_client(container="sample-container")

#     return blob_service_client

# @app.route('/')
# def hello():
#     return "Hello from Flask!"























if __name__ == '__main__':
    app.run(debug=True)
