import styles from './DocRegistration.module.css';
import DocRegistrationModal from '@/components/DocRegistrationModal';
import React, { useState, useEffect } from "react";
import { useTable, useSortBy } from "react-table";
import { uploadApi } from "../../api";
import Table from "../../components/Table/Table"
import { SevedFileResponse, savedfileApi, SevedFileRequest } from "../../api";

const bots = ["幕張トライアル", "新卒オープン", "運営マニュアル"];

const columns = [
    {
        Header: "□",
        accessor: "check"
    },
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
    {
        Header: "🚮",
        accessor: "delete"
    }
];

const convertData = (data: []): SevedFileResponse[] => {
    return data.map(item  => {
        return{
            filename: item[0],
            creation_time: item[1],
            last_modified: item[2],
            size: item[3],
            deleted: item[4],
            deleted_time: item[5],
            error: item[6]
        };
    });
}
const DocRegistration = () => {
    const [selectedOption, setSelectedOption] = useState<string>('幕張トライアル')
    const [fileinfo, setFileinfo] = useState<SevedFileResponse[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            try {
                const selectedOptionRequest: SevedFileRequest = {
                    bot: selectedOption
                };
                const response = await savedfileApi(selectedOptionRequest);
                
                const convertedResult = convertData(response);
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
                            <Table tableColumns={columns} bot={fileinfo} />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DocRegistration