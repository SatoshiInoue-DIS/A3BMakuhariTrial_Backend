import styles from './DocRegistration.module.css';
import DocRegistrationModal from '@/components/DocRegistrationModal';
import React, { useState, useEffect, useCallback } from "react";
import { Column, SortByFn, Row } from "react-table";
import Table from "../../components/Table/Table"
import { SavedFileResponse, savedfileApi, SavedFileRequest, deleteApi, generateId, checkProgress, searchfileApi } from "../../api";
import { stringify } from 'querystring';
import path from "path";
import Image from "next/image"

const bots = ["幕張トライアル", "A3B_FAQ(IT基礎&開発基礎)", "A3B_FAQ(新卒OPEN)", "QLink", "テスト"];

type FileType = 'PDF' | 'WORD' | 'EXCEL' | "POWERPOINT" | "JPG" | "PNG" | "TEXT";

const sortByFileType: SortByFn<SavedFileResponse> = (rowA: Row<SavedFileResponse>, rowB: Row<SavedFileResponse>) => {
    const fileTypeOrder: Record<string, number>  = {
        'PDF': 1,
        'WORD': 2,
        'EXCEL': 3,
        "POWERPOINT": 4,
        "JPG": 5,
        "PNG": 6,
        "TEXT": 7
    };
    const typeA: string = rowA.values.file_format[0];
    const typeB: string = rowB.values.file_format[0];
    return (fileTypeOrder[typeA] || 99) - (fileTypeOrder[typeB] || 99);
};

const columns: Array<Column<SavedFileResponse>> = 
[
    {
        Header: "⇅",
        accessor: "file_format",
        sortType: sortByFileType,
        Cell: ({ row }) => {
            // アイコンを表示するために addDocIcon の出力を表示
            const [, icon] = row.values.file_format;
            return icon;
        }
    },
    {
        Header: "ファイル名",
        accessor: "filename",
    },
    {
        Header: "サイズ",
        accessor: "size"
    },
    {
        Header: "最新更新日",
        accessor: "last_modified"
    }
];

//summarizeDataでまとめたデータをSevedFileResponse[]に当てはめていく
const convertData = (data: []): SavedFileResponse[] => {
    return data.map(item => {
        // 日付の初期化
        const gmtDate = new Date(item[1])
        // JST日時を一貫した形式で表示
        const jstDateString = gmtDate.toLocaleString('ja-JP', { 
            timeZone: "Asia/Tokyo",
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hourCycle: 'h23' 
        });
        const filename = item[0]
        const extension = path.extname(filename)
        const fileformat = item[5]
        const fileitem = [fileformat, addDocIcon(fileformat)]

        return{
            filename: filename,
            last_modified: jstDateString,
            size: item[2],
            delete: item[3],
            file_format: fileitem
        };
    });
};

const addDocIcon = (fileformat: string): any => {
    switch (fileformat) {
        case "PDF":
            return <Image src="./pdf_icon.png" width={40} height={30} alt='pdf'></Image>
        case "WORD":
            return <Image src="./word_icon.png" width={40} height={30} alt='pdf'></Image>
        case "EXCEL":
            return <Image src="./excel_icon.png" width={40} height={30} alt='pdf'></Image>
        case "POWERPOINT":
            return <Image src="./powerpoint_icon.png" width={40} height={30} alt='pdf'></Image>
        case "TEXT":
            return <Image src="./text_icon.png" width={40} height={30} alt='pdf'></Image>
        case "PNG":
            return <Image src="./png_icon.png" width={40} height={30} alt='pdf'></Image>
        case "JPG":
            return <Image src="./jpg_icon.png" width={40} height={30} alt='pdf'></Image>
        default:
            return <Image src="./pdf_icon.png" width={40} height={30} alt='pdf'></Image>
    }
}

