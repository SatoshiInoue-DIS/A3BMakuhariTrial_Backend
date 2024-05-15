import styles from './DocRegistration.module.css';
import DocRegistrationModal from '@/components/DocRegistrationModal';
import React, { useState, useEffect } from "react";
import { Column } from "react-table";
import Table from "../../components/Table/Table"
import { SevedFileResponse, savedfileApi, SevedFileRequest } from "../../api";

const bots = ["幕張トライアル", "新卒オープン", "運営マニュアル"];

const columns: Array<Column<SevedFileResponse>> = 
[
    {
        Header: "ファイル名",
        accessor: "filename"
    },
    {
        Header: "最新更新日",
        accessor: "last_modified"
    },
    {
        Header: "サイズ",
        accessor: "size"
    },
];

//summarizeDataでまとめたデータをSevedFileResponse[]に当てはめていく
const convertData = (data: []): SevedFileResponse[] => {
    return data.map(item => {
        return{
            filename: item[0],
            last_modified: item[1],
            size: item[2],
            delete: item[3],
        };
    });
};

// ファイル名を処理してファイル名ごとにグループ化し、合計サイズと最新の日時を計算する
const summarizeData = (data: []): any => {
    const groupedFiles: { [key: string]: { fileName: string; size: number; modifiedDate: string; delete: boolean; deleteDate: string } } = {};
    //ファイル名(例えば012_IT基礎研修_データベース基礎_演習問題-201.pdf)を012_IT基礎研修_データベース基礎_演習問題と.pdfに分ける正規表現
    const pattern = /^(.*?)-\d+(\..+)$/;

    data.forEach(file => {
        const fileNameParts = (file[0] as string).match(pattern); // ファイル名を「-」と「拡張子」で分割する
        if (fileNameParts) {
            const baseFileName = fileNameParts[1];// 拡張子の前の部分を取得「012_IT基礎研修_データベース基礎_演習問題」
            const extensionName = fileNameParts[2];//拡張子を取得「.pdf」
        
            // const baseFileName = fileNameParts[1] // 拡張子の前の部分を取得
            const size = file[3] as number;
            const modifiedDate = file[2] as string;
            const doDelete = file[3] as boolean;
            const deleteDate = file[4] as string
        
            // グループ化されたファイル名がすでに存在するかどうかを確認し、更に拡張子も存在しない場合は新しいオブジェクトを作成します
            if (!groupedFiles[baseFileName]) {
                if(!groupedFiles[extensionName]) {
                    if(doDelete) {
                        groupedFiles[baseFileName] = { fileName: baseFileName + extensionName, size: 0, modifiedDate: "", delete:doDelete, deleteDate:"" };
                    } else {
                        groupedFiles[baseFileName] = { fileName: baseFileName + extensionName, size: 0, modifiedDate: "", delete:doDelete, deleteDate:"" };
                    }
                }
            }
            // 各ファイルのサイズを合計します
            groupedFiles[baseFileName].size += size;
            // 各ファイルの最新の日時を更新します
            if (modifiedDate > groupedFiles[baseFileName].modifiedDate) {
                groupedFiles[baseFileName].modifiedDate = modifiedDate;
            }
            // 各ファイルの最新の日時を更新します
            if (deleteDate > groupedFiles[baseFileName].deleteDate) {
                groupedFiles[baseFileName].deleteDate = deleteDate;
            }
        }
    });
    // グループ化されたファイルの配列を作成します
    const resultList= Object.values(groupedFiles).map(groupedFile => {
        const sizeKb = groupedFile.size //12345
        const sizeMb = sizeKb/1000 //12.345
        return [groupedFile.fileName, groupedFile.modifiedDate, (Math.round(sizeMb)/1000).toFixed(1) + "MB", groupedFile.delete, groupedFile.deleteDate];
    });

    return resultList;
}

const DocRegistration = () => {
    const [selectedOption, setSelectedOption] = useState<string>('幕張トライアル')
    const [fileinfo, setFileinfo] = useState<SevedFileResponse[]>([]);
    const [selected, setSelected] = useState<Array<SevedFileResponse>>([]);

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
                    <div className={styles.docRegistrationButtonArea}>
                        <DocRegistrationModal {...{bot:selectedOption}}/>
                    </div>
                    <div className={styles.registrationDeletionArea}>
                        <button>一括削除</button>
                    </div>
                </div>
                <hr className={styles.border}></hr>
                <div>
                    <div className={styles.displayRegisteredDataArea}>
                        <section>
                            {/* <Table tableColumns={columns} files={fileinfo} /> */}
                            <Table columns={columns} data={fileinfo} callback={setSelected} bot={selectedOption}/>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DocRegistration