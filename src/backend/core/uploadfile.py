import os
import io
import html
import re
import base64
import hashlib
import pythoncom
import tempfile
import win32com.client
from win32com.client import constants
from docx2pdf import convert

from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter

from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

from azure.identity import DefaultAzureCredential
from azure.identity import ManagedIdentityCredential
from azure.identity import AzureDeveloperCliCredential
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient, SearchIndexerClient
from azure.search.documents.indexes.models import *
from azure.ai.formrecognizer import DocumentAnalysisClient



# .envファイルの内容を読み込見込む
load_dotenv()

MAX_SECTION_LENGTH = 500
SENTENCE_SEARCH_LIMIT = 100
SECTION_OVERLAP = 100

AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT")
AZURE_STORAGE_CONTAINER_NAME = os.environ.get("AZURE_STORAGE_CONTAINER_NAME")

AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX")
AZURE_SEARCH_INDEXER = os.environ.get("AZURE_SEARCH_INDEXER")
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")
AZURE_FORMRECOGNIZER_SERVICE = os.environ.get("AZURE_FORMRECOGNIZER_SERVICE")
AZURE_FORM_RECOGNIZER_KEY=os.environ.get("AZURE_FORM_RECOGNIZER_KEY")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID")

AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT = os.environ["AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT"]
AZURE_OPENAI_API_VERSION = os.environ["AZURE_OPENAI_API_VERSION"]
AZURE_OPENAI_SERVICE = os.environ["AZURE_OPENAI_SERVICE"]
AZURE_OPENAI_ENDPOINT = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
AZURE_OPENAI_KEY = os.environ["AZURE_OPENAI_KEY"]


azure_credential = DefaultAzureCredential()
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
    index_name=AZURE_SEARCH_INDEX,
    credential=AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)
)

# BlobServiceClientの作成
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

index_client = SearchIndexClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
    credential=azure_credential
)

indexers_client = SearchIndexerClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net/",
    credential=azure_credential
)

token_provider = get_bearer_token_provider(azure_credential, "https://cognitiveservices.azure.com/.default")

openai_client = AzureOpenAI(
    azure_deployment=AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_KEY,
    azure_ad_token_provider=token_provider if not AZURE_OPENAI_KEY else None
)

# ベクトル変換
def generate_embeddings(text):
    response = openai_client.embeddings.create(
        input=text,
        model=AZURE_OPENAI_TEXT_EMBEDDING_ADA_002_DEPLOYMENT  # text-embedding-ada-002 のデプロイ名
    )
    embeddings = response.data[0].embedding
    return embeddings