// ファイル名を処理してファイル名ごとにグループ化し、合計サイズと最新の日時を計算する
const summarizeData = (data: []): any => {
    const groupedFiles: { [key: string]: { fileName: string; size: number; modifiedDate: string; delete: boolean; deleteDate: string; fileFormat: string; } } = {};
    //ファイル名(例えば012_IT基礎研修_データベース基礎_演習問題-201.pdf)を012_IT基礎研修_データベース基礎_演習問題と.pdfに分ける正規表現
    const pattern = /^(.*?)-\d+(\..+)$/;

    data.forEach(file => {
            const originalFileName = file[6]//メタデータから取得したオリジナルのファイル名
            const size = file[3] as number;
            const modifiedDate = file[2] as string;
            const doDelete = file[4] as boolean;
            const deleteDate = file[5] as string;
            const fileFormat = file[7] as string;
        
            if (!groupedFiles[originalFileName]) {
                groupedFiles[originalFileName] = { fileName: originalFileName, size: 0, modifiedDate: "", delete:doDelete, deleteDate:"", fileFormat: fileFormat };
            }
            // 各ファイルのサイズを合計します
            groupedFiles[originalFileName].size += size;
            // 各ファイルの最新の日時を更新します
            if (modifiedDate > groupedFiles[originalFileName].modifiedDate) {
                groupedFiles[originalFileName].modifiedDate = modifiedDate;
            }
            // 各ファイルの最新の日時を更新します
            if (deleteDate > groupedFiles[originalFileName].deleteDate) {
                groupedFiles[originalFileName].deleteDate = deleteDate;
            }
        // }
    });
    // グループ化されたファイルの配列を作成します
    const resultList= Object.values(groupedFiles).map(groupedFile => {
        const sizeKb = groupedFile.size //12345
        const sizeMb = sizeKb/1000 //12.345
        return [groupedFile.fileName, groupedFile.modifiedDate, (Math.round(sizeMb)/1000).toFixed(1) + "MB", groupedFile.delete, groupedFile.deleteDate, groupedFile.fileFormat];
    });

    return resultList;
}

type DocRegistrationProps = {  
    addProgressPair: (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles?: { file: File; isUploaded: boolean }[], failedFilesString?: string[]) => void;  
};

