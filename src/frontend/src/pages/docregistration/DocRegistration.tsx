import styles from './DocRegistration.module.css';
import DocRegistrationModal from '@/components/DocRegistrationModal';
import React, { useState, useEffect, useCallback } from "react";
import { Column } from "react-table";
import Table from "../../components/Table/Table"
import { SevedFileResponse, savedfileApi, SevedFileRequest, deleteApi, generateId, checkProgress } from "../../api";
import { stringify } from 'querystring';
import path from "path";
import Image from "next/image"

const bots = ["テスト", "テスト", "テスト"];

const columns: Array<Column<SevedFileResponse>> = 
[
    {
        Header: "ファイル名",
        accessor: "filename"
    },
    {
        Header: "サイズ",
        accessor: "size"
    },
    {
        Header: "最新更新日",
        accessor: "last_modified"
    },
];

//summarizeDataでまとめたデータをSevedFileResponse[]に当てはめていく
const convertData = (data: []): SevedFileResponse[] => {
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
        const fileitem = addDocIcon(filename, extension)
        return{
            filename: fileitem,
            last_modified: jstDateString,
            size: item[2],
            delete: item[3],
        };
    });
};

const addDocIcon = (filename: string, extension: string): any => {
    switch (extension) {
        case ".pdf":
            return (
                <div className={styles.fileitems}>
                    <Image src="./pdf_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".doc":
        case ".docx":
            return (
                <div className={styles.fileitems}>
                    <Image src="./word_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".xls":
        case ".xlsx":
            return (
                <div className={styles.fileitems}>
                    <Image src="./excel_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".ppt":
        case ".pptx":
            return (
                <div className={styles.fileitems}>
                    <Image src="./powerpoint_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".txt":
            return (
                <div className={styles.fileitems}>
                    <Image src="./text_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".png":
            return (
                <div className={styles.fileitems}>
                    <Image src="./png_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        case ".jpg":
        case ".jpeg":
            return (
                <div className={styles.fileitems}>
                    <Image src="./jpg_icon.png" width={40} height={30} alt='pdf'></Image>
                    <p>{filename}</p>
                </div>
            );
        default:
            return filename; 
    }
}

// ファイル名を処理してファイル名ごとにグループ化し、合計サイズと最新の日時を計算する
const summarizeData = (data: []): any => {
    const groupedFiles: { [key: string]: { fileName: string; size: number; modifiedDate: string; delete: boolean; deleteDate: string } } = {};
    //ファイル名(例えば012_IT基礎研修_データベース基礎_演習問題-201.pdf)を012_IT基礎研修_データベース基礎_演習問題と.pdfに分ける正規表現
    const pattern = /^(.*?)-\d+(\..+)$/;

    data.forEach(file => {
            const originalFileName = file[6]//メタデータから取得したオリジナルのファイル名
            const size = file[3] as number;
            const modifiedDate = file[2] as string;
            const doDelete = file[4] as boolean;
            const deleteDate = file[5] as string
        
            if (!groupedFiles[originalFileName]) {
                groupedFiles[originalFileName] = { fileName: originalFileName, size: 0, modifiedDate: "", delete:doDelete, deleteDate:"" };
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
        return [groupedFile.fileName, groupedFile.modifiedDate, (Math.round(sizeMb)/1000).toFixed(1) + "MB", groupedFile.delete, groupedFile.deleteDate];
    });

    return resultList;
}

type DocRegistrationProps = {  
    addProgressPair: (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles?: { file: File; isUploaded: boolean }[], failedFilesString?: string[]) => void;  
};

const DocRegistration: React.FC<DocRegistrationProps> = ({ addProgressPair }) => {
    const [selectedOption, setSelectedOption] = useState<string>('テスト')
    const [fileinfo, setFileinfo] = useState<SevedFileResponse[]>([]);
    const [selectedRows, setSelectedRows] = useState<Array<SevedFileResponse>>([]);
    const [selectedFilenames, setSelectedFilenames] = useState<{ filename: string }[]>([{ filename: "" }]);
    const [isDeletingParent, setIsDeletingParent] = useState<boolean>(false);
    const [deleteCompParent, setDeleteCompParent] = useState<boolean>(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const selectedOptionRequest: SevedFileRequest = {
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

    const handleUpdate = async () => {
        try {
            const selectedOptionRequest: SevedFileRequest = {
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
    
    const handleSelectedRows = useCallback((selected: SevedFileResponse[]) => {
        setSelectedRows(selected);
    },[]);
    
    useEffect(() => {
        const filenames = selectedRows.map(row => {
            // 型アサーションを使用
            const fileNameComponent = row.filename as unknown as React.ReactElement;
            const fileName = (fileNameComponent.props.children[1] as React.ReactElement).props.children;
            return ({ filename: fileName })
        });
        setSelectedFilenames(filenames);
    }, [selectedRows]);
    
    const [deleteProgress, setDeleteProgress] = useState<number>(0);

    const makeApiRequest = async (filename: {filename: string}[], bot:string, isDeleting:boolean, deleteComp:boolean) => {
        const executePermission = confirm("本当に削除しますか？")
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
                        <button onClick={() => makeApiRequest(selectedFilenames, selectedOption, true, false)}>一括削除</button>
                    </div>
                </div>
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
                        />
                    </section>
                </div>
            </div>
        </div>
    )
}

export default DocRegistration