# インデックスを作成するメソッド
def create_search_index():
    if AZURE_SEARCH_INDEX not in index_client.list_index_names():
        index = SearchIndex(
            name=AZURE_SEARCH_INDEX,
            fields=[
                SimpleField(name="id", type="Edm.String", key=True, sortable=True, filterable=True, facetable=True),
                SearchableField(name="content", type="SearchFieldDataType.String", analyzer_name="ja.microsoft"),
                SimpleField(name="category", type="Edm.String", filterable=True, facetable=True),
                SimpleField(name="sourcepage", type="Edm.String", filterable=True, facetable=True),
                SearchableField(name="sourcefile", type="Edm.String", filterable=True, facetable=True),
                SearchField(name="titleVector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True, vector_search_dimensions=1536, vector_search_profile_name="default"),
                SearchField(name="contentVector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True, vector_search_dimensions=1536, vector_search_profile_name="default")
            ],
            semantic_settings=SemanticSearch(
                configurations=[SemanticConfiguration(
                    name='default',
                    prioritized_fields=SemanticPrioritizedFields(
                        title_field=SemanticField(field_name="sourcefile"), 
                        keywords_fields=[SemanticField(field_name="category")],
                        content_fields=[SemanticField(field_name='content')]
                    )
                )]
            ),
            vector_search = VectorSearch(
                algorithms=[
                    HnswAlgorithmConfiguration(
                        name="default",
                        kind="hnsw"
                    )
                ],
                profiles=[
                    VectorSearchProfile(
                        name="default",
                        algorithm_configuration_name="default",
                    )
                ]
            )
        )
        index_client.create_index(index)
        print(f"検索インデックス（'{AZURE_SEARCH_INDEX}'）の作成しました。")
    else:
        print(f"検索インデックス（'{AZURE_SEARCH_INDEX}'）はすでに存在します。")

# インデクサーを実行する
def run_indexer():
    result = indexers_client.run_indexer(AZURE_SEARCH_INDEXER)
    return result

# 各ファイルにページ番号の取り付けsourcepage
def add_page_blob_name(filename, page = 0):
    extension = os.path.splitext(filename)[1].lower()
    base_name = os.path.splitext(os.path.basename(filename))[0]
    sourcepage = base_name + f"-{page}" + extension
    return sourcepage

# ファイル名とページ番号からBlobの名前を生成します。
def blob_name_from_file_page(filename, page = 0):
    if os.path.splitext(filename)[1].lower() == ".pdf":
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
    elif os.path.splitext(filename)[1].lower() in (".xls", ".xlsx"):
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".xlsx"
    elif os.path.splitext(filename)[1].lower() == ".txt":
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".txt"
    elif os.path.splitext(filename)[1].lower() == ".png":
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".png"
    elif os.path.splitext(filename)[1].lower() in (".jpg", ".jpeg"):
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".jpg"
    elif os.path.splitext(filename)[1].lower() in (".doc", ".docx"):
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pdf"
    elif os.path.splitext(filename)[1].lower() in (".ppt", ".pptx"):
        return os.path.splitext(os.path.basename(filename))[0] + f"-{page}" + ".pptx"
    else:
        return os.path.basename(filename)

# Document intelligenceで分析した結果をインデックスに登録する為のチャンク分解や表があればHTML化させる
def get_page_map(results, offset):
    page_map = []
    pages = results.pages
    tables = results.tables
    for page_num, page in enumerate(pages):
        # page_num + 1と同じpage_numberのものをtables_on_pageに代入する
        tables_on_page = [table for table in tables if table.bounding_regions[0].page_number == page_num + 1]
        # ページ内のテーブル スパンのすべての位置をマークします。
        # スパンで表されるコンテンツの 0 から始まるインデックス
        page_offset = page.spans[0].offset
        # スパンで表されるコンテンツ内の文字数
        page_length = page.spans[0].length
        # page_lengthの数だけ-1のリストを作る
        table_chars = [-1]*page_length
        # page_num + 1のテーブルを分ける
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
                page_text += results.content[page_offset + idx]
            elif table_id not in added_tables:
                page_text += table_to_html(tables_on_page[table_id])
                added_tables.add(table_id)
        page_text += " "
        page_map.append((page_num, offset, page_text))
        offset += len(page_text)
    return page_map

#  直接blobのURLを見に行きPDFからテキストを抽出します。Document intelligenceサービスを使用します。
def get_document_text(filename, index, extension):
    """
    PDF →   PDF,
    TEXT    →   TXT,
    PNG →   PNG,
    JPG →   JPG,
    JPEG    →   JPG,
    EXCEL   →   PDF,
    WORD    →   PDF,
    POWERPOINT  →   PDF,
    """
    offset = 0
    page_map = []
    # BLOLに保存されたファイルのURL
    blob_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/{index}/{filename}"
    # DocumentAnalysisClient は、ドキュメントと画像からの情報を分析します。
    form_recognizer_client = DocumentAnalysisClient(
        endpoint=f"https://{AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/",
        credential=formrecognizer_creds,
    )
    # PDF、画像(PNG,JPEG,JPG)、EXCELはレイアウト分析
    if extension in (".pdf", ".png", ".jpeg", ".jpg", ".xls", ".xlsx"):
        print(f"Document intelligence のレイアウトモデルを使用して '{filename}' からテキストを抽出します")
        poller = form_recognizer_client.begin_analyze_document_from_url(model_id="prebuilt-layout", document_url = blob_url)
        # 分析した結果を取り出す モデル分析機能：prebuilt-layout
        form_recognizer_results = poller.result()
        # 取り出した結果をページごとに分ける
        page_map = get_page_map(form_recognizer_results, offset)
    # WORD、POWERPOINTはリード分析
    elif extension in (".doc", ".docx", ".ppt", ".pptx"):
        print(f"Document intelligence のリードモデルを使用して '{filename}' からテキストを抽出します")
        poller = form_recognizer_client.begin_analyze_document_from_url(model_id="prebuilt-read", document_url = blob_url)
        # 分析した結果を取り出す モデル分析機能：prebuilt-read
        form_recognizer_results = poller.result()
        # 取り出した結果をページごとに分ける
        page_map = get_page_map(form_recognizer_results, offset)
    # テキストの場合はDocument intelligenceを使わない
    elif extension == ".txt":
        print(f"'{filename}' のテキストを読み取ります")
        blob_container = blob_service.get_container_client(AZURE_STORAGE_CONTAINER_NAME)
        blob_client = blob_container.get_blob_client(filename)
        download_stream = blob_client.download_blob(encoding='UTF-8')
        page_text = download_stream.readall()
        page_num = 0
        offset = 0
        page_map.append((page_num, offset, page_text))
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

# ハッシュ化
def convert_japanese_to_hash(match):
    # 日本語部分を取得
    japanese_text = match.group(0)
    # ハッシュ化
    hash_object = hashlib.sha256(japanese_text.encode('utf-8'))
    hash_str = hash_object.hexdigest()
    # ハッシュ値の一部を返す（長すぎるので最初の8文字を使用）
    return hash_str[:8]

# ページマップからセクションオブジェクトのジェネレータを作成します。
def create_sections(filename, page_map):
    for i, (section, pagenum) in enumerate(split_text(page_map)):
        # 日本語部分を変換する
        temp_key = re.sub(r'[^\x00-\x7F]', convert_japanese_to_hash, filename)
        key = re.sub("[^0-9a-zA-Z_-]","_",f"{temp_key}-{i}")
        yield {
            "id": key,
            "content": section,
            # "content": page_map[i][2],
            "category": "document",
            "sourcepage": add_page_blob_name(filename, i),
            "sourcefile": filename,
            "titleVector": generate_embeddings(filename),
            "contentVector": generate_embeddings(section)
        }

# ページマップからテキストをセクションに分割します。
def split_text(page_map):
    SENTENCE_ENDINGS = [".", "!", "?"]
    WORDS_BREAKS = [",", ";", ":", " ", "(", ")", "[", "]", "{", "}", "\t", "\n"]

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
    if start + SECTION_OVERLAP < length:
        while start + SECTION_OVERLAP < length:
            last_word = -1
            end = start + MAX_SECTION_LENGTH

            if end > length:
                end = length
            else:
                # 文の終わりを探してみる
                while end < length and (end - start - MAX_SECTION_LENGTH) < SENTENCE_SEARCH_LIMIT and all_text[end] not in SENTENCE_ENDINGS:
                    if all_text[end] in WORDS_BREAKS:
                        last_word = end
                    end += 1
                if end < length and all_text[end] not in SENTENCE_ENDINGS and last_word > 0:
                    end = last_word # 少なくとも単語全体を保持することに戻ります
            if end < length:
                end += 1

            # 文の始まり、または少なくとも単語の境界全体を見つけてください。
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
                # セクションが閉じられていないテーブルで終了する場合は、そのテーブルから次のセクションを開始する必要があります。
                # テーブルが SENTENCE_SEARCH_LIMIT 内で始まる場合は、MAX_SECTION_LENGTH を超えるテーブルに対して無限ループが発生するため、無視します。
                # 最後のテーブルが SECTION_OVERLAP 内で始まる場合は、オーバーラップし続けます
                print(f"セクションは閉じていないテーブルで終了し{find_page(start)}オフセット{start}テーブル開始{last_table_start}ページのテーブルで次のセクションを開始する")
                start = min(end - SECTION_OVERLAP, start + last_table_start)
            else:
                start = end - SECTION_OVERLAP
            
        if start + SECTION_OVERLAP < end:
            yield (all_text[start:end], find_page(start))
    else:
    # if start + SECTION_OVERLAP >= length:
        yield (all_text[start:end], find_page(start))

# セクションを検索インデックスにインデックスします。
def index_sections(filename, sections):
    print(f"ファイル名「'{filename}'」のセクションを検索インデックス「'{AZURE_SEARCH_INDEX}'」にインデックスする")
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


def pdf_uploader(blob_container, upload_file, filename, extension):
    organized_allpages = []
    reader = PdfReader(upload_file)
    pages = reader.pages
    for i in range(len(pages)):
        blob_name = blob_name_from_file_page(filename, i)
        print(f"\t {i} ページの BLOB をアップロードしています -> {blob_name}")
        f = io.BytesIO()
        writer = PdfWriter()
        writer.add_page(pages[i])
        writer.write(f)
        f.seek(0)
        # メタデータを設定
        metadata = makeMetaData(filename, extension)
        blob_container.upload_blob(blob_name, f, overwrite=True, metadata=metadata)
        organized_allpages.append(blob_name)
    return organized_allpages

# 指定されたファイルをAzure Blob Storageにアップロードします。PDFの場合、各ページを個別のBlobとしてアップロードします。
def upload_blobs(upload_file, extension):
    blob_container = blob_service.get_container_client(AZURE_STORAGE_CONTAINER_NAME)
    # コンテナーがなければ作成
    if not blob_container.exists():
        blob_container.create_container()
        print(f"{AZURE_STORAGE_CONTAINER_NAME}コンテナーを作成しました")
    # ファイル名
    filename = upload_file.filename
    # 整理された全ページを入れる
    organized_allpages = []
    # ファイルが PDF の場合はページに分割し、各ページを個別の BLOB としてアップロードします
    if extension == ".pdf":
        organized_allpages = pdf_uploader(blob_container, upload_file, filename, extension)
    # ファイルがエクセルの場合、各シートごとにPDFに変換し、各ページを個別のBLOBにアップロードします。
    elif extension in (".xls", ".xlsx"):
        # COMオブジェクトの初期化
        pythoncom.CoInitialize()
        # Excelアプリケーションを開く
        excel = win32com.client.Dispatch("Excel.Application")
        # Excelウィンドウを非表示にする
        excel.Visible = False
        # 入力ストリームを先頭にリセット
        upload_file.seek(0)
        # Excelファイルのバイトデータ
        excel_data = upload_file.read()
        try:
            # 一時ファイルとしてExcelデータを保存
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_excel_file:
                tmp_excel_file.write(excel_data)
                tmp_excel_file_path = tmp_excel_file.name
            # Excelファイルを開く
            wb = excel.Workbooks.Open(tmp_excel_file_path)
            tmp_pdf_file_dir = os.path.dirname(tmp_excel_file_path)
            # 各シートをPDFに変換する
            for sheet in wb.Sheets:
                # 新しいPDFファイル名を生成（[エクセルファイル名]－[シート名].pdf）
                pdf_file_name = os.path.splitext(os.path.basename(filename))[0] + f"-{sheet.name}" + ".pdf"
                # PDF変換して保存する場所
                tmp_pdf_file_path = tmp_pdf_file_dir + "/" + pdf_file_name
                # シートをPDFに変換する
                sheet.ExportAsFixedFormat(0, tmp_pdf_file_path, 0, 1, 0, 1, sheet.PageSetup.Pages.Count, 0)
                print(f"Excelファイルのシート {sheet.name} を PDF に変換しました。")
                # 生成されたPDFの内容を読み込む
                with open(tmp_pdf_file_path, 'rb') as pdf_file:
                    organized_allpages = pdf_uploader(blob_container, pdf_file, pdf_file_name, extension)
                # PDFの一時ファイルを削除する
                os.remove(tmp_pdf_file_path)
        finally:
            # Excelファイルを閉じる
            wb.Close(False)
            # Excelアプリケーションを終了
            excel.Quit()
            # Excelの一時ファイルを削除する
            os.remove(tmp_excel_file_path)
            # 終了した後はこれを呼び出す
            pythoncom.CoUninitialize()
    # ファイルがワードの場合、PDFに変換し、各ページを個別のBLOBにアップロードします。
    elif extension in (".doc", ".docx"):
        # COMオブジェクトの初期化
        pythoncom.CoInitialize()
        # 入力ストリームを先頭にリセット
        upload_file.seek(0)
        # Wordファイルのバイトデータ
        word_data = upload_file.read()
        try:
            # 一時ファイルとしてWordデータを保存
            with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp_word_file:
                tmp_word_file.write(word_data)
                tmp_word_file_path = tmp_word_file.name
            # PDF出力用の一時ファイルを作成
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_pdf_file:
                tmp_pdf_file_path = tmp_pdf_file.name
            # WordファイルをPDFに変換
            convert(tmp_word_file_path, tmp_pdf_file_path)
            print(f"Wordファイル {filename} をPDFに変換しました")
            # Wordの一時ファイルを削除する
            os.remove(tmp_word_file_path)
            # 生成されたPDFの内容を読み込む
            with open(tmp_pdf_file_path, 'rb') as pdf_file:
                organized_allpages = pdf_uploader(blob_container, pdf_file, filename, extension)
        finally:
            # PDFの一時ファイルを削除する
            os.remove(tmp_pdf_file_path)
            # COMオブジェクトの解放
            pythoncom.CoUninitialize()
    # ファイルがパワーポイントの場合、ノード付きPDFに変換し、各ページを個別のBLOBにアップロードします。
    elif extension in (".ppt", ".pptx"):
        # COMオブジェクトの初期化
        pythoncom.CoInitialize()
        # makepy ユーティリティを起動 COM の定数を利用するため
        win32com.client.gencache.EnsureDispatch('PowerPoint.Application')
        # Powerpointアプリケーションを開く
        powerpoint = win32com.client.Dispatch("PowerPoint.Application")
        # 入力ストリームを先頭にリセット
        upload_file.seek(0)
        # Powerpointファイルのバイトデータ
        powerpoint_data = upload_file.read()
        try:
            # 一時ファイルとしてPowerpointデータを保存
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as tmp_powerpoint_file:
                tmp_powerpoint_file.write(powerpoint_data)
                tmp_powerpoint_file_path = tmp_powerpoint_file.name
            tmp_pdf_file_dir = os.path.dirname(tmp_powerpoint_file_path)
            # 新しいPDFファイル名を生成
            pdf_file_name = os.path.splitext(os.path.basename(filename))[0] + ".pdf"
            # PDF変換して保存する場所
            tmp_pdf_file_path = tmp_pdf_file_dir + "/" + pdf_file_name
            # Powerpointファイルを開きPDF形式で保存
            presentation = powerpoint.Presentations.Open(tmp_powerpoint_file_path, WithWindow=False)
            # PrintOptionsを設定してノート付きのレイアウトにする
            presentation.PrintOptions.OutputType = constants.ppPrintOutputNotesPages
            # PDFに変換する
            presentation.ExportAsFixedFormat(
                tmp_pdf_file_path,  #エクスポートするPDFファイルのパス
                constants.ppFixedFormatTypePDF,  #エクスポートするファイルの形式
                PrintRange=None,  #印刷範囲
                Intent=constants.ppFixedFormatIntentPrint,  #エクスポートの品質.印刷用
                HandoutOrder=constants.ppPrintHandoutVerticalFirst,  #配布資料の順序.垂直方向
                OutputType=constants.ppPrintOutputNotesPages,  #出力形式.ノート付きのスライド
                RangeType=constants.ppPrintAll,  #印刷するスライドの範囲.すべてのスライド
            )
            print(f"PowerPointファイル {filename} をPDFに変換しました")
            # 生成されたPDFの内容を読み込む
            with open(tmp_pdf_file_path, 'rb') as pdf_file:
                organized_allpages = pdf_uploader(blob_container, pdf_file, pdf_file_name, extension)
            # PDFの一時ファイルを削除する
            os.remove(tmp_pdf_file_path)
        finally:
            # Powerpointファイルを閉じる
            presentation.Close()
            # Powerpointアプリケーションを終了
            powerpoint.Quit()
            # Powerpointの一時ファイルを削除する
            os.remove(tmp_powerpoint_file_path)
            # 終了した後はこれを呼び出す
            pythoncom.CoUninitialize()
    # ファイルがテキスト・画像(.txt,.png,.jpg,.jpeg)の場合、そのままBLOBにアップロードします。
    else :
        page = 0
        blob_name = blob_name_from_file_page(filename)
        # メタデータを設定
        metadata = makeMetaData(filename, extension)
        blob_container.upload_blob(blob_name, upload_file, overwrite=True, metadata=metadata)
        # blob_container.upload_blob(blob_name, upload_file, overwrite=True)
        organized_allpages.append(blob_name)
    print(f"\t Azure Blob Starageへ {filename} の書き込みが終わりました。")
    return organized_allpages

# メタデータの作成
def makeMetaData(sheet_name: str, extension: str) -> dict[str, str]:
    if extension == ".pdf":
        original_file_format = "PDF"
        after_conversion_file_format = "PDF"
        analysis_model = "prebuilt-layout"
    elif extension in (".xls", ".xlsx"):
        original_file_format = "EXCEL"
        after_conversion_file_format = "PDF"
        analysis_model = "prebuilt-layout"
    elif extension == ".txt":
        original_file_format = "TEXT"
        after_conversion_file_format = "TEXT"
        analysis_model = "readall"
    elif extension == ".png":
        original_file_format = "PNG"
        after_conversion_file_format = "PNG"
        analysis_model = "prebuilt-layout"
    elif extension in (".jpeg", ".jpg"):
        original_file_format = "JPG"
        after_conversion_file_format = "JPG"
        analysis_model = "prebuilt-layout"
    elif extension in (".doc", ".docx"):
        original_file_format = "WORD"
        after_conversion_file_format = "PDF"
        analysis_model = "prebuilt-read"
    elif extension in (".ppt", ".pptx"):
        original_file_format = "POWERPOINT"
        after_conversion_file_format = "PDF"
        analysis_model = "prebuilt-read"
    encode_sheet_name = encode_metadata_value(sheet_name)
    return {
        # 取り込み時のファイル名
        "originalFileName": encode_sheet_name,
        # 取り込み時のファイル形式
        "originalFileFormat": original_file_format,
        # 変換後のファイル形式
        "afterConversionFileFormat": after_conversion_file_format,
        # 解析するFormRecognizerのモデル
        "analysisModel": analysis_model,
    }

# Azure Blob Storageのメタデータは、ASCII文字のみをサポートしているため、日本語などの非ASCII文字は使用するできません。
# 日本語をBase64エンコードする
def encode_metadata_value(value):
    return base64.b64encode(value.encode('utf-8')).decode('ascii')