const DocRegistration: React.FC<DocRegistrationProps> = ({ addProgressPair }) => {
    const [selectedOption, setSelectedOption] = useState<string>('A3B_FAQ(IT基礎&開発基礎)')
    const [fileinfo, setFileinfo] = useState<SavedFileResponse[]>([]);
    const [selectedRows, setSelectedRows] = useState<Array<SavedFileResponse>>([]);
    const [selectedFilenames, setSelectedFilenames] = useState<{ filename: string }[]>([{ filename: "" }]);
    const [isDeletingParent, setIsDeletingParent] = useState<boolean>(false);
    const [deleteCompParent, setDeleteCompParent] = useState<boolean>(false);
    const [isButtonEnabled, setIsButtonEnabled] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const selectedOptionRequest: SavedFileRequest = {
                    bot: selectedOption
                };
                const response = await savedfileApi(selectedOptionRequest);
                const sumData = summarizeData(response)
                const convertedResult = convertData(sumData);
                setFileinfo(convertedResult);
            } catch (error) {
                console.error("Error fetching data: ", error);
            }
        };
        fetchData();
    }, [selectedOption]);
    
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedOption(event.target.value)
    }

    const handleSelectionChange = (isEnabled: boolean) => {
        setIsButtonEnabled(isEnabled);
    };

    const handleUpdate = async () => {
        try {
            const selectedOptionRequest: SavedFileRequest = {
                bot: selectedOption
            };
            const response = await savedfileApi(selectedOptionRequest);
            const sumData = summarizeData(response)
            const convertedResult = convertData(sumData);
            setFileinfo(convertedResult);
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    }
    
    const handleSelectedRows = useCallback((selected: SavedFileResponse[]) => {
        setSelectedRows(selected);
    },[]);
    
    useEffect(() => {
        const filenames = selectedRows.map(row => {
            // 型アサーションを使用
            // const fileNameComponent = row.filename as unknown as React.ReactElement;
            // const fileName = (fileNameComponent.props.children[1] as React.ReactElement).props.children;
            const fileName = row.filename;
            return ({ filename: fileName })
        });
        setSelectedFilenames(filenames);
    }, [selectedRows]);
    
    const [deleteProgress, setDeleteProgress] = useState<number>(0);

    const makeApiRequest = async (filename: {filename: string}[], bot:string, isDeleting:boolean, deleteComp:boolean) => {
        const executePermission = confirm(bot + "から" + filename[0].filename + "等を本当に削除しますか？")
        if (executePermission) {
            setIsDeletingParent(isDeleting);
            setDeleteCompParent(deleteComp);
            const job_type = "delete"
            const delete_id = generateId()
            try {
                // 1番目のfileの値を取得
                const first_file_name = filename.length > 0 ? filename[0].filename : "";
                addProgressPair(0, delete_id, job_type, bot, false, first_file_name);
                // 進行状況の確認を開始
                const checkProgressPromise = checkProgress(delete_id, (newProgress: number) => {  
                    setDeleteProgress(newProgress);  
                    addProgressPair(newProgress, delete_id, job_type, bot, false, first_file_name);
                });
                const response = await deleteApi(filename, bot, delete_id);
                // checkProgressPromiseの結果を待つ
                const progressResult = await checkProgressPromise;
                const { progress, isComp, failed_files } = progressResult;
                // 進行状況が100未満かつ、失敗したファイルが存在するかを確認
                if (progress < 100 && failed_files && failed_files?.length > 0) {
                    const failed_files_string = failed_files || [];
                    if (failed_files_string.length > 0) {
                        addProgressPair(progress, delete_id, job_type, bot, isComp, first_file_name, undefined, failed_files_string);
                    }
                } else {
                    addProgressPair(progress, delete_id, job_type, bot, isComp, first_file_name);
                }
                    setIsDeletingParent(false);
                    setDeleteCompParent(true);
            } catch (e) {
                alert(`削除処理中にエラーが発生しました: ${e}`);
            } finally {
            }
        }
    };

    // 入力値の状態を定義
    const [inputFilename, setInputFilename] = useState<string>('');

    // 入力が変更されたときに状態を更新
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputFilename(e.target.value); 
    };

    const makeApiRequestForSearch = async (filename: string, bot: string) => {
        try {
            const response = await searchfileApi(filename, bot);
            const sumData = summarizeData(response)
            const convertedResult = convertData(sumData);
            setFileinfo(convertedResult);
        } catch (error) {
            console.error("Error fetching data: ", error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.containerTable}>
                <div className={styles.commandsContainer}>
                    <div className={styles.titleAndSelectArea}>
                        <h3>ドキュメント登録</h3>
                        <div className={styles.botChoiceArea}>
                            <p>Bot選択</p>
                            <select className={styles.botSelectBox} value={selectedOption} onChange={handleChange}>
                                {bots.map((bot, index) => {
                                    return <option key={index} value={bot}>{bot}</option>;
                                })}
                            </select>
                        </div>
                    </div>
                    <div className={styles.updateToLatestButtonArea}>
                        <button onClick={() => handleUpdate()}>
                            <Image src="/update.png" width={20} height={20} alt="update_icon" />
                            <span className={styles.updateString}>
                                最新の状態に更新する
                            </span>
                        </button>
                    </div>
                    <div className={styles.docRegistrationButtonArea}>
                        <DocRegistrationModal {...{bot:selectedOption}} addProgressPair={addProgressPair} /> 
                    </div>
                    <div className={styles.registrationDeletionArea}>
                        <button  disabled={!isButtonEnabled} onClick={() => makeApiRequest(selectedFilenames, selectedOption, true, false)}>一括削除</button>
                    </div>
                </div>
                <form className={styles.registrationSearchArea} onSubmit={(e) => e.preventDefault()}>
                    <button aria-label="検索" onClick={() => makeApiRequestForSearch(inputFilename, selectedOption)}></button>
                    <label>
                        <input
                            type="text"
                            placeholder='ファイル名で検索'
                            value={inputFilename}
                            onChange={handleInputChange}
                        />
                    </label>
                </form>
                <hr className={styles.border}></hr>
                <div className={styles.displayRegisteredDataArea}>
                    <section>
                        <Table 
                            columns={columns} 
                            data={fileinfo} 
                            callback={handleSelectedRows} 
                            bot={selectedOption} 
                            setIsDeleting={setIsDeletingParent} 
                            isDeleting={isDeletingParent} 
                            setDeleteComp={setDeleteCompParent} 
                            deleteComp={deleteCompParent}
                            addProgressPair={addProgressPair}
                            onSelectionChange={handleSelectionChange}
                        />
                    </section>
                </div>
            </div>
        </div>
    )
}

export default DocRegistration